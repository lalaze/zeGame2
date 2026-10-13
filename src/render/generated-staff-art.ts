import type { Look } from '../game/state';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import type { CharacterFrames, Facing, Role } from './sprites';

export const GENERATED_STAFF_DIRECTIONS = ['down', 'up', 'right'] as const;
export const GENERATED_STAFF_STATES = ['stand', 'stepA', 'stepB'] as const;
export type GeneratedStaffDirection = typeof GENERATED_STAFF_DIRECTIONS[number];
export type GeneratedStaffState = typeof GENERATED_STAFF_STATES[number];
export type GeneratedStaffFrameId = `barista-${GeneratedStaffDirection}-${GeneratedStaffState}`;
export const GENERATED_STAFF_FRAME_IDS: readonly GeneratedStaffFrameId[] =
  GENERATED_STAFF_DIRECTIONS.flatMap(direction => GENERATED_STAFF_STATES.map(state => `barista-${direction}-${state}` as const));
export const GENERATED_STAFF_FOOT = Object.freeze({ x: 9, y: 27 });
export const GENERATED_STAFF_DENSITY = 4;

export interface GeneratedStaffFrameMeta {
  readonly direction: GeneratedStaffDirection;
  /** stepB is the passing-knee gait pose, not a drink handoff. */
  readonly state: GeneratedStaffState;
  /** Bounds and foot are in the independent PNG, never in the original sheet. */
  readonly bbox: Readonly<{ x: number; y: number; w: number; h: number }>;
  readonly foot: Readonly<{ x: number; y: number }>;
}
export interface GeneratedStaffManifest {
  readonly identity: string;
  readonly frames: readonly GeneratedStaffFrameMeta[];
}
export type GeneratedStaffSources = Readonly<Partial<Record<GeneratedStaffFrameId, CanvasImageSource>>>;
export interface GeneratedStaffIdentity {
  readonly role: Role;
  readonly look: Look;
  /** Explicit opt-in for the all-zero base barista; never the randomized staff. */
  readonly baseBarista?: boolean;
}
export interface GeneratedStaffResult {
  readonly frames: CharacterFrames;
  readonly generated: boolean;
}
export interface GeneratedStaffAdapter {
  readonly ready: boolean;
  /** One scale for all nine source poses, preserving their relative proportions. */
  readonly sourceScale: number | null;
  resolve(identity: GeneratedStaffIdentity, fallback: CharacterFrames): GeneratedStaffResult;
}
export interface GeneratedStaffOptions {
  /** Omit to fit the complete set once. An unsafe/clipping scale rejects the set. */
  readonly sourceScale?: number;
  readonly createCanvas?: () => HTMLCanvasElement;
}

const W = 18, H = 28, D = GENERATED_STAFF_DENSITY;
const LOOK_KEYS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const;

export function generatedStaffEligible(identity: GeneratedStaffIdentity): boolean {
  return (identity.role === 'owner' || (identity.role === 'barista' && identity.baseBarista === true)) &&
    LOOK_KEYS.every(key => identity.look[key] === 0);
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { width: value.naturalWidth ?? value.videoWidth ?? value.displayWidth ?? value.width ?? 0,
    height: value.naturalHeight ?? value.videoHeight ?? value.displayHeight ?? value.height ?? 0 };
}

interface FrameSource { readonly meta: GeneratedStaffFrameMeta; readonly source: CanvasImageSource }
type WalkingFrames = Record<Facing, HTMLCanvasElement[]>;

/**
 * Construct once after loading. No Phaser/loader/global asset registry dependency.
 * A missing/invalid frame rejects the whole set; recreate after assets finish
 * loading rather than mixing generated and legacy walking identities.
 * Only standing/walking art is replaced. Seated/petting fields deliberately stay
 * legacy: owners/baristas never sit, and customers are never eligible here.
 */
export function createGeneratedStaffArt(manifest: GeneratedStaffManifest, sources: GeneratedStaffSources,
  options: GeneratedStaffOptions = {}): GeneratedStaffAdapter {
  const entries = new Map<GeneratedStaffFrameId, FrameSource>();
  let scaleLimit = Infinity;
  let valid = manifest.identity === 'barista-default' && manifest.frames.length === GENERATED_STAFF_FRAME_IDS.length;
  for (const meta of manifest.frames) {
    const id = `barista-${meta.direction}-${meta.state}` as GeneratedStaffFrameId;
    const source = sources[id];
    if (!GENERATED_STAFF_FRAME_IDS.includes(id) || entries.has(id) || !source) { valid = false; continue; }
    const { width, height } = sourceSize(source);
    const { x, y, w, h } = meta.bbox;
    const { x: fx, y: fy } = meta.foot;
    if (![width, height, x, y, w, h, fx, fy].every(Number.isFinite) || width <= 0 || height <= 0 ||
      x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height ||
      fx < x || fx > x + w || fy <= y || fy > y + h) { valid = false; continue; }
    // One logical pixel of head/side breathing room; foot remains (9,27).
    const extents = [[fx - x, 8], [x + w - fx, 8], [fy - y, 26], [y + h - fy, 1]];
    for (const [sourceExtent, room] of extents) if (sourceExtent > 0) scaleLimit = Math.min(scaleLimit, room / sourceExtent);
    entries.set(id, { meta, source });
  }
  valid &&= entries.size === GENERATED_STAFF_FRAME_IDS.length;
  const scale = options.sourceScale ?? scaleLimit;
  valid &&= Number.isFinite(scale) && scale > 0 && scale <= scaleLimit;
  const makeCanvas = options.createCanvas ?? (() => document.createElement('canvas'));
  let walking: WalkingFrames | null = null;

  const canvas = (width: number, height: number) => {
    const result = makeCanvas(); result.width = width; result.height = height;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated staff art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const logicalFrame = (backing: HTMLCanvasElement) => {
    const logical = canvas(W, H);
    logical.ctx.drawImage(backing, 0, 0, W, H);
    registerFineSpriteArt(logical.canvas, backing, D);
    return logical.canvas;
  };
  const bake = ({ meta, source }: FrameSource) => {
    const { x, y, w, h } = meta.bbox;
    const art = canvas(W * D, H * D);
    art.ctx.drawImage(source, x, y, w, h,
      (GENERATED_STAFF_FOOT.x + (x - meta.foot.x) * scale) * D,
      (GENERATED_STAFF_FOOT.y + (y - meta.foot.y) * scale) * D, w * scale * D, h * scale * D);
    return logicalFrame(art.canvas);
  };
  if (valid) {
    try {
      const direction = (facing: GeneratedStaffDirection) => GENERATED_STAFF_STATES.map(state => bake(entries.get(`barista-${facing}-${state}`)!));
      const down = direction('down'), up = direction('up'), right = direction('right');
      const left = right.map(frame => {
        const art = canvas(W * D, H * D);
        art.ctx.translate(W * D, 0); art.ctx.scale(-1, 1);
        art.ctx.drawImage(fineSpriteArt(frame).canvas, 0, 0);
        return logicalFrame(art.canvas);
      });
      walking = { down, up, right, left };
    } catch {
      // Loading/canvas failures must never remove a working legacy character.
      walking = null;
    }
  }

  // The completed canvases own their pixels. Do not let the constructor's
  // shared closure context retain the original decoded source images.
  if (walking) entries.clear();

  // At most two assembled fallback variants; all reuse the same twelve bitmaps.
  // Replacing profiles or passing many fallback identities cannot grow this map.
  const resolved = new Map<CharacterFrames, GeneratedStaffResult>();
  return {
    ready: walking !== null,
    sourceScale: walking ? scale : null,
    resolve(identity, fallback) {
      if (!walking || !generatedStaffEligible(identity)) return { frames: fallback, generated: false };
      const cached = resolved.get(fallback);
      if (cached) { resolved.delete(fallback); resolved.set(fallback, cached); return cached; }
      const result = { frames: { ...fallback, ...walking, stand: walking.down[0] }, generated: true };
      resolved.set(fallback, result);
      if (resolved.size > 2) resolved.delete(resolved.keys().next().value!);
      return result;
    },
  };
}
