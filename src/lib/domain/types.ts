/**
 * Shared domain types for FitMind AI calculations.
 *
 * These types are framework-free and pure-data so the domain library stays
 * unit-testable without React, Prisma, or Next.js.
 */

export type Sex = "MALE" | "FEMALE";

export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";

/**
 * The seven goals the product supports. These identifiers mirror the Prisma
 * `GoalType` enum one-to-one (kept in sync manually so the domain library stays
 * free of a Prisma dependency and is trivially unit-testable).
 *
 *  - HYPERTROPHY    — muscle growth (lean surplus)
 *  - FAT_LOSS       — fat loss (moderate deficit)
 *  - RECOMPOSITION  — simultaneous fat loss + muscle gain (eat at maintenance)
 *  - WEIGHT_GAIN    — general weight gain (larger surplus)
 *  - STRENGTH       — maximal strength (slight surplus to fuel heavy work)
 *  - ENDURANCE      — aerobic capacity (eat at maintenance)
 *  - MAINTENANCE    — hold current weight
 */
export type GoalType =
  | "HYPERTROPHY"
  | "FAT_LOSS"
  | "RECOMPOSITION"
  | "WEIGHT_GAIN"
  | "STRENGTH"
  | "ENDURANCE"
  | "MAINTENANCE";

/**
 * Situations that must NOT receive a blindly-computed calorie target. When any
 * of these is present the domain functions surface a "consult a professional"
 * flag instead of a number.
 */
export interface SafetyFlags {
  eatingDisorderRisk?: boolean;
  pregnancy?: boolean;
  metabolicDisease?: boolean;
}

/**
 * A result that may either carry a value or signal that a value could not be
 * produced safely / with the given inputs. Pure and serializable.
 */
export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: DomainFailureReason; message: string };

export type DomainFailureReason =
  | "MISSING_INPUT"
  | "INVALID_INPUT"
  | "PROFESSIONAL_REVIEW_REQUIRED";

export function ok<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

export function fail<T>(reason: DomainFailureReason, message: string): DomainResult<T> {
  return { ok: false, reason, message };
}
