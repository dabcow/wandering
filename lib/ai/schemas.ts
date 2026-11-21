import { z } from "zod";
import { MAX_SECTIONS } from "../length";
import { MOOD_IDS } from "../moods";

const text = (max: number) => z.string().trim().min(1).max(max);

export const attributeSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  value: z.number().min(0).max(100),
});
export const attributesSchema = z.array(attributeSchema).min(3).max(12);

/** A mood from the model: tolerate casing, and fall back to neutral for anything unknown. */
const moodSchema = z
  .preprocess((value) => (typeof value === "string" ? value.trim().toLowerCase() : value), z.enum(MOOD_IDS))
  .catch("neutral");

/* ---------- What the model must return ---------- */

export const aiOutlineSchema = z.object({
  title: text(200),
  sections: z
    .array(z.object({ heading: text(200), intent: text(600), mood: moodSchema }))
    .min(1)
    .max(MAX_SECTIONS),
});
export type AIOutline = z.infer<typeof aiOutlineSchema>;

/* ---------- What the browser sends to our routes ---------- */

export const outlineRequestSchema = z.object({
  idea: text(8000),
  attributes: attributesSchema,
  length: z.number().min(0).max(100),
});

/* ---------- What our routes send back ---------- */

export type OutlineResponse = { outline: AIOutline };
export type StatusResponse = {
  provider: string;
  model: string | null;
  configured: boolean;
};
