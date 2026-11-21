import type { Attribute } from "../types";
import { AIError } from "./errors";
import { createMockProvider } from "./mock";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import type { AIOutline, AlternativesContext, OutlineInput, StatusResponse } from "./schemas";

export type CallOptions = { signal?: AbortSignal };

/** Everything the app needs from a model. Add a provider by implementing this. */
export interface AIProvider {
  readonly name: string;
  generateOutline(idea: string, attributes: Attribute[], options?: CallOptions): Promise<AIOutline>;
  generateDrafts(
    idea: string,
    outline: OutlineInput,
    attributes: Attribute[],
    options?: CallOptions,
  ): Promise<string[]>;
  generateAlternatives(
    paragraph: string,
    context: AlternativesContext,
    attributes: Attribute[],
    n: number,
    options?: CallOptions & { avoid?: string[] },
  ): Promise<string[]>;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function readEnv() {
  return {
    provider: (process.env.AI_PROVIDER || "openai-compatible").trim().toLowerCase(),
    apiKey: process.env.AI_API_KEY?.trim() || "",
    model: process.env.AI_MODEL?.trim() || "",
    baseUrl: (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

export function getProviderStatus(): StatusResponse {
  const env = readEnv();
  if (env.provider === "mock") return { provider: "mock", model: null, configured: true };
  return {
    provider: env.provider,
    model: env.model || null,
    configured: env.provider === "openai-compatible" && Boolean(env.apiKey && env.model),
  };
}

export function getProvider(): AIProvider {
  const env = readEnv();
  if (env.provider === "mock") return createMockProvider();
  if (env.provider !== "openai-compatible") {
    throw new AIError(
      `Unknown AI_PROVIDER "${env.provider}". Use "openai-compatible" or "mock".`,
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
