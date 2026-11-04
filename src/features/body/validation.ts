/**
 * Shared Zod schema for the body-composition feature (usable on client and
 * server).
 *
 * Follows the nutrition/trainer convention: numeric constraints mirror the
 * Prisma `BodyMeasurement` Float columns (weightKg, bodyFatPct, waistCm, hipCm)
 * so a payload that validates here is always persistable. Every metric is
 * optional, but a measurement with no metric at all is meaningless, so the
 * schema requires at least one of them via a `.refine`. `measuredAt` is an
 * optional date (the Prisma column defaults to now()).
 */
import { z } from "zod";

/** Body weight in kilograms (mirrors the nullable Float column). */
const weightKg = z
  .number({ invalid_type_error: "Weight must be a number." })
  .positive("Weight must be a positive number.")
  .max(500, "Weight must be 500 kg or below.");

/** Body-fat percentage (0..100). */
const bodyFatPct = z
  .number({ invalid_type_error: "Body fat must be a number." })
  .min(0, "Body fat cannot be negative.")
  .max(100, "Body fat must be 100% or below.");

/** Waist circumference in centimetres. */
const waistCm = z
  .number({ invalid_type_error: "Waist must be a number." })
  .positive("Waist must be a positive number.")
  .max(300, "Waist must be 300 cm or below.");

/** Hip circumference in centimetres. */
const hipCm = z
  .number({ invalid_type_error: "Hip must be a number." })
  .positive("Hip must be a positive number.")
  .max(300, "Hip must be 300 cm or below.");

/**
 * Log a body measurement. Every metric is optional, but at least one must be
 * present — a row with no metric carries no information. `measuredAt` is
 * coerced from a string/Date; when omitted the Prisma column defaults to now().
 */
export const logMeasurementSchema = z
  .object({
    weightKg: weightKg.optional(),
    bodyFatPct: bodyFatPct.optional(),
    waistCm: waistCm.optional(),
    hipCm: hipCm.optional(),
    measuredAt: z.coerce.date().optional(),
  })
  .refine(
    (v) =>
      v.weightKg != null ||
      v.bodyFatPct != null ||
      v.waistCm != null ||
      v.hipCm != null,
    { message: "Enter at least one measurement." },
  );

export type LogMeasurementInput = z.infer<typeof logMeasurementSchema>;
