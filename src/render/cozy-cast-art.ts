import palette from '../../docs/art-grid/palette.json';
import type { Look } from '../game/state';
import { CUSTOMER_CAST } from '../game/customer-cast';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';

type Point = { x: number; y: number };
type PoseMeta = { box: [number, number, number, number]; neck: number[]; foot?: number[]; hip?: number[]; hand?: number[]; eyes?: number[][]; top?: number; band?: number[] };
type Pose = PoseMeta & { source: HTMLCanvasElement };
type Sheet = { file: string; poses: PoseMeta[] };
type Manifest = { version: number; density: number; families: Record<string, Sheet>; heads: Sheet; materials: Record<string, string[]> };
type Contacts = { foot: Point; head: Point; headHeight: number; headScale: number; bodyScale: number; legExtension: number; carryContact: Point; seatContact?: Point; petContact?: Point };
export const CAST_ART_DENSITY = 2;
export const CAST_STANDING_SIZE = Object.freeze({ width: 32, height: 44, footX: 16, footY: 42 });
const families = new Map<string, Pose[]>();
let heads: Pose[] = [], materials: Record<string, string[]> = {};
let pending: Promise<void> | null = null, epoch = 0;
const ramps = new Map<string, string[]>();
for (const color of palette.colors) { const ramp = ramps.get(color.ramp) ?? []; ramp.push(color.hex); ramps.set(color.ramp, ramp); }
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const mod = (value: number, length: number) => ((Math.trunc(value) % length) + length) % length;
function canvas(width: number, height: number) { const result = document.createElement('canvas'); result.width = width; result.height = height; return result; }

export function validateCastManifest(manifest: Manifest): void {
  if (manifest.version !== 5 || manifest.density !== 2 || Object.keys(manifest.families).length !== 12 || manifest.heads.poses.length !== 24)
    throw Error('Incomplete native cast manifest');
  for (const family of ['cardigan', 'stripe', 'overalls', 'scarf', 'jacket', 'vest', 'dress', 'hoodie', 'sailor', 'duffle', 'apron', 'sweater']) {
    if (manifest.families[family]?.poses.length !== 12) throw Error('Missing native cast poses');
  }
  for (const sheet of [...Object.values(manifest.families), manifest.heads]) {
    if (!sheet.file || sheet.poses.some(pose => pose.box.length !== 4 || pose.box.some(value => !Number.isInteger(value)) || pose.box[0] < 0 || pose.box[1] < 0 || pose.box[2] <= pose.box[0] || pose.box[3] <= pose.box[1] || pose.neck.length !== 2 || pose.neck.some(value => !Number.isFinite(value))))
      throw Error('Invalid native cast bounds');
  }
  for (const sheet of Object.values(manifest.families)) for (const pose of sheet.poses) {
    if (pose.box[2] - pose.box[0] !== 64 || pose.box[3] - pose.box[1] !== 88 || [pose.foot, pose.hip, pose.hand].some(point => !point || point.length !== 2 || point.some(value => !Number.isInteger(value)) || point[0] < 0 || point[0] > 64 || point[1] < 0 || point[1] > 88))
      throw Error('Invalid native cast contacts');
  }
  manifest.heads.poses.forEach((pose, index) => {
    if (pose.box[2] - pose.box[0] !== 48 || pose.box[3] - pose.box[1] !== 48 || pose.eyes?.length !== (index % 3 === 0 ? 2 : index % 3 === 1 ? 0 : 1) || pose.band?.length !== 3 || pose.band.some(value => !Number.isInteger(value))) throw Error('Invalid native cast face');
  });
  for (const name of ['skin-0', 'hair-option-0', 'cloth-1', 'pants-2']) if (manifest.materials[name]?.join(',') !== ramps.get(name)?.join(',')) throw Error('Invalid native cast materials');
}
export function clearBatchCharacters(): void { epoch++; families.clear(); heads = []; materials = {}; pending = null; }
export function batchCharactersReady(): boolean { return families.size === 12 && heads.length === 24; }
export function preloadBatchCharacters(): Promise<void> {
  if (batchCharactersReady()) return Promise.resolve();
  if (pending) return pending;
  const generation = epoch;
  pending = (async () => {
    const base = import.meta.env.BASE_URL + 'art/generated/cozy-cast-v5/';
    const response = await fetch(base + 'manifest.json');
    if (!response.ok) throw Error('Missing native cast manifest');
    const manifest: Manifest = await response.json(); validateCastManifest(manifest);
    const load = async (sheet: Sheet): Promise<Pose[]> => {
      const image = new Image(); image.src = base + sheet.file; await image.decode();
      return sheet.poses.map(pose => {
        const [left, top, right, bottom] = pose.box;
        if (right > image.naturalWidth || bottom > image.naturalHeight) throw Error('Native cast pose outside atlas');
        const source = canvas(right - left, bottom - top);
        source.getContext('2d')!.drawImage(image, left, top, source.width, source.height, 0, 0, source.width, source.height);
        return { ...pose, source };
      });
    };
    const result = await Promise.all(Object.entries(manifest.families).map(async ([name, sheet]) => [name, await load(sheet)] as const));
    const decodedHeads = await load(manifest.heads);
    if (generation === epoch) { result.forEach(([name, poses]) => families.set(name, poses)); heads = decodedHeads; materials = manifest.materials; }
  })().catch(error => { if (generation === epoch) pending = null; throw error; });
  return pending;
}
function recolour(pose: Pose, look: Look): HTMLCanvasElement {
  const target = canvas(pose.source.width, pose.source.height), ctx = target.getContext('2d')!;
  ctx.drawImage(pose.source, 0, 0);
  const pixels = ctx.getImageData(0, 0, target.width, target.height), replacements = new Map<string, number[]>();
  const selected = { 'skin-0': `skin-${mod(look.skin, 4)}`, 'hair-option-0': `hair-option-${mod(look.hair, 6)}`, 'cloth-1': `cloth-${mod(look.shirt, 8)}`, 'pants-2': `pants-${mod(look.pants, 3)}` };
  for (const [source, destination] of Object.entries(selected)) materials[source].forEach((color, shade) => replacements.set(rgb(color).join(','), rgb(ramps.get(destination)![shade])));
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (!pixels.data[index + 3]) continue;
    const color = replacements.get(Array.from(pixels.data.subarray(index, index + 3)).join(','));
    if (color) pixels.data.set(color, index);
  }
  ctx.putImageData(pixels, 0, 0); return target;
}
function publish(art: HTMLCanvasElement): HTMLCanvasElement {
  const frame = canvas(art.width / 2, art.height / 2), ctx = frame.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 0, 0, frame.width, frame.height); registerFineSpriteArt(frame, art, CAST_ART_DENSITY); return frame;
}
function mirror(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = canvas(source.width, source.height), ctx = target.getContext('2d')!;
  ctx.translate(target.width, 0); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0); return target;
}
export function makeBatchCharacter(look: Look, role: Role, appearanceId: number | undefined, setContacts: (frame: HTMLCanvasElement, contacts: Contacts) => void): CharacterFrames | null {
  if (!batchCharactersReady() || role !== 'customer') return null;
  const design = appearanceId === undefined ? undefined : CUSTOMER_CAST[mod(appearanceId, CUSTOMER_CAST.length)];
  const poses = families.get(design?.outfit ?? 'cardigan')!, style = mod(design?.hairstyle ?? look.hairStyle, 8);
  const make = (index: number, mirrored = false): HTMLCanvasElement => {
    const pose = poses[index], seated = index >= 9, back = index >= 3 && index < 6, profile = index >= 6;
    const art = canvas(64, 88), ctx = art.getContext('2d')!, person = canvas(64, 88), paint = person.getContext('2d')!;
    const head = heads[style * 3 + (back ? 1 : profile ? 2 : 0)], headX = pose.neck[0] - head.neck[0], headY = pose.neck[1] - head.neck[1];
    paint.drawImage(recolour(pose, look), 0, 0); paint.drawImage(recolour(head, look), headX, headY);
    const rect = (left: number, top: number, width: number, height: number, color: string) => { paint.fillStyle = color; paint.fillRect(Math.round(left), Math.round(top), width, height); };
    const accent = design ? palette.colors.reduce((best, color) => {
      const distance = (value: string) => rgb(value).reduce((sum, channel, channelIndex) => sum + (channel - rgb(design.accent)[channelIndex]) ** 2, 0);
      return distance(color.hex) < distance(best) ? color.hex : best;
    }, palette.colors[0].hex) : '#f3bd6a';
    if (design?.accessory === 'glasses' && !back) {
      for (const eye of head.eyes ?? []) {
        const left = headX + eye[0] - 2, top = headY + eye[1] - 1;
        rect(left, top, 6, 1, '#85664f'); rect(left, top + 5, 6, 1, '#85664f');
        rect(left, top + 1, 1, 4, '#85664f'); rect(left + 5, top + 1, 1, 4, '#85664f');
      }
      if (!profile && head.eyes?.length === 2) rect(headX + head.eyes[0][0] + 4, headY + head.eyes[0][1] + 1, Math.max(1, head.eyes[1][0] - head.eyes[0][0] - 6), 1, '#85664f');
    }
    const band = head.band!;
    if (design?.accessory === 'bow') { const left = headX + band[0], top = headY + band[1]; rect(left - 2, top - 1, 4, 4, accent); rect(left + 3, top - 1, 4, 4, accent); rect(left + 2, top, 2, 2, '#55301f'); }
    if (design?.accessory === 'headband') rect(headX + band[0], headY + band[1], band[2], 2, accent);
    if (design?.accessory === 'satchel') {
      for (let step = 0; step < 17; step++) rect(pose.neck[0] - 6 + Math.floor(step / 2), pose.neck[1] + step, 2, 1, accent);
      rect(pose.neck[0] + 1, pose.neck[1] + 13, 9, 7, '#55301f'); rect(pose.neck[0] + 2, pose.neck[1] + 14, 7, 4, accent);
    }
    ctx.drawImage(person, 0, 0);
    const foreground = canvas(64, 88), fg = foreground.getContext('2d')!;
    if (seated) {
      const pixels = paint.getImageData(0, 0, 64, 88);
      for (let row = 0; row < 88; row++) for (let column = 0; column < 64; column++) {
        if (row > pose.neck[1] + 3 && (column < pose.neck[0] + 4 || row > pose.hand![1] + 3)) pixels.data[(row * 64 + column) * 4 + 3] = 0;
      }
      fg.putImageData(pixels, 0, 0);
    }
    const frame = publish(mirrored ? mirror(art) : art);
    const point = (value: number[]): Point => ({ x: (mirrored ? 64 - value[0] : value[0]) / 2, y: value[1] / 2 });
    const foot = point(pose.foot!), hip = point(pose.hip!), hand = point(pose.hand!);
    const top = Math.max(0, headY + (head.top ?? 0)) / 2;
    setContacts(frame, { foot, head: { x: point(pose.neck).x, y: top }, headHeight: pose.neck[1] / 2 - top, headScale: 1, bodyScale: 1, legExtension: 0, carryContact: hand, ...(seated ? { seatContact: hip } : {}), ...(index >= 10 ? { petContact: hand } : {}) });
    if (seated) registerSeatingUnit(frame, { foreground: publish(mirrored ? mirror(foreground) : foreground), floor: foot, hip, embeddedChair: false, ...(index >= 10 ? { petContact: hand } : {}) });
    return frame;
  };
  const down = [0, 1, 2].map(index => make(index)), up = [3, 4, 5].map(index => make(index)), right = [6, 7, 8].map(index => make(index)), left = [6, 7, 8].map(index => make(index, true));
  return { down, up, right, left, stand: down[0], sitRight: make(9), sitLeft: make(9, true), sitPetRight: [make(10), make(11)], sitPetLeft: [make(10, true), make(11, true)] };
}
