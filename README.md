# FitMind AI

An intelligent personal trainer and sports-nutrition platform. On top of the
foundation (scaffolding, the full relational data model, authentication, a pure
domain calculation library, and a routine import module) and the user-profile
phase, this repository now includes the **intelligent trainer** (a curated
exercise library, profile-driven plan generation, plan saving, workout logging,
and per-muscle volume) and a **real nutrition module**: a curated USDA food
catalog, calorie/macro targets and water tracking, meal planning, food logging,
and a budget-aware market list. It also includes **dashboard progress charts**
and **body-measurement logging** on the `/dashboard/stats` page (SSR-safe
Recharts fed by real, session-scoped data). It also includes **adaptive
recommendations** at `/recommendations` (rule-based, evidence-labelled, with an
optional AI seam that is OFF by default) and a **routine-import UI** at
`/trainer/import`. Phase 7 adds the **quality-and-delivery** pass: expanded
route-protection middleware, conservative security response headers, centralized
non-leaking error boundaries, an accessibility pass, authored Playwright E2E
specs for the critical journeys (user-run against a live database), and the
delivery documentation (`docs/SECURITY.md`, `DELIVERY.md`). Progress photos
remain a labeled placeholder (the schema has no photo field), and the AI layer
stays a disabled seam that is OFF by default.

## Stack and why

| Area        | Choice                        | Why                                                                 |
| ----------- | ----------------------------- | ------------------------------------------------------------------- |
| Framework   | Next.js (App Router) + React  | SSR + routing + API handlers in one toolchain.                      |
| Language    | TypeScript (strict)           | Catches null/ownership bugs early; no `any` escape hatches.         |
| Styling     | Tailwind CSS + light/dark     | Fast, consistent, accessible primitives.                            |
| Database    | PostgreSQL                    | Relational integrity for a highly relational domain.                |
| ORM         | Prisma                        | Typed schema, migrations, and client.                               |
| Auth        | Auth.js (NextAuth) credentials| Email/password with bcrypt-hashed passwords; JWT sessions.          |
| Validation  | Zod                           | Shared client/server schemas (incl. the routine importer).          |
| Charts      | Recharts                      | Progress charts on `/dashboard/stats`, SSR-safe via `next/dynamic`. |
| Unit tests  | Vitest                        | Fast, no DB needed for the pure domain + importer tests.            |
| E2E tests   | Playwright                    | Specs authored for auth, route protection, data ownership, and smoke journeys; user-run against a live DB. |
| Package mgr | npm                           | Node v22 / npm v11.                                                 |

## Prerequisites

- Node v22+, npm v11+
- A locally running PostgreSQL instance (you create the database yourself)

## Environment variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string.                                  |
| `NEXTAUTH_SECRET`   | Secret used to sign session tokens (`openssl rand -base64 32`).|
| `NEXTAUTH_URL`      | App base URL, e.g. `http://localhost:3000`.                    |
| `FITMIND_AI_ENABLED`| Optional. Enables the (currently disabled) AI recommendation seam. **OFF by default**: AI recommendations are optional and the app runs fully with no API key — leaving this unset or `"false"` yields rule-based recommendations only. |

## Create the PostgreSQL database (from the psql SQL shell)

This project does **not** create or connect to your database automatically. Open
the psql shell and create the database yourself, for example:

```sql
-- in psql, connected as a superuser or a role that can create databases
CREATE DATABASE fitmind;
-- optional: a dedicated role
CREATE USER fitmind_user WITH PASSWORD 'change-me';
GRANT ALL PRIVILEGES ON DATABASE fitmind TO fitmind_user;
```

Then set `DATABASE_URL` in `.env` to match, e.g.:

```
postgresql://fitmind_user:change-me@localhost:5432/fitmind?schema=public
```

## Apply the schema / run migrations

Migration SQL files are committed under `prisma/migrations/`:

- `0001_init` — the full relational schema (foundation phase).
- `0002_profile_goals` — the user-profile phase: expands `GoalType` to the seven
  product goals, adds the `ExperienceLevel` and `Equipment` enums, and extends
  `UserProfile` with weight, experience, training availability, equipment,
  nutrition preferences, and an optional food budget.
- `0003_exercise_library` — the trainer phase: extends `Exercise` with
  `secondaryMuscles`, `equipment`, `difficulty`, `instructions`, and provenance
  (`sourceRef`, `sourceName`, `sourceLicense`). Additive and non-destructive.
- `0004_nutrition_catalog` — the nutrition phase: extends `Food` with
  `referenceQtyG`, `category`, and provenance (`sourceRef`, `sourceName`,
  `sourceLicense`, `fdcId`); adds `DailyNutrition.totalWaterMl`; and adds the
  user-owned `WaterLog` table. Additive and non-destructive. Its `migration.sql`
  is UTF-8 **without** a BOM and contains no null bytes.

Once your database exists and `DATABASE_URL` points at it:

```bash
# generate the Prisma client
npx prisma generate

# apply ALL committed migrations (0001 → 0002 → 0003 → 0004) to your database
npx prisma migrate deploy
```

`migrate deploy` applies only the migrations your database has not seen yet, in
order. You can also use `npm run db:migrate` (`prisma migrate dev`) during
development.

> Every migration `.sql` file is UTF-8 **without** a BOM and contains no null
> bytes (PostgreSQL rejects UTF-16 / embedded-null SQL with
> `string contains embedded null`). These later phases were built without a live
> database, so `0002_profile_goals`, `0003_exercise_library`, and
> `0004_nutrition_catalog` were generated/hand-written from the schema and their
> encoding verified; they have **not** been run against any server here. Running
> `npx prisma migrate deploy` against your own PostgreSQL is the step that
> actually alters your tables.

During development you can instead use `npm run db:migrate` (`prisma migrate
dev`), which creates and applies new migrations as the schema evolves.

> The foundation was built without a live database. The migration SQL was
> generated with `prisma migrate diff` (create-only style), so it exists even
> though no migration was applied against a running server here. Running the
> commands above against your own PostgreSQL is the step that actually creates
> the tables.

## Seed the exercise and food catalogs

Once your database exists and all migrations are applied:

```bash
# apply migrations (0001 → 0002 → 0003 → 0004) first
npx prisma migrate deploy

# then seed the curated exercise AND food catalogs
npm run db:seed
```

The seed inserts a curated, provenance-tracked **exercise** catalog
(`prisma/data/exercises.ts`) and a curated USDA **food** catalog
(`prisma/data/foods.ts`), both via idempotent `upsert` keyed by each row's
unique name, so it is safe to re-run and is additive (it only inserts missing
rows or refreshes existing ones). Every row cites its source and license (see
`docs/data-sources.md`) — no nutrition values or prices are fabricated.
Seeding requires your live PostgreSQL; it has not been run against any server
here.

## Scripts

| Script              | Does                                            |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the dev server.                           |
| `npm run build`     | `prisma generate` + `next build`.               |
| `npm run start`     | Start the production server.                    |
| `npm run lint`      | ESLint.                                          |
| `npm run typecheck` | `tsc --noEmit` (strict).                         |
| `npm run test`      | Vitest unit tests (domain + importer + profile validation). |
| `npm run test:watch`| Vitest in watch mode.                            |
| `npm run test:e2e`  | Playwright E2E (user-run; needs a live DB — see Testing). |
| `npm run db:migrate`| `prisma migrate dev`.                            |
| `npm run db:seed`   | Seed the curated exercise + food catalogs (idempotent). |
| `npm run db:studio` | Open Prisma Studio.                              |
| `npm run postinstall` | Runs `prisma generate` after `npm install` (automatic). |

## Run locally (full ordered setup)

Follow these steps in order. They assume Node v22+, npm v11+, and a locally
running PostgreSQL.

```bash
# 1. Create the database from the psql SQL shell (connected as a role that can
#    create databases):
#      CREATE DATABASE fitmind;
#    (see "Create the PostgreSQL database" above for the optional dedicated role)

# 2. Copy the env template and fill in real values (NEVER commit .env):
cp .env.example .env
#    then set in .env:
#      DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/fitmind?schema=public
#      NEXTAUTH_SECRET=<openssl rand -base64 32>
#      NEXTAUTH_URL=http://localhost:3000
#    (FITMIND_AI_ENABLED is optional and OFF by default — leave it unset)

# 3. Install dependencies (postinstall runs `prisma generate` for you):
npm install

# 4. Apply every committed migration (0001 -> 0002 -> 0003 -> 0004):
npx prisma migrate deploy

# 5. Seed the curated exercise + food catalogs (idempotent, additive):
npm run db:seed

# 6. Start the dev server and open http://localhost:3000
npm run dev
```

`FITMIND_AI_ENABLED` is **OFF by default**: leave it unset (or `"false"`) and the
app runs fully with no API key, returning rule-based recommendations only. The
AI layer is a disabled seam that makes no network call and fabricates no model
output.

## Testing

### Unit tests (no database)

The Vitest suite covers the pure domain library, the routine importer, and the
profile validation — none of it needs a database:

```bash
npm run test        # single run (CI-style)
npm run test:watch  # watch mode
```

### End-to-end tests (user-run; needs a live database)

Playwright specs live under `e2e/` and cover the critical journeys: registration
and login (`auth.spec.ts`), route-protection redirects for unauthenticated users
(`route-protection.spec.ts`), surface-level data ownership between two users
(`data-ownership.spec.ts`), and the logged-in happy path across profile, trainer,
nutrition, import, and recommendations (`smoke-journeys.spec.ts`), plus the
original `smoke.spec.ts`.

E2E is **user-run**: it needs the app running against **your live PostgreSQL**
(migrated and seeded) and the Playwright browsers installed. The specs were
authored and type-checked in this repository but were **not executed here**
(no live database is available in the build environment).

```bash
# one-time: install the Playwright browser binaries
npx playwright install

# then run the suite (playwright.config.ts auto-starts `npm run dev` on :3000)
npm run test:e2e
```

## Documentation

- `ARCHITECTURE.md` — folder layout, module boundaries, data-ownership rule, decisions.
- `docs/domain-equations.md` — every nutrition/training equation, units, assumptions, limitations.
- `docs/routine-import-format.md` — the JSON + CSV routine import format.
- `docs/data-sources.md` — exercise- and food-data provenance and licensing.
- `docs/SECURITY.md` — security/isolation model, audit table, accessibility checklist, and what is not covered.
- `DELIVERY.md` — the delivery report: architecture, tech choices, DB model, features, real verification results, and limitations.

## What is real vs placeholder

- **Real:** scaffolding, strict TS, Tailwind + theming, the full Prisma schema +
  migration SQL, registration/login/sessions/route protection, the pure domain
  library (with passing Vitest tests), the routine importer (with tests), and
  the **user profile**: create/update form with shared Zod validation, a
  server action that enforces data ownership, and a computed-values summary
  (BMI, BMR, TDEE, calorie target, macro split) rendered on `/profile` and
  summarized on `/dashboard`. Derived values are computed by the domain library,
  not stored; missing inputs and flagged situations show the library's signals
  instead of fabricated numbers.
- **Real (trainer phase):** the **exercise library** at `/exercises` (a curated,
  provenance-tracked catalog, filterable by muscle group, equipment, and
  difficulty); the **trainer** at `/trainer`, which generates a workout plan from
  the signed-in user's profile and active goal (each recommendation shows its
  reason), saves it to the user's account, and lists their own saved plans;
  **workout logging** at `/trainer/log`, which records per-set weight/reps and an
  optional RIR/RPE and shows per-muscle training volume computed by the domain
  library; and a **trainer summary** on `/dashboard`. All reads/writes are scoped
  to the signed-in user; the exercise catalog is shared read-only reference data.
  Plan generation and volume/progression math live in the pure domain library.
- **Real (nutrition phase):** the **food catalog** at `/nutrition/foods` (a
  curated, provenance-tracked USDA catalog, searchable by name, with per-100g
  calories/macros and each row's source + license); **targets + water** at
  `/nutrition`, which reuse the profile `computeDerived` path (BMI orientational,
  BMR safety floor, missing-input / consult-a-professional signals) and add an
  orientational water target with water logging; **meal planning** (create plans,
  add meals, add foods by grams, substitute foods, per-item/per-meal/daily macro
  summaries); **food logging** at `/nutrition/log` with a consumed-vs-target
  daily summary; a **budget-aware market list** at `/nutrition/market` that
  aggregates a plan's foods by grams, screens them against declared
  allergies/restrictions, and surfaces the food budget without ever fabricating
  a price (quantities only); and a **nutrition summary** on `/dashboard`. All
  reads/writes are scoped to the signed-in user; the `Food` catalog is shared
  read-only reference data. Scaling/summary/market/dietary math lives in the pure
  domain library.
- **Real (stats phase):** the **Full statistics** page at `/dashboard/stats`,
  which renders the user's own logged data in three sections — Training (weekly
  frequency, per-muscle rep-volume, estimated-1RM progression, personal records,
  program adherence), Nutrition (calories vs target, macros vs targets,
  target-compliance %, meal history), and Body composition (weight history,
  waist/hip/body-fat history, this-month-vs-last-month comparison) — plus
  **body-measurement logging** (weight, body fat, waist, hip) via a shared
  Zod-validated form and a session-scoped write path. Every chart has a title,
  axis units, a legend where relevant, an adjacent accessible text alternative,
  theme-aware colors, and an explicit empty state; charts are `'use client'`
  components imported through a `next/dynamic` `ssr:false` wrapper so Recharts
  never server-renders. All aggregation math lives in the pure
  `@/lib/domain/stats` library; all reads/writes are scoped to the signed-in
  user.
- **Real (recommendations + import phase):** **adaptive recommendations** at
  `/recommendations`, built only from the signed-in user's own logged data and
  grouped by basis — `calculation` (deterministic facts from the pure domain
  lib), `rule` (conservative heuristics across recovery/volume, stalled
  exercises, low adherence, and nutrition gaps), and an optional `ai` section.
  The engine (`src/lib/domain/recommendations.ts`) is pure and never re-derives
  training/nutrition math or fabricates advice; where it cannot compute
  something it shows an explicit "not enough data" note, and safety is respected
  (consult-a-professional gate, never a suggestion to eat below the BMR floor).
  An **Insights** card on `/dashboard` previews the top items and links here.
  The **routine-import UI** at `/trainer/import` reuses the existing JSON/CSV
  parser and the trainer save path (paste/upload → preview → confirm), persists
  the plan as `source = IMPORTED` scoped to the signed-in user, and lists
  unmappable rows rather than dropping them. The AI layer is a **disabled seam**
  gated by `FITMIND_AI_ENABLED` (OFF by default): no live provider ships, no
  model output is fabricated, and AI never overrides the rule-based or safety
  logic.
- **Real (quality + delivery phase):** expanded route-protection middleware
  covering every authenticated page, conservative security response headers
  (nosniff, frame-deny, referrer policy, HSTS over HTTPS), centralized
  non-leaking error boundaries (`src/app/error.tsx`, `src/app/global-error.tsx`),
  an accessibility pass (programmatic hint/error association on the profile form,
  audited labels/focus states/chart text-alternatives), authored Playwright E2E
  specs for the critical journeys, and the delivery docs (`docs/SECURITY.md`,
  `DELIVERY.md`). See `docs/SECURITY.md` for the audit table and the honest
  not-covered section.
- **Placeholder (labeled as such):** per-plan detail/editing and progress photos
  (the schema has no photo field, so upload/comparison is intentionally not
  built) — shown in clearly labeled cards, no dead buttons presented as working
  features. The AI recommendation layer is a **disabled seam**, OFF by default.
- **User-run (not executed in this repo):** database migration + seeding and the
  Playwright E2E suite, which both require the user's live PostgreSQL (and
  `npx playwright install` for E2E). The E2E specs are authored and type-check
  but were not run here.
