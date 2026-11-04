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
        title: `Considera reducir el volumen de ${muscle}`,
        rationale:
          "El volumen de repeticiones semanal de este músculo supera un límite orientativo. Es una heurística conservadora, no un diagnóstico — si la recuperación se siente bien quizá estés bien; de lo contrario, reducir el volumen o añadir un día de recuperación puede ayudar.",
        evidence: [
          `Volumen de repeticiones semanal de ${muscle}: ${round1(volume)} (umbral ${HIGH_VOLUME_THRESHOLD}).`,
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
        ? `Reduce la carga en ${e.key} y reconstruye`
        : `Mantén la carga en ${e.key} y prioriza la recuperación`,
      rationale:
        "Basado en la propia decisión de la regla de progresión para este ejercicio (nunca aumenta la carga solo por las repeticiones). Tómalo como orientación para la próxima sesión, no como una garantía.",
      evidence: [`${e.key}: acción de progresión ${p.action} — ${p.rationale}`],
      severity: reduce ? "warning" : "info",
    });
  }

  const hasProgression = input.exercises.some((e) => e.progression != null);
  if (!hasProgression && !hasVolume) {
    insufficientData.push(
      "No hay datos suficientes para consejos de recuperación/volumen — registra sesiones con repeticiones y recuperación para poder calcular el volumen por músculo y una decisión de progresión.",
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
      title: `${e.key} parece estancado — prueba una descarga o un cambio de esquema de repeticiones`,
      rationale:
        "El 1RM estimado apenas se movió en la ventana reciente, lo que puede indicar un estancamiento. Es una lectura heurística de tus series registradas, no una certeza — una descarga, un cambio de esquema de repeticiones o una revisión de técnica son respuestas razonables.",
      evidence: [
        `${e.key}: 1RM estimado ${round1(p.startE1rm)} → ${round1(p.endE1rm)} kg (${round1(p.improvementPct)}% de cambio en la ventana).`,
      ],
      severity: "info",
    });
  }

  if (withPlateau.length === 0) {
    insufficientData.push(
      "No hay datos suficientes para evaluar ejercicios estancados — registra un ejercicio a lo largo de varias sesiones para poder evaluar una ventana de estancamiento.",
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
      "No hay datos suficientes para evaluar la adherencia al entrenamiento — activa un plan con días programados y registra sesiones para poder medir la adherencia.",
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
      title: "Tu adherencia reciente al entrenamiento",
      rationale:
        "Un cálculo directo a partir de tus días de entrenamiento programados vs. completados — un hecho, no una sugerencia.",
      evidence: [`Adherencia al programa: ${round1(pct)}% (umbral ${LOW_ADHERENCE_THRESHOLD}%).`],
      severity: "info",
    });
    recommendations.push({
      id: "adherence:reduce-days",
      basis: "rule",
      category: "adherence",
      title: "Considera menos días de entrenamiento planificados",
      rationale:
        "La adherencia está por debajo de un umbral conservador. Programar menos días, más alcanzables, suele ser mejor que un plan ambicioso que no puedes cumplir — esto es orientación, no una regla que debas seguir.",
      evidence: [`La adherencia medida del ${round1(pct)}% está por debajo del ${LOW_ADHERENCE_THRESHOLD}%.`],
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
      "No hay datos suficientes para consejos de nutrición — configura tu perfil (peso, altura, edad, sexo, actividad, objetivo) y registra comidas para poder calcular un objetivo.",
    );
    return { recommendations, insufficientData };
  }

  // SAFETY GATE: a professional-review situation suppresses ALL numeric advice.
  if (n.professionalReviewRequired) {
    recommendations.push({
      id: "nutrition:professional-review",
      basis: "rule",
      category: "nutrition",
      title: "Consulta a un profesional cualificado antes de cambiar tu nutrición",
      rationale:
        "Tu perfil señala una situación en la que el cálculo automático de calorías está desactivado por seguridad. No se muestra ningún consejo numérico de nutrición — por favor, trabaja con un profesional cualificado.",
      evidence: ["Hay una restricción de seguridad (se requiere revisión profesional) activa en tu objetivo de calorías."],
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
      title: "Tu objetivo de calorías ya está en tu límite de seguridad",
      rationale:
        "El déficit solicitado se redujo para respetar tu límite de TMB, así que no se recomienda comer menos. Si el progreso se ha estancado, ajústalo mediante el entrenamiento o la actividad en lugar de recortar más las calorías.",
      evidence: ["El objetivo de calorías se ajustó al límite de la TMB (clampedToFloor = true)."],
      severity: "info",
    });
  }

  // Low compliance -> a gentle, non-numeric prompt to tighten consistency.
  if (compliance != null && compliance < LOW_TARGET_COMPLIANCE_THRESHOLD) {
    recommendations.push({
      id: "nutrition:compliance",
      basis: "rule",
      category: "nutrition",
      title: "Mejora la constancia de tu nutrición",
      rationale:
        "Menos de la mayoría de tus días registrados cayeron dentro de tu banda objetivo. La constancia suele importar más que cualquier día aislado — esto es un aviso heurístico, no una prescripción.",
      evidence: [
        `Cumplimiento del objetivo: ${round1(compliance)}% de los días registrados dentro del objetivo (umbral ${LOW_TARGET_COMPLIANCE_THRESHOLD}%).`,
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
        title: "Estás comiendo por debajo de tu objetivo de calorías",
        rationale:
          "En un día reciente típico tu consumo quedó por debajo del objetivo. Acercar el consumo hacia el objetivo puede ayudar — ajústalo de forma gradual y con alimentos integrales. Orientación heurística, no una prescripción.",
        evidence: [`Las calorías recientes estuvieron unas ${absKcal} kcal por debajo del objetivo.`],
        severity: "info",
      });
    } else if (delta > 0 && !n.clampedToFloor) {
      // Only suggest trimming intake when the target is NOT already at the floor.
      recommendations.push({
        id: "nutrition:calorie-over",
        basis: "rule",
        category: "nutrition",
        title: "Estás comiendo por encima de tu objetivo de calorías",
        rationale:
          "En un día reciente típico tu consumo quedó por encima del objetivo. Una reducción moderada hacia el objetivo puede ayudar — orientación heurística, no una prescripción.",
        evidence: [`Las calorías recientes estuvieron unas ${absKcal} kcal por encima del objetivo.`],
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
      title: "Prioriza la proteína",
      rationale:
        "El consumo reciente de proteína quedó por debajo del objetivo. Alcanzar la proteína favorece la recuperación y la retención muscular — orientación heurística, no una prescripción.",
      evidence: [`La proteína reciente estuvo unos ${absG} g por debajo del objetivo.`],
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
