import type { z } from "zod";
import { AIError, getProvider, type AIProvider } from "./provider";

/**
 * Shared wrapper for the AI route handlers: parse and validate the body,
 * resolve the provider, and turn failures into `{ error }` JSON.
 */
export async function handleAIRoute<S extends z.ZodType>(
  request: Request,
  schema: S,
  run: (input: z.infer<S>, provider: AIProvider, signal: AbortSignal) => Promise<unknown>,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "request";
    return Response.json({ error: `Invalid ${where}: ${issue?.message ?? "bad input"}` }, { status: 400 });
  }

  try {
    const result = await run(parsed.data, getProvider(), request.signal);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AIError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[ai] unexpected error", error);
    return Response.json({ error: "Something went wrong while generating. Try again." }, { status: 500 });
  }
}
