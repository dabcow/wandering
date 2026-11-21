import { handleAIRoute } from "@/lib/ai/route";
import { alternativesRequestSchema, type AlternativesResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, alternativesRequestSchema, async (input, provider, signal) => {
    const alternatives = await provider.generateAlternatives(
      input.paragraph,
      input.context,
      input.attributes,
      input.n,
      { signal, avoid: input.avoid },
    );
    return { alternatives } satisfies AlternativesResponse;
  });
}
