# body

Body-composition tracking: logging a `BodyMeasurement` (weight, body fat, waist,
hip) and the read aggregations the Phase 5 charts consume. This module is the
data-entry prerequisite for the body-composition charts — without a way to log
measurements those charts can never populate.

## What this module owns

- `validation.ts` — the shared `logMeasurementSchema` (Zod). Every metric is
  optional, but at least one must be present; numeric bounds mirror the Prisma
  `BodyMeasurement` Float columns, and `measuredAt` is an optional coerced date.
  Used by both the client form and the server action.
- `service.ts` — session-scoped persistence and reads: `logBodyMeasurement`
  (write), `getWeightHistory` / `getMeasurementHistory` (series), and
  `getBodyComparison` (this-month vs last-month).
- `actions.ts` — `logMeasurementAction`, the `'use server'` entry point used by
  the form.
- `measurement-form.tsx` — the `'use client'` form.

## Ownership rule

Every function takes an explicit `userId` the caller MUST source from the
session (`getCurrentUser` / `requireUser`), never from client input. Each query
is scoped to that id, so a user only reads and writes their own measurements.
The server action re-validates with `logMeasurementSchema` and sources the user
id solely from `getCurrentUser`.

## Columns only — no photo storage

Only the existing `BodyMeasurement` columns are touched (`weightKg`,
`bodyFatPct`, `waistCm`, `hipCm`, `measuredAt`). The schema has no
progress-photo field, so no photo upload or storage is invented and no new
migration is added.

## Where the math lives

All time-bucketing and period-over-period math is delegated to the pure,
framework-free `@/lib/domain/stats` helpers (FEAT-001): `getMeasurementHistory`
reuses `bucketByPeriod`, and `getBodyComparison` reuses `comparePeriods` (so a
zero previous month yields a null percent delta rather than Infinity). This
layer only loads/persists rows and adapts them to those functions.
