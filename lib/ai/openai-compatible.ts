import type { z } from "zod";
import { depthForPacing } from "../tree";
import { AIError, NOT_SET_UP } from "./errors";
import {
  buildGuideRailPrompt,
  buildOptionsPrompt,
  buildPremisePrompt,
  type Prompt,
  buildTidyPrompt,
} from "./prompts";
import type { AIProvider } from "./provider";
import { aiGuideRailSchema, aiOptionsSchema, aiPremiseSchema, aiTidySchema } from "./schemas";

type Config = {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Optional "reasoning_effort" for models that think before answering, e.g. "low". */
  reasoningEffort?: string;
};

const TIMEOUT_MS = 90_000;

/** Pull the JSON object out of a reply, tolerating code fences or stray prose around it. */
function extractJSON(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(content.slice(start, end + 1));
}

async function providerErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    if (message) return message;
  } catch {
    // Not JSON; fall through to the raw body.
  }
  return raw.slice(0, 300);
}

/**
 * Adapter for any Chat Completions-style endpoint (OpenAI and the many
 * services that mirror its API). Base URL and model come from env vars.
 */
export function createOpenAICompatibleProvider(config: Config): AIProvider {
  // Flipped off for the rest of the process if the endpoint rejects JSON mode.
  let jsonMode = true;
  // Likewise if it rejects the reasoning-effort setting.
  let sendEffort = Boolean(config.reasoningEffort);

  async function chat(prompt: Prompt, signal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(sendEffort ? { reasoning_effort: config.reasoningEffort } : {}),
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (timeout.aborted) throw new AIError("The AI took too long to answer. Try again.", 504);
      if (signal?.aborted) throw new AIError("Request cancelled.", 499);
      console.error(`[ai] could not reach ${config.baseUrl} (check AI_BASE_URL and the connection)`, error);
      throw new AIError("Couldn't reach the AI. Check your internet connection and try again.");
    }

    if (!response.ok) {
      const detail = await providerErrorMessage(response);
      if (response.status === 400 && jsonMode && /response_format|json_object/i.test(detail)) {
        jsonMode = false;
        return chat(prompt, signal);
      }
      if (response.status === 400 && sendEffort && /reasoning/i.test(detail)) {
        sendEffort = false;
        return chat(prompt, signal);
      }
      // Writers see a plain message; the technical detail goes to the server log.
      if (response.status === 401 || response.status === 403) {
        console.error(`[ai] provider rejected the API key (${response.status}); check AI_API_KEY. ${detail}`);
        throw new AIError(NOT_SET_UP);
      }
      if (response.status === 404) {
        console.error(`[ai] provider did not recognise the model or endpoint; check AI_MODEL and AI_BASE_URL. ${detail}`);
        throw new AIError(NOT_SET_UP);
      }
      if (response.status === 429) {
        console.error(`[ai] provider is rate limiting or out of quota. ${detail}`);
        throw new AIError("The AI is busy right now. Wait a minute and try again.", 429);
      }
      console.error(`[ai] provider returned ${response.status}. ${detail}`);
      throw new AIError("The AI ran into a problem. Try again in a moment.");
    }

    const data = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      console.error("[ai] provider returned an empty reply");
      throw new AIError("The AI didn't come up with anything. Try again.");
    }
    return content;
  }

  /**
   * Ask for JSON and validate it. The model gets one more try if the shape is
   * wrong or `accept` rejects it; a second reply that is valid but still
   * rejected is used anyway rather than failing the request.
   */
  async function completeJSON<S extends z.ZodType>(
    prompt: Prompt,
    schema: S,
    signal?: AbortSignal,
    accept?: (value: z.infer<S>) => boolean,
  ): Promise<z.infer<S>> {
    let fallback: z.infer<S> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await chat(prompt, signal);
      try {
        const parsed = schema.safeParse(extractJSON(content));
        if (parsed.success) {
          if (!accept || accept(parsed.data)) return parsed.data;
          fallback = parsed.data;
        }
      } catch {
        // Unparseable reply; retry below.
      }
    }
    if (fallback !== undefined) return fallback;
    console.error("[ai] reply was not in the expected format after two tries");
    throw new AIError("The suggestions came back garbled. Try again.");
  }

  return {
    name: "openai-compatible",

    generateGuideRail(idea, pacing, options) {
      const depth = depthForPacing(pacing);
      return completeJSON(
        buildGuideRailPrompt(idea, pacing),
        aiGuideRailSchema,
        options?.signal,
        (rail) => rail.beats.length === depth,
      );
    },

    async generateOptions(input, options) {
      const result = await completeJSON(buildOptionsPrompt(input), aiOptionsSchema, options?.signal);
      return result.options.slice(0, input.count);
    },

    async tidyIdea(idea, options) {
      const result = await completeJSON(buildTidyPrompt(idea), aiTidySchema, options?.signal);
      return result.text;
    },

    async generateBPlotPremise(idea, mainTree, options) {
      const result = await completeJSON(
        buildPremisePrompt(idea, mainTree),
        aiPremiseSchema,
        options?.signal,
      );
      return result.premise;
    },
  };
}
