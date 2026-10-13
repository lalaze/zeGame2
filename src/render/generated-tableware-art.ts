import { registerFineSpriteArt } from './fine-sprite-art';

/** Frozen misc-domain candidates and authored shallow serviceware, never recipe layers. */
export const GENERATED_TABLEWARE_IDS = Object.freeze([
  'empty-cup-saucer', 'empty-plate', 'heart', 'drop', 'crown', 'shallow-plate', 'shallow-tray',
] as const);
export type GeneratedTablewareId = typeof GENERATED_TABLEWARE_IDS[number];
export type GeneratedTablewareEffectId = 'heart' | 'drop' | 'crown';
export type GeneratedTablewareSources = Readonly<Partial<Record<GeneratedTablewareId, CanvasImageSource>>>;
export const GENERATED_TABLEWARE_DENSITY = 4;
export const generatedTablewareKey = (id: GeneratedTablewareId): `tableware-${GeneratedTablewareId}` => `tableware-${id}`;
export const GENERATED_TABLEWARE_ASSETS: Readonly<Record<GeneratedTablewareId, string>> = Object.freeze(
  Object.fromEntries(GENERATED_TABLEWARE_IDS.map(id => [id, `catalog-v1/tableware/${id}.png`])) as Record<GeneratedTablewareId, string>);

type Point = Readonly<{ x: number; y: number }>;
export interface GeneratedTablewareMeta {
  readonly file: string;
  readonly size: readonly [number, number];
  /** Measurement only: the complete PNG, including faint alpha, is always drawn. */
  readonly anchor: Point;
  /** Authored empty interior plane; the caller positions live food separately. */
  readonly support?: Point;
}
const meta = (id: GeneratedTablewareId, width: number, height: number, x: number, y: number,
  options: { folder?: string; support?: Point } = {}): GeneratedTablewareMeta => Object.freeze({
  file: `${options.folder ?? 'bulk-candidates/ui'}/${id}.png`, size: Object.freeze([width, height] as const),
  anchor: Object.freeze({ x, y }), ...(options.support ? { support: Object.freeze({ ...options.support }) } : {}),
});
/** Exact source coordinates from misc and shallow-tableware-v1 manifests. */
export const GENERATED_TABLEWARE_CATALOG: Readonly<Record<GeneratedTablewareId, GeneratedTablewareMeta>> = Object.freeze({
  'empty-cup-saucer': meta('empty-cup-saucer', 378, 367, 195.5, 336),
  'empty-plate': meta('empty-plate', 348, 350, 163, 316),
  heart: meta('heart', 310, 304, 163, 252),
  drop: meta('drop', 305, 305, 137.5, 269),
  crown: meta('crown', 348, 305, 162, 262),
  'shallow-plate': meta('shallow-plate', 1218, 177, 609, 164,
    { folder: 'shallow-tableware-v1', support: { x: 609, y: 84 } }),
  'shallow-tray': meta('shallow-tray', 1458, 202, 729, 189,
    { folder: 'shallow-tableware-v1', support: { x: 729, y: 84 } }),
});
/**
 * Cup and effects retain their old final canvas dimensions, including the
 * effects' existing 1px padding. The authored plate needs its own honest 12×12
 * envelope; it is not squashed into the old PASS_SLOT_W×2 edge-on placeholder.
 * The near-square empty-tray candidate similarly cannot replace a 22×3 tray;
 * new shallow serviceware has independent 12×2 and 22×3 envelopes instead.
 * No logo is included: the archive has no authored replacement for icon.svg.
 */
export const GENERATED_TABLEWARE_ENVELOPES: Readonly<Record<GeneratedTablewareId, readonly [number, number]>> = Object.freeze({
  'empty-cup-saucer': Object.freeze([7, 7] as const),
  'empty-plate': Object.freeze([12, 12] as const),
  heart: Object.freeze([9, 8] as const),
  drop: Object.freeze([7, 7] as const),
  crown: Object.freeze([9, 6] as const),
  'shallow-plate': Object.freeze([12, 2] as const),
  'shallow-tray': Object.freeze([22, 3] as const),
});

export interface GeneratedTablewareAdapter {
  /** At least one successfully baked identity; absent identities stay legacy. */
  readonly ready: boolean;
  readonly readyIds: readonly GeneratedTablewareId[];
  /** Stable logical canvas with an associated 4× fineSpriteArt backing. */
  sprite(id: string): HTMLCanvasElement | undefined;
  cup(): HTMLCanvasElement | undefined;
  plate(): HTMLCanvasElement | undefined;
  passPlate(): HTMLCanvasElement | undefined;
  tray(): HTMLCanvasElement | undefined;
  effect(id: GeneratedTablewareEffectId): HTMLCanvasElement | undefined;
  /** Measured lower contact in logical canvas coordinates, after whole-PNG fit. */
  anchor(id: string): Point | undefined;
  /** Interior support contact in logical coordinates; not the lower silhouette edge. */
  support(id: string): Point | undefined;
  /** Paint at the logical top-left. No source access, crops or new allocation. */
  paint(ctx: CanvasRenderingContext2D, id: string, x: number, y: number): boolean;
}
export interface GeneratedTablewareOptions { readonly createCanvas?: () => HTMLCanvasElement }
interface Baked {
  readonly sprite: HTMLCanvasElement;
  readonly backing: HTMLCanvasElement;
  readonly anchor: Point;
  readonly support?: Point;
}

function sourceSize(source: CanvasImageSource): Point {
  const value = source as unknown as { complete?: boolean; naturalWidth?: number; naturalHeight?: number;
    videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  if (value.complete === false) return { x: 0, y: 0 };
  // Keep intrinsic pairs together: CSS dimensions cannot revive a failed image.
  if (value.naturalWidth !== undefined || value.naturalHeight !== undefined) {
    return { x: value.naturalWidth ?? 0, y: value.naturalHeight ?? 0 };
  }
  if (value.videoWidth !== undefined || value.videoHeight !== undefined) {
    return { x: value.videoWidth ?? 0, y: value.videoHeight ?? 0 };
  }
  if (value.displayWidth !== undefined || value.displayHeight !== undefined) {
    return { x: value.displayWidth ?? 0, y: value.displayHeight ?? 0 };
  }
  return { x: value.width ?? 0, y: value.height ?? 0 };
}

/** Separate closure deliberately retains only small baked outputs, not sources/options. */
function publish(baked: ReadonlyMap<GeneratedTablewareId, Baked>): GeneratedTablewareAdapter {
  const get = (id: string) => baked.get(id as GeneratedTablewareId);
  const readyIds = Object.freeze([...baked.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    sprite(id: string) { return get(id)?.sprite; },
    cup() { return get('empty-cup-saucer')?.sprite; },
    plate() { return get('empty-plate')?.sprite; },
    passPlate() { return get('shallow-plate')?.sprite; },
    tray() { return get('shallow-tray')?.sprite; },
    effect(id: GeneratedTablewareEffectId) { return get(id)?.sprite; },
    anchor(id: string) { return get(id)?.anchor; },
    support(id: string) { return get(id)?.support; },
    paint(ctx: CanvasRenderingContext2D, id: string, x: number, y: number) {
      const art = get(id); if (!art) return false;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art.backing, x, y, art.sprite.width, art.sprite.height);
      ctx.restore(); return true;
    },
  });
}

/**
 * Bake two canvases per eligible identity once, then release source references.
 * Preserve every source pixel's alpha/color: no bbox crop, masking, recoloring,
 * extra outline, or background. A single isotropic scale fits the entire PNG.
 * The packer's long edge is exact; ceil contributes less than one transparent
 * pixel on the shorter edge. Excluding only that exporter-added padding keeps
 * the original aspect and contact coordinates without trimming authored alpha.
 */
export function createGeneratedTablewareArt(sources: GeneratedTablewareSources,
  options: GeneratedTablewareOptions = {}): GeneratedTablewareAdapter {
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const result = make(); result.width = width; result.height = height;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated tableware art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const baked = new Map<GeneratedTablewareId, Baked>();
  for (const id of GENERATED_TABLEWARE_IDS) {
    try {
      const source = sources[id]; if (!source) continue;
      const size = sourceSize(source), metadata = GENERATED_TABLEWARE_CATALOG[id];
      if (![size.x, size.y].every(n => Number.isFinite(n) && n > 0)) continue;
      const packedScale = Math.max(size.x, size.y) / Math.max(...metadata.size);
      const productionContentSize = { x: metadata.size[0] * packedScale, y: metadata.size[1] * packedScale };
      // A shorter raster would clip authored content. A larger one is not this
      // exporter's bounded ceil padding. Either must retain the legacy fallback.
      const padding = [size.x - productionContentSize.x, size.y - productionContentSize.y];
      if (padding.some(n => n < -1e-10 || n >= 1)) continue;
      const [w, h] = GENERATED_TABLEWARE_ENVELOPES[id], d = GENERATED_TABLEWARE_DENSITY;
      const scale = Math.min(w / productionContentSize.x, h / productionContentSize.y);
      const width = productionContentSize.x * scale, height = productionContentSize.y * scale;
      const x = (w - width) / 2, y = (h - height) / 2;
      const backing = canvas(w * d, h * d);
      backing.ctx.drawImage(source, 0, 0, productionContentSize.x, productionContentSize.y,
        x * d, y * d, width * d, height * d);
      const logical = canvas(w, h);
      logical.ctx.drawImage(backing.canvas, 0, 0, w, h);
      registerFineSpriteArt(logical.canvas, backing.canvas, d);
      const point = (p: Point): Point => Object.freeze({ x: x + p.x * packedScale * scale,
        y: y + p.y * packedScale * scale });
      const anchor = point(metadata.anchor), support = metadata.support ? point(metadata.support) : undefined;
      baked.set(id, Object.freeze({ sprite: logical.canvas, backing: backing.canvas, anchor, support }));
    } catch {
      // An unavailable context or failed draw affects only this identity.
      // Never publish a blank or half-baked sprite over a working fallback.
    }
  }
  return publish(baked);
}
