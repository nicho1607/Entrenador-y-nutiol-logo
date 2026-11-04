# stats

The statistics UI layer: SSR-safe Recharts chart components and the labels /
theme they share. This module owns only presentation — it does no data fetching
and no calculation. The `/dashboard/stats` page fetches the real,
session-scoped aggregations (from the trainer, nutrition, and body services,
which in turn delegate to the pure `@/lib/domain/stats` helpers) and passes
already-shaped plain-data props into these charts.

## What this module owns

- `chart-theme.ts` — theme-aware color strings built from the globals.css HSL
  CSS vars (`hsl(var(--primary))`, `hsl(var(--muted-foreground))`, etc.) plus a
  small categorical `SERIES_PALETTE` for multi-series charts. Colors resolve
  against the active `:root` / `.dark` palette, so every chart follows the
  current light/dark theme.
- `labels.ts` — re-exports `MUSCLE_GROUP_LABELS` from the trainer feature and
  adds period labels so charts and summaries render identical strings.
- `charts/*.tsx` — the `'use client'` chart components. Each wraps a Recharts
  chart in a `ResponsiveContainer` with an accessible `aria-label`, axis labels
  that include units, and a `<Legend>` where multi-series. Each accepts
  already-aggregated plain-data props (no fetching inside a chart) and renders
  `null` when given no rows — the page supplies the empty-state copy and the
  adjacent accessible text alternative (a summary line or data table).
- `charts/dynamic.tsx` — the ONLY entry point the page imports from. It
  re-exports each chart via `next/dynamic` with `{ ssr: false }` and a loading
  placeholder, so Recharts never server-renders and `next build` does not break
  on chart internals.

## SSR rule

Recharts measures the DOM and fails under server rendering. The page therefore
imports charts exclusively from `charts/dynamic.tsx`; importing a chart module
directly into a server component is not allowed.

## No fabricated data

Charts render only what the page hands them. When a user has logged nothing, the
page shows an explicit "no data yet" note instead of a sample or placeholder
series. Progress photos are an honestly labeled "not available yet" placeholder
because the schema has no photo field.

## Where the math lives

All aggregation math is in the pure, framework-free `@/lib/domain/stats`
library (FEAT-001), unit-tested there. This module never computes — it only
draws.
