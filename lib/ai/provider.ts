import { AIError, NOT_SET_UP } from "./errors";
import { createMockProvider } from "./mock";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import type { AIGuideRail, AIOption, OptionsRequest, StatusResponse } from "./schemas";

export type CallOptions = { signal?: AbortSignal };

/** Everything the app needs from a model. Add a provider by implementing this. */
export interface AIProvider {
  readonly name: string;
  /** The intended arc: one beat per tree level, as many as the pacing calls for. */
  generateGuideRail(idea: string, pacing: number, options?: CallOptions): Promise<AIGuideRail>;
  /** Distinct next plot points for one parent on one branch. */
  generateOptions(input: OptionsRequest, options?: CallOptions): Promise<AIOption[]>;
  generateBPlotPremise(idea: string, mainTree: string, options?: CallOptions): Promise<string>;
  /** The idea with typos and transcript filler cleaned up, for the Plot reminder. */
  tidyIdea(idea: string, options?: CallOptions): Promise<string>;
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
    reasoningEffort: process.env.AI_REASONING_EFFORT?.trim().toLowerCase() || "",
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
    console.error('[ai] AI_PROVIDER in .env.local is not a known provider. Use "openrouter", "openai-compatible" or "mock".');
    throw new AIError(NOT_SET_UP, 503);
  }
  if (!env.apiKey || !env.model) {
    console.error(
      "[ai] No AI provider is configured. Set AI_API_KEY and AI_MODEL in .env.local, then restart the server. (AI_PROVIDER=mock gives canned output for trying the interface.)",
    );
    throw new AIError(NOT_SET_UP, 503);
  }
  return createOpenAICompatibleProvider({
    apiKey: env.apiKey,
    model: env.model,
    baseUrl: env.baseUrl,
    reasoningEffort: env.reasoningEffort,
  });
}

export { AIError };
