import { getProviderStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Tells the UI which provider is active. Never includes the key. */
export function GET() {
  return Response.json(getProviderStatus());
}
