import { z } from "zod";
import { attributeSchema } from "./ai/schemas";
import { defaultAttributes } from "./attributes";
import { DEFAULT_LENGTH } from "./length";
import { MOOD_IDS } from "./moods";
import { STEPS, type Project } from "./types";

const STORAGE_KEY = "wandering:project:v2";
const V1_STORAGE_KEY = "wandering:project:v1";

const projectSchema = z.object({
  version: z.literal(2),
  step: z.enum(STEPS),
  idea: z.string(),
  attributes: z.array(attributeSchema).min(3),
  length: z.number().min(0).max(100),
  title: z.string(),
  cells: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      intent: z.string(),
      mood: z.enum(MOOD_IDS).catch("neutral"),
      started: z.boolean(),
      text: z.string(),
      alternates: z.array(z.object({ id: z.string(), text: z.string() })),
    }),
  ),
});

/** The first saved format, where the outline and the (AI-drafted) cells were separate lists. */
const v1Schema = z.object({
  version: z.literal(1),
  step: z.string(),
  idea: z.string(),
  attributes: z.array(attributeSchema).min(3),
  outline: z
    .object({
      title: z.string(),
      sections: z.array(z.object({ id: z.string(), heading: z.string(), intent: z.string() })),
    })
    .nullable(),
  cells: z.array(
    z.object({ id: z.string(), heading: z.string(), text: z.string(), history: z.array(z.string()) }),
  ),
});

function migrateV1(old: z.infer<typeof v1Schema>): Project {
  const sections = old.outline?.sections ?? [];
  const intentFor = (heading: string) => sections.find((s) => s.heading === heading)?.intent ?? "";
  const cells: Project["cells"] =
    old.cells.length > 0
      ? old.cells.map((cell) => ({
          id: cell.id,
          heading: cell.heading,
          intent: intentFor(cell.heading),
          mood: "neutral",
          started: true,
          text: cell.text,
          alternates: cell.history.map((text, i) => ({ id: `${cell.id}-v${i}`, text })),
        }))
      : sections.map((section) => ({
          id: section.id,
          heading: section.heading,
          intent: section.intent,
          mood: "neutral",
          started: false,
          text: "",
          alternates: [],
        }));
  return {
    version: 2,
    step: old.step === "idea" || old.step === "style" ? old.step : "outline",
    idea: old.idea,
    attributes: old.attributes,
    length: DEFAULT_LENGTH,
    title: old.outline?.title ?? "",
    cells,
  };
}

export function emptyProject(): Project {
  return {
    version: 2,
    step: "idea",
    idea: "",
    attributes: defaultAttributes(),
    length: DEFAULT_LENGTH,
    title: "",
    cells: [],
  };
}

function read<S extends z.ZodType>(key: string, schema: S): z.infer<S> | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const parsed = schema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

/** Returns the saved project, or null if there is none or it is unreadable. */
export function loadProject(): Project | null {
  try {
    const current = read(STORAGE_KEY, projectSchema);
    if (current) return current;
    const old = read(V1_STORAGE_KEY, v1Schema);
    return old ? migrateV1(old) : null;
  } catch {
    return null;
  }
}

/** Returns false if the browser refused the write (private mode, quota). */
export function saveProject(project: Project): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}
