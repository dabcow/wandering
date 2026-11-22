import { handleAIRoute } from "@/lib/ai/route";
import { tidyRequestSchema, type TidyResponse } from "@/lib/ai/schemas";

/** The story idea, tidied for the Plot reminder at the top of the Tree step. */
export function POST(request: Request) {
  return handleAIRoute(request, tidyRequestSchema, async (input, provider, signal) => {
    const text = await provider.tidyIdea(input.idea, { signal });
    return { text } satisfies TidyResponse;
  });
}
