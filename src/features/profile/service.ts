/**
 * Server-side profile persistence and derived-value computation.
 *
 * Data ownership: every function takes an explicit `userId` that the caller
 * MUST source from the session (`getCurrentUser`/`requireUser`), never from
 * client input. Queries are scoped to that id so a user can only read/write
 * their own profile and active goal.
 *
 * Derived values (BMI, BMR, TDEE, calorie target, macro split) are NOT stored;
 * they are recomputed on read by calling the pure domain library, which remains
 * the single source of truth for the math.
 */
import type {
  ActivityLevel,
  Equipment,
  ExperienceLevel,
  GoalType,
  Sex,
} from "@prisma/client";
import { prisma } from "@/server/db";
import {
  calculateBmi,
  calculateBmr,
  calculateCalorieTarget,
  calculateMacroSplit,
  calculateTdee,
  type BmiResult,
  type MacroSplitResult,
} from "@/lib/domain/nutrition";
import type {
  DomainResult,
  GoalType as DomainGoalType,
  SafetyFlags,
} from "@/lib/domain/types";
import type { ProfileInput } from "./validation";

/** The profile as surfaced to the UI (age derived from stored birthDate). */
export interface ProfileView {
  age: number | null;
  sex: Sex | null;
  weightKg: number | null;
  heightCm: number | null;
  experienceLevel: ExperienceLevel | null;
  goal: GoalType | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  activityLevel: ActivityLevel | null;
  equipment: Equipment[];
  dietaryPreferences: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  foodBudget: number | null;
  flaggedForProfessionalReview: boolean;
}

/**
 * Derived nutrition values for the summary card. Each field is a DomainResult
 * so the UI can show the "missing input" / "consult a professional" signals the
 * domain library returns instead of a fabricated number.
 */
export interface DerivedValues {
  bmi: DomainResult<BmiResult>;
  bmr: DomainResult<number>;
  tdee: DomainResult<number>;
  calorieTarget: DomainResult<{ calories: number; clampedToFloor: boolean }>;
  macros: DomainResult<MacroSplitResult>;
}

const MISSING: DomainResult<never> = {
  ok: false,
  reason: "MISSING_INPUT",
  message: "Add age, sex, weight, height, activity level and a goal to compute this.",
};

/**
 * Loads a user's profile (and their active goal) scoped to their own id.
 * Returns null when no profile exists yet (empty state).
 */
export async function getProfile(userId: string): Promise<ProfileView | null> {
  const [profile, goal] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.fitnessGoal.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!profile) return null;

  return {
    age: birthDateToAge(profile.birthDate),
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    experienceLevel: profile.experienceLevel,
    goal: goal?.type ?? null,
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    activityLevel: profile.activityLevel,
    equipment: profile.equipment,
    dietaryPreferences: profile.dietaryPreferences,
    allergies: profile.allergies,
    dietaryRestrictions: profile.dietaryRestrictions,
    foodBudget: profile.foodBudget,
    flaggedForProfessionalReview: profile.flaggedForProfessionalReview,
  };
}

/**
 * Creates or updates the caller's profile and active goal in one transaction.
 * The write is scoped to `userId`; no caller-supplied id is trusted. Age is
 * stored as an approximate birthDate (Jan 1 of the implied birth year) so the
 * schema keeps a single date-of-birth field.
 */
export async function saveProfile(userId: string, input: ProfileInput): Promise<void> {
  const birthDate = ageToBirthDate(input.age);

  await prisma.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        birthDate,
        sex: input.sex,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        experienceLevel: input.experienceLevel,
        daysPerWeek: input.daysPerWeek,
        sessionMinutes: input.sessionMinutes,
        activityLevel: input.activityLevel,
        equipment: input.equipment,
        dietaryPreferences: input.dietaryPreferences,
        allergies: input.allergies,
        dietaryRestrictions: input.dietaryRestrictions,
        foodBudget: input.foodBudget,
        flaggedForProfessionalReview: input.flaggedForProfessionalReview,
      },
      update: {
        birthDate,
        sex: input.sex,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        experienceLevel: input.experienceLevel,
        daysPerWeek: input.daysPerWeek,
        sessionMinutes: input.sessionMinutes,
        activityLevel: input.activityLevel,
        equipment: input.equipment,
        dietaryPreferences: input.dietaryPreferences,
        allergies: input.allergies,
        dietaryRestrictions: input.dietaryRestrictions,
        foodBudget: input.foodBudget,
        flaggedForProfessionalReview: input.flaggedForProfessionalReview,
      },
    });

    // Keep a single active goal in sync with the chosen primary goal.
    if (input.goal) {
      const existing = await tx.fitnessGoal.findFirst({
        where: { userId, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      if (existing) {
        await tx.fitnessGoal.update({
          where: { id: existing.id },
          data: { type: input.goal },
        });
      } else {
        await tx.fitnessGoal.create({ data: { userId, type: input.goal } });
      }
    }
  });
}

/**
 * Computes the derived nutrition values by calling the domain library. Where an
 * essential input is missing the corresponding result carries MISSING_INPUT so
 * the UI shows the gap instead of a number.
 */
export function computeDerived(profile: ProfileView): DerivedValues {
  const { age, sex, weightKg, heightCm, activityLevel, goal } = profile;

  const bmi =
    weightKg != null && heightCm != null
      ? calculateBmi({ weightKg, heightCm })
      : MISSING;

  const bmr =
    sex != null && weightKg != null && heightCm != null && age != null
      ? calculateBmr({ sex, weightKg, heightCm, ageYears: age })
      : MISSING;

  const tdee =
    bmr.ok && activityLevel != null
      ? calculateTdee({ bmr: bmr.value, activityLevel })
      : MISSING;

  const safetyFlags = profile.flaggedForProfessionalReview
    ? { metabolicDisease: true }
    : undefined;

  const calorieTarget = computeCalorieTarget(tdee, bmr, goal, safetyFlags);

  const macros = calorieTarget.ok
    ? calculateMacroSplit({ calories: calorieTarget.value.calories })
    : MISSING;

  return { bmi, bmr, tdee, calorieTarget, macros };
}

type CalorieTarget = { calories: number; clampedToFloor: boolean };

/**
 * Chains the calorie-target calculation onto the TDEE/BMR results. If either
 * upstream input is missing we propagate that failure; if the goal is missing
 * we report a missing input; otherwise we defer entirely to the domain
 * library (including its safety floor and professional-review gate).
 */
function computeCalorieTarget(
  tdee: DomainResult<number>,
  bmr: DomainResult<number>,
  goal: DomainGoalType | null,
  safetyFlags: SafetyFlags | undefined,
): DomainResult<CalorieTarget> {
  if (!tdee.ok) return tdee;
  if (!bmr.ok) return bmr;
  if (goal == null) return MISSING;
  return calculateCalorieTarget({ tdee: tdee.value, bmr: bmr.value, goal, safetyFlags });
}

function birthDateToAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function ageToBirthDate(age: number | undefined): Date | null {
  if (age == null) return null;
  const year = new Date().getUTCFullYear() - age;
  return new Date(Date.UTC(year, 0, 1));
}
