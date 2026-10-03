import { AnalysisError, analyzeMeal } from "@/lib/analyze-meal";

const MAX_BASE64_LENGTH = 4_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const STATUS_BY_CODE: Record<AnalysisError["code"], number> = {
  not_configured: 503,
  quota: 429,
  unreadable: 422,
  upstream: 502,
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { image?: unknown; mimeType?: unknown } | null;
  const image = body?.image;
  const mimeType = body?.mimeType;

  if (typeof image !== "string" || typeof mimeType !== "string" || !ALLOWED_TYPES.has(mimeType)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  try {
    return Response.json(await analyzeMeal(image, mimeType));
  } catch (error) {
    if (error instanceof AnalysisError) {
      console.error(`analyze: ${error.code}: ${error.message}`);
      return Response.json({ error: error.code }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error("analyze: unexpected failure", error);
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
