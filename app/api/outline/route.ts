import { handleAIRoute } from "@/lib/ai/route";
import { outlineRequestSchema, type OutlineResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, outlineRequestSchema, async (input, provider, signal) => {
    const outline = await provider.generateOutline(input.idea, input.attributes, { signal });
    return { outline } satisfies OutlineResponse;
  });
}
