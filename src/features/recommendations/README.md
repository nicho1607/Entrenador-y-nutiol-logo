# recommendations

Adaptive training and nutrition recommendations for the signed-in user, built
**only** from that user's own logged data. Every item is labelled by how it was
produced and carries the evidence behind it; where the data is not enough to
compute something, the UI says so rather than guessing.

## The four rule categories

The pure engine (`src/lib/domain/recommendations.ts`) applies four conservative,
documented rule groups to already-computed inputs:

1. **Recovery / volume** — from per-muscle weekly rep-volume above an
   orientational ceiling and from the progression rule's own `HOLD` / `DECREASE`
   calls, suggest trimming volume or prioritizing recovery. It never recommends
   blindly increasing load; the progression call is reused, never re-derived.
2. **Stalled exercises** — for an exercise whose plateau window shows estimated
   1RM barely moving, suggest a deload, a rep-scheme change, or a technique
   check, citing the start/end 1RM and the % change.
3. **Low adherence** — when measured training adherence sits below a
   conservative threshold, suggest fewer, more sustainable planned days, with
   the measured percentage attached as a companion `calculation` fact.
4. **Nutrition gaps** — from target-compliance % and calorie/protein deltas,
   surface gentle consistency and intake prompts (eat a bit more when under
   target, prioritize protein when short, trim intake when over — subject to the
   safety rules below).

## How each basis is defined

- **`calculation`** — a deterministic value derived by the pure domain library
  from recorded data (e.g. the measured adherence %). A fact, not a suggestion.
- **`rule`** — a conservative heuristic applied to those calculations. Presented
  as guidance with the uncertainty kept explicit, never as a proven fact.
- **`ai`** — optional, clearly labelled AI text. **Off by default** and always
  appended AFTER the rule/calculation items, so it never replaces them.

## Safety guarantees

- **Never below the BMR floor.** When the calorie target is already clamped to
  the BMR floor, the engine states this and never suggests eating less.
- **Consult a professional.** When a safety gate (`professionalReviewRequired`)
  is active, a single `critical` consult-a-professional item is emitted and all
  numeric nutrition advice is suppressed.
- **No fabrication.** A missing input becomes an explicit `insufficientData`
  note — never an invented recommendation, and never fabricated AI output (the
  disabled AI seam resolves to `[]`).
- **AI cannot override safety.** Because AI items are appended last and carry
  `basis: 'ai'`, they can never replace a rule, a safety gate, or the BMR floor.

## File map

- `src/lib/domain/recommendations.ts` — the **pure, framework-free engine**
  (`buildRecommendations`): rules, thresholds, and the `Recommendation` /
  `EngineInput` types. Unit-tested in `recommendations.test.ts`.
- `src/features/recommendations/service.ts` — the **session-`userId`-scoped
  service** (`getRecommendations(userId)`): gathers inputs by reusing the
  existing trainer / nutrition services (adds no new query, re-implements no
  math), runs the engine, then appends the optional AI seam.
- `src/features/recommendations/ai.ts` — the **optional, disabled AI seam**
  behind `FITMIND_AI_ENABLED` (default OFF).
- `src/features/recommendations/recommendation-card.tsx` — the
  **presentation-only** card that renders a single recommendation with its basis
  badge, severity, rationale, and evidence.
- `src/app/recommendations/page.tsx` — the server page that guards the session,
  scopes the read to the user, and renders items grouped by basis (with the
  insufficient-data and empty states). An **Insights** card on `/dashboard`
  previews the top items and links here.
