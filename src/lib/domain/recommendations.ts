/**
 * Adaptive recommendations ENGINE for FitMind AI (Phase 6).
 *
 * Pure and framework-free: this module imports ONLY from `./types` and the
 * TYPES of `./training` / `./stats` / `./nutrition`; it has NO Prisma, React or
 * Next dependency, so it is trivially unit-testable. It takes ALREADY-COMPUTED
 * inputs (volumes, adherence %, target-compliance %, plateau / progression
 * results, calorie / macro deltas, nutrition safety signals) and turns them
 * into typed recommendations. It NEVER re-derives the training or nutrition
 * math — that lives in `training.ts` / `nutrition.ts` / `stats.ts`, the single
 * sources of truth — and it NEVER fabricates data: a missing input becomes an
 * explicit `insufficientData` message, not an invented recommendation.
 *
 * Every recommendation carries its `basis` (calculation | rule | ai) and a
 * `rationale` that keeps the uncertainty explicit: a heuristic is presented as
 * a heuristic, never as a proven fact. AI recommendations are produced
 * elsewhere (the flag-gated seam) and only ever appended AFTER these items;
 * this engine itself emits only `calculation` and `rule` bases.
 */
import type { MuscleGroup } from "./types-training";
import type { PlateauResult, ProgressionResult } from "./training";

/** How a recommendation was produced. */
export type RecommendationBasis = "calculation" | "rule" | "ai";

/** Severity of a recommendation (drives the UI emphasis). */
export type RecommendationSeverity = "info" | "warning" | "critical";

/** The area a recommendation belongs to. */
export type RecommendationCategory =
  | "recovery_volume"
  | "stalled_exercise"
  | "adherence"
  | "nutrition";

/** A single typed recommendation with its evidence and rationale. */
export interface Recommendation {
  /** Stable, deterministic id (category + a stable key). */
  id: string;
  basis: RecommendationBasis;
  category: RecommendationCategory;
  title: string;
  /** Why this is suggested, written so the uncertainty stays explicit. */
  rationale: string;
  /** The concrete, already-computed facts this recommendation rests on. */
  evidence: string[];
  severity: RecommendationSeverity;
}

/** One exercise's already-computed plateau / progression assessment. */
export interface ExerciseSignal {
  /** The exercise's catalog name / stable key. */
  key: string;
  /** Plateau assessment, or null when there was not enough history. */
  plateau: PlateauResult | null;
  /** Progression suggestion, or null when the domain rule withheld a call. */
  progression: ProgressionResult | null;
}

/** Already-computed nutrition signals (deltas are consumed − target). */
export interface NutritionSignal {
  /** True when the calorie target already sits at the BMR floor. */
  clampedToFloor: boolean;
  /** True when a safety gate requires a qualified professional. */
  professionalReviewRequired: boolean;
  /** Consumed − target calories (kcal); null when not computable. */
  calorieDelta: number | null;
  /** Consumed − target protein (g); null when not computable. */
  proteinDeltaG: number | null;
}

/**
 * Everything the engine needs, ALREADY computed by the services from the
 * domain single-sources-of-truth. Nulls mean "not available" — the engine
 * turns them into insufficient-data notes rather than guessing.
 */
export interface EngineInput {
  /** Per-muscle rep-volume, or null when no volume could be computed. */
  volumeByMuscle: Partial<Record<MuscleGroup, number>> | null;
  /** Program adherence percentage (0..100), or null when unavailable. */
  adherencePct: number | null;
  /** Nutrition target-compliance percentage (0..100), or null. */
  targetCompliancePct: number | null;
  /** Per-exercise plateau / progression assessments (already computed). */
  exercises: ExerciseSignal[];
  /** Nutrition signals, or null when no profile-derived target exists. */
  nutrition: NutritionSignal | null;
}

/** The engine output: rule/calculation recommendations + honest data gaps. */
export interface RecommendationReport {
  recommendations: Recommendation[];
  /** Human-readable notes for inputs that were missing (never fabricated). */
  insufficientData: string[];
}

// ---------------------------------------------------------------------------
// Documented threshold constants. These are conservative heuristics, not
// proven facts; the rationale text each rule emits says so.
// ---------------------------------------------------------------------------

/**
 * Per-muscle weekly rep-volume above which we flag a recovery/volume review.
 * Rep-volume = Σ(sets × reps) per muscle (see `calculateTrainingVolume`). This
 * is an orientational ceiling, deliberately high, not a hard limit.
 */
export const HIGH_VOLUME_THRESHOLD = 200;

/**
 * Training-adherence percentage below which we suggest trimming planned days to
 * a more sustainable number. Documented, conservative.
 */
export const LOW_ADHERENCE_THRESHOLD = 70;

/**
 * Nutrition target-compliance percentage below which we surface a nutrition
 * adjustment prompt. Documented, conservative.
 */
export const LOW_TARGET_COMPLIANCE_THRESHOLD = 70;

/** Rounds to at most one decimal place for human-readable evidence. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Rule (a): recovery / volume.
// ---------------------------------------------------------------------------

/**
 * From progression results that are HOLD/DECREASE (poor recovery / short reps)
 * and/or per-muscle volume beyond `HIGH_VOLUME_THRESHOLD`, emit rule-based
 * recommendations to REDUCE volume or prioritize recovery. It NEVER recommends
 * blindly increasing load: the progression call is REUSED from
 * `suggestProgression`, never re-derived. When there is neither progression
 * data nor a volume map, a single insufficient-data note is produced.
 */
function recoveryVolumeRule(input: EngineInput): {
  recommendations: Recommendation[];
  insufficientData: string[];
} {
  const recommendations: Recommendation[] = [];
  const insufficientData: string[] = [];

  const volumeEntries = input.volumeByMuscle
    ? (Object.entries(input.volumeByMuscle) as [MuscleGroup, number][]).filter(
        ([, v]) => typeof v === "number",
      )
    : [];
  const hasVolume = input.volumeByMuscle != null;

  for (const [muscle, volume] of volumeEntries) {
    if (volume > HIGH_VOLUME_THRESHOLD) {
      recommendations.push({
        id: `recovery_volume:volume:${muscle}`,
        basis: "rule",
        category: "recovery_volume",
        title: `Consider reducing ${muscle} volume`,
        rationale:
          "Weekly rep-volume for this muscle is above an orientational ceiling. This is a conservative heuristic, not a diagnosis — if recovery feels fine you may be fine; otherwise trimming volume or adding a recovery day can help.",
        evidence: [
          `${muscle} weekly rep-volume: ${round1(volume)} (threshold ${HIGH_VOLUME_THRESHOLD}).`,
        ],
        severity: "info",
      });
    }
  }

  // Reuse the already-computed progression calls; never re-derive a load call.
  const holdOrDecrease = input.exercises.filter(
    (e) => e.progression != null && e.progression.action !== "INCREASE",
  );
  for (const e of holdOrDecrease) {
    const p = e.progression!;
    const reduce = p.action === "DECREASE";
    recommendations.push({
      id: `recovery_volume:progression:${e.key}`,
      basis: "rule",
      category: "recovery_volume",
      title: reduce
        ? `Reduce load on ${e.key} and rebuild`
        : `Hold load on ${e.key} and prioritize recovery`,
      rationale:
        "Based on the progression rule's own decision for this exercise (it never increases load from reps alone). Treat it as guidance for the next session, not a guarantee.",
      evidence: [`${e.key}: progression action ${p.action} — ${p.rationale}`],
      severity: reduce ? "warning" : "info",
    });
  }

  const hasProgression = input.exercises.some((e) => e.progression != null);
  if (!hasProgression && !hasVolume) {
    insufficientData.push(
      "Not enough data for recovery/volume advice — log sessions with reps and recovery so per-muscle volume and a progression call can be computed.",
    );
  }

  return { recommendations, insufficientData };
}

// ---------------------------------------------------------------------------
// Rule (b): stalled exercises.
// ---------------------------------------------------------------------------

/**
 * For each exercise whose `plateau.isPlateau` is true, emit a rule-based
 * recommendation (deload / change rep scheme / technique check) with evidence
 * citing the improvement % and the start/end estimated 1RM. When NONE of the
 * exercises carry plateau data, a single insufficient-data note is produced.
 */
function stalledExerciseRule(input: EngineInput): {
  recommendations: Recommendation[];
  insufficientData: string[];
} {
  const recommendations: Recommendation[] = [];
  const insufficientData: string[] = [];

  const withPlateau = input.exercises.filter((e) => e.plateau != null);
  for (const e of withPlateau) {
    const p = e.plateau!;
    if (!p.isPlateau) continue;
    recommendations.push({
      id: `stalled_exercise:${e.key}`,
      basis: "rule",
      category: "stalled_exercise",
      title: `${e.key} looks stalled — try a deload or rep-scheme change`,
      rationale:
        "Estimated 1RM barely moved across the recent window, which can signal a plateau. This is a heuristic read of your logged sets, not a certainty — a deload, a change of rep scheme, or a technique check are reasonable responses.",
      evidence: [
        `${e.key}: estimated 1RM ${round1(p.startE1rm)} → ${round1(p.endE1rm)} kg (${round1(p.improvementPct)}% change over the window).`,
      ],
      severity: "info",
    });
  }

  if (withPlateau.length === 0) {
    insufficientData.push(
      "Not enough data to assess stalled exercises — log an exercise across several sessions so a plateau window can be evaluated.",
    );
  }

  return { recommendations, insufficientData };
}

// ---------------------------------------------------------------------------
// Rule (c): low training adherence.
// ---------------------------------------------------------------------------

/**
 * When `adherencePct` is a number below `LOW_ADHERENCE_THRESHOLD`, emit a
 * rule-based recommendation to reduce planned days to a sustainable number, and
 * attach the adherence percentage as a `calculation`-basis companion fact. When
 * `adherencePct` is null, produce an insufficient-data note (NEVER a fabricated
 * percentage).
 */
function adherenceRule(input: EngineInput): {
  recommendations: Recommendation[];
  insufficientData: string[];
} {
  const recommendations: Recommendation[] = [];
  const insufficientData: string[] = [];

  if (input.adherencePct == null) {
    insufficientData.push(
      "Not enough data to assess training adherence — activate a plan with scheduled days and log sessions so adherence can be measured.",
    );
    return { recommendations, insufficientData };
  }

  const pct = input.adherencePct;
  if (pct < LOW_ADHERENCE_THRESHOLD) {
    // Companion fact: the measured percentage itself (a calculation, not a rule).
    recommendations.push({
      id: "adherence:measured",
      basis: "calculation",
      category: "adherence",
      title: "Your recent training adherence",
      rationale:
        "A direct calculation from your scheduled vs completed training days — a fact, not a suggestion.",
      evidence: [`Program adherence: ${round1(pct)}% (threshold ${LOW_ADHERENCE_THRESHOLD}%).`],
      severity: "info",
    });
    recommendations.push({
      id: "adherence:reduce-days",
      basis: "rule",
      category: "adherence",
      title: "Consider fewer planned training days",
      rationale:
        "Adherence is below a conservative threshold. Scheduling fewer, more achievable days often beats an ambitious plan you cannot keep — this is guidance, not a rule you must follow.",
      evidence: [`Measured adherence ${round1(pct)}% is below ${LOW_ADHERENCE_THRESHOLD}%.`],
      severity: "warning",
    });
  }

  return { recommendations, insufficientData };
}

// ---------------------------------------------------------------------------
// Rule (d): nutrition gaps (with safety gates).
// ---------------------------------------------------------------------------

/**
 * From `targetCompliancePct` + calorie/macro deltas, emit reasonable nutrition
 * adjustments. SAFETY FIRST:
 *  - when `professionalReviewRequired` is true, emit a SINGLE consult-a-professional
 *    recommendation (severity 'critical') and SUPPRESS all numeric advice;
 *  - when `clampedToFloor` is true, state the target already sits at the BMR
 *    floor and NEVER recommend eating less (the floor is respected).
 * When `nutrition` is null, produce an insufficient-data note.
 */
function nutritionRule(input: EngineInput): {
  recommendations: Recommendation[];
  insufficientData: string[];
} {
  const recommendations: Recommendation[] = [];
  const insufficientData: string[] = [];

  const n = input.nutrition;
  if (n == null) {
    insufficientData.push(
      "Not enough data for nutrition advice — set up your profile (weight, height, age, sex, activity, goal) and log meals so a target can be computed.",
    );
    return { recommendations, insufficientData };
  }

  // SAFETY GATE: a professional-review situation suppresses ALL numeric advice.
  if (n.professionalReviewRequired) {
    recommendations.push({
      id: "nutrition:professional-review",
      basis: "rule",
      category: "nutrition",
      title: "Consult a qualified professional before changing your nutrition",
      rationale:
        "Your profile flags a situation where automatic calorie targeting is disabled for safety. No numeric nutrition advice is shown — please work with a qualified professional.",
      evidence: ["A safety gate (professional review required) is active on your calorie target."],
      severity: "critical",
    });
    return { recommendations, insufficientData };
  }

  const compliance = input.targetCompliancePct;

  // The BMR floor means we must NEVER suggest eating less, regardless of deltas.
  if (n.clampedToFloor) {
    recommendations.push({
      id: "nutrition:floor",
      basis: "rule",
      category: "nutrition",
      title: "Your calorie target already sits at your safety floor",
      rationale:
        "The requested deficit was reduced to respect your BMR floor, so eating less is not recommended. If progress has stalled, adjust through training or activity rather than cutting calories further.",
      evidence: ["Calorie target was clamped to the BMR floor (clampedToFloor = true)."],
      severity: "info",
    });
  }

  // Low compliance -> a gentle, non-numeric prompt to tighten consistency.
  if (compliance != null && compliance < LOW_TARGET_COMPLIANCE_THRESHOLD) {
    recommendations.push({
      id: "nutrition:compliance",
      basis: "rule",
      category: "nutrition",
      title: "Tighten nutrition consistency",
      rationale:
        "Fewer than most of your logged days hit your target band. Consistency usually matters more than any single day — this is a heuristic prompt, not a prescription.",
      evidence: [
        `Target compliance: ${round1(compliance)}% of logged days on target (threshold ${LOW_TARGET_COMPLIANCE_THRESHOLD}%).`,
      ],
      severity: "info",
    });
  }

  // Calorie delta advice — but only an "eat MORE" direction is ever suggested
  // when the target is at the floor; otherwise both directions are allowed.
  if (n.calorieDelta != null) {
    const delta = n.calorieDelta; // consumed − target
    const absKcal = Math.abs(round1(delta));
    if (delta < 0) {
      // Consuming under target -> it is always safe to suggest eating a bit more.
      recommendations.push({
        id: "nutrition:calorie-under",
        basis: "rule",
        category: "nutrition",
        title: "You are eating under your calorie target",
        rationale:
          "On a typical recent day your intake sat below target. Nudging intake up toward target can help — adjust gradually and with whole foods. Heuristic guidance, not a prescription.",
        evidence: [`Recent calories ran about ${absKcal} kcal below target.`],
        severity: "info",
      });
    } else if (delta > 0 && !n.clampedToFloor) {
      // Only suggest trimming intake when the target is NOT already at the floor.
      recommendations.push({
        id: "nutrition:calorie-over",
        basis: "rule",
        category: "nutrition",
        title: "You are eating over your calorie target",
        rationale:
          "On a typical recent day your intake sat above target. A modest reduction toward target can help — heuristic guidance, not a prescription.",
        evidence: [`Recent calories ran about ${absKcal} kcal above target.`],
        severity: "info",
      });
    }
  }

  // Protein under target -> suggest prioritizing protein (never a safety issue).
  if (n.proteinDeltaG != null && n.proteinDeltaG < 0) {
    const absG = Math.abs(round1(n.proteinDeltaG));
    recommendations.push({
      id: "nutrition:protein-under",
      basis: "rule",
      category: "nutrition",
      title: "Prioritize protein",
      rationale:
        "Recent protein intake sat below target. Hitting protein supports recovery and muscle retention — heuristic guidance, not a prescription.",
      evidence: [`Recent protein ran about ${absG} g below target.`],
      severity: "info",
    });
  }

  return { recommendations, insufficientData };
}

/**
 * Composes the four pure rules into one report. Recommendations keep their
 * deterministic ids and declared basis; `insufficientData` collects the honest
 * gaps so the UI can show a "not enough data" state instead of a fabricated
 * recommendation.
 */
export function buildRecommendations(input: EngineInput): RecommendationReport {
  const parts = [
    recoveryVolumeRule(input),
    stalledExerciseRule(input),
    adherenceRule(input),
    nutritionRule(input),
  ];

  const recommendations = parts.flatMap((p) => p.recommendations);
  const insufficientData = parts.flatMap((p) => p.insufficientData);

  return { recommendations, insufficientData };
}
