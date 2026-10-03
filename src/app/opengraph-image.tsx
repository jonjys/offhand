import { ogSize, renderOg } from "@/lib/og";

export const alt = "Offhand: a Shopify resale store that stocks itself";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg();
}
