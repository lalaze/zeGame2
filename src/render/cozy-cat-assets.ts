import { CATS, type CatId } from '../game/pets';
import { registerFineSpriteArt } from './fine-sprite-art';
import { GENERATED_CAT_STATES, type GeneratedCatAdapter, type GeneratedCatContacts, type GeneratedCatState } from './generated-cat-art';
import type { CatFrames } from './sprites';

type Point = Readonly<{ x: number; y: number }>;
type Box = readonly [number, number, number, number];
export interface CozyCatFrame {
  readonly state: GeneratedCatState;
  readonly box: Box;
  readonly silhouette: Box;
  readonly foot: Point;
  readonly headContact: Point;
}
export interface CozyCatBreed {
  readonly breed: CatId;
  readonly file: string;
  readonly size: readonly [number, number];
  readonly scale: number;
  readonly frames: readonly CozyCatFrame[];
}
export interface CozyCatManifest {
  readonly version: number;
  readonly density: number;
  readonly width: number;
  readonly height: number;
  readonly foot: Point;
  readonly breeds: readonly CozyCatBreed[];
}

export const COZY_CAT_BASE = 'art/generated/cozy-cats-v2/';
const ZERO = Object.freeze({ x: 0, y: 0 });
let adapter: GeneratedCatAdapter | null = null;
let pending: Promise<void> | null = null;
let epoch = 0;

/** Reject incomplete identities before publishing any new family to the scene or UI. */
export function validateCozyCatManifest(manifest: CozyCatManifest): void {
  if (manifest.version !== 2 || manifest.density !== 4 || manifest.width !== 24 || manifest.height !== 18 ||
      manifest.foot?.x !== 12 || manifest.foot?.y !== 17 || manifest.breeds?.length !== CATS.length)
    throw Error('Invalid cozy cat atlas family');
  const ids = new Set<CatId>();
  for (const breed of manifest.breeds) {
    if (!CATS.some(cat => cat.id === breed.breed) || ids.has(breed.breed) || breed.file !== breed.breed + '.png' ||
        breed.size?.length !== 2 || breed.size.some(n => !Number.isFinite(n) || n <= 0) ||
        !Number.isFinite(breed.scale) || breed.scale <= 0 || breed.frames?.length !== GENERATED_CAT_STATES.length)
      throw Error('Invalid cozy cat breed');
    ids.add(breed.breed);
    const states = new Set<GeneratedCatState>();
    for (const frame of breed.frames) {
      if (!GENERATED_CAT_STATES.includes(frame.state) || states.has(frame.state) || frame.box?.length !== 4 ||
          frame.box.some(n => !Number.isFinite(n)) || frame.box[0] < 0 || frame.box[1] < 0 ||
          frame.box[2] > breed.size[0] || frame.box[3] > breed.size[1] || frame.box[2] <= frame.box[0] || frame.box[3] <= frame.box[1])
        throw Error('Invalid cozy cat crop');
      states.add(frame.state);
      for (const point of [frame.foot, frame.headContact]) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
            point.x < frame.box[0] || point.x > frame.box[2] || point.y < frame.box[1] || point.y > frame.box[3])
          throw Error('Invalid cozy cat contact');
      }
      const left = 12 + (frame.box[0] - frame.foot.x) * breed.scale;
      const right = 12 + (frame.box[2] - frame.foot.x) * breed.scale;
      const top = 17 + (frame.box[1] - frame.foot.y) * breed.scale;
      const bottom = 17 + (frame.box[3] - frame.foot.y) * breed.scale;
      if (left < 0 || top < 0 || right > 24 || bottom > 18) throw Error('Cozy cat crop exceeds shared envelope');
    }
  }
}

/** Complete newly drawn poses; no recoloring, pose-height fitting or bitmap distortion. */
export function bakeCozyCatArt(manifest: CozyCatManifest, sources: ReadonlyMap<CatId, CanvasImageSource>,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): GeneratedCatAdapter {
  validateCozyCatManifest(manifest);
  const packs = new Map<CatId, CatFrames>();
  const contacts = new WeakMap<HTMLCanvasElement, readonly [GeneratedCatContacts, GeneratedCatContacts]>();
  const density = manifest.density;
  const canvas = (w: number, h: number) => { const c = makeCanvas(); c.width = w; c.height = h; return c; };
  for (const breed of manifest.breeds) {
    const source = sources.get(breed.breed);
    if (!source) throw Error('Missing cozy cat atlas: ' + breed.breed);
    const frames = new Map<GeneratedCatState, HTMLCanvasElement>();
    for (const pose of breed.frames) {
      const [left, top, right, bottom] = pose.box;
      const transform = (p: Point): Point => Object.freeze({
        x: manifest.foot.x + (p.x - pose.foot.x) * breed.scale,
        y: manifest.foot.y + (p.y - pose.foot.y) * breed.scale,
      });
      const at = transform({ x: left, y: top });
      const backing = canvas(manifest.width * density, manifest.height * density), ctx = backing.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, left, top, right - left, bottom - top, at.x * density, at.y * density,
        (right - left) * breed.scale * density, (bottom - top) * breed.scale * density);
      const frame = canvas(manifest.width, manifest.height), logical = frame.getContext('2d')!;
      logical.imageSmoothingEnabled = false;
      logical.drawImage(backing, 0, 0, manifest.width, manifest.height);
      registerFineSpriteArt(frame, backing, density);
      const headContact = transform(pose.headContact);
      contacts.set(frame, [Object.freeze({ foot: manifest.foot, headContact }), Object.freeze({ foot: manifest.foot,
        headContact: Object.freeze({ x: manifest.width - headContact.x, y: headContact.y }) })]);
      frames.set(pose.state, frame);
    }
    const get = (state: GeneratedCatState) => frames.get(state)!;
    packs.set(breed.breed, { idle: get('idle'), swish: get('swish'), blink: get('blink'), happy: get('happy'),
      walk: [get('walkA'), get('walkB')], sleep: get('sleep'), groom: [get('groomA'), get('groomB')],
      stretch: get('stretch'), watch: get('watch'), lookUp: get('lookUp'), nuzzle: [get('nuzzleA'), get('nuzzleB')] });
  }
  const readyBreeds = Object.freeze(CATS.map(cat => cat.id));
  const offset = Object.freeze({ x: -3, y: 0 });
  return Object.freeze({
    ready: true, readyBreeds, sourceFrameIds: Object.freeze([]), scales: null, scalesByBreed: Object.freeze({}), errors: Object.freeze([]),
    resolve(breed: CatId, fallback: CatFrames) { const frames = packs.get(breed); return frames ? { frames, generated: true } : { frames: fallback, generated: false }; },
    drawOffset(frame: HTMLCanvasElement) { return contacts.has(frame) ? offset : ZERO; },
    contactPoints(frame: HTMLCanvasElement, flipX = false) { return contacts.get(frame)?.[flipX ? 1 : 0] ?? null; },
  });
}

export function clearCozyCats(): void { epoch++; adapter = null; pending = null; }
export function cozyCatsReady(): boolean { return adapter?.ready === true; }
export function createCozyCatArt(): GeneratedCatAdapter {
  if (!adapter) throw Error('Cozy cat artwork must finish loading before scene creation');
  return adapter;
}
export function preloadCozyCats(): Promise<void> {
  if (adapter) return Promise.resolve();
  if (pending) return pending;
  const generation = epoch, base = import.meta.env.BASE_URL + COZY_CAT_BASE;
  pending = (async () => {
    const response = await fetch(base + 'manifest.json');
    if (!response.ok) throw Error('Missing cozy cat manifest');
    const manifest: CozyCatManifest = await response.json(); validateCozyCatManifest(manifest);
    const entries = await Promise.all(manifest.breeds.map(async breed => {
      const image = new Image(); image.src = base + breed.file; await image.decode();
      if (image.naturalWidth !== breed.size[0] || image.naturalHeight !== breed.size[1]) throw Error('Cozy cat atlas dimensions changed');
      return [breed.breed, image] as const;
    }));
    // Late loads after a reset cannot replace the next scene's adapter.
    if (epoch === generation) adapter = bakeCozyCatArt(manifest, new Map(entries));
  })().catch(error => { if (epoch === generation) pending = null; throw error; });
  return pending;
}
