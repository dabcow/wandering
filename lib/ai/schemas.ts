import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const attributeSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  value: z.number().min(0).max(100),
});
export const attributesSchema = z.array(attributeSchema).min(3).max(12);

/* ---------- What the model must return ---------- */

export const aiOutlineSchema = z.object({
  title: text(200),
  sections: z
    .array(z.object({ heading: text(200), intent: text(600) }))
    .min(1)
    .max(12),
});
export type AIOutline = z.infer<typeof aiOutlineSchema>;

export const aiDraftSchema = z.object({
  paragraphs: z.array(text(6000)).min(1).max(12),
});

export const aiAlternativesSchema = z.object({
  alternatives: z.array(text(6000)).min(1).max(8),
});

/* ---------- What the browser sends to our routes ---------- */

export const outlineRequestSchema = z.object({
  idea: text(8000),
  attributes: attributesSchema,
});

/** The user-edited outline: intents may be left blank. */
export const outlineInputSchema = z.object({
  title: z.string().trim().max(200),
  sections: z
    .array(z.object({ heading: text(200), intent: z.string().trim().max(600) }))
    .min(1)
    .max(12),
});
export type OutlineInput = z.infer<typeof outlineInputSchema>;

export const draftRequestSchema = z.object({
  idea: text(8000),
  attributes: attributesSchema,
  outline: outlineInputSchema,
});

export const alternativesContextSchema = z.object({
  idea: z.string().max(8000),
  title: z.string().max(200),
  heading: z.string().max(200),
  before: z.string().max(6000),
  after: z.string().max(6000),
});
export type AlternativesContext = z.infer<typeof alternativesContextSchema>;

export const alternativesRequestSchema = z.object({
  paragraph: text(6000),
  context: alternativesContextSchema,
  attributes: attributesSchema,
  n: z.number().int().min(3).max(5).default(4),
  /** Rewrites already shown, so "more alternatives" doesn't repeat them. */
  avoid: z.array(z.string().max(6000)).max(10).default([]),
});

/* ---------- What our routes send back ---------- */

export type OutlineResponse = { outline: AIOutline };
export type DraftResponse = { paragraphs: string[] };
export type AlternativesResponse = { alternatives: string[] };
export type StatusResponse = {
  provider: string;
  model: string | null;
  configured: boolean;
};
