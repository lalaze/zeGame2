import { CUSTOMER_CAST, type CustomerDesign } from '../game/customer-cast';
import type { Look } from '../game/state';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import type { CharacterFrames, Role } from './sprites';

/** The archived density-4 pack covers the original 30 guests only. New guests use cozy-cast-v8. */
export const LEGACY_GENERATED_CUSTOMER_CAST = Object.freeze(CUSTOMER_CAST.slice(0, 30));
const WALK_DIRECTIONS = ['down', 'up', 'right'] as const;
const WALK_STATES = ['stand', 'stepA', 'stepB'] as const;
const SEAT_DIRECTIONS = ['right', 'left'] as const;
const SEAT_STATES = ['sit', 'sitPetA', 'sitPetB'] as const;
type CustomerPose = `${typeof WALK_DIRECTIONS[number]}-${typeof WALK_STATES[number]}` |
  `${typeof SEAT_DIRECTIONS[number]}-${typeof SEAT_STATES[number]}`;
type NonMinaCustomerId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
  16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29;
export type GeneratedCustomerFrameId = `${'mina' | `customer-${NonMinaCustomerId}`}-${CustomerPose}`;
const POSES: readonly CustomerPose[] = Object.freeze([
  ...WALK_DIRECTIONS.flatMap(direction => WALK_STATES.map(state => `${direction}-${state}` as const)),
  ...SEAT_DIRECTIONS.flatMap(direction => SEAT_STATES.map(state => `${direction}-${state}` as const)),
]);
const NO_FRAME_IDS: readonly GeneratedCustomerFrameId[] = Object.freeze([]);
const FRAME_IDS = Object.freeze(LEGACY_GENERATED_CUSTOMER_CAST.map(design => Object.freeze(POSES.map(pose =>
  `${design.id === 0 ? 'mina' : `customer-${design.id}`}-${pose}` as GeneratedCustomerFrameId))));
/** Stable source IDs: original Mina IDs for cast 0, candidate filenames for cast 1–29. */
export const GENERATED_CUSTOMER_FRAME_IDS: readonly GeneratedCustomerFrameId[] = Object.freeze(FRAME_IDS.flat());
export function generatedCustomerFrameIds(appearanceId: number): readonly GeneratedCustomerFrameId[] {
  return Number.isInteger(appearanceId) ? FRAME_IDS[appearanceId] ?? NO_FRAME_IDS : NO_FRAME_IDS;
}
/** Invalid cast IDs or direction/action combinations have no source mapping. */
export function generatedCustomerFrameId(appearanceId: number, direction: GeneratedCustomerFrameMeta['direction'],
  state: GeneratedCustomerFrameMeta['state']): GeneratedCustomerFrameId | null {
  const index = POSES.indexOf(`${direction}-${state}` as CustomerPose);
  return generatedCustomerFrameIds(appearanceId)[index] ?? null;
}
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
  /** Shared sheet calibration; never normalize individual pose heights. */
  readonly sourceToWorldScale: number;
}
export interface GeneratedCustomerManifest {
  readonly identity: string;
  readonly appearanceId: number;
  readonly look: Readonly<Look>;
  /** Mina's original manifest predates this field. Other cast packs require it. */
  readonly hairstyle?: number;
  readonly outfit: CustomerDesign['outfit'];
  readonly accessory: CustomerDesign['accessory'];
  readonly accent: string;
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
export interface GeneratedCustomerScales { readonly walking: number; readonly seated: number }
export interface GeneratedCustomerAdapter {
  /** At least one complete identity is ready; other identities may still fall back. */
  readonly ready: boolean;
  readonly readyAppearanceIds: readonly number[];
  /** Only successfully baked packs may release their original source images. */
  readonly sourceFrameIds: readonly GeneratedCustomerFrameId[];
  /** Compatibility view for the first ready identity; use scalesFor for a cast. */
  readonly scales: GeneratedCustomerScales | null;
  scalesFor(appearanceId: number): GeneratedCustomerScales | null;
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
const WALK_FOOT = Object.freeze({ x: 9, y: 27 });
function cast(appearanceId: number | undefined): CustomerDesign | undefined {
  return appearanceId !== undefined && Number.isInteger(appearanceId) ? LEGACY_GENERATED_CUSTOMER_CAST[appearanceId] : undefined;
}
const sameLook = (look: Readonly<Look>, design: CustomerDesign): boolean =>
  LOOK_KEYS.every(key => look[key] === design.look[key]);
export function generatedCustomerEligible(identity: GeneratedCustomerIdentity): boolean {
  const design = cast(identity.appearanceId);
  return identity.role === 'customer' && !!design && sameLook(identity.look, design);
}

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
interface BakedIdentity {
  readonly result: GeneratedCustomerResult;
  readonly scales: GeneratedCustomerScales;
}
interface ContactMaps {
  readonly offsets: WeakMap<HTMLCanvasElement, Point>;
  readonly contacts: WeakMap<HTMLCanvasElement, GeneratedCustomerContacts>;
}

/** Bake one identity atomically. Input images and metadata are not retained. */
function bakeIdentity(manifest: GeneratedCustomerManifest, sources: GeneratedCustomerSources,
  options: GeneratedCustomerOptions, maps: ContactMaps): BakedIdentity | null {
  const design = cast(manifest.appearanceId);
  if (!design) return null;
  const frameIds = generatedCustomerFrameIds(design.id);
  const expectedIdentity = design.id === 0 ? 'customer-cast-0-Mina' : `customer-cast-${design.id}-${design.name}`;
  let valid = manifest.identity === expectedIdentity && sameLook(manifest.look, design) &&
    manifest.outfit === design.outfit && manifest.accessory === design.accessory && manifest.accent === design.accent &&
    (manifest.hairstyle === design.hairstyle || (design.id === 0 && manifest.hairstyle === undefined)) &&
    manifest.frames.length === POSES.length;
  const entries = new Map<GeneratedCustomerFrameId, SourceFrame>();
  let walkLimit = Infinity, seatCalibration: number | undefined;
  for (const meta of manifest.frames) {
    const id = generatedCustomerFrameId(design.id, meta.direction, meta.state);
    const source = id && sources[id];
    if (!id || entries.has(id) || !source) { valid = false; continue; }
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
    // Any supplied contact must be meaningful; do not propagate NaN optional metadata.
    if ((meta.seatContact && !within(meta.seatContact, b)) || (meta.petContact && !within(meta.petContact, b))) valid = false;
    entries.set(id, { meta, source });
  }
  const walkScale = options.walkingScale ?? walkLimit;
  const referenceScale = entries.get(generatedCustomerFrameId(design.id, 'down', 'stand')!)?.meta.sourceToWorldScale;
  const seatScale = options.seatedScale ?? walkScale * (seatCalibration ?? NaN) / (referenceScale ?? NaN);
  valid &&= entries.size === POSES.length && Number.isFinite(walkScale) && walkScale > 0 && walkScale <= walkLimit &&
    Number.isFinite(seatScale) && seatScale > 0;

  const placement = (meta: GeneratedCustomerFrameMeta) => {
    const walk = meta.group === 'walk', pet = !walk && meta.state !== 'sit';
    const offset = pet ? PET_OFFSET : ZERO;
    return { width: pet ? 22 : 18, height: walk ? 28 : pet ? 34 : 29, offset,
      scale: walk ? walkScale : seatScale, sourceAnchor: walk ? meta.foot : meta.seatContact!,
      target: walk ? WALK_FOOT : { x: (meta.direction === 'right' ? 7 : 11) - offset.x, y: 22 } };
  };
  if (valid) for (const { meta } of entries.values()) {
    const p = placement(meta), b = meta.bbox;
    const x = p.target.x + (b.x - p.sourceAnchor.x) * p.scale;
    const y = p.target.y + (b.y - p.sourceAnchor.y) * p.scale;
    if (x < -1e-9 || y < -1e-9 || x + b.w * p.scale > p.width + 1e-9 || y + b.h * p.scale > p.height + 1e-9) valid = false;
  }

  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const c = make(); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Generated customer art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  };
  const pendingContacts: Array<readonly [HTMLCanvasElement, Point, GeneratedCustomerContacts]> = [];
  const logical = (backing: HTMLCanvasElement, width: number, height: number, offset: Point, points: GeneratedCustomerContacts) => {
    const c = canvas(width, height);
    c.ctx.drawImage(backing, 0, 0, width, height);
    registerFineSpriteArt(c.canvas, backing, D);
    pendingContacts.push([c.canvas, offset, Object.freeze(points)]);
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
      const frames = new Map(frameIds.map(id => [id, bake(entries.get(id)!)]));
      const frame = (direction: GeneratedCustomerFrameMeta['direction'], state: GeneratedCustomerFrameMeta['state']) =>
        frames.get(generatedCustomerFrameId(design.id, direction, state)!)!;
      const direction = (facing: typeof WALK_DIRECTIONS[number]) => WALK_STATES.map(state => frame(facing, state));
      const down = direction('down'), up = direction('up'), right = direction('right');
      const left = right.map(source => {
        const art = canvas(18 * D, 28 * D);
        art.ctx.translate(18 * D, 0); art.ctx.scale(-1, 1); art.ctx.drawImage(fineSpriteArt(source).canvas, 0, 0);
        return logical(art.canvas, 18, 28, ZERO, { foot: WALK_FOOT });
      });
      // CharacterFrames has legacy mutable array types; the generated cache itself is immutable.
      for (const facing of [down, up, right, left]) Object.freeze(facing);
      result = Object.freeze({ generated: true, frames: Object.freeze({ down, up, right, left, stand: down[0],
        sitRight: frame('right', 'sit'), sitLeft: frame('left', 'sit'),
        sitPetRight: Object.freeze([frame('right', 'sitPetA'), frame('right', 'sitPetB')] as const),
        sitPetLeft: Object.freeze([frame('left', 'sitPetA'), frame('left', 'sitPetB')] as const) }) });
    } catch {
      result = null; // No partial identity replacement when any bitmap fails.
    }
  }
  entries.clear();
  if (result) for (const [frame, offset, points] of pendingContacts) {
    maps.offsets.set(frame, offset); maps.contacts.set(frame, points);
  }
  return result ? Object.freeze({ result, scales: Object.freeze({ walking: walkScale, seated: seatScale }) }) : null;
}

/**
 * Construct once after loading. Each fixed cast member is replaced only by its
 * own complete 15-pose pack and exact saved Look. Unknown/custom looks fall back.
 * One failed or duplicate identity never borrows another customer's poses.
 *
 * Walking uses a fixed (9,27) foot. Seated hips stay at (7,22) right / (11,22)
 * left, relative to legacy seat top-left. Pet frames use a 22×34 envelope with a
 * -2 draw offset. Sheet-wide calibration preserves pose proportions, including
 * authored lean/reach variation. Candidate anchors still require in-game QA.
 *
 * The immutable result cache is bounded by CUSTOMER_CAST (30 identities, 18
 * logical/backing pairs each). resolve allocates no canvases and retains no
 * fallback sets. Only completed bitmaps and contacts survive construction.
 */
export function createGeneratedCustomerArt(manifest: GeneratedCustomerManifest | readonly GeneratedCustomerManifest[],
  sources: GeneratedCustomerSources, options: GeneratedCustomerOptions = {}): GeneratedCustomerAdapter {
  const manifests: readonly GeneratedCustomerManifest[] = Array.isArray(manifest) ? manifest : [manifest as GeneratedCustomerManifest];
  const maps: ContactMaps = { offsets: new WeakMap(), contacts: new WeakMap() };
  const baked = new Map<number, BakedIdentity>();
  // Iterate the fixed roster rather than growing a map from untrusted input IDs.
  for (const design of LEGACY_GENERATED_CUSTOMER_CAST) {
    const candidates = manifests.filter(candidate => candidate.appearanceId === design.id);
    if (candidates.length !== 1) continue;
    try {
      const identity = bakeIdentity(candidates[0], sources, options, maps);
      if (identity) baked.set(design.id, identity);
    } catch {
      // A malformed pack cannot prevent unrelated complete identities loading.
    }
  }
  const readyAppearanceIds = Object.freeze([...baked.keys()]);
  const sourceFrameIds = Object.freeze(readyAppearanceIds.flatMap(id => generatedCustomerFrameIds(id)));
  return Object.freeze({
    ready: baked.size > 0, readyAppearanceIds, sourceFrameIds,
    scales: baked.values().next().value?.scales ?? null,
    scalesFor(appearanceId: number) { return baked.get(appearanceId)?.scales ?? null; },
    resolve(identity: GeneratedCustomerIdentity, fallback: CharacterFrames) {
      return generatedCustomerEligible(identity) && baked.get(identity.appearanceId!)?.result || { frames: fallback, generated: false };
    },
    drawOffset(frame: HTMLCanvasElement) { return maps.offsets.get(frame) ?? ZERO; },
    contactPoints(frame: HTMLCanvasElement) { return maps.contacts.get(frame) ?? null; },
  });
}
