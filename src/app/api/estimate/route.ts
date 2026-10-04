import { mockTextEstimate } from "@/lib/analysis-fixtures";
import { clip, mockingGemini, respondWithAnalysis } from "@/lib/analysis-response";
import { estimateFromText } from "@/lib/analyze-meal";
import { CLAUDE_REFUSED, mayUseClaude } from "@/lib/session";

const MAX_DESCRIPTION = 300;

/** Estimates food from a short description ("1 gulab jamun", "2 rotis and a katori of dal"). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const description = clip(body?.text, MAX_DESCRIPTION);
  if (!description) return Response.json({ error: "bad_request" }, { status: 400 });

  const model = body?.model === "claude" ? "claude" : "gemini";
  if (model === "claude" && !(await mayUseClaude())) return Response.json(CLAUDE_REFUSED, { status: 403 });

  if (mockingGemini()) {
    const estimate = mockTextEstimate(description);
    return Response.json(model === "claude" ? { ...estimate, name: `${estimate.name} (Claude)`, costUsd: 0.004 } : estimate);
  }
  return respondWithAnalysis(`estimate (${model})`, () => estimateFromText(description, body?.outside === true, model));
}
