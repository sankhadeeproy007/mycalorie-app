import { AnalysisError } from "../analysis-error";
import { toGeminiSchema } from "../meal-prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiUsage = { inputTokens: number; outputTokens: number };

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

/** One JSON-constrained Gemini call. Thinking tokens are billed as output, so they're counted there. */
export async function callGemini<T>(
  parts: GeminiPart[],
  schema: Record<string, unknown>,
  { apiKey, model = DEFAULT_GEMINI_MODEL }: { apiKey: string | undefined; model?: string },
): Promise<{ data: T; usage: GeminiUsage }> {
  if (!apiKey) throw new AnalysisError("not_configured", "GEMINI_API_KEY is not set");

  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), temperature: 0.2 },
    }),
  });

  if (response.status === 429) throw new AnalysisError("quota", "The free Gemini quota is used up for now");
  if (!response.ok) {
    const raw = await response.text();
    const reason = (() => {
      try {
        return (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        return "";
      }
    })();
    throw new AnalysisError(
      "upstream",
      `Gemini returned ${response.status}: ${raw.slice(0, 300)}`,
      `gemini ${response.status}${reason ? `: ${reason.slice(0, 120)}` : ""}`,
    );
  }

  const body = (await response.json()) as GeminiResponse;
  const candidate = body.candidates?.[0];
  // Newer models can split an answer across parts and add thought parts; join only the answer text.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");
  if (!text) {
    const why = body.promptFeedback?.blockReason ?? candidate?.finishReason ?? "unknown";
    throw new AnalysisError("upstream", `Gemini returned no answer (${why})`, `no answer (${why})`);
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new AnalysisError(
      "upstream",
      `Gemini answer wasn't valid JSON (finish: ${candidate?.finishReason}): ${text.slice(0, 200)}`,
      `unreadable answer (${candidate?.finishReason ?? "unknown"})`,
    );
  }
  const meta = body.usageMetadata ?? {};
  return {
    data,
    usage: {
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    },
  };
}
