import { handleAIRoute } from "@/lib/ai/route";
import { draftRequestSchema, type DraftResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, draftRequestSchema, async (input, provider, signal) => {
    const paragraphs = await provider.generateDrafts(input.idea, input.outline, input.attributes, {
      signal,
    });
    return { paragraphs } satisfies DraftResponse;
  });
}
