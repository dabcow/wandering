import { handleAIRoute } from "@/lib/ai/route";
import { optionsRequestSchema, type OptionsResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, optionsRequestSchema, async (input, provider, signal) => {
    const options = await provider.generateOptions(input, { signal });
    return { options } satisfies OptionsResponse;
  });
}
