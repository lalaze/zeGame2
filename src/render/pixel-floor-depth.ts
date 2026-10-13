/**
 * Warm limestone for the main café. This is source-painted pixel artwork, not
 * a scene image: furnishings, rugs, light and contact shadows remain separate.
 */
type Ctx = CanvasRenderingContext2D;

export interface PixelFloorDepthOptions {
  /** Set to 1 when the complete ground layer uses the shared presentation projection. */
  horizontalBackScale?: number;
  /** World-space art pixel. Use 0.5 on a 2× backing canvas for finer detail. */
  pixelSize?: number;
  /** Number of whole stones across the front of the floor. */
  columns?: number;
  /** Number of courses from back to front; normally inferred from the aspect. */
  rows?: number;
}

const BACK_SCALE = 0.8;
const STONE = ['#ead6b5', '#eeddbc', '#ebd8b7', '#efdfc0', '#e7d3b1', '#ecdbb9'];
const GROUT = '#d2bc98';
const LIP = '#f5e7cc';

function noise(a: number, b: number, seed: number): number {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function blend(a: string, b: string, amount: number): string {
  let color = '#';
  for (const channel of [1, 3, 5]) {
    const av = parseInt(a.slice(channel, channel + 2), 16);
    const bv = parseInt(b.slice(channel, channel + 2), 16);
    color += Math.round(av + (bv - av) * amount).toString(16).padStart(2, '0');
  }
  return color;
}

function boundedCount(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.min(48, Math.round(Number.isFinite(value) ? value! : fallback)));
}

/**
 * Paint a complete floor rectangle with gently converging, stepped seams.
 * Perspective is only in the illustration, so this never changes world or
 * simulation coordinates. A single projection governs both axes; stones get
 * narrower and courses get shallower toward the back.
 *
 * All drawing is clipped arithmetically to the supplied rectangle, using only
 * hard-edged fillRect calls. No gradients, strokes, paths, randomness or time.
 * Work is bounded even for oversized rectangles or an unusually fine grid.
 */
export function paintPixelFloorDepth(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed = 17,
  options: PixelFloorDepthOptions = {},
): void {
  if (![x, y, w, h, x + w, y + h].every(Number.isFinite) || w <= 0 || h <= 0) return;

  const requestedPixel = options.pixelSize;
  const pixel = Math.max(
    Number.isFinite(requestedPixel) && requestedPixel! > 0 ? requestedPixel! : 1,
    h / 1024,
    w / 2048,
  );
  const columns = boundedCount(options.columns, 16);
  const horizontalBackScale = Number.isFinite(options.horizontalBackScale) ? Math.max(0.5, Math.min(1, options.horizontalBackScale!)) : BACK_SCALE;
  const rows = boundedCount(options.rows, Math.round(h / w * columns * 1.35));
  const seedKey = Number.isFinite(seed) ? seed | 0 : 17;
  // Extra stones outside the front rectangle fill the widening field of view
  // at the back. Cropping them avoids exposed triangular gutters at the sides.
  const extra = Math.ceil(columns * (1 / BACK_SCALE - 1) / 2) + 1;
  const snap = (n: number) => Math.round(n / pixel) * pixel;
  const depth = (q: number) => BACK_SCALE * q / (1 - (1 - BACK_SCALE) * q);
  const projectX = (u: number, t: number) => w * (0.5 + (u - 0.5) * (horizontalBackScale + (1 - horizontalBackScale) * t));

  const mark = (left: number, top: number, width: number, height: number, color: string) => {
    const right = Math.min(w, left + width);
    const bottom = Math.min(h, top + height);
    left = Math.max(0, left);
    top = Math.max(0, top);
    if (right <= left || bottom <= top) return;
    ctx.fillStyle = color;
    ctx.fillRect(x + left, y + top, right - left, bottom - top);
  };

  ctx.save();
  // Guarantees full coverage for fractional input sizes and tiny thumbnails.
  mark(0, 0, w, h, '#ecdbb9');

  for (let row = 0; row < rows; row++) {
    const top = row === 0 ? 0 : Math.min(h, snap(depth(row / rows) * h));
    const bottom = row === rows - 1 ? h : Math.min(h, snap(depth((row + 1) / rows) * h));
    if (bottom <= top) continue;

    for (let col = -extra; col < columns + extra; col++) {
      const tone = STONE[Math.floor(noise(col, row, seedKey) * STONE.length)];
      // Low-contrast mineral colors stay subordinate to the furniture.
      const chalk = blend(tone, '#fff3d8', 0.38);
      const ochre = blend(tone, '#cdb38a', 0.24);
      const cloud = blend(tone, '#fff0d1', 0.16);

      // Scan strips make the trapezoid edge pixel-stepped rather than smoothed.
      const strips = Math.ceil((bottom - top) / pixel);
      for (let strip = 0; strip < strips; strip++) {
        const sy = top + strip * pixel;
        const sh = Math.min(pixel, bottom - sy);
        const t = (sy + sh / 2) / h;
        const left = snap(projectX(col / columns, t));
        const right = snap(projectX((col + 1) / columns, t));
        mark(left, sy, right - left, sh, tone);
        // One quiet joint; deliberately no thick dark bottom/right bevel box.
        mark(left, sy, Math.min(pixel, right - left), sh, GROUT);
      }

      // A few uneven, subdued chalk/mineral clusters instead of uniform noise.
      // Their count is independent of output resolution and thus bounded.
      for (let fleck = 0; fleck < 7; fleck++) {
        const key = row * 137 + fleck * 19;
        const u = 0.14 + noise(col * 11 + fleck, key, seedKey + 23) * 0.72;
        const v = 0.17 + noise(col * 7 - fleck, key, seedKey + 71) * 0.65;
        const sy = snap(top + v * (bottom - top));
        const t = sy / h;
        const left = snap(projectX(col / columns, t)) + pixel * 2;
        const right = snap(projectX((col + 1) / columns, t)) - pixel * 2;
        const sx = snap(projectX((col + u) / columns, t));
        const width = pixel * (fleck === 0 ? 3 : fleck % 3 === 0 ? 2 : 1);
        if (sx < left || sx + width > right || sy + pixel >= bottom - pixel) continue;
        mark(sx, sy, width, pixel, fleck === 0 ? cloud : fleck % 3 ? chalk : ochre);
        if (fleck === 1 && sy + pixel * 2 < bottom - pixel) {
          mark(sx + pixel, sy + pixel, pixel, pixel, chalk);
        }
      }
    }

    // Fine cream edges catch light along only the top of each course. The
    // vertical seams remain un-beveled, so the floor does not read as a cage.
    if (row > 0) {
      mark(0, top, w, Math.min(pixel, bottom - top), GROUT);
      if (bottom - top > pixel * 3) mark(0, top + pixel, w, pixel, LIP);
    }
  }
  ctx.restore();
}
