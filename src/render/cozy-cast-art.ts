import palette from '../../docs/art-grid/palette.json';
import type { Look } from '../game/state';
import { CUSTOMER_CAST } from '../game/customer-cast';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';

type Point = { x: number; y: number };
type PoseMeta = { box: number[]; top: number; neck: number[]; foot: number[]; hip: number[]; hand: number[] };
type Pose = PoseMeta & { source: HTMLCanvasElement };
type Sheet = { id: number; file: string; scale: number; frames: PoseMeta[] };
type Manifest = { version: number; density: number; width: number; height: number; characters: Sheet[] };
type Contacts = { foot: Point; head: Point; headHeight: number; headScale: number; bodyScale: number; legExtension: number; carryContact: Point; seatContact?: Point; petContact?: Point };
export const CAST_ART_DENSITY = 2;
export const CAST_STANDING_SIZE = Object.freeze({ width: 40, height: 44, footX: 20, footY: 42 });
const W = CAST_STANDING_SIZE.width * CAST_ART_DENSITY, H = CAST_STANDING_SIZE.height * CAST_ART_DENSITY;
const figures = new Map<number, Pose[]>();
const diningFigures = new Map<number, Pose[]>();
let pending: Promise<void> | null = null, epoch = 0;
const ramps = new Map<string, string[]>();
for (const color of palette.colors) { const ramp = ramps.get(color.ramp) ?? []; ramp.push(color.hex); ramps.set(color.ramp, ramp); }
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const mod = (value: number, length: number) => ((Math.trunc(value) % length) + length) % length;
function canvas(width: number, height: number) { const result = document.createElement('canvas'); result.width = width; result.height = height; return result; }

export function validateCastManifest(manifest: Manifest): void {
  if (manifest.version !== 6 || manifest.density !== CAST_ART_DENSITY || manifest.width !== W / 2 || manifest.height !== H / 2 ||
    manifest.characters?.length !== CUSTOMER_CAST.length || new Set(manifest.characters.map(sheet => sheet.id)).size !== CUSTOMER_CAST.length)
    throw Error('Incomplete whole-figure cast manifest');
  for (const sheet of manifest.characters) {
    if (!Number.isInteger(sheet.id) || !CUSTOMER_CAST[sheet.id] || !sheet.file || !Number.isFinite(sheet.scale) || sheet.scale <= 0 || sheet.frames?.length !== 12)
      throw Error('Invalid whole-figure cast identity');
    for (const [index, pose] of sheet.frames.entries()) {
      if (pose.box?.length !== 4 || pose.box.some(value => !Number.isInteger(value)) || pose.box[0] !== index * W || pose.box[1] !== 0 || pose.box[2] !== (index + 1) * W || pose.box[3] !== H ||
        !Number.isInteger(pose.top) || pose.top < 1 || pose.top >= H ||
        [pose.neck, pose.foot, pose.hip, pose.hand].some(point => !point || point.length !== 2 || point.some(value => !Number.isInteger(value)) || point[0] < 0 || point[0] > W || point[1] < 0 || point[1] > H))
        throw Error('Invalid whole-figure cast bounds or contacts');
    }
  }
}
export function clearBatchCharacters(): void { epoch++; figures.clear(); diningFigures.clear(); pending = null; }
export function batchCharactersReady(): boolean { return figures.size === CUSTOMER_CAST.length && diningFigures.size === CUSTOMER_CAST.length; }
export function preloadBatchCharacters(): Promise<void> {
  if (batchCharactersReady()) return Promise.resolve();
  if (pending) return pending;
  const generation = epoch;
  pending = (async () => {
    const base = import.meta.env.BASE_URL + 'art/generated/cozy-cast-v6/';
    const response = await fetch(base + 'manifest.json');
    if (!response.ok) throw Error('Missing whole-figure cast manifest');
    const manifest: Manifest = await response.json(); validateCastManifest(manifest);
    const decoded = await Promise.all(manifest.characters.map(async sheet => {
      const image = new Image(); image.src = base + sheet.file; await image.decode();
      if (image.naturalWidth !== W * 12 || image.naturalHeight !== H) throw Error('Invalid whole-figure cast atlas size');
      const poses = sheet.frames.map(pose => {
        const source = canvas(W, H);
        source.getContext('2d')!.drawImage(image, pose.box[0], 0, W, H, 0, 0, W, H);
        return { ...pose, source };
      });
      return [sheet.id, poses] as const;
    }));
    const diningBase=import.meta.env.BASE_URL+'art/generated/cozy-dining-v3/';
    const diningResponse=await fetch(diningBase+'manifest.json');
    if(!diningResponse.ok)throw Error('Missing matched dining cast');
    const dining=await diningResponse.json();
    if(dining.version!==3||dining.density!==2||!dining.embeddedChair||dining.characters.length!==CUSTOMER_CAST.length)throw Error('Incomplete matched dining cast');
    const seated=await Promise.all(dining.characters.map(async(sheet:Sheet)=>{
      if(sheet.frames.length!==3)throw Error('Missing matched dining pose');
      const image=new Image();image.src=diningBase+sheet.file;await image.decode();
      if(image.naturalWidth!==W*3||image.naturalHeight!==H)throw Error('Invalid matched dining atlas size');
      return [sheet.id,sheet.frames.map(pose=>{const source=canvas(W,H);source.getContext('2d')!.drawImage(image,pose.box[0],0,W,H,0,0,W,H);return{...pose,source};})] as const;
    }));
    if (generation === epoch) {
      decoded.forEach(([id, poses]) => figures.set(id, poses));
      seated.forEach(([id, poses])=>diningFigures.set(id,poses));
    }
  })().catch(error => { if (generation === epoch) pending = null; throw error; });
  return pending;
}

/** Saved cast looks use the authored paint. Custom callers retain palette substitution. */
function paintPose(pose: Pose, look: Look, original: Readonly<Look>): HTMLCanvasElement {
  const target = canvas(W, H), ctx = target.getContext('2d')!;
  ctx.drawImage(pose.source, 0, 0);
  const channels = [['skin', 'skin-', 4], ['hair', 'hair-option-', 6], ['shirt', 'cloth-', 8], ['pants', 'pants-', 3]] as const;
  const replacements = new Map<string, number[]>();
  for (const [key, prefix, count] of channels) {
    if (look[key] === original[key]) continue;
    ramps.get(prefix + original[key])!.forEach((color, shade) => replacements.set(rgb(color).join(','), rgb(ramps.get(prefix + mod(look[key], count))![shade])));
  }
  if (replacements.size) {
    const pixels = ctx.getImageData(0, 0, W, H);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (!pixels.data[index + 3]) continue;
      const color = replacements.get(Array.from(pixels.data.subarray(index, index + 3)).join(','));
      if (color) pixels.data.set(color, index);
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return target;
}
function publish(art: HTMLCanvasElement): HTMLCanvasElement {
  const frame = canvas(W / 2, H / 2), ctx = frame.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 0, 0, frame.width, frame.height); registerFineSpriteArt(frame, art, CAST_ART_DENSITY); return frame;
}
function mirror(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = canvas(W, H), ctx = target.getContext('2d')!;
  ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0); return target;
}
export function makeBatchCharacter(look: Look, role: Role, appearanceId: number | undefined, setContacts: (frame: HTMLCanvasElement, contacts: Contacts) => void): CharacterFrames | null {
  if (!batchCharactersReady() || role !== 'customer') return null;
  const design = CUSTOMER_CAST[mod(appearanceId ?? 0, CUSTOMER_CAST.length)], poses = figures.get(design.id)!;
  const make = (index: number, mirrored = false): HTMLCanvasElement => {
    const seated = index >= 9, pose = seated ? diningFigures.get(design.id)![index-9] : poses[index];
    // Neck landmarks describe the intact painting; they never position a head.
    const art = paintPose(pose, look, design.look);
    const frame = publish(mirrored ? mirror(art) : art);
    const point = (value: number[]): Point => ({ x: (mirrored ? W - value[0] : value[0]) / 2, y: value[1] / 2 });
    const foot = point(pose.foot), hip = point(pose.hip), hand = point(pose.hand);
    setContacts(frame, { foot, head: { x: point(pose.neck).x, y: pose.top / 2 }, headHeight: (pose.neck[1] - pose.top) / 2,
      headScale: 1, bodyScale: 1, legExtension: 0, carryContact: hand, ...(seated ? { seatContact: hip } : {}), ...(index >= 10 ? { petContact: hand } : {}) });
    if (seated) {
      const foreground = canvas(W, H), fg = foreground.getContext('2d')!, pixels = art.getContext('2d')!.getImageData(0, 0, W, H);
      // Resting palms extend below the nominal wrist landmark. Keep the
      // complete forearm down to the lap, stopping before the knees/shins.
      // Petting retains its separate reaching-hand/actor depth contract.
      const armBottom = index === 9 ? pose.hip[1] : pose.hand[1] + 2;
      for (let row = 0; row < H; row++) for (let column = 0; column < W; column++) {
        if (row > pose.neck[1] + 1 && (column < pose.neck[0] + 1 || row > armBottom)) pixels.data[(row * W + column) * 4 + 3] = 0;
      }
      fg.putImageData(pixels, 0, 0);
      registerSeatingUnit(frame, { foreground: publish(mirrored ? mirror(foreground) : foreground), floor: foot, hip, embeddedChair: true, ...(index >= 10 ? { petContact: hand } : {}) });
    }
    return frame;
  };
  const down = [0, 1, 2].map(index => make(index)), up = [3, 4, 5].map(index => make(index)), right = [6, 7, 8].map(index => make(index)), left = [6, 7, 8].map(index => make(index, true));
  return { down, up, right, left, stand: down[0], sitRight: make(9), sitLeft: make(9, true), sitPetRight: [make(10), make(11)], sitPetLeft: [make(10, true), make(11, true)] };
}
