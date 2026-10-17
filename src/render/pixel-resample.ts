/**
 * Pure pixel-art resampling shared by the game (src/render/world-art-grid.ts) and the
 * artwork pipeline (scripts/pixel-conform.mjs). No DOM, no imports: Node can run it
 * directly with type stripping.
 */

/** Opaque colour families darker than their cell's average win more of a tie. */
const SHADE_BIAS = 0.6;

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const alphaLevel = (a: number) => a < 32 ? 0 : a < 112 ? 1 : a < 200 ? 2 : 3;

/**
 * Area-weighted dominant-colour resampling. Each output pixel takes the colour family
 * covering most of its footprint (or stays transparent when most of it is), so
 * palettes, flat fills and hard edges survive instead of being blended into new
 * colours or dropped at random like nearest-neighbour sampling. A second pass puts
 * back the outer contour wherever the source silhouette had a dark outline.
 */
export function resampleRgba(src: Uint8ClampedArray, sw: number, sh: number, tw: number, th: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tw * th * 4);
  if (!sw || !sh || !tw || !th) return out;
  const fx = sw / tw, fy = sh / th;
  const index = new Map<number, number>();
  const keys: number[] = [], weight: number[] = [], sum: number[] = [];
  for (let ty = 0; ty < th; ty++) {
    const y0 = ty * fy, y1 = Math.min(sh, y0 + fy);
    for (let tx = 0; tx < tw; tx++) {
      const x0 = tx * fx, x1 = Math.min(sw, x0 + fx);
      index.clear(); keys.length = 0; weight.length = 0; sum.length = 0;
      let clear = 0, solid = 0, shade = 0;
      for (let sy = Math.floor(y0); sy < y1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < x1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy, i = (sy * sw + sx) * 4, a = src[i + 3], level = alphaLevel(a);
          if (!level) { clear += w; continue; }
          const key = level << 12 | (src[i] >> 4) << 8 | (src[i + 1] >> 4) << 4 | src[i + 2] >> 4;
          let k = index.get(key);
          if (k === undefined) { k = keys.length; index.set(key, k); keys.push(key); weight.push(0); sum.push(0, 0, 0, 0); }
          weight[k] += w; solid += w;
          sum[k * 4] += src[i] * w; sum[k * 4 + 1] += src[i + 1] * w; sum[k * 4 + 2] += src[i + 2] * w; sum[k * 4 + 3] += a * w;
          shade += luminance(src[i], src[i + 1], src[i + 2]) * w;
        }
      }
      if (solid < clear) continue;
      const mean = shade / solid;
      let best = 0, bestScore = -1;
      for (let k = 0; k < keys.length; k++) {
        const w = weight[k], lum = luminance(sum[k * 4], sum[k * 4 + 1], sum[k * 4 + 2]) / w;
        const score = w * (1 + SHADE_BIAS * Math.max(0, mean - lum) / 255);
        if (score > bestScore) { bestScore = score; best = k; }
      }
      const o = (ty * tw + tx) * 4, w = weight[best];
      out[o] = Math.round(sum[best * 4] / w);
      out[o + 1] = Math.round(sum[best * 4 + 1] / w);
      out[o + 2] = Math.round(sum[best * 4 + 2] / w);
      out[o + 3] = keys[best] >> 12 === 3 ? 255 : Math.round(sum[best * 4 + 3] / w);
    }
  }
  restoreContour(src, sw, sh, out, tw, th);
  return out;
}

/**
 * Source pixels on the silhouette edge that are clearly darker than the body behind
 * them. Only real transparency makes an edge: a region's own border is not a contour.
 */
function outlineMask(src: Uint8ClampedArray, sw: number, sh: number): Uint8Array {
  const mask = new Uint8Array(sw * sh);
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= sw || y >= sh || src[(y * sw + x) * 4 + 3] >= 112;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (src[(y * sw + x) * 4 + 3] < 112) continue;
    let edge = false, inner = 0, count = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!solid(x + dx, y + dy)) { edge = true; continue; }
      if (x + dx < 0 || y + dy < 0 || x + dx >= sw || y + dy >= sh) continue;
      const j = ((y + dy) * sw + x + dx) * 4;
      inner += luminance(src[j], src[j + 1], src[j + 2]); count++;
    }
    const i = (y * sw + x) * 4;
    if (edge && (!count || luminance(src[i], src[i + 1], src[i + 2]) < inner / count - 18)) mask[y * sw + x] = 1;
  }
  return mask;
}

function restoreContour(src: Uint8ClampedArray, sw: number, sh: number, out: Uint8ClampedArray, tw: number, th: number): void {
  if (tw >= sw && th >= sh) return;
  const outline = outlineMask(src, sw, sh), fx = sw / tw, fy = sh / th;
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= tw || y >= th || out[(y * tw + x) * 4 + 3] >= 112;
  const repaint: [number, number, number, number, number][] = [];
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    if (out[(ty * tw + tx) * 4 + 3] < 112 || (solid(tx + 1, ty) && solid(tx - 1, ty) && solid(tx, ty + 1) && solid(tx, ty - 1))) continue;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const left = Math.max(0, Math.floor(tx * fx - 1)), right = Math.min(sw, Math.ceil((tx + 1) * fx + 1));
    const top = Math.max(0, Math.floor(ty * fy - 1)), bottom = Math.min(sh, Math.ceil((ty + 1) * fy + 1));
    for (let sy = top; sy < bottom; sy++) for (let sx = left; sx < right; sx++) {
      if (!outline[sy * sw + sx]) continue;
      const i = (sy * sw + sx) * 4;
      r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++;
    }
    if (n) repaint.push([(ty * tw + tx) * 4, r / n, g / n, b / n, a / n]);
  }
  for (const [o, r, g, b, a] of repaint) {
    out[o] = Math.round(r); out[o + 1] = Math.round(g); out[o + 2] = Math.round(b);
    out[o + 3] = alphaLevel(a) === 3 ? 255 : Math.round(a);
  }
}
