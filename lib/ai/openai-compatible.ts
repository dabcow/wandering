import type { z } from "zod";
import { AIError } from "./errors";
import { buildOutlinePrompt, type Prompt } from "./prompts";
import type { AIProvider } from "./provider";
import { aiOutlineSchema } from "./schemas";

type Config = { apiKey: string; model: string; baseUrl: string };

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
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (timeout.aborted) throw new AIError("The AI provider took too long to respond.", 504);
      if (signal?.aborted) throw new AIError("Request cancelled.", 499);
      console.error("[ai] network error", error);
      throw new AIError("Could not reach the AI provider. Check AI_BASE_URL and your connection.");
    }

    if (!response.ok) {
      const detail = await providerErrorMessage(response);
      if (response.status === 400 && jsonMode && /response_format|json_object/i.test(detail)) {
        jsonMode = false;
        return chat(prompt, signal);
      }
      if (response.status === 401 || response.status === 403) {
        throw new AIError("The AI provider rejected the API key. Check AI_API_KEY.");
      }
      if (response.status === 404) {
        throw new AIError(
          `The AI provider did not recognise the model or endpoint. Check AI_MODEL and AI_BASE_URL.${detail ? ` (${detail})` : ""}`,
        );
      }
      if (response.status === 429) {
        throw new AIError("The AI provider is rate limiting or out of quota. Try again shortly.", 429);
      }
      throw new AIError(`The AI provider returned an error (${response.status}). ${detail}`.trim());
    }

    const data = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AIError("The AI provider returned an empty reply.");
    }
    return content;
  }

  /** Ask for JSON, validate it, and give the model one more try if the shape is wrong. */
  async function completeJSON<S extends z.ZodType>(
    prompt: Prompt,
    schema: S,
    signal?: AbortSignal,
  ): Promise<z.infer<S>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await chat(prompt, signal);
      try {
        const parsed = schema.safeParse(extractJSON(content));
        if (parsed.success) return parsed.data;
      } catch {
        // Unparseable reply; retry below.
      }
    }
    throw new AIError("The AI reply was not in the expected format. Try again.");
  }

  return {
    name: "openai-compatible",

    generateOutline(idea, attributes, length, options) {
      return completeJSON(
        buildOutlinePrompt(idea, attributes, length),
        aiOutlineSchema,
        options?.signal,
      );
    },
  };
}
