import { ImageResponse } from "next/og";
import { BrandMark } from "./brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon; iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
