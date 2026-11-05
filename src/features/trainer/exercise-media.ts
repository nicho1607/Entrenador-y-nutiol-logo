/**
 * Exercise demo media. The catalog is seeded from Free Exercise DB
 * (yuhonas/free-exercise-db, public domain), which ships two photos per
 * exercise — the start and end position. Alternating them gives a looping
 * demo animation (see ExerciseAnimation).
 *
 * Keyed by the catalog `Exercise.name` (unique). Exercises the dataset has no
 * photos for are simply absent and render no animation.
 */
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const DATASET_IDS: Record<string, string> = {
  "Barbell Bench Press": "Barbell_Bench_Press_-_Medium_Grip",
  "Dumbbell Bench Press": "Dumbbell_Bench_Press",
  "Incline Dumbbell Press": "Incline_Dumbbell_Press",
  "Push-Up": "Pushups",
  "Cable Crossover": "Cable_Crossover",
  "Barbell Deadlift": "Barbell_Deadlift",
  "Bent-Over Barbell Row": "Bent_Over_Barbell_Row",
  "Pull-Up": "Pullups",
  "Lat Pulldown": "Wide-Grip_Lat_Pulldown",
  "Seated Cable Row": "Seated_Cable_Rows",
  "Single-Arm Dumbbell Row": "One-Arm_Dumbbell_Row",
  "Overhead Barbell Press": "Standing_Military_Press",
  "Seated Dumbbell Shoulder Press": "Dumbbell_Shoulder_Press",
  "Dumbbell Lateral Raise": "Side_Lateral_Raise",
  "Cable Face Pull": "Face_Pull",
  "Barbell Curl": "Barbell_Curl",
  "Dumbbell Curl": "Dumbbell_Bicep_Curl",
  "Hammer Curl": "Hammer_Curls",
  "Cable Triceps Pushdown": "Triceps_Pushdown",
  "Close-Grip Bench Press": "Close-Grip_Barbell_Bench_Press",
  "Bench Dip": "Bench_Dips",
  "Overhead Dumbbell Triceps Extension": "Standing_Dumbbell_Triceps_Extension",
  "Barbell Back Squat": "Barbell_Squat",
  "Goblet Squat": "Goblet_Squat",
  "Leg Press": "Leg_Press",
  "Walking Lunge": "Bodyweight_Walking_Lunge",
  "Bodyweight Squat": "Bodyweight_Squat",
  "Romanian Deadlift": "Romanian_Deadlift",
  "Lying Leg Curl": "Lying_Leg_Curls",
  "Dumbbell Romanian Deadlift": "Stiff-Legged_Dumbbell_Deadlift",
  "Barbell Hip Thrust": "Barbell_Hip_Thrust",
  "Glute Bridge": "Barbell_Glute_Bridge",
  "Bulgarian Split Squat": "Split_Squat_with_Dumbbells",
  "Standing Calf Raise": "Standing_Calf_Raises",
  "Dumbbell Calf Raise": "Standing_Dumbbell_Calf_Raise",
  Plank: "Plank",
  "Hanging Leg Raise": "Hanging_Leg_Raise",
  "Cable Crunch": "Cable_Crunch",
  "Russian Twist": "Russian_Twist",
  "Kettlebell Swing": "One-Arm_Kettlebell_Swings",
  "Dumbbell Clean and Press": "Clean_and_Press",
  "Treadmill Run": "Running_Treadmill",
  "Jump Rope": "Rope_Jumping",
  // Exercises added to the catalog by the Hevy import.
  "Iso-Lateral Chest Press (Machine)": "Leverage_Chest_Press",
  "Triceps Rope Pushdown": "Triceps_Pushdown_-_Rope_Attachment",
  "Overhead Triceps Extension (Cable)": "Cable_Rope_Overhead_Triceps_Extension",
  "Reverse Wrist Curl (Dumbbell)": "Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench",
  "Reverse Curl (Cable)": "Reverse_Cable_Curl",
};

/** The start/end frame URLs for an exercise, or null when none are known. */
export function exerciseFrames(exerciseName: string): [string, string] | null {
  const id = DATASET_IDS[exerciseName];
  if (!id) return null;
  return [`${IMAGE_BASE}/${id}/0.jpg`, `${IMAGE_BASE}/${id}/1.jpg`];
}
