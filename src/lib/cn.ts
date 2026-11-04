/**
 * Minimal className joiner. Filters out falsy values so conditional classes
 * compose cleanly without pulling in an extra dependency.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
