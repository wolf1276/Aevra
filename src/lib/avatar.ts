// Local, deterministic avatar generation via DiceBear — no network calls.
import {
  adventurer,
  botttsNeutral,
  identicon,
  notionists,
  personas,
  pixelArt,
  shapes,
} from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

// Each DiceBear style package has its own Options type; createAvatar's first
// param is generic per-style, so a mixed-style lookup table needs a loose cast.
type AnyStyle = Parameters<typeof createAvatar>[0];

export const AVATAR_STYLES = {
  botttsNeutral: { label: "Bottts Neutral", style: botttsNeutral as AnyStyle },
  pixelArt: { label: "Pixel Art", style: pixelArt as AnyStyle },
  shapes: { label: "Shapes", style: shapes as AnyStyle },
  personas: { label: "Personas", style: personas as AnyStyle },
  identicon: { label: "Identicon", style: identicon as AnyStyle },
  adventurer: { label: "Adventurer", style: adventurer as AnyStyle },
  notionists: { label: "Notionists", style: notionists as AnyStyle },
} as const;

export type AvatarStyle = keyof typeof AVATAR_STYLES;
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "botttsNeutral";

const cache = new Map<string, string>();

export function generateAvatarSvg(seed: string, style: AvatarStyle): string {
  const key = `${style}:${seed}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const svg = createAvatar(AVATAR_STYLES[style].style, { seed }).toString();
  cache.set(key, svg);
  return svg;
}
