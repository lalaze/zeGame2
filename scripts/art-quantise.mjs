// The GIF reduction that e0b819f applied to most runtime art, kept after the move to WebP
// (8d17e2f) so rebuilding a pack ships what it shipped before. In these packs the PNG master
// is the full-colour original and players see its reduction: on/off transparency cut at alpha
// 100, then at most 256 colours without dithering. scripts/convert-art-webp.mjs applies it.
// Replayed on 2026-11-22 with sharp 0.34.5 (libimagequant 2.4.1), it reproduced all 522
// GIF-era files exactly; scripts/art-quantise.test.mjs keeps checking that.
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

/** Packs whose masters are the originals of what ships (mastersDiffer in assets/generated/PACKS.json). */
export const QUANTISED_PACKS = [
  'art/generated/catalog-v1', 'art/generated/cozy-cafe-v1', 'art/generated/cozy-cats-v2', 'art/generated/cozy-dining-v3',
  'art/generated/cozy-furniture-v2', 'art/generated/cozy-idle-v1', 'art/generated/cozy-menu-v2', 'art/generated/cozy-seating-v3',
  'art/generated/cozy-service-v2', 'art/generated/cozy-signature-v2', 'art/generated/cozy-world-v2', 'art/generated/main-runner-v3',
  'art/generated/main-v1', 'art/generated/main-v2',
];
/** The cut the game itself applies to its sprites (cozy-team-art.ts, cozy-seating-art.ts). */
const ALPHA_CUT = 100;
/** A file with more of its visible area soft than this keeps full colour: glass and liquids would turn into holes. */
const MAX_SOFT_AREA = 0.01;
/** Sets that change state on screen: one member with real glass keeps them all full colour. */
const GLASS_SETS = [/\/till-jar-\d\.png$/, /\/cozy-signature-v2\/cup-[a-z]+\.png$/];

export const inQuantisedPack = (file) => QUANTISED_PACKS.some((pack) => file.startsWith(`${pack}/`));

/** Share of visible pixels in a soft region: thin antialiased edges erode away, glass does not. */
function softArea(data, width, height) {
  const radius = Math.max(1, Math.round(Math.min(width, height) / 96)), stride = width + 1;
  const sums = new Int32Array(stride * (height + 1));
  let visible = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (alpha >= 8) visible++;
    sums[(y + 1) * stride + x + 1] = (alpha >= 8 && alpha <= 223 ? 1 : 0)
      + sums[y * stride + x + 1] + sums[(y + 1) * stride + x] - sums[y * stride + x];
  }
  let soft = 0;
  const full = (2 * radius + 1) ** 2;
  for (let y = radius; y < height - radius; y++) for (let x = radius; x < width - radius; x++) {
    const top = (y - radius) * stride, bottom = (y + radius + 1) * stride;
    if (sums[bottom + x + radius + 1] - sums[top + x + radius + 1] - sums[bottom + x - radius] + sums[top + x - radius] === full) soft++;
  }
  return visible ? soft / visible : 0;
}

/**
 * Whether a file new to a quantised pack is reduced too, by the rules the GIF step used: not a
 * glass set, and not soft over more than 1% of it. (The GIF step also kept files that would barely
 * shrink as GIF; that was about bytes, so new files are reduced regardless.)
 */
export function reducesNewFile(file, { data, width, height }) {
  return inQuantisedPack(file) && !GLASS_SETS.some((pattern) => pattern.test(file)) && softArea(data, width, height) <= MAX_SOFT_AREA;
}

/** The GIF reduction of RGBA pixels, as RGBA with the colour of fully transparent pixels cleared. */
export async function reduce({ data, width, height }) {
  const cut = Buffer.from(data);
  for (let i = 3; i < cut.length; i += 4) cut[i] = cut[i] < ALPHA_CUT ? 0 : 255;
  const gif = await sharp(cut, { raw: { width, height, channels: 4 } }).gif({ colours: 256, dither: 0, effort: 10 }).toBuffer();
  const back = await sharp(gif).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < back.length; i += 4) if (back[i + 3] === 0) back[i] = back[i + 1] = back[i + 2] = 0;
  return { data: back, width, height };
}
