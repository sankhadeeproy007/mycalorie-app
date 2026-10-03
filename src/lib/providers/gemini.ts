import { AnalysisError } from "../analysis-error";
import { toGeminiSchema } from "../meal-prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiUsage = { inputTokens: number; outputTokens: number };

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
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
    throw new AnalysisError("upstream", `Gemini returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AnalysisError("upstream", "Gemini returned no answer");
  const meta = body.usageMetadata ?? {};
  return {
    data: JSON.parse(text) as T,
    usage: {
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    },
  };
}
