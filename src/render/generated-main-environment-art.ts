import { mix } from './color';

/** Measurements from the immutable environment manifest. Alpha > 128 was used
 * only for measuring these bounds; the complete RGBA source is always baked. */
export const GENERATED_MAIN_ENVIRONMENT_CATALOG = {
  'main-horizontal-beam': { size: [684, 118], bbox: { x: 15, y: 16, w: 652, h: 83 }, cacheEnvelope: [80, 16] },
  'main-corner-post': { size: [147, 540], bbox: { x: 20, y: 19, w: 108, h: 503 }, cacheEnvelope: [18, 80] },
  'foreground-threshold': { size: [619, 122], bbox: { x: 11, y: 5, w: 585, h: 93 }, cacheEnvelope: [64, 12] },
  'outdoor-tree-line': { size: [516, 412], bbox: { x: 20, y: 14, w: 485, h: 376 }, cacheEnvelope: [94, 50] },
  'village-roof-cluster': { size: [404, 347], bbox: { x: 7, y: 19, w: 392, h: 290 }, cacheEnvelope: [80, 48] },
  cloud: { size: [419, 220], bbox: { x: 7, y: 16, w: 396, h: 191 }, cacheEnvelope: [44, 20] },
} as const;

export type GeneratedMainEnvironmentId = keyof typeof GENERATED_MAIN_ENVIRONMENT_CATALOG;
export const GENERATED_MAIN_ENVIRONMENT_IDS = Object.freeze(
  Object.keys(GENERATED_MAIN_ENVIRONMENT_CATALOG) as GeneratedMainEnvironmentId[]);
export const generatedMainEnvironmentKey = (id: GeneratedMainEnvironmentId): `environment-${GeneratedMainEnvironmentId}` => `environment-${id}`;
export const GENERATED_MAIN_ENVIRONMENT_DENSITY = 4;
export type GeneratedMainEnvironmentSources = Readonly<Partial<Record<GeneratedMainEnvironmentId, CanvasImageSource>>>;
export type GeneratedMainEnvironmentAlignment = 'left' | 'center' | 'right';
export interface GeneratedMainEnvironmentOptions {
  readonly createCanvas?: () => HTMLCanvasElement;
  readonly catalog?: Readonly<Partial<Record<GeneratedMainEnvironmentId, {
    readonly size: readonly number[]; readonly bbox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    readonly cacheEnvelope: readonly number[];
  }>>>;
}

export interface GeneratedMainEnvironmentAdapter {
  readonly ready: boolean;
  readonly readyIds: readonly GeneratedMainEnvironmentId[];
  /** One immutable-size 4× backing per ready identity; never the input bitmap. */
  artwork(id: string): HTMLCanvasElement | undefined;
  /** Repeat measured beam modules uniformly; clip only at the destination band. */
  paintBeam(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): boolean;
  /** Full-source contain in this box, bottom aligned. x/y are the box's top-left. */
  paintPost(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number, maxH: number,
    align?: GeneratedMainEnvironmentAlignment): boolean;
  /** Full-source contain, horizontally centered and bottom aligned in this box. */
  paintThreshold(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number, maxH: number): boolean;
  /** The caller supplies the existing glass aperture; no frame or room is baked. */
  paintWindowScenery(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    dark: number, t: number, paintSky?: boolean): boolean;
}

type Box = Readonly<{ x: number; y: number; w: number; h: number }>;
interface Baked {
  readonly canvas: HTMLCanvasElement;
  /** Exact image extent, excluding at most one transparent cache-padding pixel. */
  readonly width: number;
  readonly height: number;
  readonly bbox: Box;
}

function sourceSize(source: CanvasImageSource): readonly [number, number] {
  const s = source as unknown as { complete?: boolean; naturalWidth?: number; naturalHeight?: number;
    videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  if (s.complete === false) return [0, 0];
  if (s.naturalWidth !== undefined || s.naturalHeight !== undefined) return [s.naturalWidth ?? 0, s.naturalHeight ?? 0];
  if (s.videoWidth !== undefined || s.videoHeight !== undefined) return [s.videoWidth ?? 0, s.videoHeight ?? 0];
  if (s.displayWidth !== undefined || s.displayHeight !== undefined) return [s.displayWidth ?? 0, s.displayHeight ?? 0];
  return [s.width ?? 0, s.height ?? 0];
}

function bake(sources: GeneratedMainEnvironmentSources, make: () => HTMLCanvasElement, catalog?: GeneratedMainEnvironmentOptions['catalog']): Map<GeneratedMainEnvironmentId, Baked> {
  const result = new Map<GeneratedMainEnvironmentId, Baked>();
  for (const id of GENERATED_MAIN_ENVIRONMENT_IDS) {
    try {
      const source = sources[id];
      if (!source) continue;
      const [sw, sh] = sourceSize(source), meta = catalog?.[id] ?? GENERATED_MAIN_ENVIRONMENT_CATALOG[id];
      if (![sw, sh].every(n => Number.isFinite(n) && n > 0)) continue;
      // Packed PNGs scale both axes together and can pad the shorter edge by
      // <= 1 px. Measure authored bounds with that same packed ratio.
      const packedRatio = Math.max(sw, sh) / Math.max(...meta.size);
      if (Math.abs(sw - meta.size[0] * packedRatio) > 1 || Math.abs(sh - meta.size[1] * packedRatio) > 1) continue;
      const density = GENERATED_MAIN_ENVIRONMENT_DENSITY;
      const maxW = meta.cacheEnvelope[0] * density, maxH = meta.cacheEnvelope[1] * density;
      const scale = Math.min(maxW / sw, maxH / sh);
      const width = sw * scale, height = sh * scale;
      const canvas = make();
      canvas.width = Math.min(maxW, Math.ceil(width)); canvas.height = Math.min(maxH, Math.ceil(height));
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, sw, sh, 0, 0, width, height);
      const k = packedRatio * scale, { bbox } = meta;
      result.set(id, Object.freeze({ canvas, width, height,
        bbox: Object.freeze({ x: bbox.x * k, y: bbox.y * k, w: bbox.w * k, h: bbox.h * k }) }));
    } catch {
      // Each identity publishes atomically. A bad source never disables peers.
    }
  }
  return result;
}

function validBox(x: number, y: number, w: number, h: number): boolean {
  return [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0;
}

/** Full source region, one uniform destination scale. Never an alpha crop. */
function draw(ctx: CanvasRenderingContext2D, art: Baked, x: number, y: number, scale: number): void {
  ctx.drawImage(art.canvas, 0, 0, art.width, art.height, x, y, art.width * scale, art.height * scale);
}

function contain(ctx: CanvasRenderingContext2D, art: Baked | undefined,
  x: number, y: number, w: number, h: number, align: GeneratedMainEnvironmentAlignment): boolean {
  if (!art || !validBox(x, y, w, h)) return false;
  const scale = Math.min(w / art.width, h / art.height);
  const offset = align === 'left' ? 0 : align === 'right' ? 1 : .5;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    draw(ctx, art, x + (w - art.width * scale) * offset, y + h - art.height * scale, scale);
  } finally { ctx.restore(); }
  return true;
}

/** Position the measured painted body; preserve its faint surrounding alpha. */
function body(ctx: CanvasRenderingContext2D, art: Baked | undefined,
  left: number, bottom: number, maxW: number, maxH: number): void {
  if (!art) return;
  const scale = Math.min(maxW / art.bbox.w, maxH / art.bbox.h);
  draw(ctx, art, left - art.bbox.x * scale, bottom - (art.bbox.y + art.bbox.h) * scale, scale);
}

/** Separate closure: the returned adapter retains only the bounded baked map. */
function adapterFor(baked: ReadonlyMap<GeneratedMainEnvironmentId, Baked>): GeneratedMainEnvironmentAdapter {
  const readyIds = Object.freeze([...baked.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    artwork(id: string) { return baked.get(id as GeneratedMainEnvironmentId)?.canvas; },
    paintBeam(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
      const art = baked.get('main-horizontal-beam');
      if (!art || !validBox(x, y, w, h)) return false;
      const scale = h / art.bbox.h, step = art.bbox.w * scale;
      const count = Math.ceil(w / step);
      // Also reject unreasonable boxes instead of risking an unbounded paint loop.
      if (!Number.isFinite(count) || count > 2048) return false;
      ctx.save();
      try {
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        for (let i = 0; i < count; i++) {
          draw(ctx, art, x + i * step - art.bbox.x * scale, y - art.bbox.y * scale, scale);
        }
      } finally { ctx.restore(); }
      return true;
    },
    paintPost(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
      align: GeneratedMainEnvironmentAlignment = 'center') {
      return contain(ctx, baked.get('main-corner-post'), x, y, w, h, align);
    },
    paintThreshold(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
      return contain(ctx, baked.get('foreground-threshold'), x, y, w, h, 'center');
    },
    paintWindowScenery(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: number, t: number, paintSky = true) {
      const trees = baked.get('outdoor-tree-line'), roofs = baked.get('village-roof-cluster'), cloud = baked.get('cloud');
      if ((!trees && !roofs && !cloud) || !validBox(x, y, w, h)) return false;
      const darkness = Number.isFinite(dark) ? Math.max(0, Math.min(1, dark)) : 0;
      const time = Number.isFinite(t) ? t : 0;
      ctx.save();
      try {
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        // Sky remains live code. Source colors/alpha are never thresholded,
        // recolored, filtered, or painted into a flattened room backdrop.
        if (paintSky) {
          ctx.fillStyle = mix('#cce5e5', '#15283d', darkness); ctx.fillRect(x, y, w, h);
          ctx.fillStyle = mix('#e7e9c8', '#243b4a', darkness); ctx.fillRect(x, y + h * .62, w, h * .38);
        }
        if (darkness <= .6) body(ctx, cloud, x + w * (.08 + Math.sin(time * .05) * .12), y + h * .32, w * .67, h * .28);
        body(ctx, trees, x - w * .12, y + h * 1.06, w * .76, h * .72);
        body(ctx, roofs, x + w * .30, y + h * 1.02, w * .72, h * .62);
      } finally { ctx.restore(); }
      return true;
    },
  });
}

/** Six fixed 4× canvases maximum, once per load; paints allocate no canvases.
 * The caller can release all readyIds' decoded sources immediately afterward. */
export function createGeneratedMainEnvironmentArt(sources: GeneratedMainEnvironmentSources,
  options: GeneratedMainEnvironmentOptions = {}): GeneratedMainEnvironmentAdapter {
  return adapterFor(bake(sources, options.createCanvas ?? (() => document.createElement('canvas')), options.catalog));
}
