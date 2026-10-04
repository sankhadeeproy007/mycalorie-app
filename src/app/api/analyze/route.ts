import { mockClaudeAnalysis, mockPhotoAnalysis } from "@/lib/analysis-fixtures";
import { clip, mockingGemini, respondWithAnalysis } from "@/lib/analysis-response";
import { analyzePhoto, type RegularSummary } from "@/lib/analyze-meal";
import { CLAUDE_REFUSED, mayUseClaude } from "@/lib/session";

const MAX_BASE64_LENGTH = 4_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_HINT = 300;
const MAX_REGULARS = 60;

function readRegulars(value: unknown): RegularSummary[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_REGULARS).flatMap((entry) => {
    const id = clip(entry?.id, 64);
    const name = clip(entry?.name, 80);
    const protein = Number(entry?.protein);
    return id && name && Number.isFinite(protein) ? [{ id, name, summary: clip(entry?.summary, 160), protein }] : [];
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const image = body?.image;
  const mimeType = body?.mimeType;

  if (typeof image !== "string" || typeof mimeType !== "string" || !ALLOWED_TYPES.has(mimeType)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const context = { hint: clip(body?.hint, MAX_HINT), outside: body?.outside === true, regulars: readRegulars(body?.regulars) };
  const model = body?.model === "claude" ? "claude" : "gemini";
  if (model === "claude" && !(await mayUseClaude())) return Response.json(CLAUDE_REFUSED, { status: 403 });
  if (mockingGemini()) {
    return Response.json(model === "claude" ? mockClaudeAnalysis(context.hint) : mockPhotoAnalysis(context.hint));
  }
  return respondWithAnalysis(`analyze (${model})`, () =>
    analyzePhoto({ base64: image, mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" }, context, model),
  );
}
