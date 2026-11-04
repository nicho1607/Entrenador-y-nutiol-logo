# Architecture — FitMind AI

## Folder layout

```
.
├─ prisma/
│  ├─ schema.prisma        # full relational domain (provider: postgresql)
│  ├─ migrations/          # SQL migration(s) for the schema
│  ├─ data/                # curated, provenance-tracked seed data (exercises + foods)
│  └─ seed.ts              # idempotent exercise + food catalog seed (no fabricated data)
├─ src/
│  ├─ app/                 # Next.js App Router (routes, layout, API handlers)
│  │  ├─ api/auth/[...nextauth]/  # NextAuth route handler
│  │  ├─ api/register/     # registration endpoint
│  │  ├─ login/ register/  # auth pages
│  │  ├─ dashboard/        # protected overview (profile + trainer summary)
│  │  ├─ exercises/        # browsable exercise library (filterable)
│  │  ├─ trainer/          # generate/save plans; trainer/log/ logs sessions
│  │  └─ nutrition/        # targets+water+plans; foods/ catalog, log/ daily log,
│  │                       #   market/ budget-aware shopping list
│  ├─ components/          # shared app components
│  │  └─ ui/               # accessible UI primitives (button, input, card)
│  ├─ features/            # feature-oriented modules
│  │  ├─ auth/             # registration, login, sessions, ownership helpers
│  │  ├─ workouts/import/  # routine import (JSON/CSV parser + schemas)
│  │  ├─ profile/          # user profile: Zod schema, server action, service,
│  │  │                    #   derived-value display (calls the domain library)
│  │  ├─ trainer/          # exercise catalog, plan generate/save/read, logging,
│  │  │                    #   per-muscle volume (service + actions + UI forms)
│  │  ├─ nutrition/        # food catalog, targets + water, meal planning,
│  │  │                    #   food logging, market list (service+actions+UI)
│  │  ├─ dashboard/        # (placeholder)
│  │  └─ recommendations/  # adaptive recommendations: userId-scoped service +
│  │                       #   presentation card + optional (disabled) AI seam
│  ├─ lib/
│  │  ├─ domain/           # pure, framework-free calculations + tests
│  │  └─ cn.ts             # className helper
│  ├─ server/
│  │  └─ db.ts             # Prisma client singleton
│  └─ types/               # ambient type augmentation (next-auth)
├─ e2e/                    # Playwright specs: auth, route-protection,
│                         #   data-ownership, smoke-journeys (+ helpers, smoke)
└─ docs/                   # domain equations + routine-import format
```

## Module boundaries

- **`src/lib/domain`** is pure and has no Next.js/Prisma/React imports, so it is
  trivially unit-testable with Vitest. It knows nothing about persistence.
- **`src/server`** owns infrastructure (the Prisma client). Feature modules call
  into it; the domain library never does.
- **`src/features/*`** group UI + server logic + validation per product area.
  Shared Zod schemas live beside the feature and are imported by both client
  and server.
- **`src/components/ui`** holds presentation-only, accessible primitives with no
  business logic.

## Data-ownership rule

Every user-owned table references `User` and cascades on user deletion (see
`onDelete: Cascade` in `schema.prisma`). Server code identifies the caller
through a single helper, `getCurrentUser()` / `requireUser()`
(`src/features/auth/session.ts`), and must scope every query to that user's id.
The session JWT carries the user id so this is available everywhere on the
server. Catalog tables that are not user-owned (`Food`, `Exercise`) are shared
and use `onDelete: Restrict` from referencing rows to avoid orphaning logs.

## Decisions (ADR-style notes)

- **Next.js App Router + TypeScript strict.** One framework for routing, SSR,
  and API handlers; strict mode catches ownership/null bugs early. No `any`
  escape hatches.
- **PostgreSQL via Prisma.** Relational integrity (FKs, unique constraints,
  indexes) matches the domain. Provider is fixed to `postgresql`. The database
  is treated as external and possibly offline: this phase ships the migration
  SQL and documents the commands, and never claims a migration ran against a DB
  it cannot reach.
- **Auth.js (NextAuth) credentials + JWT.** Email/password with bcrypt-hashed
  passwords is sufficient for the foundation. JWT sessions carry the user id to
  power the ownership rule without an extra DB round-trip per request.
- **bcryptjs (pure JS).** Avoids a native build step across platforms.
- **Zod everywhere at the boundary.** Shared schemas validate client input and
  server payloads, including the routine importer and the user profile
  (`src/features/profile/validation.ts` is imported by both the client form and
  the `saveProfileAction` server action).
- **Profile derived values are computed, never stored.** The profile service
  (`src/features/profile/service.ts`) persists only the user's inputs; BMI, BMR,
  TDEE, calorie target, and macro split are recomputed on read by calling the
  pure domain library, which stays the single source of truth for the math. The
  primary goal is stored on the existing `FitnessGoal` model (one active goal
  kept in sync), not duplicated on `UserProfile`.
- **Domain library returns Result types, not throws.** Missing inputs and
  safety-gated situations are first-class outcomes, not exceptions, so the UI
  can surface them.
- **Recharts added now, used later.** Dependency is justified by the planned
  progress charts; no chart code ships in the foundation.
- **Vitest for unit, Playwright for E2E.** Vitest runs the pure domain,
  importer, and profile-validation tests fast with no DB. Playwright specs are
  authored for the critical journeys (auth, route-protection, data-ownership,
  smoke-journeys) and share a sign-in helper; they are **user-run** because they
  need a live PostgreSQL and `npx playwright install`, so they are type-checked
  in CI but executed by the user, not by the build here.
- **Nutrition is real, built on the same patterns.** `src/features/nutrition`
  ships a food catalog, targets + water tracking, meal planning, food logging,
  and a budget-aware market list — not a placeholder. It mirrors the trainer
  feature's structure (validation / labels / service / actions / UI forms) and
  obeys the data-ownership rule: plans, meals, items, food logs, and water logs
  are user-owned and every service query is scoped to the session user's id;
  `Food` is shared read-only reference data (like `Exercise`), written only by
  the seed.
- **Nutrition targets reuse the profile `computeDerived` path.** The nutrition
  service does not re-implement BMR/TDEE/calorie-target/macros/safety; it calls
  the profile feature's `computeDerived`, keeping a single source of truth for
  the energy math and the safety floor / professional-review gate. New
  portion-scaling, daily-totals, consumed-vs-target, market-list aggregation,
  dietary-filter, and water-target math lives in the pure domain library
  (`src/lib/domain/nutrition.ts`) and is unit-tested there — never inline in a
  component or re-derived in the service.
- **Water tracking: raw log + cached summary.** `WaterLog` is the user-owned
  source of truth for intake; `DailyNutrition.totalWaterMl` (and the macro
  totals) is a best-effort per-day cache keyed `[userId, date]`, refreshed when
  the daily summary is read. A cache write never breaks the read path.
- **Market lists never fabricate prices.** The catalog has no verifiable price
  source, so `generateMarketList` surfaces aggregated quantities only, reports
  `pricingAvailable: false`, and passes the profile's optional `foodBudget`
  through as context with an explicit "pricing not populated" note. Foods that
  match declared allergies / dietary restrictions are partitioned out with a
  reason via the pure `filterByDietary` helper.
- **Statistics math lives in `src/lib/domain/stats.ts`.** All aggregation — time
  bucketing, estimated-1RM over time, adherence %, target-compliance %,
  period-over-period comparison, and personal records — is a set of pure,
  framework-free helpers (no Prisma/React/Next imports) returning `DomainResult`
  and unit-tested in `stats.test.ts`. Empty inputs are valid outcomes, not
  errors. No formula is re-implemented: Epley e1RM is reused from `training.ts`,
  volume from `calculateTrainingVolume` / `logsToVolumeEntries`, macros from
  `nutrition.ts`. The trainer, nutrition, and body services add read-only,
  `userId`-scoped query functions that load only the caller's own rows and
  delegate every calculation to these helpers.
- **Charts are SSR-safe `ssr:false` client components.** Recharts measures the
  DOM and breaks under server rendering, so every chart under
  `src/features/stats/charts/` is a `'use client'` component and the
  `/dashboard/stats` server page imports them ONLY through
  `src/features/stats/charts/dynamic.tsx`, which re-exports each via
  `next/dynamic` with `{ ssr: false }`. This keeps `next build` from trying to
  server-render chart internals. Chart colors come from the globals.css HSL CSS
  vars via `hsl(var(--...))` (in `chart-theme.ts`) so they follow the active
  light/dark theme. Every chart ships a title, axis units, a legend where
  relevant, an adjacent accessible text alternative, and an explicit empty
  state; the page renders only the user's real session-scoped data and never a
  fabricated series.
- **Body measurements are the new user-owned write path.** `src/features/body`
  adds the only Phase 5 write (`logBodyMeasurement`), scoped to the session
  user's id and validated by a shared Zod schema on both client and server. It
  touches only the existing `BodyMeasurement` columns (weight, body fat, waist,
  hip, measuredAt) — no new migration — and invents no progress-photo storage,
  because the schema has no photo field; progress photos stay an honestly
  labeled placeholder.
- **Recommendations engine is a pure, framework-free boundary.** The adaptive
  recommendations math lives in `src/lib/domain/recommendations.ts`: a pure
  module (no Prisma/React/Next imports) whose `buildRecommendations(input)`
  turns ALREADY-COMPUTED inputs into a typed `Recommendation[]` — each item
  carrying `basis` + `evidence` + `rationale` + `severity`. The
  session-`userId`-scoped service `src/features/recommendations/service.ts`
  (`getRecommendations(userId)`) only ADAPTS the outputs of the existing
  trainer / nutrition / body services into the engine's `EngineInput`; it adds
  no new query and never re-implements training or nutrition math. When an
  underlying `DomainResult` fails, the input is mapped to `null` so the engine
  emits an explicit insufficient-data note rather than guessing.
- **Four-way basis distinction, kept explicit in the UI.** Every surfaced fact
  is one of four kinds, and the label makes which one visible: (1) **recorded
  data** — rows the user logged; (2) **deterministic calculations** — values
  the pure domain lib derives from recorded data (e.g. adherence %, estimated
  1RM), labelled `calculation`; (3) **rule-based recommendations** — the
  engine's conservative heuristics applied to those calculations, labelled
  `rule`; and (4) **optional AI text** — labelled `ai`, off by default. The
  engine itself emits only `calculation` and `rule` bases.
- **AI is a disabled seam behind a flag, never an override.**
  `src/features/recommendations/ai.ts` is a seam, not a live integration: it
  ships only a disabled stub that performs no network call and fabricates no
  model output (`generate` resolves to `[]`). It is gated by the
  `FITMIND_AI_ENABLED` env var (default OFF) so the app runs fully with no API
  key and no extra runtime dependency. The service APPENDS any AI items AFTER
  the rule/calculation output, so AI can never replace a rule, a safety gate, or
  the BMR floor; every AI item carries `basis: 'ai'`.
- **Routine import UI reuses the existing parser.** `/trainer/import` is a thin
  UI (paste/upload → preview → confirm) over the existing
  `src/features/workouts/import` parser and the trainer `savePlan` path; it
  forks neither. Confirming persists the normalized plan to the signed-in
  user's account with `source = IMPORTED` (the `PlanSource.IMPORTED` enum value
  already exists, so no new migration). Every write is scoped to the session
  user's id server-side; the client never supplies a userId, and unmappable
  rows are surfaced in the preview rather than dropped silently.
- **Route-protection middleware covers every authenticated page.** `src/
  middleware.ts` still re-exports NextAuth's middleware
  (`export { default } from "next-auth/middleware"`), but its `config.matcher`
  was expanded from `['/dashboard/:path*']` alone to also match
  `/profile/:path*`, `/trainer/:path*`, `/nutrition/:path*`,
  `/recommendations/:path*`, and `/exercises/:path*` (`/dashboard/:path*`
  already covers `/dashboard/stats`). The public routes `/`, `/login`,
  `/register` and the `/api/*` handlers are intentionally excluded (NextAuth's
  own API must stay reachable, and the login/register pages must render for
  signed-out users). The middleware is the first line of defense; each server
  page still guards with `getCurrentUser()` + `redirect('/login')`, so
  protection is defense-in-depth, not middleware-only.
- **Conservative security response headers, no restrictive CSP.**
  `next.config.mjs` exports an async `headers()` that applies to every route
  (`source: '/(.*)'`): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-DNS-Prefetch-Control: off`, and
  `Strict-Transport-Security: max-age=63072000; includeSubDomains` (HSTS is
  honored only over HTTPS and is a no-op on `http://localhost`). A restrictive
  `default-src` CSP is deliberately **not** shipped: it would break Next's
  inline runtime bootstrap and Recharts, and a correct nonce/hash-based policy
  is deferred rather than shipped half-working. `reactStrictMode` and
  `outputFileTracingRoot` are preserved.
- **Centralized, non-leaking error boundaries.** `src/app/error.tsx` is a
  `'use client'` route-segment boundary that accepts `{ error, reset }`, renders
  a generic message plus a themed reset button, and never renders `error.stack`
  or a raw `error.message` to the user; `src/app/global-error.tsx` is the
  root-level boundary that renders its own `<html><body>` with inline styles
  (the theme/providers may be unmounted at that point). Both only
  `console.error` the detail for developers, so no stack or secret leaks into
  the UI in production.
