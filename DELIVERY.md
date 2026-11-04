# FitMind AI — Delivery Report

An intelligent personal-trainer and sports-nutrition web application. This
report describes what was built, the technology choices and why, the database
model, the implemented features per module, the **real** verification results
captured from this environment, and the honest list of what still requires the
user's live database or further work.

> Scope note: every test/build number below is the actual output of the command
> run in this environment. Nothing is fabricated. Where a check could not run
> here (the Playwright E2E suite, database migration/seeding), that is stated
> explicitly and the work is marked user-run.

## Implemented architecture

- **Next.js 15 (App Router) + React 19 + TypeScript (strict).** One toolchain
  for routing, SSR, and API handlers; strict mode catches null/ownership bugs.
  No `any` is used to silence type errors.
- **Feature-oriented modules** under `src/features/*`, each grouping
  `validation.ts` (shared Zod, client + server), `actions.ts` (server actions
  that call `getCurrentUser()`), `service.ts` (userId-scoped persistence), and
  `*-form.tsx` (client UI).
- **Pure domain library** under `src/lib/domain/*`: framework-free math (no
  Prisma/React/Next imports) returning `DomainResult` types and never throwing,
  unit-tested with Vitest. It is the single source of truth for all nutrition,
  training, stats, plan-generation, and recommendation math.
- **Prisma singleton** in `src/server/db.ts`; accessible UI primitives in
  `src/components/ui/*`.
- **Data-ownership rule** enforced everywhere: the caller is identified from the
  session (`src/features/auth/session.ts`), never from client input, and every
  user-owned query is scoped to that id. `Food`/`Exercise` are shared read-only
  catalogs. See `ARCHITECTURE.md` and `docs/SECURITY.md` for detail.

## Technologies and justification

| Area | Choice | Why |
| ---- | ------ | --- |
| Framework | Next.js (App Router) + React 19 | SSR + routing + API handlers in one toolchain. |
| Language | TypeScript (strict) | Catches null/ownership bugs early; no `any`. |
| Styling | Tailwind CSS + next-themes | Fast, consistent, accessible; light/dark theming. |
| Database | PostgreSQL | Relational integrity for a highly relational domain. |
| ORM | Prisma | Typed schema, migrations, and client. |
| Auth | Auth.js (NextAuth) credentials + JWT | Email/password with bcrypt; JWT carries the user id for the ownership rule. |
| Password hashing | bcryptjs (cost 12) | Pure-JS, no native build step across platforms. |
| Validation | Zod | Shared client/server schemas; server re-validates. |
| Charts | Recharts | Progress charts on `/dashboard/stats`, SSR-safe via `next/dynamic` `ssr:false`. |
| Unit tests | Vitest | Fast, no DB needed for the pure domain + importer tests. |
| E2E tests | Playwright | Critical-journey specs; user-run against a live DB. |
| Package manager | npm | Node v22 / npm v11; `type: module`. |

## Skills found and selected

During the quality-and-delivery audit the repository's `.kiro/skills` were
reviewed for applicable workflows. The **conventional-commits** skill was
selected as the authoring convention for commit messages and is located at:

```
.kiro/skills/conventional-commits/SKILL.md
```

(confirmed present during this work). It defines the Conventional Commits
format, types (`feat`, `fix`, `docs`, `refactor`, `chore`, `build`, `test`, …),
module scopes for this project (`auth`, `profile`, `nutrition`, …), and the
rule that a message must trace to a real diff. Per the phase rule, **no git
commits were made** in this phase, so the skill is cited as the convention to
follow, not executed.

## Folder structure

```
.
├─ prisma/        schema.prisma, migrations 0001-0004, data/ (curated seed), seed.ts
├─ src/
│  ├─ app/        App Router: landing, login/, register/, api/auth + api/register,
│  │              dashboard/ + dashboard/stats, exercises/, trainer/ + log + import,
│  │              nutrition/ + foods/log/market, profile/, recommendations/,
│  │              error.tsx + global-error.tsx (error boundaries)
│  ├─ components/ui/  button, input, card, theme-toggle (accessible primitives)
│  ├─ features/   auth, profile, trainer, nutrition, body, stats + stats/charts,
│  │              recommendations, dashboard, workouts/import
│  ├─ lib/domain/ pure tested math: nutrition, training, stats, plan-generator,
│  │              recommendations, types
│  ├─ server/db.ts    Prisma singleton
│  ├─ middleware.ts   NextAuth route-protection (matcher covers all auth pages)
│  └─ types/      next-auth augmentation
├─ e2e/           auth, route-protection, data-ownership, smoke-journeys (+ helpers, smoke)
└─ docs/          domain-equations, data-sources, routine-import-format, SECURITY
```

## Database model

The schema (`prisma/schema.prisma`, provider `postgresql`) models the full
relational domain. PKs are `cuid()` strings; mutable entities carry
`createdAt`/`updatedAt`.

### Entities and relationships

- **User** — root identity (email unique, `passwordHash`, optional name). Owns
  (1-to-many, cascade on delete): `UserProfile` (1-to-1), `FitnessGoal`,
  `WorkoutPlan`, `WorkoutSession`, `BodyMeasurement`, `NutritionPlan`,
  `FoodLog`, `DailyNutrition`, `WaterLog`, `ProgressRecord`.
- **UserProfile** — demographics, training availability, equipment, nutrition
  preferences, optional `foodBudget`, and the single safety boolean
  `flaggedForProfessionalReview` (see the limitation below).
- **FitnessGoal** — the user's goal (`GoalType` enum: HYPERTROPHY, FAT_LOSS,
  RECOMPOSITION, WEIGHT_GAIN, STRENGTH, ENDURANCE, MAINTENANCE), with one active
  goal kept in sync.
- **Training:** `WorkoutPlan` → `WorkoutDay` → `WorkoutExercise` →
  `ExerciseLog`; `WorkoutSession` groups logs. `Exercise` is a **shared
  read-only catalog** (provenance columns); `WorkoutExercise`/`ExerciseLog`
  reference it with `onDelete: Restrict`.
- **Body/progress:** `BodyMeasurement` (weight, body-fat, waist, hip) and
  `ProgressRecord` (metric + value).
- **Nutrition:** `NutritionPlan` → `Meal` → `MealItem`; `Food` is a **shared
  read-only USDA catalog** (per-100g macros + provenance). `FoodLog` records
  consumption; `DailyNutrition` is a cached per-day summary keyed
  `[userId, date]`; `WaterLog` is the raw water-intake source of truth.
- **Enums:** `Sex`, `ActivityLevel`, `ExperienceLevel`, `Equipment`,
  `GoalType`, `PlanSource` (NATIVE/IMPORTED), `MuscleGroup`, `MealType`,
  `ProgressMetric`.

Migrations: `0001_init`, `0002_profile_goals`, `0003_exercise_library`,
`0004_nutrition_catalog` — all committed under `prisma/migrations/`; **no new
migration was added** in this phase.

## Implemented features per module

- **auth** — registration, login, JWT sessions; bcrypt cost 12; scrubbed
  errors; `getCurrentUser()`/`requireUser()` ownership entry point.
- **profile** — create/update form (shared Zod), ownership-enforcing server
  action, and a computed-values summary (BMI, BMR, TDEE, calorie target, macro
  split) on `/profile` and `/dashboard`. Derived values are computed, not
  stored.
- **trainer** — exercise library at `/exercises`; profile-driven plan
  generation, plan saving, and the user's saved plans at `/trainer`; workout
  logging with per-muscle volume at `/trainer/log`; a routine-import UI at
  `/trainer/import` (paste/upload → preview → confirm, persisted as
  `source = IMPORTED`).
- **nutrition** — USDA food catalog at `/nutrition/foods`; calorie/macro targets
  + water tracking at `/nutrition` (reusing the profile `computeDerived` path);
  meal planning; food logging with consumed-vs-target at `/nutrition/log`; and a
  budget-aware market list at `/nutrition/market` (quantities only, never a
  fabricated price).
- **stats** — `/dashboard/stats`: training, nutrition, and body-composition
  charts over the user's own data (SSR-safe Recharts), plus body-measurement
  logging. All aggregation lives in `src/lib/domain/stats.ts`.
- **recommendations** — `/recommendations`: rule-based, evidence-labelled items
  (`calculation`/`rule`) built only from the user's logged data, with an
  explicit insufficient-data state, plus an optional `ai` section.
- **import** — `src/features/workouts/import` JSON/CSV parser reused by the
  trainer import UI; unmappable rows are surfaced, not dropped.
- **AI seam** — `src/features/recommendations/ai.ts`: a disabled stub gated by
  `FITMIND_AI_ENABLED` (OFF by default), no network call, no fabricated output;
  AI items are appended after rules and can never override a rule or safety gate.

## Tests executed — real results

The final verification gate was run in this environment with **no dev server
running**, in order. Real output:

| Check | Command | Result |
| ----- | ------- | ------ |
| Type check | `npm run typecheck` (`tsc --noEmit`) | **0 errors** (exit 0) |
| Lint | `npm run lint` (`next lint`) | **No ESLint warnings or errors** (exit 0) |
| Unit tests | `npm run test` (`vitest run`) | **125 passed / 125**, across **10 test files** (exit 0) |
| Build | `npm run build` (`prisma generate && next build`) | **Success — 19 routes**, middleware **63.3 kB**; `prisma generate` succeeded on the first try (no EPERM/DLL lock); build retry not needed (exit 0) |
| E2E type-check | `npx tsc --noEmit` | **0 errors** — the `e2e/*.spec.ts` are covered by tsconfig and compile (exit 0) |

Unit test files (all passing): `src/lib/domain/nutrition.test.ts` (33),
`src/lib/domain/plan-generator.test.ts` (17), `src/lib/domain/stats.test.ts`
(16), `src/lib/domain/recommendations.test.ts` (13),
`src/lib/domain/training.test.ts` (11), `prisma/data/foods.test.ts` (8),
`src/features/profile/validation.test.ts` (8),
`src/features/workouts/import/importer.test.ts` (7),
`prisma/data/exercises.test.ts` (6),
`src/lib/domain/volume-adapter.test.ts` (6). Total = 125.

### E2E — authored + user-run, NOT executed here

The Playwright specs under `e2e/` (`auth.spec.ts`, `route-protection.spec.ts`,
`data-ownership.spec.ts`, `smoke-journeys.spec.ts`, plus `helpers.ts` and the
original `smoke.spec.ts`) were **authored and type-checked** (`npx tsc
--noEmit` = 0 errors) but were **not executed in this environment**: there is no
live PostgreSQL here, and E2E needs the app running against the user's database
plus `npx playwright install`. No E2E result is reported as a pass or a fail
because none was run.

## What was verified here vs what needs your live database

**Verified in this environment** (real command output above):
type-check (0 errors), lint (clean), unit tests (125/125), production build
(19 routes), and e2e spec compilation (0 errors).

**Requires your live PostgreSQL (user-run, not verified here):**

- `npx prisma migrate deploy` — applying migrations `0001` → `0004`.
- `npm run db:seed` — seeding the curated exercise + food catalogs.
- `npm run test:e2e` — the Playwright suite (also needs `npx playwright
  install`).
- Any runtime behavior that reads/writes the database.

## Known limitations / pending issues

- **Nutrition safety-flag collapse.** The domain distinguishes three conditions
  (eating-disorder risk, pregnancy, metabolic disease) but the DB stores a
  single boolean `UserProfile.flaggedForProfessionalReview`, collapsing all
  three onto the domain `metabolicDisease` flag. Behavior is safe (any flag
  disables auto-targeting) but cannot tell the conditions apart. A faithful fix
  needs a schema change (new migration) and is out of scope this phase. The
  checkbox label already names all three honestly. (See `docs/SECURITY.md`.)
- **Progress photos — not implemented.** The schema has no photo field, so
  photo upload/comparison is intentionally not built and stays a labeled
  placeholder.
- **AI layer — disabled seam, OFF by default.** `FITMIND_AI_ENABLED` is unset by
  default; no live provider ships and no model output is fabricated.
- **E2E requires a live DB + `npx playwright install`** and was not run here.
- **WCAG not fully audited.** The accessibility work is a static/code audit;
  full WCAG 2.1 conformance needs manual assistive-tech testing and expert
  review. (See `docs/SECURITY.md`.)
- **Security items not covered:** rate limiting, CSRF specifics beyond NextAuth,
  a full restrictive CSP, and penetration testing — all listed in
  `docs/SECURITY.md`.
- **Per-plan detail/editing** is a labeled placeholder.

## Run locally (step by step)

```bash
# 1. Create the database from the psql shell:
#      CREATE DATABASE fitmind;
# 2. Copy the env template and fill in real values (never commit .env):
cp .env.example .env
#      DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/fitmind?schema=public
#      NEXTAUTH_SECRET=<openssl rand -base64 32>
#      NEXTAUTH_URL=http://localhost:3000
#      (FITMIND_AI_ENABLED optional, OFF by default)
# 3. Install deps (postinstall runs `prisma generate`):
npm install
# 4. Apply all migrations (0001 -> 0004):
npx prisma migrate deploy
# 5. Seed the curated catalogs:
npm run db:seed
# 6. Start the app:
npm run dev        # http://localhost:3000

# Tests:
npm run test       # unit (no DB)
npx playwright install && npm run test:e2e   # E2E (needs the live DB above)
```

See `README.md` for the full setup narrative, `ARCHITECTURE.md` for module
boundaries and ADR notes, and `docs/SECURITY.md` for the security/accessibility
model and audit table.
