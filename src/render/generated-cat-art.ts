import type { CatId } from '../game/pets';
import { registerFineSpriteArt } from './fine-sprite-art';
import type { CatFrames } from './sprites';

export const GENERATED_CAT_STATES = ['idle', 'swish', 'blink', 'happy', 'walkA', 'walkB', 'sleep',
  'groomA', 'groomB', 'stretch', 'watch', 'lookUp', 'nuzzleA', 'nuzzleB'] as const;
export type GeneratedCatState = typeof GENERATED_CAT_STATES[number];
export type GeneratedCatFrameId = `siamese-${GeneratedCatState}`;
export const GENERATED_CAT_FRAME_IDS: readonly GeneratedCatFrameId[] = GENERATED_CAT_STATES.map(state => `siamese-${state}` as const);
export const GENERATED_CAT_DENSITY = 4;
export const GENERATED_CAT_FOOT = Object.freeze({ x: 12, y: 17 });
export const GENERATED_CAT_SHEETS = ['core-source.png', 'behaviors-source.png', 'interaction-source.png', 'nuzzle-raised-source.png'] as const;
export type GeneratedCatSheet = typeof GENERATED_CAT_SHEETS[number];
type Point = Readonly<{ x: number; y: number }>;
export interface GeneratedCatFrameMeta {
  readonly state: GeneratedCatState;
  readonly source: GeneratedCatSheet;
  /** Complete independent PNG dimensions, including the original alpha fringe. */
  readonly size: readonly number[];
  /** Opaque silhouette QA bounds. Rendering preserves the entire PNG instead. */
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
export interface GeneratedCatAdapter {
  readonly ready: boolean;
  readonly scales: Readonly<Record<GeneratedCatSheet, number>> | null;
  resolve(breed: CatId, fallback: CatFrames): GeneratedCatResult;
  /** Add to x=painted.x-9, y=painted.y-frame.height+2. Unknown frames return zero. */
  drawOffset(frame: HTMLCanvasElement): Point;
  /** Canvas-local contacts after the optional Scene flip; no second mirror needed. */
  contactPoints(frame: HTMLCanvasElement, flipX?: boolean): GeneratedCatContacts | null;
}
export interface GeneratedCatOptions {
  /** One multiplier for all sheet calibrations. Unsafe/clipping values reject the set. */
  readonly scale?: number;
  readonly createCanvas?: () => HTMLCanvasElement;
}

const WIDTH = 24, HEIGHT = 18, D = GENERATED_CAT_DENSITY;
const ZERO = Object.freeze({ x: 0, y: 0 });
const OFFSET = Object.freeze({ x: -3, y: 0 });
const SHEET: Record<GeneratedCatState, GeneratedCatSheet> = {
  idle: 'core-source.png', lookUp: 'core-source.png', walkA: 'core-source.png', walkB: 'core-source.png',
  swish: 'behaviors-source.png', blink: 'behaviors-source.png', happy: 'behaviors-source.png', sleep: 'behaviors-source.png',
  groomA: 'behaviors-source.png', groomB: 'behaviors-source.png', stretch: 'interaction-source.png', watch: 'interaction-source.png',
  nuzzleA: 'nuzzle-raised-source.png', nuzzleB: 'nuzzle-raised-source.png',
};
interface SourceFrame { readonly source: CanvasImageSource; readonly meta: GeneratedCatFrameMeta; readonly scale: number }
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
 * One atomic Siamese identity, including every behavior and raised interaction.
 * All poses share a symmetric 24×18 envelope and ground (12,17). Its -3 x offset
 * retains the legacy logical x=9/world foot at painted+(0,1), including flipX.
 * Walking remains authored head-left: retain residentCatFlipX(walking,facing).
 * Sheet scales preserve head/body proportions; never fit each pose to a height.
 */
export function createGeneratedCatArt(manifest: GeneratedCatManifest, sources: GeneratedCatSources,
  options: GeneratedCatOptions = {}): GeneratedCatAdapter {
  const entries = new Map<GeneratedCatFrameId, SourceFrame>();
  const sheetScales = new Map<GeneratedCatSheet, number>();
  const multiplier = options.scale ?? 1;
  let valid = manifest.breed === 'siamese' && manifest.frames.length === GENERATED_CAT_FRAME_IDS.length &&
    Number.isFinite(multiplier) && multiplier > 0;
  for (const meta of manifest.frames) {
    const id = `siamese-${meta.state}` as GeneratedCatFrameId, source = sources[id];
    if (!GENERATED_CAT_FRAME_IDS.includes(id) || entries.has(id) || !source || SHEET[meta.state] !== meta.source) { valid = false; continue; }
    const size = sourceSize(source), b = meta.bbox, scale = meta.sourceToWorldScale * multiplier;
    if (![size.x, size.y, b.x, b.y, b.w, b.h, scale].every(Number.isFinite) || size.x <= 0 || size.y <= 0 || scale <= 0 ||
      meta.size.length !== 2 || meta.size[0] !== size.x || meta.size[1] !== size.y || b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 ||
      b.x + b.w > size.x || b.y + b.h > size.y || !within(meta.foot, b) || !within(meta.headContact, b) ||
      meta.headContact.y >= meta.foot.y) { valid = false; continue; }
    const prior = sheetScales.get(meta.source);
    if (prior !== undefined && prior !== scale) valid = false;
    sheetScales.set(meta.source, scale);
    // Include every source pixel, even low-alpha edges outside the QA bbox.
    const left = GENERATED_CAT_FOOT.x - meta.foot.x * scale, top = GENERATED_CAT_FOOT.y - meta.foot.y * scale;
    if (left < 0 || top < 0 || left + size.x * scale > WIDTH || top + size.y * scale > HEIGHT) valid = false;
    entries.set(id, { source, meta, scale });
  }
  valid &&= entries.size === GENERATED_CAT_FRAME_IDS.length && sheetScales.size === GENERATED_CAT_SHEETS.length;
  const makeCanvas = options.createCanvas ?? (() => document.createElement('canvas'));
  const contacts = new WeakMap<HTMLCanvasElement, readonly [GeneratedCatContacts, GeneratedCatContacts]>();
  const canvas = (width: number, height: number) => {
    const c = makeCanvas(); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Generated cat art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  };
  const bake = ({ source, meta, scale }: SourceFrame) => {
    const map = (point: Point): Point => Object.freeze({ x: GENERATED_CAT_FOOT.x + (point.x - meta.foot.x) * scale,
      y: GENERATED_CAT_FOOT.y + (point.y - meta.foot.y) * scale });
    const origin = map(ZERO), art = canvas(WIDTH * D, HEIGHT * D);
    art.ctx.drawImage(source, 0, 0, meta.size[0], meta.size[1], origin.x * D, origin.y * D,
      meta.size[0] * scale * D, meta.size[1] * scale * D);
    const logical = canvas(WIDTH, HEIGHT);
    logical.ctx.drawImage(art.canvas, 0, 0, WIDTH, HEIGHT);
    registerFineSpriteArt(logical.canvas, art.canvas, D);
    const points = Object.freeze({ foot: GENERATED_CAT_FOOT, headContact: map(meta.headContact) });
    const mirrored = Object.freeze({ foot: GENERATED_CAT_FOOT,
      headContact: Object.freeze({ x: WIDTH - points.headContact.x, y: points.headContact.y }) });
    contacts.set(logical.canvas, [points, mirrored]);
    return logical.canvas;
  };
  let result: GeneratedCatResult | null = null;
  if (valid) {
    try {
      const frames = new Map(GENERATED_CAT_STATES.map(state => [state, bake(entries.get(`siamese-${state}`)!)]));
      const frame = (state: GeneratedCatState) => frames.get(state)!;
      result = { generated: true, frames: { idle: frame('idle'), swish: frame('swish'), blink: frame('blink'), happy: frame('happy'),
        walk: [frame('walkA'), frame('walkB')], sleep: frame('sleep'), groom: [frame('groomA'), frame('groomB')],
        stretch: frame('stretch'), watch: frame('watch'), lookUp: frame('lookUp'), nuzzle: [frame('nuzzleA'), frame('nuzzleB')] } };
    } catch {
      result = null; // A drawing failure must not leave a partly replaced breed.
    }
  }
  // Final canvases own their pixels. Successful adapters retain no source entries;
  // the caller may then release the loaded source registry/texture pack safely.
  if (result) entries.clear();
  const scales = result ? Object.freeze(Object.fromEntries(sheetScales) as Record<GeneratedCatSheet, number>) : null;
  return {
    ready: !!result, scales,
    resolve(breed, fallback) { return result && breed === 'siamese' ? result : { frames: fallback, generated: false }; },
    drawOffset(frame) { return result && contacts.has(frame) ? OFFSET : ZERO; },
    contactPoints(frame, flipX = false) { return result ? contacts.get(frame)?.[flipX ? 1 : 0] ?? null : null; },
  };
}
