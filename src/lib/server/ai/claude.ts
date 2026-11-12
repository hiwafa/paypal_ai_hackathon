import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import type { z } from "zod";
import { getAiConfig } from "../env";

// Thin wrapper around the official Anthropic SDK.
//
// Every call opts into server-side fallback: if the primary model declines a
// request for policy reasons, the API retries it on the model's default
// fallback instead of failing the customer's conversation.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type Effort = "low" | "medium" | "high";

/** Raised when Claude can't be used for a request; callers fall back to the offline brain. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const globalClaude = globalThis as typeof globalThis & {
  __crewosClaude?: { apiKey: string; client: Anthropic };
};

export function claude(): { client: Anthropic; model: string } | null {
  const config = getAiConfig();
  if (!config) return null;
  if (globalClaude.__crewosClaude?.apiKey !== config.apiKey) {
    globalClaude.__crewosClaude = {
      apiKey: config.apiKey,
      client: new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: 90_000 }),
    };
  }
  return { client: globalClaude.__crewosClaude.client, model: config.model };
}

export interface StructuredCall<S extends z.ZodType> {
  system: string;
  messages: BetaMessageParam[];
  schema: S;
  effort: Effort;
  maxTokens?: number;
}

/** One request whose answer must match `schema` (structured outputs). */
export async function askStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
  const ai = claude();
  if (!ai) throw new AiUnavailableError("No ANTHROPIC_API_KEY configured.");

  try {
    const response = await ai.client.beta.messages.parse({
      model: ai.model,
      max_tokens: call.maxTokens ?? 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      // The system prompt is identical across turns, so it is cached.
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: call.messages,
      output_config: { effort: call.effort, format: betaZodOutputFormat(call.schema) },
    });

    if (response.stop_reason === "refusal") throw new AiUnavailableError("The model declined this request.");
    if (response.stop_reason === "max_tokens") throw new AiUnavailableError("The model ran out of output tokens.");
    if (response.parsed_output == null) throw new AiUnavailableError("The model returned no structured output.");
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    throw toAiError(error);
  }
}

/** Maps SDK errors to one error type and logs what an operator needs to know. */
export function toAiError(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("[ai] Anthropic rejected the API key. Check ANTHROPIC_API_KEY.");
    return new AiUnavailableError("Invalid Anthropic API key.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    console.warn("[ai] Rate limited by the Anthropic API.");
    return new AiUnavailableError("Claude is busy right now.");
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`[ai] Anthropic API error ${error.status ?? ""}: ${error.message}`);
    return new AiUnavailableError("Claude could not answer.");
  }
  console.error("[ai] Unexpected error calling Claude", error);
  return new AiUnavailableError("Claude could not answer.");
}
