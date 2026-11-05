/**
 * Theme-aware chart colors.
 *
 * Recharts needs concrete color strings (it does not read Tailwind classes), so
 * we build them from the same HSL CSS variables defined in
 * `src/app/globals.css`. Because each value is `hsl(var(--token))`, the browser
 * resolves it against the current `:root` / `.dark` palette, so every chart
 * follows the active light/dark theme without re-rendering.
 *
 * The multi-series palette is derived from those same tokens (built around the
 * competition-plate colours) so a chart with several lines/bars stays readable in both
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
 * macros, measurements). It opens with the competition-plate colours of the
 * app's identity (blue 20 kg, yellow 15 kg, red 25 kg, green 10 kg), then
 * adds hues that stay distinct on both the iron and chalk backgrounds; each
 * entry is a literal `hsl(...)` string Recharts can consume directly.
 */
export const SERIES_PALETTE: readonly string[] = [
  "hsl(211 62% 55%)", // plate blue
  "hsl(45 87% 52%)", // plate yellow
  "hsl(8 72% 56%)", // plate red
  "hsl(145 50% 42%)", // plate green
  "hsl(280 45% 62%)", // violet
  "hsl(190 70% 45%)", // cyan
  "hsl(25 85% 55%)", // orange
  "hsl(330 60% 60%)", // pink
  "hsl(80 50% 45%)", // olive
  "hsl(240 45% 65%)", // periwinkle
  "hsl(170 50% 38%)", // dark teal
  "hsl(30 25% 55%)", // leather
];

/** Returns a stable palette color for the series at `index` (wraps around). */
export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length] ?? PRIMARY;
}
