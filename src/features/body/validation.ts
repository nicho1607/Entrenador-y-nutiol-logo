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
  .number({ invalid_type_error: "El peso debe ser un número." })
  .positive("El peso debe ser un número positivo.")
  .max(500, "El peso debe ser 500 kg o menos.");

/** Body-fat percentage (0..100). */
const bodyFatPct = z
  .number({ invalid_type_error: "La grasa corporal debe ser un número." })
  .min(0, "La grasa corporal no puede ser negativa.")
  .max(100, "La grasa corporal debe ser 100% o menos.");

/** Waist circumference in centimetres. */
const waistCm = z
  .number({ invalid_type_error: "La cintura debe ser un número." })
  .positive("La cintura debe ser un número positivo.")
  .max(300, "La cintura debe ser 300 cm o menos.");

/** Hip circumference in centimetres. */
const hipCm = z
  .number({ invalid_type_error: "La cadera debe ser un número." })
  .positive("La cadera debe ser un número positivo.")
  .max(300, "La cadera debe ser 300 cm o menos.");

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
    { message: "Introduce al menos una medida." },
  );

export type LogMeasurementInput = z.infer<typeof logMeasurementSchema>;
