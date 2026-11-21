import type { Attribute } from "../types";
import { AIError } from "./errors";
import { createMockProvider } from "./mock";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import type { AIOutline, StatusResponse } from "./schemas";

export type CallOptions = { signal?: AbortSignal };

/** Everything the app needs from a model. Add a provider by implementing this. */
export interface AIProvider {
  readonly name: string;
  /** @param length 0–100, how long the outline should be relative to the idea. */
  generateOutline(
    idea: string,
    attributes: Attribute[],
    length: number,
    options?: CallOptions,
  ): Promise<AIOutline>;
}

/**
 * Providers that speak the Chat Completions API, with the base URL each uses
 * unless AI_BASE_URL overrides it.
 */
const CHAT_PROVIDERS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  "openai-compatible": "https://api.openai.com/v1",
};

const isChatProvider = (name: string) => Object.hasOwn(CHAT_PROVIDERS, name);

function readEnv() {
  const provider = (process.env.AI_PROVIDER || "openai-compatible").trim().toLowerCase();
  const baseUrl =
    process.env.AI_BASE_URL?.trim() || (isChatProvider(provider) ? CHAT_PROVIDERS[provider] : "");
  return {
    provider,
    apiKey: process.env.AI_API_KEY?.trim() || "",
    model: process.env.AI_MODEL?.trim() || "",
    baseUrl: baseUrl.replace(/\/+$/, ""),
  };
}

export function getProviderStatus(): StatusResponse {
  const env = readEnv();
  if (env.provider === "mock") return { provider: "mock", model: null, configured: true };
  // Never echo an unrecognised value: a key pasted on the wrong line must not reach the browser.
  if (!isChatProvider(env.provider)) return { provider: "unknown", model: null, configured: false };
  return {
    provider: env.provider,
    model: env.model || null,
    configured: Boolean(env.apiKey && env.model),
  };
}

export function getProvider(): AIProvider {
  const env = readEnv();
  if (env.provider === "mock") return createMockProvider();
  if (!isChatProvider(env.provider)) {
    throw new AIError(
      'AI_PROVIDER in .env.local is not a known provider. Use "openrouter", "openai-compatible" or "mock".',
      503,
    );
  }
  if (!env.apiKey || !env.model) {
    throw new AIError(
      "No AI provider is configured. Set AI_API_KEY and AI_MODEL in .env.local, then restart the server. (AI_PROVIDER=mock gives canned output for trying the interface.)",
      503,
    );
  }
  return createOpenAICompatibleProvider({
    apiKey: env.apiKey,
    model: env.model,
    baseUrl: env.baseUrl,
  });
}

export { AIError };
