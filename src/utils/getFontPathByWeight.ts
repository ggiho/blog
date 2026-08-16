import type { FontData } from "astro:assets";

// satori/opentype.js can parse ttf/otf/woff, but NOT woff2 (brotli).
// Prefer a parseable format and never hand back a woff2 URL.
const PREFERRED = ["truetype", "ttf", "opentype", "otf", "woff"];

export function getFontPathByWeight(
  fonts: FontData[],
  weight: number,
  options?: {
    style?: "normal" | "italic";
  }
): string | undefined {
  const style = options?.style ?? "normal";

  for (const font of fonts) {
    if (font.weight === String(weight) && font.style === style) {
      for (const format of PREFERRED) {
        const src = font.src.find(file => file.format === format);
        if (src) return src.url;
      }
      const nonWoff2 = font.src.find(file => file.format !== "woff2");
      if (nonWoff2) return nonWoff2.url;
    }
  }

  return undefined;
}
