import { fineSpriteArt, isFineBacking, type FineSpriteArt } from './fine-sprite-art';
import { resampleRgba } from './pixel-resample';

export { resampleRgba };

/**
 * The café world has ONE art grid: two art pixels per room pixel (640×480 for the
 * 320×240 room). Room layers paint at this density, sprites authored at 3× or 4×
 * are resampled onto it once, and the stage renders a whole number of device
 * pixels per art pixel. Rules for new artwork: docs/art-grid/README.md.
 */
export const WORLD_ART_DENSITY = 2;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  return canvas;
}

const isImage = (image: unknown): image is HTMLImageElement => typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement;
const isCanvas = (image: unknown): image is HTMLCanvasElement => typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement;
const isBitmap = (image: unknown): image is ImageBitmap => typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;

/** Canvases whose pixels never change once made, so their resamples may be cached. */
const finished = new WeakSet<object>();
const isFinished = (image: CanvasImageSource) =>
  finished.has(image) || (isCanvas(image) && isFineBacking(image)) || isImage(image) || isBitmap(image);

function naturalSize(image: CanvasImageSource): { width: number; height: number } | null {
  if (isImage(image)) return { width: image.naturalWidth, height: image.naturalHeight };
  if (isCanvas(image) || isBitmap(image)) return { width: image.width, height: image.height };
  return null;
}

const resamples = new WeakMap<object, Map<string, HTMLCanvasElement>>();
const RESAMPLES_PER_SOURCE = 48;

/** A source region resampled to exactly `tw`×`th` pixels on the art grid, cached for finished sources. */
export function resampleImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  const key = `${sx},${sy},${sw},${sh}>${tw}x${th}`;
  const cache = isFinished(image) ? resamples.get(image as object) ?? new Map<string, HTMLCanvasElement>() : null;
  const old = cache?.get(key);
  if (old) return old;
  const result = makeCanvas(tw, th), resultCtx = result.getContext('2d')!;
  if (typeof ImageData === 'undefined' || typeof resultCtx.getImageData !== 'function') {
    // Hosts without pixel access (headless test canvases) keep nearest-neighbour scaling.
    resultCtx.imageSmoothingEnabled = false;
    resultCtx.drawImage(image, sx, sy, sw, sh, 0, 0, tw, th);
  } else {
    const region = makeCanvas(sw, sh), regionCtx = region.getContext('2d')!;
    regionCtx.imageSmoothingEnabled = false;
    regionCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const pixels = resampleRgba(regionCtx.getImageData(0, 0, sw, sh).data, sw, sh, tw, th);
    resultCtx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, tw, th), 0, 0);
  }
  finished.add(result);
  if (cache) {
    if (cache.size >= RESAMPLES_PER_SOURCE) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    resamples.set(image as object, cache);
  }
  return result;
}

const worldArt = new WeakMap<HTMLCanvasElement, Map<string, FineSpriteArt>>();

/**
 * A sprite's artwork on the world grid at a logical size (its own by default).
 * Finer backings are resampled once; room-pixel and 2× art already sit on the grid.
 */
export function worldSpriteArt(original: HTMLCanvasElement, logicalWidth = original.width, logicalHeight = original.height): FineSpriteArt {
  const art = fineSpriteArt(original);
  const native = logicalWidth === art.logicalWidth && logicalHeight === art.logicalHeight;
  if (native && art.density <= WORLD_ART_DENSITY) return art;
  const width = Math.max(1, Math.round(logicalWidth * WORLD_ART_DENSITY));
  const height = Math.max(1, Math.round(logicalHeight * WORLD_ART_DENSITY));
  const key = `${width}x${height}`;
  let sizes = worldArt.get(art.canvas);
  const old = sizes?.get(key);
  if (old) return old;
  const canvas = resampleImage(art.canvas, 0, 0, art.canvas.width, art.canvas.height, width, height);
  const world = Object.freeze({ canvas, density: WORLD_ART_DENSITY, logicalWidth: width / WORLD_ART_DENSITY, logicalHeight: height / WORLD_ART_DENSITY });
  if (!sizes) { sizes = new Map(); worldArt.set(art.canvas, sizes); }
  sizes.set(key, world);
  return world;
}

/** Phaser crop rectangle, in texture pixels, for a sprite drawn with `worldSpriteArt`. */
export function worldCrop(original: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const { density, logicalWidth, logicalHeight } = worldSpriteArt(original);
  const left = Math.min(logicalWidth, Math.max(0, x));
  const top = Math.min(logicalHeight, Math.max(0, y));
  const right = Math.min(logicalWidth, Math.max(left, x + width));
  const bottom = Math.min(logicalHeight, Math.max(top, y + height));
  return { x: left * density, y: top * density, width: (right - left) * density, height: (bottom - top) * density };
}

type DrawArgs = [number, number] | [number, number, number, number] | [number, number, number, number, number, number, number, number];

/**
 * Snap `drawImage` onto the destination's pixel grid. A finished image drawn smaller
 * than its own resolution is resampled to exactly the device pixels it covers and
 * copied 1:1 at whole-pixel bounds; everything else draws exactly as before.
 */
function gridDrawImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, ...args: DrawArgs): void {
  const original = () => Reflect.apply(ctx.drawImage, ctx, [image, ...args]);
  const size = naturalSize(image);
  if (!size || !isFinished(image) || typeof ctx.getTransform !== 'function') { original(); return; }
  const m = ctx.getTransform();
  if (m.b !== 0 || m.c !== 0) { original(); return; }
  let sx = 0, sy = 0, sw = size.width, sh = size.height, dx: number, dy: number, dw = sw, dh = sh;
  if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args;
  else if (args.length === 4) [dx, dy, dw, dh] = args;
  else [dx, dy] = args;
  const x0 = m.a * dx + m.e, x1 = m.a * (dx + dw) + m.e, y0 = m.d * dy + m.f, y1 = m.d * (dy + dh) + m.f;
  const left = Math.round(Math.min(x0, x1)), right = Math.round(Math.max(x0, x1));
  const top = Math.round(Math.min(y0, y1)), bottom = Math.round(Math.max(y0, y1));
  const tw = right - left, th = bottom - top;
  sx = Math.round(sx); sy = Math.round(sy); sw = Math.round(sw); sh = Math.round(sh);
  if (tw <= 0 || th <= 0 || sw <= 0 || sh <= 0 || (tw >= sw && th >= sh)) { original(); return; }
  const resampled = resampleImage(image, sx, sy, sw, sh, tw, th);
  ctx.save();
  ctx.setTransform(x1 < x0 ? -1 : 1, 0, 0, y1 < y0 ? -1 : 1, x1 < x0 ? left + right : 0, y1 < y0 ? top + bottom : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(resampled, left, top);
  ctx.restore();
}

const gridContexts = new WeakMap<CanvasRenderingContext2D, CanvasRenderingContext2D>();

/** A drawing context whose images land on its own pixel grid; all other calls pass through. */
export function gridSafeContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  let proxy = gridContexts.get(ctx);
  if (!proxy) {
    const draw = (image: CanvasImageSource, ...args: DrawArgs) => gridDrawImage(ctx, image, ...args);
    proxy = new Proxy(ctx, {
      get(target, property) {
        if (property === 'drawImage') return draw;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, property, value) { return Reflect.set(target, property, value, target); },
    });
    gridContexts.set(ctx, proxy);
  }
  return proxy;
}
