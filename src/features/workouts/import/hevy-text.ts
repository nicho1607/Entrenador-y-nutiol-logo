/**
 * Parses a Hevy routine copied from its public share page (hevy.com/routine/…,
 * select all → copy). The page shows each exercise as its name followed by a
 * summary line, in the viewer's language:
 *
 *   Press de Banca (Barra)
 *   5 series · 6-12 repeticiones
 *
 * (English: "5 sets · 6-12 reps".) Navigation text around the routine is
 * ignored. Exercise names are resolved to the catalog via a table of known
 * Hevy exercises (Spanish and English titles), then the generic title matcher;
 * anything else is kept under its pasted name with a muscle guessed from
 * keywords, and added to the catalog on save.
 *
 * Pure: no I/O. The result is one plan with one day (the routine).
 */
import type { Equipment, MuscleGroup } from "@prisma/client";
import type { ImportResult, NormalizedWorkoutExercise, RejectedRow } from "./types";

interface KnownHevyExercise {
  titles: string[];
  /** Existing catalog name, or the new catalog name to create. */
  name: string;
  /** Present only for exercises the catalog does not have yet. */
  create?: { muscle: MuscleGroup; equipment: Equipment[] };
}

const KNOWN: KnownHevyExercise[] = [
  { titles: ["Press de Banca (Barra)", "Bench Press (Barbell)"], name: "Barbell Bench Press" },
  {
    titles: ["Press de Banca (Mancuerna)", "Bench Press (Dumbbell)"],
    name: "Dumbbell Bench Press",
  },
  {
    titles: ["Press de Banca Inclinado (Mancuerna)", "Incline Bench Press (Dumbbell)"],
    name: "Incline Dumbbell Press",
  },
  {
    titles: ["Elevación Lateral (Mancuerna)", "Lateral Raise (Dumbbell)"],
    name: "Dumbbell Lateral Raise",
  },
  {
    titles: ["Press de Hombros (Mancuerna)", "Shoulder Press (Dumbbell)"],
    name: "Seated Dumbbell Shoulder Press",
  },
  { titles: ["Sentadilla (Barra)", "Squat (Barbell)"], name: "Barbell Back Squat" },
  { titles: ["Peso Muerto (Barra)", "Deadlift (Barbell)"], name: "Barbell Deadlift" },
  {
    titles: ["Peso Muerto Rumano (Barra)", "Romanian Deadlift (Barbell)"],
    name: "Romanian Deadlift",
  },
  { titles: ["Prensa de Piernas (Máquina)", "Leg Press (Machine)"], name: "Leg Press" },
  { titles: ["Dominadas", "Pull Up"], name: "Pull-Up" },
  { titles: ["Flexiones", "Push Up"], name: "Push-Up" },
  { titles: ["Jalón al Pecho (Cable)", "Lat Pulldown (Cable)"], name: "Lat Pulldown" },
  { titles: ["Curl de Bíceps (Barra)", "Bicep Curl (Barbell)"], name: "Barbell Curl" },
  { titles: ["Curl de Bíceps (Mancuerna)", "Bicep Curl (Dumbbell)"], name: "Dumbbell Curl" },
  { titles: ["Curl Martillo (Mancuerna)", "Hammer Curl (Dumbbell)"], name: "Hammer Curl" },
  { titles: ["Hip Thrust (Barra)", "Hip Thrust (Barbell)"], name: "Barbell Hip Thrust" },
  {
    titles: ["Press de Pecho Iso-Lateral (Máquina)", "Iso-Lateral Chest Press (Machine)"],
    name: "Iso-Lateral Chest Press (Machine)",
    create: { muscle: "CHEST", equipment: ["FULL_GYM"] },
  },
  {
    titles: ["Jalón de tríceps con cuerda", "Triceps Rope Pushdown"],
    name: "Triceps Rope Pushdown",
    create: { muscle: "TRICEPS", equipment: ["CABLE_MACHINE"] },
  },
  {
    titles: [
      "Extensión de tríceps por encima de la cabeza (cable)",
      "Overhead Triceps Extension (Cable)",
    ],
    name: "Overhead Triceps Extension (Cable)",
    create: { muscle: "TRICEPS", equipment: ["CABLE_MACHINE"] },
  },
  {
    titles: ["Curl de Muñeca Invertido (Mancuerna)", "Reverse Wrist Curl (Dumbbell)"],
    name: "Reverse Wrist Curl (Dumbbell)",
    create: { muscle: "OTHER", equipment: ["DUMBBELLS"] },
  },
  {
    titles: ["Curl Invertido (Cable)", "Reverse Curl (Cable)"],
    name: "Reverse Curl (Cable)",
    create: { muscle: "BICEPS", equipment: ["CABLE_MACHINE"] },
  },
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** An exercise missing from the catalog, to be added on save. */
export interface NewCatalogExercise {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  sourceRef: string;
}

/** English Hevy titles whose catalog name the generic rules cannot derive. */
const TITLE_ALIASES: Record<string, string> = {
  "bicep curl barbell": "Barbell Curl",
  "bicep curl dumbbell": "Dumbbell Curl",
  "hammer curl dumbbell": "Hammer Curl",
  "lateral raise dumbbell": "Dumbbell Lateral Raise",
  "triceps pushdown": "Cable Triceps Pushdown",
  "bench press close grip barbell": "Close-Grip Bench Press",
  "squat barbell": "Barbell Back Squat",
  "bent over row barbell": "Bent-Over Barbell Row",
  "overhead press barbell": "Overhead Barbell Press",
  "seated overhead press dumbbell": "Seated Dumbbell Shoulder Press",
  "shoulder press dumbbell": "Seated Dumbbell Shoulder Press",
  "seated cable row v grip cable": "Seated Cable Row",
  "dumbbell row": "Single-Arm Dumbbell Row",
  "face pull": "Cable Face Pull",
  "incline bench press dumbbell": "Incline Dumbbell Press",
  "triceps extension dumbbell": "Overhead Dumbbell Triceps Extension",
};

/**
 * Resolves an English Hevy title ("Bench Press (Barbell)") to a catalog name
 * ("Barbell Bench Press"), or null when nothing matches.
 */
export function matchCatalogName(
  hevyTitle: string,
  catalogNames: readonly string[],
): string | null {
  const byNorm = new Map(catalogNames.map((n) => [norm(n), n]));

  const alias = TITLE_ALIASES[norm(hevyTitle)];
  if (alias && byNorm.has(norm(alias))) return byNorm.get(norm(alias))!;

  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(hevyTitle);
  const base = m ? m[1]! : hevyTitle;
  const equipment = m ? m[2]! : null;
  const candidates = [hevyTitle, ...(equipment ? [`${equipment} ${base}`, base] : [])];
  for (const c of candidates) {
    const hit = byNorm.get(norm(c));
    if (hit) return hit;
  }
  return null;
}

const KNOWN_BY_TITLE = new Map(KNOWN.flatMap((k) => k.titles.map((t) => [norm(t), k] as const)));

/** Keyword → muscle, checked in order (more specific first). */
const MUSCLE_KEYWORDS: [RegExp, MuscleGroup][] = [
  [/tricep|fondos|dip/, "TRICEPS"],
  [/munec|wrist|antebrazo|forearm/, "OTHER"],
  [/curl|bicep/, "BICEPS"],
  [/hombro|shoulder|lateral|militar|military|deltoid|face pull/, "SHOULDERS"],
  [/pecho|chest|banca|bench|apertura|fly|pec/, "CHEST"],
  [/remo|row|jalon|pulldown|dominad|pull up|espalda|back|lat/, "BACK"],
  [/femoral|hamstring|leg curl|peso muerto rumano|romanian/, "HAMSTRINGS"],
  [/gluteo|glute|hip thrust|puente/, "GLUTES"],
  [/gemelo|pantorrilla|calf|calves/, "CALVES"],
  [/abdomin|crunch|plancha|plank|core|oblicu/, "CORE"],
  [
    /sentadilla|squat|prensa|leg press|zancada|lunge|cuadricep|extension de pierna|leg extension/,
    "QUADS",
  ],
];

export function guessMuscle(title: string): MuscleGroup {
  const n = norm(title);
  return MUSCLE_KEYWORDS.find(([re]) => re.test(n))?.[1] ?? "OTHER";
}

/** "5 series · 6-12 repeticiones" / "4 sets · 10 reps" (also "x", "-", "•"). */
const SUMMARY =
  /^(\d+)\s*(?:series|serie|sets?)\s*[·•x×,\-–]?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:repeticiones|repeticion|reps?)\b/i;
/** A summary line without reps (time/distance exercises): "3 series · 30s". */
const SUMMARY_NO_REPS = /^(\d+)\s*(?:series|serie|sets?)\b/i;
/** Text after which the page shows author/summary panels, not exercises. */
const END_MARKERS = /^(creado por|created by|resumen de rutina|routine summary)$/i;
const COPY_SUFFIX = /\s*\((?:copy|copia)\)\s*$/i;

export interface HevyTextResult extends ImportResult {
  newExercises: NewCatalogExercise[];
}

/** True when the pasted text is just a Hevy share link (not the copied page). */
export function isHevyShareLink(raw: string): boolean {
  return /^\s*https?:\/\/(www\.)?hevy\.com\/routine\/[A-Za-z0-9_-]+\s*$/.test(raw);
}

export function parseHevyText(raw: string, catalogNames: readonly string[]): HevyTextResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const endIdx = lines.findIndex((l) => END_MARKERS.test(l));
  const body = endIdx >= 0 ? lines.slice(0, endIdx) : lines;

  const exercises: NormalizedWorkoutExercise[] = [];
  const rejected: RejectedRow[] = [];
  const newExercises = new Map<string, NewCatalogExercise>();
  let firstNameIdx = -1;
  let row = 0;

  for (let i = 1; i < body.length; i += 1) {
    const line = body[i]!;
    if (!SUMMARY_NO_REPS.test(line)) continue;

    const title = body[i - 1]!.slice(0, 120);
    if (firstNameIdx < 0) firstNameIdx = i - 1;
    row += 1;

    const m = SUMMARY.exec(line);
    if (!m) {
      rejected.push({
        index: row,
        raw: { exercise: title, summary: line },
        reason: `${title}: no tiene repeticiones (los ejercicios por tiempo o distancia no se admiten).`,
      });
      continue;
    }

    const sets = Number(m[1]);
    const repsMin = Number(m[2]);
    const repsMax = m[3] ? Number(m[3]) : repsMin;
    if (sets < 1 || repsMin < 1 || repsMax < repsMin) {
      rejected.push({
        index: row,
        raw: line,
        reason: `${title}: series o repeticiones no válidas.`,
      });
      continue;
    }

    const known = KNOWN_BY_TITLE.get(norm(title));
    let name: string;
    let muscle: MuscleGroup | undefined;
    if (known && !known.create && catalogNames.includes(known.name)) {
      name = known.name;
    } else if (known?.create) {
      name = known.name;
      muscle = known.create.muscle;
      if (!catalogNames.includes(name)) {
        newExercises.set(name, {
          name,
          primaryMuscle: known.create.muscle,
          secondaryMuscles: [],
          equipment: known.create.equipment,
          sourceRef: `hevy-text:${norm(name).replace(/ /g, "-")}`,
        });
      }
    } else {
      const matched = matchCatalogName(title, catalogNames);
      if (matched) {
        name = matched;
      } else {
        name = title;
        muscle = guessMuscle(title);
        newExercises.set(name, {
          name,
          primaryMuscle: muscle,
          secondaryMuscles: [],
          equipment: [],
          sourceRef: `hevy-text:${norm(name).replace(/ /g, "-")}`,
        });
      }
    }

    exercises.push({
      order: exercises.length + 1,
      exerciseName: name,
      // Catalog muscles are filled in by the caller for catalog names.
      primaryMuscle: muscle ?? "OTHER",
      sets,
      repsMin,
      repsMax,
      restSeconds: null,
      targetRir: null,
    });
  }

  const title =
    (firstNameIdx > 0 ? body[firstNameIdx - 1]! : "").replace(COPY_SUFFIX, "").slice(0, 120) ||
    "Rutina de Hevy";

  if (row === 0) {
    rejected.push({
      index: 1,
      raw: raw.slice(0, 200),
      reason:
        "No encontramos ejercicios. Copia toda la página de tu rutina de Hevy (Ctrl+A, Ctrl+C) y pégala aquí.",
    });
  }

  return {
    plan:
      exercises.length > 0
        ? {
            name: title,
            description: "Importado desde Hevy",
            days: [{ order: 1, name: title, exercises }],
          }
        : null,
    rejected,
    importedCount: exercises.length,
    newExercises: Array.from(newExercises.values()),
  };
}
