import "server-only";
import { AnalysisError } from "./analyze-meal";

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
      return Response.json({ error: error.code }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error(`${label}: unexpected failure`, error);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}

/** A development-only stand-in for Gemini, switched on with MOCK_GEMINI=1, so the review flow can be built without a key. */
export const mockingGemini = () => process.env.NODE_ENV !== "production" && process.env.MOCK_GEMINI === "1";

export const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
