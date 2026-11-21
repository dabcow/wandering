import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

const beatSchema = z.object({ title: text(160), description: text(600) });

/* ---------- What the model must return ---------- */

export const aiGuideRailSchema = z.object({
  title: text(200),
  beats: z.array(beatSchema).min(3).max(16),
});
export type AIGuideRail = z.infer<typeof aiGuideRailSchema>;

export const aiOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        title: text(160),
        summary: text(700),
        isEnding: z.boolean().catch(false),
      }),
    )
    .min(1)
    .max(8),
});
export type AIOption = z.infer<typeof aiOptionsSchema>["options"][number];

export const aiPremiseSchema = z.object({ premise: text(1000) });

export const aiTidySchema = z.object({ text: text(2000) });

/* ---------- What the browser sends to our routes ---------- */

const idea = text(8000);
const pacing = z.number().min(0).max(100);

export const guideRailRequestSchema = z.object({ idea, pacing });

export const optionsRequestSchema = z.object({
  idea,
  pacing,
  /** Empty when the writer started from scratch, without an outline. */
  guideRail: z.array(beatSchema).max(16),
  /** The chosen plot points from the first level down to the parent. Empty for level 1. */
  path: z.array(z.object({ title: z.string().max(200), summary: z.string().max(1000) })).max(40),
  plot: z.enum(["main", "b"]),
  bPremise: z.string().max(2000).default(""),
  /** A text listing of the other plot's tree, for awareness. */
  otherPlot: z.string().max(6000).default(""),
  /** Titles already offered or chosen under this parent. */
  avoid: z.array(z.string().max(200)).max(40).default([]),
  count: z.number().int().min(2).max(5).default(4),
});
export type OptionsRequest = z.infer<typeof optionsRequestSchema>;

export const tidyRequestSchema = z.object({ idea });

export const premiseRequestSchema = z.object({
  idea,
  mainTree: z.string().max(6000).default(""),
});

/* ---------- What our routes send back ---------- */

export type GuideRailResponse = AIGuideRail;
export type OptionsResponse = { options: AIOption[] };
export type PremiseResponse = { premise: string };
export type TidyResponse = { text: string };
export type StatusResponse = {
  provider: string;
  model: string | null;
  configured: boolean;
};
