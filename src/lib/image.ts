"use client";

export type PreparedImage = {
  /** Base64 payload without the data-URL prefix, for the analyze API. */
  base64: string;
  mimeType: "image/jpeg";
  dataUrl: string;
};

const ANALYSIS_MAX_EDGE = 1024;
const SHELF_MAX_EDGE = 360;

async function encode(file: Blob, maxEdge: number, quality: number): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}

/** Downscales a camera photo so uploads stay fast and inside the free AI quota. */
export function prepareForAnalysis(file: Blob) {
  return encode(file, ANALYSIS_MAX_EDGE, 0.82);
}

/** Small copy kept only when a meal is saved to the shelf. */
export async function shelfThumbnail(file: Blob): Promise<string> {
  return (await encode(file, SHELF_MAX_EDGE, 0.72)).dataUrl;
}
