/**
 * Training-specific domain types. Re-exports the shared DomainResult helpers so
 * the training module has a single import surface, and defines MuscleGroup
 * mirroring the Prisma enum (kept in sync manually to keep the domain library
 * free of a Prisma dependency and thus trivially unit-testable).
 */
export { type DomainResult, type DomainFailureReason, ok, fail } from "./types";

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
