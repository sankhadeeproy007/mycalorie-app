import "server-only";
import { AnalysisError } from "./analysis-error";

const STATUS_BY_CODE: Record<AnalysisError["code"], number> = {
  not_configured: 503,
  quota: 429,
  unreadable: 422,
  upstream: 502,
};

/** Runs an AI call and turns its failures into the small error vocabulary the client understands. */
export async function respondWithAnalysis(label: string, run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (error) {
    if (error instanceof AnalysisError) {
      console.error(`${label}: ${error.code}: ${error.message}`);
      return Response.json({ error: error.code, detail: error.detail }, { status: STATUS_BY_CODE[error.code] });
    }
    // Usually an answer in an unexpected shape (a field missing); say so instead of a bare failure.
    console.error(`${label}: unexpected failure`, error);
    const detail = error instanceof Error ? `unexpected answer: ${error.message.slice(0, 100)}` : "unexpected failure";
    return Response.json({ error: "upstream", detail }, { status: 502 });
  }
}

/** A development-only stand-in for Gemini, switched on with MOCK_GEMINI=1, so the review flow can be built without a key. */
export const mockingGemini = () => process.env.NODE_ENV !== "production" && process.env.MOCK_GEMINI === "1";

export const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
