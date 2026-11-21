import { handleAIRoute } from "@/lib/ai/route";
import { premiseRequestSchema, type PremiseResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, premiseRequestSchema, async (input, provider, signal) => {
    const premise = await provider.generateBPlotPremise(input.idea, input.mainTree, { signal });
    return { premise } satisfies PremiseResponse;
  });
}
