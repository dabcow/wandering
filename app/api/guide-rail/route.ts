import { handleAIRoute } from "@/lib/ai/route";
import { guideRailRequestSchema, type GuideRailResponse } from "@/lib/ai/schemas";

export function POST(request: Request) {
  return handleAIRoute(request, guideRailRequestSchema, async (input, provider, signal) => {
    const rail = await provider.generateGuideRail(input.idea, input.pacing, { signal });
    return rail satisfies GuideRailResponse;
  });
}
