import { mockTextEstimate } from "@/lib/analysis-fixtures";
import { clip, mockingGemini, respondWithAnalysis } from "@/lib/analysis-response";
import { estimateFromText } from "@/lib/analyze-meal";

const MAX_DESCRIPTION = 300;

/** Estimates food from a short description ("1 gulab jamun", "2 rotis and a katori of dal"). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const description = clip(body?.text, MAX_DESCRIPTION);
  if (!description) return Response.json({ error: "bad_request" }, { status: 400 });

  if (mockingGemini()) return Response.json(mockTextEstimate(description));
  return respondWithAnalysis("estimate", () => estimateFromText(description, body?.outside === true));
}
