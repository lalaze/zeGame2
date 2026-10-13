import { mix } from './color';

type Context = CanvasRenderingContext2D;
type Mark = (x: number, y: number, w: number, h: number, color: string) => void;

// Geometry below is authored in fine pixels, not enlarged legacy pixels. One
// fine pixel occupies 0.5 world units on the main room's 2× backing canvas.
const FINE_SCALE = 2;
const WALNUT = '#865332';

function surface(ctx: Context, x: number, y: number, w: number, h: number) {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
  // Snap inward, so fractional caller footprints never gain a protruding edge.
  const left = Math.ceil(x * FINE_SCALE), top = Math.ceil(y * FINE_SCALE);
  const right = Math.floor((x + w) * FINE_SCALE), bottom = Math.floor((y + h) * FINE_SCALE);
  if (![left, top, right, bottom].every(Number.isSafeInteger)) return;
  const width = right - left, height = bottom - top;
  if (width <= 0 || height <= 0) return;
  const mark: Mark = (a, b, aw, bh, color) => {
    const x0 = Math.max(0, Math.ceil(a)), y0 = Math.max(0, Math.ceil(b));
    const x1 = Math.min(width, Math.floor(a + aw)), y1 = Math.min(height, Math.floor(b + bh));
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = color;
    ctx.fillRect((left + x0) / FINE_SCALE, (top + y0) / FINE_SCALE,
      (x1 - x0) / FINE_SCALE, (y1 - y0) / FINE_SCALE);
  };
  return { width, height, mark };
}

/** Small fixed palette per paint; no per-grain color mixing or growing cache. */
function walnutPalette(base: string) {
  return {
    seam: mix(base, '#352219', 0.78),
    return: mix(base, '#563221', 0.59),
    recess: mix(base, '#643b26', 0.40),
    frame: mix(base, '#a76a3e', 0.21),
    face: mix(base, '#b77a49', 0.20),
    rail: mix(base, '#c58b50', 0.31),
    edge: mix(base, '#e7b774', 0.54),
    grain: mix(base, '#5f3a26', 0.18),
    grainLight: mix(base, '#c08b59', 0.24),
  };
}
type WalnutPalette = ReturnType<typeof walnutPalette>;

function seedAt(i: number, seed: number): number {
  let n = Math.imul(i + 1, 0x45d9f3b) ^ seed;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

/** Broken, lengthwise fibers. Sparse marks leave the warm face readable. */
function grain(p: Mark, x: number, y: number, long: number, deep: number,
  palette: WalnutPalette, seed: number, vertical = false): void {
  if (long < 5 || deep < 3) return;
  const along: Mark = (a, b, aw, bh, color) => vertical
    ? p(x + b, y + a, bh, aw, color) : p(x + a, y + b, aw, bh, color);
  // Both loops have fixed upper bounds, even if a caller paints a huge beam.
  const bands = Math.min(5, Math.max(1, Math.floor(deep / 5)));
  const count = Math.min(48, Math.max(1, Math.floor(long / 13)));
  for (let band = 0; band < bands; band++) {
    const b = Math.min(deep - 1, 1 + Math.floor((band + 0.35) * (deep - 2) / bands));
    for (let i = 0; i < count; i++) {
      const n = seedAt(i + band * 53, seed);
      const cell = Math.floor(i * long / count);
      const a = Math.min(long - 2, cell + 1 + n % 4);
      const length = Math.min(long - a, 3 + (n >>> 4) % 11);
      along(a, b, length, 1, (n & 1) === 0 ? palette.grain : palette.grainLight);
      // A single stepped fiber, not an all-over beveled noise pattern.
      if (length > 6 && b + 1 < deep && (n & 7) === 3) {
        along(a + 3, b + 1, length - 4, 1, palette.grain);
      }
    }
  }
}

/** Walnut door with separate stiles, a recessed panel and a tiny brass pull. */
export function paintFineCabinet(ctx: Context, x: number, y: number, w: number, h: number,
  base = WALNUT, handle = false): void {
  const panel = surface(ctx, x, y, w, h);
  if (!panel) return;
  const { width: W, height: H, mark: p } = panel;
  const c = walnutPalette(base);
  ctx.save();
  p(0, 0, W, H, c.seam);
  p(1, 1, W - 2, H - 2, c.frame);
  // Planed upper face catches light; the right return and foot stay in shade.
  p(1, 0, W - 2, 1, c.rail);
  p(1, 1, W - 3, 1, c.edge);
  p(1, 2, 1, H - 4, c.rail);
  p(W - 2, 2, 1, H - 3, c.return);
  p(2, H - 3, W - 4, 1, c.return);

  if (W >= 14 && H >= 14) {
    const stile = W < 26 ? 3 : 4, rail = H < 24 ? 3 : 4;
    const ix = stile, iy = rail, iw = W - stile * 2, ih = H - rail * 2 - 1;
    // The inner panel sits behind the rails. Its upper/left groove is dark;
    // the lower/right slope reflects light back into the inset.
    p(ix, iy, iw, ih, c.seam);
    p(ix + 1, iy + 1, iw - 2, ih - 2, c.recess);
    p(ix + 2, iy + 2, iw - 4, ih - 4, c.face);
    p(ix + 2, iy + ih - 2, iw - 3, 1, c.rail);
    p(ix + iw - 2, iy + 2, 1, ih - 3, c.rail);
    // Rail grain runs across the door, while stile and floating panel grain
    // run downward. The resulting joints read as construction, not a box.
    grain(p, 3, 2, W - 7, Math.max(1, rail - 2), c, W * 7 + H);
    grain(p, 2, 4, H - 9, Math.max(1, stile - 2), c, H * 17, true);
    grain(p, ix + 2, iy + 2, ih - 4, iw - 4, c, W * 13 + H * 29, true);
    p(2, rail, Math.max(1, stile - 2), 1, c.recess);
    p(W - stile, H - rail - 2, Math.max(1, stile - 2), 1, c.recess);
    // Just two pin-sized warm glints in the mortise joints.
    if (W >= 28 && H >= 24) {
      p(2, H - rail - 1, 1, 1, c.rail);
      p(W - 4, rail - 1, 1, 1, c.rail);
    }
  } else {
    // Slender filler panels keep one readable face instead of nested frames.
    p(2, 2, W - 5, H - 5, c.face);
    grain(p, 2, 3, H - 7, W - 5, c, W * 13 + H * 29, true);
  }

  if (handle && W >= 20 && H >= 20) {
    if (W >= H * 1.4) {
      // Shallow wide fronts read as drawers, with a centered horizontal pull.
      const hx = Math.floor(W / 2) - 4, hy = Math.floor(H * 0.55);
      p(hx, hy, 8, 3, c.recess);
      p(hx + 1, hy + 2, 8, 2, c.seam);
      p(hx + 1, hy, 6, 2, '#aa7635');
      p(hx + 1, hy, 5, 1, '#f0cb7e');
      p(hx + 2, hy + 1, 4, 1, '#d5a655');
      p(hx + 1, hy, 6, 1, '#ffe0a0');
      p(hx + 6, hy + 1, 1, 1, '#765024');
    } else {
      const hx = W - 8, hy = Math.floor(H / 2) - 3;
      p(hx, hy, 3, 7, c.recess); // sunk fitting
      p(hx + 2, hy + 2, 2, 5, c.seam); // short lower-right cast shadow
      p(hx, hy + 1, 2, 5, '#aa7635');
      p(hx, hy + 1, 1, 4, '#f0cb7e');
      p(hx + 1, hy + 1, 1, 3, '#d5a655');
      p(hx, hy + 1, 2, 1, '#ffe0a0');
      p(hx + 1, hy + 5, 1, 1, '#765024');
    }
  }
  ctx.restore();
}

/** A planed beam: narrow lit lip, warm broad face, darker return and end joints. */
export function paintFineBeam(ctx: Context, x: number, y: number, w: number, h: number,
  vertical = false, base = WALNUT): void {
  const beam = surface(ctx, x, y, w, h);
  if (!beam) return;
  const { width: W, height: H, mark } = beam;
  const p: Mark = vertical
    ? (a, b, aw, bh, color) => mark(b, a, bh, aw, color) : mark;
  const long = vertical ? H : W, deep = vertical ? W : H;
  const c = walnutPalette(base);
  ctx.save();
  p(0, 0, long, deep, c.seam);
  p(1, 1, long - 2, deep - 2, c.frame);
  p(1, 1, long - 3, 1, c.edge);
  p(2, 2, long - 4, 1, c.rail);
  const turn = deep >= 10 ? 3 : 1;
  p(1, deep - turn - 1, long - 2, turn, c.return);
  p(2, deep - turn - 2, long - 4, 1, c.recess);
  grain(p, 3, 3, long - 6, deep - turn - 6, c, long * 11 + deep * 23);

  if (long >= 32 && deep >= 10) {
    for (const a of [5, long - 7]) {
      // An end-grain seam and one countersunk peg are enough at this scale.
      p(a, 3, 1, deep - 6, c.recess);
      p(a + 1, 3, 1, deep - 7, c.grainLight);
      p(a + 2, 4, 2, 2, c.return);
      p(a + 2, 4, 1, 1, c.rail);
    }
  }
  if (long >= 80 && deep >= 14) {
    const a = Math.floor(long * 0.38), b = Math.floor((deep - turn) / 2);
    // One elongated knot, drawn with four fine marks rather than dark spots.
    p(a, b, 7, 1, c.grain);
    p(a + 2, b - 1, 4, 1, c.grainLight);
    p(a + 3, b + 1, 5, 1, c.grain);
    p(a + 5, b, 2, 1, c.recess);
  }
  ctx.restore();
}
