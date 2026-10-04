import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AnalysisError } from "../analysis-error";

/**
 * The second opinion on a photo: Claude Sonnet 5.5, asked only when the owner taps "Try Claude".
 * Same prompt and schema as Gemini, so both answers read the same way.
 */

export const CLAUDE_MODEL = "claude-sonnet-5-5";
/** Sonnet 5.5 list prices, US$ per million tokens, for the cost shown next to the answer. */
const PRICE_PER_MILLION = { input: 2, output: 10 };
/** Low effort matched higher effort on these photos in the comparison script, at a fraction of the output. */
const DEFAULT_EFFORT = "low";
const EFFORTS = new Set(["low", "medium", "high"]);

let client: Anthropic | null = null;

function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AnalysisError("not_configured", "ANTHROPIC_API_KEY is not set", "claude not set up");
  client ??= new Anthropic();
  return client;
}

export type ClaudeAnswer<T> = { data: T; costUsd: number };

export async function callClaude<T>(
  image: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" },
  instructions: string,
  schema: Record<string, unknown>,
): Promise<ClaudeAnswer<T>> {
  const effort = EFFORTS.has(process.env.CLAUDE_EFFORT ?? "") ? process.env.CLAUDE_EFFORT! : DEFAULT_EFFORT;
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await claude().beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      // If a safety check declines the photo, the API retries on a fallback model it picks by category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: effort as "low" | "medium" | "high", format: { type: "json_schema", schema } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
            { type: "text", text: instructions },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AnalysisError("not_configured", "Claude rejected the key", "claude key rejected");
    if (error instanceof Anthropic.RateLimitError) throw new AnalysisError("quota", "Claude rate limit", "claude rate limit");
    if (error instanceof Anthropic.APIError) {
      throw new AnalysisError("upstream", `Claude ${error.status}: ${error.message}`, `claude ${error.status}: ${error.message.slice(0, 120)}`);
    }
    throw error;
  }

  const costUsd =
    (response.usage.input_tokens * PRICE_PER_MILLION.input + response.usage.output_tokens * PRICE_PER_MILLION.output) / 1_000_000;
  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "no category";
    throw new AnalysisError("upstream", `Claude declined (${category})`, `claude declined (${category})`);
  }
  if (response.stop_reason === "max_tokens") throw new AnalysisError("upstream", "Claude ran out of tokens", "claude answer cut off");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new AnalysisError("upstream", "Claude gave no answer", "claude no answer");
  try {
    return { data: JSON.parse(text.text) as T, costUsd };
  } catch {
    throw new AnalysisError("upstream", `Claude answer wasn't JSON: ${text.text.slice(0, 200)}`, "claude unreadable answer");
  }
}
