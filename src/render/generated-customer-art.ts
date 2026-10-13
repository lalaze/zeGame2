import { CUSTOMER_CAST } from '../game/customer-cast';
import type { Look } from '../game/state';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import type { CharacterFrames, Role } from './sprites';

const WALK_DIRECTIONS = ['down', 'up', 'right'] as const;
const WALK_STATES = ['stand', 'stepA', 'stepB'] as const;
const SEAT_DIRECTIONS = ['right', 'left'] as const;
const SEAT_STATES = ['sit', 'sitPetA', 'sitPetB'] as const;
export type GeneratedCustomerFrameId = `mina-${typeof WALK_DIRECTIONS[number]}-${typeof WALK_STATES[number]}` |
  `mina-${typeof SEAT_DIRECTIONS[number]}-${typeof SEAT_STATES[number]}`;
export const GENERATED_CUSTOMER_FRAME_IDS: readonly GeneratedCustomerFrameId[] = [
  ...WALK_DIRECTIONS.flatMap(direction => WALK_STATES.map(state => `mina-${direction}-${state}` as const)),
  ...SEAT_DIRECTIONS.flatMap(direction => SEAT_STATES.map(state => `mina-${direction}-${state}` as const)),
];
export const GENERATED_CUSTOMER_DENSITY = 4;
type Point = Readonly<{ x: number; y: number }>;
export interface GeneratedCustomerFrameMeta {
  readonly direction: 'down' | 'up' | 'right' | 'left';
  readonly state: 'stand' | 'stepA' | 'stepB' | 'sit' | 'sitPetA' | 'sitPetB';
  readonly group: 'walk' | 'seated';
  /** All coordinates refer to the independent PNG, not its source sheet. */
  readonly bbox: Readonly<{ x: number; y: number; w: number; h: number }>;
  readonly foot: Point;
  readonly seatContact?: Point;
  readonly petContact?: Point;
  /** Authored sheet calibration. All six seated values must agree. */
  readonly sourceToWorldScale: number;
}
export interface GeneratedCustomerManifest {
  readonly identity: string;
  readonly appearanceId: number;
  readonly look: Readonly<Look>;
  readonly frames: readonly GeneratedCustomerFrameMeta[];
}
export type GeneratedCustomerSources = Readonly<Partial<Record<GeneratedCustomerFrameId, CanvasImageSource>>>;
export interface GeneratedCustomerIdentity {
  readonly role: Role;
  readonly appearanceId?: number;
  readonly look: Readonly<Look>;
}
export interface GeneratedCustomerContacts {
  /** Points in logical canvas coordinates; add drawOffset when placing them. */
  readonly foot: Point;
  readonly seatContact?: Point;
  readonly petContact?: Point;
}
export interface GeneratedCustomerResult { readonly frames: CharacterFrames; readonly generated: boolean }
export interface GeneratedCustomerAdapter {
  readonly ready: boolean;
  readonly scales: Readonly<{ walking: number; seated: number }> | null;
  resolve(identity: GeneratedCustomerIdentity, fallback: CharacterFrames): GeneratedCustomerResult;
  /** Add to the legacy top-left. Pet padding is visual only, not a new foot. */
  drawOffset(frame: HTMLCanvasElement): Point;
  contactPoints(frame: HTMLCanvasElement): GeneratedCustomerContacts | null;
}
export interface GeneratedCustomerOptions {
  readonly walkingScale?: number;
  /** Optional whole-sheet calibration override, never an individual pose fit. */
  readonly seatedScale?: number;
  readonly createCanvas?: () => HTMLCanvasElement;
}

const LOOK_KEYS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const;
const D = GENERATED_CUSTOMER_DENSITY;
const ZERO = Object.freeze({ x: 0, y: 0 });
const PET_OFFSET = Object.freeze({ x: -2, y: 0 });
const sameLook = (look: Readonly<Look>) => LOOK_KEYS.every(key => look[key] === CUSTOMER_CAST[0].look[key]);
export const generatedCustomerEligible = (identity: GeneratedCustomerIdentity): boolean =>
  identity.role === 'customer' && identity.appearanceId === 0 && sameLook(identity.look);

function sourceSize(source: CanvasImageSource): Point {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { x: value.naturalWidth ?? value.videoWidth ?? value.displayWidth ?? value.width ?? 0,
    y: value.naturalHeight ?? value.videoHeight ?? value.displayHeight ?? value.height ?? 0 };
}
function within(point: Point | undefined, bbox: GeneratedCustomerFrameMeta['bbox']): point is Point {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= bbox.x && point.x <= bbox.x + bbox.w &&
    point.y >= bbox.y && point.y <= bbox.y + bbox.h;
}
interface SourceFrame { readonly meta: GeneratedCustomerFrameMeta; readonly source: CanvasImageSource }

/**
 * Atomically replace only cast 0 with its complete generated identity. Walking
 * uses a fixed (9,27) foot; seated poses keep the legacy top-left s.y-33 and
 * register the hip at (7,22) facing right / (11,22) facing left. The idle canvas
 * extends to 29 high for the longer authored legs; 22×34 pet canvases have two
 * extra pixels on each side and drawOffset -2. Never shrink just a reaching pose.
 *
 * The two source sheets have different pixel densities. Their manifest's shared
 * seated calibration is scaled relative to down-stand's calibration, preserving
 * head size while the entire walking set is fit once. All six seated poses then
 * use exactly that same scale. Unsafe/clipping geometry falls back as a whole.
 */
export function createGeneratedCustomerArt(manifest: GeneratedCustomerManifest, sources: GeneratedCustomerSources,
  options: GeneratedCustomerOptions = {}): GeneratedCustomerAdapter {
  const entries = new Map<GeneratedCustomerFrameId, SourceFrame>();
  let valid = manifest.identity === 'customer-cast-0-Mina' && manifest.appearanceId === 0 && sameLook(manifest.look) &&
    manifest.frames.length === GENERATED_CUSTOMER_FRAME_IDS.length;
  let walkLimit = Infinity, seatCalibration: number | undefined;
  for (const meta of manifest.frames) {
    const id = `mina-${meta.direction}-${meta.state}` as GeneratedCustomerFrameId;
    const source = sources[id];
    if (!GENERATED_CUSTOMER_FRAME_IDS.includes(id) || entries.has(id) || !source) { valid = false; continue; }
    const size = sourceSize(source), b = meta.bbox;
    const walk = WALK_STATES.some(state => state === meta.state);
    if (![size.x, size.y, b.x, b.y, b.w, b.h, meta.sourceToWorldScale].every(Number.isFinite) || size.x <= 0 || size.y <= 0 ||
      b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 || b.x + b.w > size.x || b.y + b.h > size.y ||
      meta.sourceToWorldScale <= 0 || !within(meta.foot, b) || meta.group !== (walk ? 'walk' : 'seated')) { valid = false; continue; }
    if (walk) {
      if (meta.foot.y <= b.y) { valid = false; continue; }
      for (const [extent, room] of [[meta.foot.x - b.x, 8], [b.x + b.w - meta.foot.x, 8], [meta.foot.y - b.y, 26], [b.y + b.h - meta.foot.y, 1]]) {
        if (extent > 0) walkLimit = Math.min(walkLimit, room / extent);
      }
    } else {
      if (!within(meta.seatContact, b) || (meta.state !== 'sit' && !within(meta.petContact, b))) { valid = false; continue; }
      if (seatCalibration !== undefined && Math.abs(seatCalibration - meta.sourceToWorldScale) > 1e-10) valid = false;
      seatCalibration ??= meta.sourceToWorldScale;
    }
    entries.set(id, { meta, source });
  }
  const walkScale = options.walkingScale ?? walkLimit;
  const referenceScale = entries.get('mina-down-stand')?.meta.sourceToWorldScale;
  const seatScale = options.seatedScale ?? walkScale * (seatCalibration ?? NaN) / (referenceScale ?? NaN);
  valid &&= entries.size === GENERATED_CUSTOMER_FRAME_IDS.length && Number.isFinite(walkScale) && walkScale > 0 && walkScale <= walkLimit &&
    Number.isFinite(seatScale) && seatScale > 0;

  const placement = (meta: GeneratedCustomerFrameMeta) => {
    const walk = meta.group === 'walk', pet = !walk && meta.state !== 'sit';
    const offset = pet ? PET_OFFSET : ZERO;
    return { width: pet ? 22 : 18, height: walk ? 28 : pet ? 34 : 29, offset,
      scale: walk ? walkScale : seatScale, sourceAnchor: walk ? meta.foot : meta.seatContact!,
      target: walk ? { x: 9, y: 27 } : { x: (meta.direction === 'right' ? 7 : 11) - offset.x, y: 22 } };
  };
  if (valid) for (const { meta } of entries.values()) {
    const p = placement(meta), b = meta.bbox;
    const x = p.target.x + (b.x - p.sourceAnchor.x) * p.scale;
    const y = p.target.y + (b.y - p.sourceAnchor.y) * p.scale;
    if (x < -1e-9 || y < -1e-9 || x + b.w * p.scale > p.width + 1e-9 || y + b.h * p.scale > p.height + 1e-9) valid = false;
  }

  const offsets = new WeakMap<HTMLCanvasElement, Point>();
  const contacts = new WeakMap<HTMLCanvasElement, GeneratedCustomerContacts>();
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const c = make(); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Generated customer art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  };
  const logical = (backing: HTMLCanvasElement, width: number, height: number, offset: Point, points: GeneratedCustomerContacts) => {
    const c = canvas(width, height);
    c.ctx.drawImage(backing, 0, 0, width, height);
    registerFineSpriteArt(c.canvas, backing, D);
    offsets.set(c.canvas, offset); contacts.set(c.canvas, Object.freeze(points));
    return c.canvas;
  };
  const bake = ({ meta, source }: SourceFrame) => {
    const p = placement(meta), b = meta.bbox;
    const map = (point: Point): Point => Object.freeze({ x: p.target.x + (point.x - p.sourceAnchor.x) * p.scale,
      y: p.target.y + (point.y - p.sourceAnchor.y) * p.scale });
    const topLeft = map(b);
    const art = canvas(p.width * D, p.height * D);
    art.ctx.drawImage(source, b.x, b.y, b.w, b.h, topLeft.x * D, topLeft.y * D, b.w * p.scale * D, b.h * p.scale * D);
    return logical(art.canvas, p.width, p.height, p.offset, { foot: map(meta.foot),
      ...(meta.seatContact ? { seatContact: map(meta.seatContact) } : {}),
      ...(meta.petContact ? { petContact: map(meta.petContact) } : {}) });
  };
  let result: GeneratedCustomerResult | null = null;
  if (valid) {
    try {
      const frames = new Map(GENERATED_CUSTOMER_FRAME_IDS.map(id => [id, bake(entries.get(id)!)]));
      const frame = (id: GeneratedCustomerFrameId) => frames.get(id)!;
      const direction = (facing: typeof WALK_DIRECTIONS[number]) => WALK_STATES.map(state => frame(`mina-${facing}-${state}`));
      const down = direction('down'), up = direction('up'), right = direction('right');
      const left = right.map(source => {
        const art = canvas(18 * D, 28 * D);
        art.ctx.translate(18 * D, 0); art.ctx.scale(-1, 1); art.ctx.drawImage(fineSpriteArt(source).canvas, 0, 0);
        return logical(art.canvas, 18, 28, ZERO, { foot: Object.freeze({ x: 9, y: 27 }) });
      });
      result = { generated: true, frames: { down, up, right, left, stand: down[0],
        sitRight: frame('mina-right-sit'), sitLeft: frame('mina-left-sit'),
        sitPetRight: [frame('mina-right-sitPetA'), frame('mina-right-sitPetB')],
        sitPetLeft: [frame('mina-left-sitPetA'), frame('mina-left-sitPetB')] } };
    } catch {
      result = null; // No partial identity replacement when any bitmap fails.
    }
  }
  // The completed canvases own their pixels; the returned closures must not
  // retain the original full-resolution image entries after a successful bake.
  if (result) entries.clear();

  // Exactly one complete result and eighteen logical/backing pairs per adapter.
  // resolve never allocates another canvas or retains arbitrary fallback frames.
  return {
    ready: !!result,
    scales: result ? Object.freeze({ walking: walkScale, seated: seatScale }) : null,
    resolve(identity, fallback) { return result && generatedCustomerEligible(identity) ? result : { frames: fallback, generated: false }; },
    drawOffset(frame) { return result ? offsets.get(frame) ?? ZERO : ZERO; },
    contactPoints(frame) { return result ? contacts.get(frame) ?? null : null; },
  };
}
