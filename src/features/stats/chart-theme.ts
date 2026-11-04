/**
 * Theme-aware chart colors.
 *
 * Recharts needs concrete color strings (it does not read Tailwind classes), so
 * we build them from the same HSL CSS variables defined in
 * `src/app/globals.css`. Because each value is `hsl(var(--token))`, the browser
 * resolves it against the current `:root` / `.dark` palette, so every chart
 * follows the active light/dark theme without re-rendering.
 *
 * The multi-series palette is derived from those same tokens (hue-rotated from
 * the primary hue) so a chart with several lines/bars stays readable in both
 * themes instead of hard-coding light-only hex values.
 */

/** Primary accent (lines, single-series bars). */
export const PRIMARY = "hsl(var(--primary))";
/** Muted foreground — axis ticks, grid, secondary text. */
export const MUTED = "hsl(var(--muted-foreground))";
/** Border color — grid lines and axis strokes. */
export const BORDER = "hsl(var(--border))";
/** Primary foreground text. */
export const FOREGROUND = "hsl(var(--foreground))";
/** Card surface — tooltip/legend backgrounds. */
export const CARD = "hsl(var(--card))";

/**
 * A small categorical palette for multi-series charts (volume-by-muscle,
 * macros, measurements). Hues are offsets from the primary blue so the set
 * works against both the light and dark backgrounds; each entry is still a
 * literal `hsl(...)` string Recharts can consume directly.
 */
export const SERIES_PALETTE: readonly string[] = [
  "hsl(221 83% 53%)", // blue (primary-ish)
  "hsl(160 60% 42%)", // teal/green
  "hsl(28 90% 55%)", // amber
  "hsl(291 64% 55%)", // violet
  "hsl(0 72% 55%)", // red
  "hsl(199 89% 48%)", // cyan
  "hsl(84 60% 45%)", // lime
  "hsl(330 70% 55%)", // pink
  "hsl(45 93% 47%)", // gold
  "hsl(258 70% 60%)", // indigo
  "hsl(14 80% 55%)", // orange-red
  "hsl(174 60% 40%)", // dark teal
];

/** Returns a stable palette color for the series at `index` (wraps around). */
export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length] ?? PRIMARY;
}
