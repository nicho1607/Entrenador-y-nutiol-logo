# Security & Accessibility Model

This document records FitMind AI's security and isolation model, an audit of
each hardening item (PASS where already compliant, FIXED where changed in the
quality-and-delivery phase), the accessibility checklist, and an honest account
of what is **not** covered. It is grounded in the code as shipped; it does not
claim guarantees that were not verified.

## Security model

### Per-user data isolation

The data-ownership rule is the core of the model. Server code never trusts a
client-supplied user id. Instead it identifies the caller through a single
helper, `getCurrentUser()` / `requireUser()` in
`src/features/auth/session.ts`, which reads the user id from the signed
NextAuth JWT session. Every user-owned service function takes that id from the
session and scopes every query to it:

- `src/features/profile/service.ts`, `trainer/service.ts`,
  `nutrition/service.ts`, `body/service.ts`, and `recommendations/service.ts`
  all load and write only the caller's own rows.
- The catalog tables `Food` and `Exercise` are **shared, read-only** reference
  data by design; they are written only by the seed, never by user actions.
- Every user-owned table references `User` and cascades on user deletion
  (`onDelete: Cascade` in `prisma/schema.prisma`); catalog references use
  `onDelete: Restrict` to avoid orphaning logs.

### Input validation

Zod schemas are shared between client and server (e.g.
`src/features/profile/validation.ts`, the auth schemas, the routine importer).
Client forms validate for UX, and the server actions **re-validate** the same
payload before persisting — the client check is never trusted as the only gate.

### Authentication & passwords

Auth.js (NextAuth) credentials provider with JWT sessions. Passwords are hashed
with **bcryptjs at cost 12**; authentication errors are scrubbed to generic
messages so they do not reveal whether an email exists.

### Route protection (defense in depth)

- **Middleware** (`src/middleware.ts`) re-exports NextAuth's middleware and its
  `config.matcher` covers every authenticated page:
  `/dashboard/:path*`, `/profile/:path*`, `/trainer/:path*`,
  `/nutrition/:path*`, `/recommendations/:path*`, `/exercises/:path*`. Public
  routes (`/`, `/login`, `/register`) and the `/api/*` handlers are
  intentionally excluded.
- **Server pages** still guard individually with `getCurrentUser()` +
  `redirect('/login')`, so protection does not depend on the middleware alone.

### Security response headers

`next.config.mjs` applies to every route (`source: '/(.*)'`):

| Header | Value | Purpose |
| ------ | ----- | ------- |
| `X-Content-Type-Options` | `nosniff` | Stop MIME-type sniffing. |
| `X-Frame-Options` | `DENY` | Block clickjacking via framing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage. |
| `X-DNS-Prefetch-Control` | `off` | Avoid speculative DNS lookups. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Force HTTPS (honored only over HTTPS; a no-op on `http://localhost`). |

### Error handling (no leak)

Centralized error boundaries — `src/app/error.tsx` (route-segment) and
`src/app/global-error.tsx` (root-level) — render a generic message and a reset
affordance only. They never render `error.stack` or a raw `error.message` to
the user; detail is `console.error`'d for developers. No stack trace or secret
reaches the UI.

### Secret handling

`.env` is git-ignored (`.gitignore` covers `.env*` while keeping
`.env.example`). `.env.example` holds **placeholders only**; the real `.env` is
never read or echoed by the application code or by this delivery work.

## Security audit table

Each item below is from the FEAT-001 security pass. PASS = verified already
compliant and left unchanged; FIXED = changed in this phase.

| # | Item | Result | Reference |
| - | ---- | ------ | --------- |
| 1 | Per-user ownership scoping (profile/trainer/nutrition/body/recommendations) | PASS | `src/features/*/service.ts`, `src/features/auth/session.ts` |
| 2 | Catalog tables shared read-only, not user-scoped (by design) | PASS | `Food`, `Exercise` in `prisma/schema.prisma` |
| 3 | Zod validation on client **and** server (server re-validates) | PASS | `src/features/*/validation.ts`, server actions |
| 4 | bcrypt password hashing at cost 12 | PASS | `src/features/auth/password.ts` |
| 5 | Route-protection middleware matcher covers every authenticated page | FIXED | `src/middleware.ts` (expanded from `/dashboard` only) |
| 6 | Conservative security response headers on all routes | FIXED | `next.config.mjs` `headers()` |
| 7 | Centralized, non-leaking error boundaries | FIXED | `src/app/error.tsx`, `src/app/global-error.tsx` |
| 8 | Dead documentation link in `/trainer/import` (404, no `public/`) | FIXED | `src/app/trainer/import/page.tsx` (inline `<details>` format reference) |
| 9 | Stale landing copy overclaiming "features arrive in upcoming phases" | FIXED | `src/app/page.tsx` |
| 10 | `.env` git-ignored; `.env.example` placeholders only; `.env` never read | PASS | `.gitignore`, `.env.example` |

## Accessibility checklist

From the FEAT-002 accessibility pass. This is a targeted static/code audit of
the React source, **not** a full WCAG 2.1 conformance audit.

| Item | Result | Note |
| ---- | ------ | ---- |
| Labels associated with every control | PASS | `<label htmlFor>` across profile/login/register/body/nutrition/trainer forms; icon-only buttons carry `aria-label`. |
| Hint/error programmatically associated (`aria-describedby`) | FIXED | Profile-form `Field` helper now injects `aria-describedby` built from `[hintId, errorId]` via `React.cloneElement`, covering both `<Input>` and native `<select>`; `aria-invalid` retained. |
| Form-level error/status messages | PASS | Login/register/body/nutrition/trainer use a single `role='alert'`/`role='status'` live region — acceptable; left unchanged. |
| Visible focus states | PASS | Primitives use `focus-visible:ring-2 focus-visible:ring-ring`. |
| Color not the sole signal | PASS | Errors conveyed with words + `role='alert'`, not color alone. |
| Chart text alternatives | PASS | Every stats chart ships a title, axis units, a legend where relevant, an `aria-label`, an adjacent plain-text summary, and an explicit empty state. |
| Light/dark legibility | PASS | Charts read colors from CSS custom properties (next-themes) so they adapt to the active theme. |

## Known limitation — nutrition safety-flag collapse

The domain safety model distinguishes **three** conditions that should disable
automatic calorie targeting: eating-disorder risk, pregnancy, and metabolic
disease (`SafetyFlags` in the domain library, surfaced as the
`PROFESSIONAL_REVIEW_REQUIRED` gate). The database, however, stores only a
single boolean, `UserProfile.flaggedForProfessionalReview`, which maps onto the
domain's `metabolicDisease` flag and therefore **collapses all three conditions
into one**. The app behaves correctly and safely (any one condition disables
auto-targeting and asks the user to consult a professional), but it cannot
distinguish *which* condition applies, so it cannot tailor the message per
condition.

A faithful fix needs a schema change (three distinct columns or a flags table)
and therefore a Prisma migration, which is **out of scope** for this phase (no
new migration). The user-facing checkbox label in
`src/features/profile/profile-form.tsx` already names all three conditions
honestly, so no copy change was required. This is recorded here and in
`DELIVERY.md` as a known limitation.

## What is NOT covered

These are deliberately out of scope and are **not** claimed to be in place:

- **Rate limiting / brute-force throttling.** No login or API rate limiting is
  implemented.
- **CSRF specifics.** Beyond NextAuth's own handling and same-origin
  assumptions, no additional CSRF token layer was added or audited.
- **Full Content-Security-Policy.** No restrictive `default-src` CSP is shipped
  — it would break Next's inline runtime and Recharts. A nonce/hash-based CSP is
  deferred.
- **Penetration testing.** No dynamic security testing, fuzzing, or pen-test was
  performed.
- **Full WCAG conformance.** The accessibility work is a static/code audit only.
  Full WCAG 2.1 conformance requires manual testing with assistive technologies
  (screen readers such as NVDA/VoiceOver, keyboard-only navigation) and expert
  review, which was not performed here and is not claimed.
- **Secrets management at scale.** `.env` is sufficient for local/dev use; no
  vault/KMS integration is provided.
