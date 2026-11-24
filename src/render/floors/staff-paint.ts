// Repaints a café staff strip of the floors view (assets/generated/floor-sample-v1/build/staff,
// scripts/art-gen/floor-staff-build.py) in a saved look's colours. The strips are painted in key
// colours (violet hair, green apron, blue trousers, light peach skin); a mask says how much of each
// pixel is which part. Each part takes its new colour and keeps the shading it was painted with.
// Nothing here touches the page, so tests and offline tools can run it on plain pixel arrays.

export type Rgb = readonly [number, number, number];
export const STAFF_PARTS = ['hair', 'apron', 'pants', 'skin'] as const;
export type StaffPart = typeof STAFF_PARTS[number];
export type StaffColours = Readonly<Record<StaffPart, Rgb>>;

/**
 * How much of a pixel's own tint (against the key colour) carries over, 0 (only its lightness) to 1.
 * Skin keeps nearly all of it, so cheeks stay rosy on every skin; cloth and hair keep a little of
 * the painted warmth in their shadows.
 */
const TINT: Record<StaffPart, number> = { hair: .3, apron: .3, pants: .3, skin: .9 };

export function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const luma = (r: number, g: number, b: number) => .299 * r + .587 * g + .114 * b;

/**
 * One channel of a part's new colour at the shade the pixel was painted in: darker than the key
 * colour multiplies the new colour down, lighter lifts it towards white, and the key colour itself
 * gives exactly the new colour.
 */
export function shade(target: number, ratio: number): number {
  return ratio <= 1 ? target * ratio : 255 - (255 - target) / ratio;
}

/** A pixel painted in `key`'s family, repainted in `target`'s. */
export function repaint(r: number, g: number, b: number, key: Rgb, target: Rgb, tint: number): [number, number, number] {
  const light = luma(r, g, b) / Math.max(1, luma(key[0], key[1], key[2]));
  const channel = (value: number, k: number, t: number) => shade(t, light + (value / Math.max(1, k) - light) * tint);
  return [channel(r, key[0], target[0]), channel(g, key[1], target[1]), channel(b, key[2], target[2])];
}

/**
 * The strip in the look's colours. `strip` is RGBA, `width` by `height`. `mask` is RGBA, the same
 * width and twice the height: in its top half red, green and blue are how much of the pixel is
 * hair, apron and trousers; in its bottom half red is how much is skin. `key` holds the colours the
 * parts were painted in. Returns new pixels; a pixel outside every part is unchanged.
 */
export function paintStaff(strip: Uint8ClampedArray, mask: Uint8ClampedArray, width: number, height: number,
  key: StaffColours, colours: StaffColours): Uint8ClampedArray {
  if (strip.length !== width * height * 4 || mask.length !== strip.length * 2) throw new Error('Staff strip and mask sizes do not match');
  const out = new Uint8ClampedArray(strip), lower = width * height * 4;
  const share = [0, 0, 0, 0];
  for (let i = 0; i < lower; i += 4) {
    if (!strip[i + 3]) continue;
    share[0] = mask[i]; share[1] = mask[i + 1]; share[2] = mask[i + 2]; share[3] = mask[lower + i];
    const total = share[0] + share[1] + share[2] + share[3];
    // Lossy masks leave a faint haze outside the parts: ignore it.
    if (total < 6) continue;
    const r = strip[i], g = strip[i + 1], b = strip[i + 2], scale = 1 / Math.max(255, total);
    const kept = 1 - total * scale;
    let nr = r * kept, ng = g * kept, nb = b * kept;
    for (let p = 0; p < 4; p++) {
      if (!share[p]) continue;
      const part = STAFF_PARTS[p], painted = repaint(r, g, b, key[part], colours[part], TINT[part]), weight = share[p] * scale;
      nr += painted[0] * weight; ng += painted[1] * weight; nb += painted[2] * weight;
    }
    out[i] = Math.round(nr); out[i + 1] = Math.round(ng); out[i + 2] = Math.round(nb);
  }
  return out;
}
