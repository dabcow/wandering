import type { Attribute } from "./types";

/**
 * The style axes. The pentagon renders any number of these (N-gon), so adding,
 * removing or renaming an axis only means editing this list and, optionally,
 * giving it tailored wording in lib/ai/prompts.ts.
 */
export const DEFAULT_ATTRIBUTES: readonly Attribute[] = [
  { id: "professional", label: "Professional", value: 50 },
  { id: "concise", label: "Concise", value: 50 },
  { id: "warm", label: "Warm", value: 50 },
  { id: "persuasive", label: "Persuasive", value: 50 },
  { id: "vivid", label: "Vivid", value: 50 },
];

export function defaultAttributes(): Attribute[] {
  return DEFAULT_ATTRIBUTES.map((a) => ({ ...a }));
}

export function clampValue(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
