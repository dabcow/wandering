/**
 * The Length setting (0–100) decides how long the outline is relative to the
 * idea typed in step 1. 50 keeps it in step with the idea; lower condenses,
 * higher expands. Pure functions: used by the Style page and the prompt.
 */

export const DEFAULT_LENGTH = 50;
export const MAX_SECTIONS = 12;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Sections a piece naturally needs for an idea of this size, before the Length setting. */
function naturalSections(words: number): number {
  return Math.max(2, Math.min(9, Math.round(1 + 0.45 * Math.sqrt(words))));
}

/** How many outline sections to ask for. Length 0 halves the natural count, 100 doubles it. */
export function targetSections(idea: string, length: number): number {
  const clamped = Math.max(0, Math.min(100, length));
  const multiplier = 2 ** ((clamped - 50) / 50);
  const target = Math.round(naturalSections(countWords(idea)) * multiplier);
  return Math.max(1, Math.min(MAX_SECTIONS, target));
}

const BANDS = [
  "much tighter than the idea: only the essential beats",
  "tighter than the idea: the main beats, nothing extra",
  "in step with the idea: one section per main point",
  "more developed than the idea: its points broken into finer steps",
  "far more expanded than the idea: extra sections for context, examples and transitions",
] as const;

export function describeLength(length: number): string {
  const clamped = Math.max(0, Math.min(100, length));
  return BANDS[Math.min(4, Math.floor(clamped / 20))];
}
