import "server-only";
import { z } from "zod";
import { PayPalApiError } from "./paypal/client";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Reads and validates a JSON body with a hard size cap. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 32_000): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "Request body is too large.");

  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body is too large.");

  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    throw new HttpError(400, `Invalid request${where}: ${issue?.message ?? "unknown error"}`);
  }
  return parsed.data;
}

/** Turns any thrown error into a safe JSON response. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof PayPalApiError) {
    console.error("[paypal]", error.message, { status: error.status, debugId: error.debugId });
    const status = error.status === 422 ? 422 : 502;
    return Response.json(
      { error: `PayPal: ${error.userMessage}`, issue: error.issue, debugId: error.debugId },
      { status },
    );
  }
  console.error("[api] Unexpected error", error);
  return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
}
