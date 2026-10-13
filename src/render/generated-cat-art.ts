import { CATS, type CatId } from '../game/pets';
import { registerFineSpriteArt } from './fine-sprite-art';
import type { CatFrames } from './sprites';

export const GENERATED_CAT_STATES = ['idle', 'swish', 'blink', 'happy', 'walkA', 'walkB', 'sleep',
  'groomA', 'groomB', 'stretch', 'watch', 'lookUp', 'nuzzleA', 'nuzzleB'] as const;
export type GeneratedCatState = typeof GENERATED_CAT_STATES[number];
export type GeneratedCatFrameId = `${CatId}-${GeneratedCatState}`;
export const GENERATED_CAT_BREEDS: readonly CatId[] = Object.freeze(CATS.map(cat => cat.id));
/** Enumerate one identity without accidentally requesting all 168 source images. */
export const generatedCatFrameIds = (breed: CatId): readonly GeneratedCatFrameId[] =>
  Object.freeze(GENERATED_CAT_STATES.map(state => `${breed}-${state}` as const));
export const GENERATED_CAT_FRAME_IDS: readonly GeneratedCatFrameId[] = Object.freeze(
  GENERATED_CAT_BREEDS.flatMap(generatedCatFrameIds));
export const GENERATED_CAT_DENSITY = 4;
export const GENERATED_CAT_FOOT = Object.freeze({ x: 12, y: 17 });
/** Every original content pixel must fit. Larger packs need an envelope adaptation, never pose fitting. */
export const GENERATED_CAT_ENVELOPE = Object.freeze({ width: 24, height: 18, foot: GENERATED_CAT_FOOT });
/** Legacy Siamese sheet names; other breeds may have their own correction sheets. */
export const GENERATED_CAT_SHEETS = ['core-source.png', 'behaviors-source.png', 'interaction-source.png', 'nuzzle-raised-source.png'] as const;
export type GeneratedCatSheet = string;
type Point = Readonly<{ x: number; y: number }>;
type SheetScales = Readonly<Record<GeneratedCatSheet, number>>;
export interface GeneratedCatFrameMeta {
  readonly state: GeneratedCatState;
  readonly source: GeneratedCatSheet;
  /** Complete independent PNG dimensions, including the original alpha fringe. */
  readonly size: readonly number[];
  /** Optional extent before the exporter rounded the PNG canvas up to integer pixels.
   * Each dimension must be in (size - 1, size]. Only trailing export padding is omitted. */
  readonly productionContentSize?: readonly number[];
  /** Opaque silhouette QA bounds. Rendering preserves all original image content instead. */
  readonly bbox: Readonly<{ x: number; y: number; w: number; h: number }>;
  readonly foot: Point;
  readonly headContact: Point;
  readonly sourceToWorldScale: number;
}
export interface GeneratedCatManifest {
  readonly breed: string;
  readonly frames: readonly GeneratedCatFrameMeta[];
}
export type GeneratedCatSources = Readonly<Partial<Record<GeneratedCatFrameId, CanvasImageSource>>>;
export interface GeneratedCatContacts { readonly foot: Point; readonly headContact: Point }
export interface GeneratedCatResult { readonly frames: CatFrames; readonly generated: boolean }
export interface GeneratedCatError {
  readonly breed: string;
  readonly code: 'unknown-breed' | 'duplicate-breed' | 'invalid-manifest' | 'invalid-scale' | 'invalid-frame' |
    'missing-source' | 'invalid-content-size' | 'invalid-metadata' | 'inconsistent-sheet-scale' | 'envelope-overflow' | 'bake-failed';
  readonly frameId?: GeneratedCatFrameId;
  readonly message: string;
  /** Original image-content bounds in the logical canvas; present on envelope overflow. */
  readonly bounds?: Readonly<{ left: number; top: number; right: number; bottom: number }>;
}
export interface GeneratedCatAdapter {
  /** True if at least one complete breed was baked. */
  readonly ready: boolean;
  readonly readyBreeds: readonly CatId[];
  /** Only complete, successfully baked packs may release their source images. */
  readonly sourceFrameIds: readonly GeneratedCatFrameId[];
  /** Legacy Siamese calibration; null when that breed is not ready. */
  readonly scales: SheetScales | null;
  readonly scalesByBreed: Readonly<Partial<Record<CatId, SheetScales>>>;
  readonly errors: readonly GeneratedCatError[];
  resolve(breed: CatId, fallback: CatFrames): GeneratedCatResult;
  /** Add to x=painted.x-9, y=painted.y-frame.height+2. Unknown frames return zero. */
  drawOffset(frame: HTMLCanvasElement): Point;
  /** Canvas-local contacts after the optional Scene flip; no second mirror needed. */
  contactPoints(frame: HTMLCanvasElement, flipX?: boolean): GeneratedCatContacts | null;
}
export interface GeneratedCatOptions {
  /** One multiplier for all sheet calibrations. Unsafe/clipping values reject the affected pack. */
  readonly scale?: number;
  readonly createCanvas?: () => HTMLCanvasElement;
}

const { width: WIDTH, height: HEIGHT } = GENERATED_CAT_ENVELOPE;
const D = GENERATED_CAT_DENSITY;
const ZERO = Object.freeze({ x: 0, y: 0 });
const OFFSET = Object.freeze({ x: -3, y: 0 });
const SIAMESE_SHEET: Record<GeneratedCatState, GeneratedCatSheet> = {
  idle: 'core-source.png', lookUp: 'core-source.png', walkA: 'core-source.png', walkB: 'core-source.png',
  swish: 'behaviors-source.png', blink: 'behaviors-source.png', happy: 'behaviors-source.png', sleep: 'behaviors-source.png',
  groomA: 'behaviors-source.png', groomB: 'behaviors-source.png', stretch: 'interaction-source.png', watch: 'interaction-source.png',
  nuzzleA: 'nuzzle-raised-source.png', nuzzleB: 'nuzzle-raised-source.png',
};
interface SourceFrame {
  readonly source: CanvasImageSource;
  readonly meta: GeneratedCatFrameMeta;
  readonly scale: number;
  readonly contentSize: readonly number[];
}
function sourceSize(source: CanvasImageSource): Point {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { x: value.naturalWidth ?? value.videoWidth ?? value.displayWidth ?? value.width ?? 0,
    y: value.naturalHeight ?? value.videoHeight ?? value.displayHeight ?? value.height ?? 0 };
}
function within(point: Point, b: GeneratedCatFrameMeta['bbox']): boolean {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= b.x && point.x <= b.x + b.w &&
    point.y >= b.y && point.y <= b.y + b.h;
}

/**
 * Independently replace complete breed identities, including all fourteen poses.
 * All poses share a symmetric 24×18 envelope and ground (12,17). Its -3 x offset
 * retains the legacy logical x=9/world foot at painted+(0,1), including flipX.
 * Walking remains authored head-left: retain residentCatFlipX(walking,facing).
 * Sheet scales preserve head/body proportions; never fit each pose to a height.
 * At most twelve packs allocate fourteen logical/backing pairs each. Resolution
 * and fallback do not allocate canvases, and no source images remain captured.
 */
export function createGeneratedCatArt(manifest: GeneratedCatManifest | readonly GeneratedCatManifest[], sources: GeneratedCatSources,
  options: GeneratedCatOptions = {}): GeneratedCatAdapter {
  const manifests: readonly GeneratedCatManifest[] = Array.isArray(manifest) ? manifest : [manifest as GeneratedCatManifest];
  const packs = new Map<CatId, GeneratedCatManifest>();
  const duplicates = new Set<CatId>();
  const errors: GeneratedCatError[] = [];
  for (const candidate of manifests) {
    const breed = candidate?.breed;
    if (!GENERATED_CAT_BREEDS.includes(breed as CatId)) {
      errors.push({ breed: breed ?? '', code: 'unknown-breed', message: `Unknown generated cat breed: ${String(breed)}.` });
      continue;
    }
    const id = breed as CatId;
    if (packs.has(id)) {
      duplicates.add(id);
      errors.push({ breed, code: 'duplicate-breed', message: `Multiple manifests claim ${breed}; the whole breed remains fallback.` });
    } else packs.set(id, candidate);
  }
  const multiplier = options.scale ?? 1;
  const results = new Map<CatId, GeneratedCatResult>();
  const sourceFrameIds: GeneratedCatFrameId[] = [];
  const scalesByBreed: Partial<Record<CatId, SheetScales>> = {};
  const contacts = new WeakMap<HTMLCanvasElement, readonly [GeneratedCatContacts, GeneratedCatContacts]>();
  const makeCanvas = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const c = makeCanvas(); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Generated cat art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  };
  const bake = ({ source, meta, scale, contentSize }: SourceFrame) => {
    const map = (point: Point): Point => Object.freeze({ x: GENERATED_CAT_FOOT.x + (point.x - meta.foot.x) * scale,
      y: GENERATED_CAT_FOOT.y + (point.y - meta.foot.y) * scale });
    const origin = map(ZERO), art = canvas(WIDTH * D, HEIGHT * D);
    art.ctx.drawImage(source, 0, 0, contentSize[0], contentSize[1], origin.x * D, origin.y * D,
      contentSize[0] * scale * D, contentSize[1] * scale * D);
    const logical = canvas(WIDTH, HEIGHT);
    logical.ctx.drawImage(art.canvas, 0, 0, WIDTH, HEIGHT);
    registerFineSpriteArt(logical.canvas, art.canvas, D);
    const points = Object.freeze({ foot: GENERATED_CAT_FOOT, headContact: map(meta.headContact) });
    const mirrored = Object.freeze({ foot: GENERATED_CAT_FOOT,
      headContact: Object.freeze({ x: WIDTH - points.headContact.x, y: points.headContact.y }) });
    return { canvas: logical.canvas, contacts: [points, mirrored] as const };
  };
  // Catalog order makes public IDs stable even if manifests arrive out of order.
  for (const breed of GENERATED_CAT_BREEDS) {
    const pack = packs.get(breed);
    if (!pack || duplicates.has(breed)) continue;
    const fail = (error: Omit<GeneratedCatError, 'breed'>) => { errors.push({ breed, ...error }); };
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      fail({ code: 'invalid-scale', message: 'The shared scale multiplier must be finite and greater than zero.' });
      continue;
    }
    if (!Array.isArray(pack.frames) || pack.frames.length !== GENERATED_CAT_STATES.length) {
      fail({ code: 'invalid-manifest', message: `A complete ${breed} pack requires exactly fourteen distinct states.` });
      continue;
    }
    const entries = new Map<GeneratedCatState, SourceFrame>();
    const sheetScales = new Map<GeneratedCatSheet, number>();
    const errorCount = errors.length;
    for (const meta of pack.frames as readonly GeneratedCatFrameMeta[]) {
      const frameId = `${breed}-${meta?.state}` as GeneratedCatFrameId;
      if (!meta || !GENERATED_CAT_STATES.includes(meta.state) || entries.has(meta.state) ||
        typeof meta.source !== 'string' || !meta.source.trim() || (breed === 'siamese' && SIAMESE_SHEET[meta.state] !== meta.source)) {
        fail({ code: 'invalid-frame', frameId, message: `Invalid or repeated state/source in ${frameId}.` });
        continue;
      }
      const source = sources[frameId];
      if (!source) {
        fail({ code: 'missing-source', frameId, message: `Missing source image ${frameId}.` });
        continue;
      }
      const size = sourceSize(source), b = meta.bbox, scale = meta.sourceToWorldScale * multiplier;
      const contentSize = meta.productionContentSize === undefined ? meta.size : meta.productionContentSize;
      if (!Array.isArray(contentSize) || contentSize.length !== 2 || ![contentSize[0], contentSize[1]].every(Number.isFinite) ||
        contentSize[0] <= 0 || contentSize[1] <= 0 || contentSize[0] > size.x || contentSize[1] > size.y ||
        size.x - contentSize[0] >= 1 || size.y - contentSize[1] >= 1) {
        fail({ code: 'invalid-content-size', frameId,
          message: `Invalid content extent in ${frameId}; only subpixel trailing production padding may be excluded.` });
        continue;
      }
      if (!b || !Array.isArray(meta.size) || ![size.x, size.y, b.x, b.y, b.w, b.h, scale].every(Number.isFinite) ||
        size.x <= 0 || size.y <= 0 || scale <= 0 || meta.size.length !== 2 || meta.size[0] !== size.x || meta.size[1] !== size.y ||
        b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 || b.x + b.w > contentSize[0] || b.y + b.h > contentSize[1] ||
        !within(meta.foot, b) || !within(meta.headContact, b) || meta.headContact.y >= meta.foot.y) {
        fail({ code: 'invalid-metadata', frameId, message: `Invalid image size, silhouette, contacts or calibration in ${frameId}.` });
        continue;
      }
      const prior = sheetScales.get(meta.source);
      if (prior !== undefined && Math.abs(prior - scale) > 1e-10) {
        fail({ code: 'inconsistent-sheet-scale', frameId, message: `Every ${breed} frame from ${meta.source} must share one scale.` });
      }
      sheetScales.set(meta.source, scale);
      // Keep the original alpha fringe. Inverse-map only the fractional extent
      // authored by the exporter, excluding its new ceil-rounded trailing padding.
      const left = GENERATED_CAT_FOOT.x - meta.foot.x * scale, top = GENERATED_CAT_FOOT.y - meta.foot.y * scale;
      const right = left + contentSize[0] * scale, bottom = top + contentSize[1] * scale;
      if (left < -1e-9 || top < -1e-9 || right > WIDTH + 1e-9 || bottom > HEIGHT + 1e-9) {
        fail({ code: 'envelope-overflow', frameId, bounds: Object.freeze({ left, top, right, bottom }),
          message: `${frameId} exceeds the 24×18 envelope around foot (12,17); adapt the shared envelope and offsets before using this pack.` });
      }
      entries.set(meta.state, { source, meta, scale, contentSize });
    }
    if (errors.length !== errorCount || entries.size !== GENERATED_CAT_STATES.length) continue;
    try {
      const baked = new Map(GENERATED_CAT_STATES.map(state => [state, bake(entries.get(state)!)]));
      const frame = (state: GeneratedCatState) => baked.get(state)!.canvas;
      const result: GeneratedCatResult = { generated: true, frames: { idle: frame('idle'), swish: frame('swish'), blink: frame('blink'), happy: frame('happy'),
        walk: [frame('walkA'), frame('walkB')], sleep: frame('sleep'), groom: [frame('groomA'), frame('groomB')],
        stretch: frame('stretch'), watch: frame('watch'), lookUp: frame('lookUp'), nuzzle: [frame('nuzzleA'), frame('nuzzleB')] } };
      // Publish the entire pack together. Failed packs expose neither contacts nor releasable IDs.
      for (const value of baked.values()) contacts.set(value.canvas, value.contacts);
      results.set(breed, result);
      scalesByBreed[breed] = Object.freeze(Object.fromEntries(sheetScales));
      sourceFrameIds.push(...generatedCatFrameIds(breed));
    } catch {
      fail({ code: 'bake-failed', message: `Canvas allocation or drawing failed for ${breed}; the whole breed remains fallback.` });
    }
  }
  return {
    ready: results.size > 0,
    readyBreeds: Object.freeze([...results.keys()]),
    sourceFrameIds: Object.freeze(sourceFrameIds),
    scales: scalesByBreed.siamese ?? null,
    scalesByBreed: Object.freeze(scalesByBreed),
    errors: Object.freeze(errors.map(error => Object.freeze(error))),
    resolve(breed, fallback) { return results.get(breed) ?? { frames: fallback, generated: false }; },
    drawOffset(frame) { return contacts.has(frame) ? OFFSET : ZERO; },
    contactPoints(frame, flipX = false) { return contacts.get(frame)?.[flipX ? 1 : 0] ?? null; },
  };
}
