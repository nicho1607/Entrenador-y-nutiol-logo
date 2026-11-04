/**
 * Curated exercise catalog — public-domain provenance.
 *
 * SOURCE: Free Exercise DB (yuhonas/free-exercise-db)
 *   https://github.com/yuhonas/free-exercise-db
 *   License: Public Domain (Unlicense-style dedication).
 *   See docs/data-sources.md for the full provenance record.
 *
 * Every row below is a REAL movement curated from that dataset and mapped onto
 * this project's Prisma enums (MuscleGroup / Equipment / ExperienceLevel). Rows
 * whose muscle or equipment could not be mapped verifiably were omitted rather
 * than guessed. Instruction text is paraphrased, not copied, and provenance is
 * recorded per row. Content was rephrased for compliance with licensing
 * restrictions. No nutrition/food data is included in this file.
 *
 * This module is framework-free: it only re-uses the enum string unions that
 * mirror the Prisma enums, so the seed script and tests can import it without a
 * Prisma client at type-check time.
 */

/** Mirrors the Prisma `MuscleGroup` enum. */
export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "CORE"
  | "FULL_BODY"
  | "OTHER";

/** Mirrors the Prisma `Equipment` enum. */
export type Equipment =
  | "BODYWEIGHT"
  | "DUMBBELLS"
  | "BARBELL"
  | "KETTLEBELL"
  | "RESISTANCE_BANDS"
  | "PULL_UP_BAR"
  | "BENCH"
  | "CABLE_MACHINE"
  | "CARDIO_MACHINE"
  | "FULL_GYM";

/** Mirrors the Prisma `ExperienceLevel` enum. */
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/**
 * A single curated catalog row. Shape matches the fields added to the Prisma
 * `Exercise` model in migration 0003 (plus the stable unique `name`).
 */
export interface SeedExercise {
  readonly name: string;
  readonly primaryMuscle: MuscleGroup;
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly equipment: readonly Equipment[];
  readonly difficulty: ExperienceLevel;
  readonly instructions: string;
  /** Stable provenance key, e.g. "free-exercise-db:<slug>". */
  readonly sourceRef: string;
  readonly sourceName: string;
  readonly sourceLicense: string;
}

const SOURCE_NAME = "Free Exercise DB (yuhonas/free-exercise-db)";
const SOURCE_LICENSE = "Public Domain (Unlicense-style dedication)";

/** Builds a row, attaching the shared provenance fields. */
function ex(
  slug: string,
  name: string,
  primaryMuscle: MuscleGroup,
  secondaryMuscles: readonly MuscleGroup[],
  equipment: readonly Equipment[],
  difficulty: ExperienceLevel,
  instructions: string,
): SeedExercise {
  return {
    name,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    difficulty,
    instructions,
    sourceRef: `free-exercise-db:${slug}`,
    sourceName: SOURCE_NAME,
    sourceLicense: SOURCE_LICENSE,
  };
}

/**
 * Curated set of real exercises. Spans every mappable MuscleGroup and the
 * common Equipment options. Names are unique (the seed's upsert key).
 */
export const CURATED_EXERCISES: readonly SeedExercise[] = [
  // --- CHEST ---------------------------------------------------------------
  ex(
    "barbell-bench-press",
    "Barbell Bench Press",
    "CHEST",
    ["TRICEPS", "SHOULDERS"],
    ["BARBELL", "BENCH"],
    "INTERMEDIATE",
    "Lie on a flat bench, lower the barbell to the mid-chest with control, then press it back up until the arms are extended.",
  ),
  ex(
    "dumbbell-bench-press",
    "Dumbbell Bench Press",
    "CHEST",
    ["TRICEPS", "SHOULDERS"],
    ["DUMBBELLS", "BENCH"],
    "BEGINNER",
    "Lie on a flat bench holding a dumbbell in each hand, lower them to chest level, then press them up together.",
  ),
  ex(
    "incline-dumbbell-press",
    "Incline Dumbbell Press",
    "CHEST",
    ["SHOULDERS", "TRICEPS"],
    ["DUMBBELLS", "BENCH"],
    "INTERMEDIATE",
    "On a bench set to a slight incline, press the dumbbells up and together to emphasise the upper chest.",
  ),
  ex(
    "push-up",
    "Push-Up",
    "CHEST",
    ["TRICEPS", "SHOULDERS", "CORE"],
    ["BODYWEIGHT"],
    "BEGINNER",
    "In a plank position, lower the chest toward the floor by bending the elbows, then push back up keeping the body rigid.",
  ),
  ex(
    "cable-crossover",
    "Cable Crossover",
    "CHEST",
    ["SHOULDERS"],
    ["CABLE_MACHINE"],
    "INTERMEDIATE",
    "With high pulleys, bring both handles down and across the body in an arc, squeezing the chest at the bottom.",
  ),

  // --- BACK ----------------------------------------------------------------
  ex(
    "deadlift",
    "Barbell Deadlift",
    "BACK",
    ["GLUTES", "HAMSTRINGS", "CORE"],
    ["BARBELL"],
    "ADVANCED",
    "Hinge at the hips to grip the bar, then stand tall by driving through the floor, keeping the spine neutral throughout.",
  ),
  ex(
    "bent-over-barbell-row",
    "Bent-Over Barbell Row",
    "BACK",
    ["BICEPS", "SHOULDERS"],
    ["BARBELL"],
    "INTERMEDIATE",
    "Hinge forward with a flat back and pull the barbell to the lower ribs, then lower it under control.",
  ),
  ex(
    "pull-up",
    "Pull-Up",
    "BACK",
    ["BICEPS", "SHOULDERS"],
    ["PULL_UP_BAR", "BODYWEIGHT"],
    "INTERMEDIATE",
    "Hang from the bar with an overhand grip and pull the chest toward the bar, then lower with control.",
  ),
  ex(
    "lat-pulldown",
    "Lat Pulldown",
    "BACK",
    ["BICEPS"],
    ["CABLE_MACHINE"],
    "BEGINNER",
    "Seated at the machine, pull the bar down to the upper chest while keeping the torso upright, then release slowly.",
  ),
  ex(
    "seated-cable-row",
    "Seated Cable Row",
    "BACK",
    ["BICEPS", "SHOULDERS"],
    ["CABLE_MACHINE"],
    "BEGINNER",
    "Sitting upright, pull the handle to the abdomen by driving the elbows back, then extend the arms under control.",
  ),
  ex(
    "single-arm-dumbbell-row",
    "Single-Arm Dumbbell Row",
    "BACK",
    ["BICEPS"],
    ["DUMBBELLS", "BENCH"],
    "BEGINNER",
    "Braced on a bench, row the dumbbell to the hip while keeping the back flat, then lower it fully.",
  ),

  // --- SHOULDERS -----------------------------------------------------------
  ex(
    "overhead-barbell-press",
    "Overhead Barbell Press",
    "SHOULDERS",
    ["TRICEPS", "CORE"],
    ["BARBELL"],
    "INTERMEDIATE",
    "From shoulder height, press the barbell overhead until the arms lock out, then lower it back under control.",
  ),
  ex(
    "seated-dumbbell-shoulder-press",
    "Seated Dumbbell Shoulder Press",
    "SHOULDERS",
    ["TRICEPS"],
    ["DUMBBELLS", "BENCH"],
    "BEGINNER",
    "Seated with back support, press the dumbbells overhead and lower them to ear height.",
  ),
  ex(
    "dumbbell-lateral-raise",
    "Dumbbell Lateral Raise",
    "SHOULDERS",
    [],
    ["DUMBBELLS"],
    "BEGINNER",
    "Raise the dumbbells out to the sides up to shoulder height with a slight elbow bend, then lower slowly.",
  ),
  ex(
    "face-pull",
    "Cable Face Pull",
    "SHOULDERS",
    ["BACK"],
    ["CABLE_MACHINE"],
    "INTERMEDIATE",
    "Pull a rope toward the face with the elbows high, externally rotating the shoulders at the end of the movement.",
  ),

  // --- BICEPS --------------------------------------------------------------
  ex(
    "barbell-curl",
    "Barbell Curl",
    "BICEPS",
    [],
    ["BARBELL"],
    "BEGINNER",
    "With a shoulder-width grip, curl the barbell up by flexing the elbows, keeping them at the sides, then lower slowly.",
  ),
  ex(
    "dumbbell-curl",
    "Dumbbell Curl",
    "BICEPS",
    [],
    ["DUMBBELLS"],
    "BEGINNER",
    "Curl the dumbbells up one or both at a time, supinating the wrists, then lower under control.",
  ),
  ex(
    "hammer-curl",
    "Hammer Curl",
    "BICEPS",
    [],
    ["DUMBBELLS"],
    "BEGINNER",
    "Curl the dumbbells with a neutral (palms-facing) grip to emphasise the brachialis, then lower slowly.",
  ),
  ex(
    "resistance-band-curl",
    "Resistance Band Curl",
    "BICEPS",
    [],
    ["RESISTANCE_BANDS"],
    "BEGINNER",
    "Stand on the band and curl the handles upward against the band tension, then release with control.",
  ),

  // --- TRICEPS -------------------------------------------------------------
  ex(
    "triceps-pushdown",
    "Cable Triceps Pushdown",
    "TRICEPS",
    [],
    ["CABLE_MACHINE"],
    "BEGINNER",
    "With elbows pinned to the sides, extend the forearms downward against the cable, then return under control.",
  ),
  ex(
    "close-grip-bench-press",
    "Close-Grip Bench Press",
    "TRICEPS",
    ["CHEST", "SHOULDERS"],
    ["BARBELL", "BENCH"],
    "INTERMEDIATE",
    "Bench press with a shoulder-width grip, keeping the elbows close to the torso to load the triceps.",
  ),
  ex(
    "bench-dip",
    "Bench Dip",
    "TRICEPS",
    ["CHEST", "SHOULDERS"],
    ["BENCH", "BODYWEIGHT"],
    "BEGINNER",
    "With hands on a bench behind you, lower the body by bending the elbows, then press back up.",
  ),
  ex(
    "overhead-dumbbell-extension",
    "Overhead Dumbbell Triceps Extension",
    "TRICEPS",
    [],
    ["DUMBBELLS"],
    "BEGINNER",
    "Hold one dumbbell overhead with both hands and lower it behind the head, then extend the arms back up.",
  ),

  // --- QUADS ---------------------------------------------------------------
  ex(
    "barbell-back-squat",
    "Barbell Back Squat",
    "QUADS",
    ["GLUTES", "HAMSTRINGS", "CORE"],
    ["BARBELL"],
    "INTERMEDIATE",
    "With the bar on the upper back, squat down until the thighs are at least parallel, then drive up through the heels.",
  ),
  ex(
    "goblet-squat",
    "Goblet Squat",
    "QUADS",
    ["GLUTES", "CORE"],
    ["DUMBBELLS"],
    "BEGINNER",
    "Hold a single dumbbell at the chest and squat down between the knees, then stand back up.",
  ),
  ex(
    "leg-press",
    "Leg Press",
    "QUADS",
    ["GLUTES", "HAMSTRINGS"],
    ["FULL_GYM"],
    "BEGINNER",
    "Seated in the machine, lower the platform by bending the knees, then press it away without locking out hard.",
  ),
  ex(
    "walking-lunge",
    "Walking Lunge",
    "QUADS",
    ["GLUTES", "HAMSTRINGS"],
    ["DUMBBELLS", "BODYWEIGHT"],
    "INTERMEDIATE",
    "Step forward into a lunge until both knees are bent near ninety degrees, then drive up and step through.",
  ),
  ex(
    "bodyweight-squat",
    "Bodyweight Squat",
    "QUADS",
    ["GLUTES", "CORE"],
    ["BODYWEIGHT"],
    "BEGINNER",
    "With feet shoulder-width apart, squat down keeping the chest up, then stand back to full height.",
  ),

  // --- HAMSTRINGS ----------------------------------------------------------
  ex(
    "romanian-deadlift",
    "Romanian Deadlift",
    "HAMSTRINGS",
    ["GLUTES", "BACK"],
    ["BARBELL"],
    "INTERMEDIATE",
    "Hinge at the hips with soft knees, lowering the bar along the thighs until a stretch is felt, then stand tall.",
  ),
  ex(
    "lying-leg-curl",
    "Lying Leg Curl",
    "HAMSTRINGS",
    ["CALVES"],
    ["FULL_GYM"],
    "BEGINNER",
    "Lying face down on the machine, curl the pad toward the glutes by flexing the knees, then lower slowly.",
  ),
  ex(
    "dumbbell-romanian-deadlift",
    "Dumbbell Romanian Deadlift",
    "HAMSTRINGS",
    ["GLUTES", "BACK"],
    ["DUMBBELLS"],
    "BEGINNER",
    "Holding dumbbells, hinge at the hips with a flat back until a hamstring stretch is felt, then return upright.",
  ),

  // --- GLUTES --------------------------------------------------------------
  ex(
    "barbell-hip-thrust",
    "Barbell Hip Thrust",
    "GLUTES",
    ["HAMSTRINGS", "CORE"],
    ["BARBELL", "BENCH"],
    "INTERMEDIATE",
    "With the upper back on a bench and the bar over the hips, drive the hips up to full extension, then lower.",
  ),
  ex(
    "glute-bridge",
    "Glute Bridge",
    "GLUTES",
    ["HAMSTRINGS", "CORE"],
    ["BODYWEIGHT"],
    "BEGINNER",
    "Lying on your back with knees bent, lift the hips until the body forms a straight line, then lower slowly.",
  ),
  ex(
    "bulgarian-split-squat",
    "Bulgarian Split Squat",
    "GLUTES",
    ["QUADS", "HAMSTRINGS"],
    ["DUMBBELLS", "BENCH"],
    "INTERMEDIATE",
    "With the rear foot on a bench, lower into a lunge on the front leg, then drive back up through the front heel.",
  ),

  // --- CALVES --------------------------------------------------------------
  ex(
    "standing-calf-raise",
    "Standing Calf Raise",
    "CALVES",
    [],
    ["BODYWEIGHT"],
    "BEGINNER",
    "Stand tall and rise onto the balls of the feet as high as possible, then lower the heels under control.",
  ),
  ex(
    "dumbbell-calf-raise",
    "Dumbbell Calf Raise",
    "CALVES",
    [],
    ["DUMBBELLS"],
    "BEGINNER",
    "Holding dumbbells, raise the heels to contract the calves, pause at the top, then lower slowly.",
  ),

  // --- CORE ----------------------------------------------------------------
  ex(
    "plank",
    "Plank",
    "CORE",
    ["SHOULDERS"],
    ["BODYWEIGHT"],
    "BEGINNER",
    "Hold a straight line from head to heels on the forearms and toes, bracing the abs for the set duration.",
  ),
  ex(
    "hanging-leg-raise",
    "Hanging Leg Raise",
    "CORE",
    ["HAMSTRINGS"],
    ["PULL_UP_BAR"],
    "INTERMEDIATE",
    "Hanging from a bar, raise the legs toward horizontal by flexing the hips, then lower without swinging.",
  ),
  ex(
    "cable-crunch",
    "Cable Crunch",
    "CORE",
    [],
    ["CABLE_MACHINE"],
    "BEGINNER",
    "Kneeling at a high pulley, crunch the torso down by flexing the spine, then return under control.",
  ),
  ex(
    "russian-twist",
    "Russian Twist",
    "CORE",
    [],
    ["BODYWEIGHT"],
    "BEGINNER",
    "Seated with the torso leaned back, rotate the trunk side to side while keeping the core braced.",
  ),

  // --- FULL_BODY -----------------------------------------------------------
  ex(
    "kettlebell-swing",
    "Kettlebell Swing",
    "FULL_BODY",
    ["GLUTES", "HAMSTRINGS", "BACK", "CORE"],
    ["KETTLEBELL"],
    "INTERMEDIATE",
    "Hinge and swing the kettlebell to chest height using an explosive hip drive, then let it swing back between the legs.",
  ),
  ex(
    "burpee",
    "Burpee",
    "FULL_BODY",
    ["CHEST", "QUADS", "CORE"],
    ["BODYWEIGHT"],
    "INTERMEDIATE",
    "Drop to a push-up, return to a squat, then jump upward, repeating the whole sequence continuously.",
  ),
  ex(
    "clean-and-press",
    "Dumbbell Clean and Press",
    "FULL_BODY",
    ["SHOULDERS", "QUADS", "BACK"],
    ["DUMBBELLS"],
    "ADVANCED",
    "Pull the dumbbells from the floor to the shoulders, then press them overhead in one coordinated effort.",
  ),

  // --- CARDIO (OTHER) ------------------------------------------------------
  ex(
    "treadmill-run",
    "Treadmill Run",
    "OTHER",
    ["QUADS", "CALVES", "HAMSTRINGS"],
    ["CARDIO_MACHINE"],
    "BEGINNER",
    "Run at a steady pace on the treadmill for the prescribed duration to build aerobic conditioning.",
  ),
  ex(
    "jump-rope",
    "Jump Rope",
    "OTHER",
    ["CALVES", "SHOULDERS"],
    ["BODYWEIGHT"],
    "BEGINNER",
    "Skip rope with small, quick jumps off the balls of the feet for the prescribed time or count.",
  ),
] as const;
