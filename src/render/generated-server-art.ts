import type { Look } from '../game/state';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import type { CharacterFrames, Facing, Role } from './sprites';

export const GENERATED_SERVER_DIRECTIONS = ['down', 'up', 'right'] as const;
export const GENERATED_SERVER_STATES = ['stand', 'stepA', 'stepB'] as const;
export type GeneratedServerDirection = typeof GENERATED_SERVER_DIRECTIONS[number];
export type GeneratedServerState = typeof GENERATED_SERVER_STATES[number];
export type GeneratedServerFrameId = `server-${GeneratedServerDirection}-${GeneratedServerState}`;
export const GENERATED_SERVER_FRAME_IDS: readonly GeneratedServerFrameId[] = Object.freeze(
  GENERATED_SERVER_DIRECTIONS.flatMap(direction => GENERATED_SERVER_STATES.map(state => `server-${direction}-${state}` as const)));
export const GENERATED_SERVER_FOOT = Object.freeze({ x: 9, y: 27 });
export const GENERATED_SERVER_DENSITY = 4;

export interface GeneratedServerFrameMeta {
  readonly direction: GeneratedServerDirection;
  /** stepB is the passing gait pose; acknowledgement and handoff remain live layers. */
  readonly state: GeneratedServerState;
  /** Coordinates refer to the independent PNG, after any common production scale. */
  readonly size: readonly number[];
  readonly bbox: Readonly<{ x: number; y: number; w: number; h: number }>;
  readonly foot: Readonly<{ x: number; y: number }>;
  readonly sourceToWorldScale: number;
  /** Original full RGBA extent, excluding only subpixel trailing exporter padding. */
  readonly productionContentSize?: readonly number[];
}
export interface GeneratedServerManifest {
  readonly identity: string;
  readonly role: string;
  readonly look: Readonly<Look>;
  readonly exactLookOnly: boolean;
  readonly frames: readonly GeneratedServerFrameMeta[];
}
export type GeneratedServerSources = Readonly<Partial<Record<GeneratedServerFrameId, CanvasImageSource>>>;
export interface GeneratedServerIdentity { readonly role: Role; readonly look: Readonly<Look> }
export interface GeneratedServerResult { readonly frames: CharacterFrames; readonly generated: boolean }
export interface GeneratedServerAdapter {
  readonly ready: boolean;
  /** Only a successfully baked, complete pack may release its decoded sources. */
  readonly sourceFrameIds: readonly GeneratedServerFrameId[];
  /** One isotropic scale for the entire nine-pose family. */
  readonly sourceScale: number | null;
  resolve(identity: GeneratedServerIdentity, fallback: CharacterFrames): GeneratedServerResult;
}
export interface GeneratedServerOptions {
  /** Omit to fit the complete family once. Any scale that clips a pose is rejected. */
  readonly sourceScale?: number;
  readonly createCanvas?: () => HTMLCanvasElement;
}

const W = 18, H = 28, D = GENERATED_SERVER_DENSITY;
const LOOK_KEYS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const;
const NO_FRAME_IDS: readonly GeneratedServerFrameId[] = Object.freeze([]);
const zeroLook = (look: Readonly<Look> | undefined): boolean => !!look && LOOK_KEYS.every(key => look[key] === 0);

/** No owner/barista remapping, random staff substitution, or partial Look matching. */
export function generatedServerEligible(identity: GeneratedServerIdentity): boolean {
  return identity.role === 'server' && zeroLook(identity.look);
}

function sourceSize(source: CanvasImageSource): readonly [number, number] {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return [value.naturalWidth ?? value.videoWidth ?? value.displayWidth ?? value.width ?? 0,
    value.naturalHeight ?? value.videoHeight ?? value.displayHeight ?? value.height ?? 0];
}
interface FrameSource {
  readonly meta: GeneratedServerFrameMeta;
  readonly source: CanvasImageSource;
  readonly contentSize: readonly number[];
}
type WalkingFrames = Record<Facing, HTMLCanvasElement[]>;
interface BakedServer { readonly walking: WalkingFrames; readonly scale: number }

/** Separate bake scope prevents adapters from retaining source images or manifests. */
function bakeServer(manifest: GeneratedServerManifest, sources: GeneratedServerSources,
  options: GeneratedServerOptions): BakedServer | null {
  if (manifest?.identity !== 'canonical-server-all-zero-only' || manifest.role !== 'server' ||
    manifest.exactLookOnly !== true || !zeroLook(manifest.look) || !Array.isArray(manifest.frames) ||
    manifest.frames.length !== GENERATED_SERVER_FRAME_IDS.length) return null;
  const entries = new Map<GeneratedServerFrameId, FrameSource>();
  let scaleLimit = Infinity, calibration: number | undefined;
  for (const meta of manifest.frames as readonly GeneratedServerFrameMeta[]) {
    if (!meta) return null;
    const id = `server-${meta.direction}-${meta.state}` as GeneratedServerFrameId;
    const source = sources[id];
    if (!GENERATED_SERVER_FRAME_IDS.includes(id) || entries.has(id) || !source) return null;
    const [width, height] = sourceSize(source), b = meta.bbox, f = meta.foot;
    const content = meta.productionContentSize === undefined ? meta.size : meta.productionContentSize;
    if (!Array.isArray(meta.size) || meta.size.length !== 2 || meta.size[0] !== width || meta.size[1] !== height ||
      !Array.isArray(content) || content.length !== 2 || ![width, height, content[0], content[1]].every(Number.isFinite) ||
      width <= 0 || height <= 0 || content[0] <= 0 || content[1] <= 0 || content[0] > width || content[1] > height ||
      width - content[0] >= 1 || height - content[1] >= 1) return null;
    if (!b || !f || ![b.x, b.y, b.w, b.h, f.x, f.y, meta.sourceToWorldScale].every(Number.isFinite) ||
      b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 || b.x + b.w > content[0] || b.y + b.h > content[1] ||
      f.x < b.x || f.x > b.x + b.w || f.y <= b.y || f.y > b.y + b.h || meta.sourceToWorldScale <= 0 ||
      (calibration !== undefined && Math.abs(calibration - meta.sourceToWorldScale) > 1e-10)) return null;
    calibration ??= meta.sourceToWorldScale;
    // Body keeps one logical pixel of head/side breathing room. The complete
    // source alpha fringe also fits; measured opaque bounds never crop pixels.
    const extents = [[f.x - b.x, 8], [b.x + b.w - f.x, 8], [f.y - b.y, 26], [b.y + b.h - f.y, 1],
      [f.x, 9], [content[0] - f.x, 9], [f.y, 27], [content[1] - f.y, 1]];
    for (const [extent, room] of extents) if (extent > 0) scaleLimit = Math.min(scaleLimit, room / extent);
    entries.set(id, { meta, source, contentSize: content });
  }
  const scale = options.sourceScale ?? scaleLimit;
  if (entries.size !== GENERATED_SERVER_FRAME_IDS.length || !Number.isFinite(scale) || scale <= 0 || scale > scaleLimit) return null;
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const result = make(); result.width = width; result.height = height;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated server art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const logical = (backing: HTMLCanvasElement) => {
    const result = canvas(W, H);
    result.ctx.drawImage(backing, 0, 0, W, H);
    registerFineSpriteArt(result.canvas, backing, D);
    return result.canvas;
  };
  const bake = ({ meta, source, contentSize: [width, height] }: FrameSource) => {
    const art = canvas(W * D, H * D);
    art.ctx.drawImage(source, 0, 0, width, height,
      (GENERATED_SERVER_FOOT.x - meta.foot.x * scale) * D,
      (GENERATED_SERVER_FOOT.y - meta.foot.y * scale) * D, width * scale * D, height * scale * D);
    return logical(art.canvas);
  };
  try {
    const direction = (facing: GeneratedServerDirection) => GENERATED_SERVER_STATES.map(state => bake(entries.get(`server-${facing}-${state}`)!));
    const down = direction('down'), up = direction('up'), right = direction('right');
    const left = right.map(source => {
      const art = canvas(W * D, H * D);
      art.ctx.translate(W * D, 0); art.ctx.scale(-1, 1);
      art.ctx.drawImage(fineSpriteArt(source).canvas, 0, 0);
      return logical(art.canvas);
    });
    for (const frames of [down, up, right, left]) Object.freeze(frames);
    return { walking: Object.freeze({ down, up, right, left }), scale };
  } catch {
    return null; // Any allocation/drawing failure rejects the entire identity.
  }
}

/**
 * Exact all-zero server standing/walking only. Tray, live plates and service
 * acknowledgements stay separate. Legacy seated/petting fields are untouched;
 * this pack does not supply or claim seated server poses.
 */
export function createGeneratedServerArt(manifest: GeneratedServerManifest, sources: GeneratedServerSources,
  options: GeneratedServerOptions = {}): GeneratedServerAdapter {
  const baked = bakeServer(manifest, sources, options);
  // At most two fallback assemblies, sharing twelve immutable pose canvases.
  const resolved = new Map<CharacterFrames, GeneratedServerResult>();
  return Object.freeze({
    ready: baked !== null,
    sourceFrameIds: baked ? GENERATED_SERVER_FRAME_IDS : NO_FRAME_IDS,
    sourceScale: baked?.scale ?? null,
    resolve(identity: GeneratedServerIdentity, fallback: CharacterFrames): GeneratedServerResult {
      if (!baked || !generatedServerEligible(identity)) return { frames: fallback, generated: false };
      const cached = resolved.get(fallback);
      if (cached) { resolved.delete(fallback); resolved.set(fallback, cached); return cached; }
      const result = Object.freeze({ frames: Object.freeze({ ...fallback, ...baked.walking, stand: baked.walking.down[0] }), generated: true });
      resolved.set(fallback, result);
      if (resolved.size > 2) resolved.delete(resolved.keys().next().value!);
      return result;
    },
  });
}
