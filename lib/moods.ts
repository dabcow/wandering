/**
 * The moods a cell can carry. Each tints the cell's background. The outline
 * model picks one per section; the writer can change it on the cell.
 */
export const MOOD_IDS = [
  "neutral",
  "calm",
  "warm",
  "joyful",
  "playful",
  "hopeful",
  "reflective",
  "somber",
  "tense",
  "bold",
] as const;

export type Mood = (typeof MOOD_IDS)[number];

export const MOODS: Record<Mood, { label: string; color: string; hint: string }> = {
  neutral: { label: "Neutral", color: "#6b7686", hint: "plain, informational" },
  calm: { label: "Calm", color: "#4fc3d9", hint: "steady, reassuring" },
  warm: { label: "Warm", color: "#eab05a", hint: "friendly, affectionate, grateful" },
  joyful: { label: "Joyful", color: "#f2dc4e", hint: "happy, celebratory" },
  playful: { label: "Playful", color: "#f283bd", hint: "light, humorous" },
  hopeful: { label: "Hopeful", color: "#86d96b", hint: "optimistic, looking forward" },
  reflective: { label: "Reflective", color: "#a98bfa", hint: "thoughtful, looking back" },
  somber: { label: "Somber", color: "#6a8fe0", hint: "sad, serious, heavy" },
  tense: { label: "Tense", color: "#f0565f", hint: "anxious, conflicted, suspenseful" },
  bold: { label: "Bold", color: "#ff7d3c", hint: "confident, forceful, rallying" },
};

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOOD_IDS as readonly string[]).includes(value);
}
