import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';
import { WORLD_ART_DENSITY } from './world-art-grid';
import { hexRgb, paintTeamPose, segmentTeamPose, shadeRamp, voteTeamPose, type GridPose, type PoseImage, type TeamColours } from './team-pixel-art';

type Point = { x: number; y: number };
type Box = [number, number, number, number];
type PoseAnchors = { hip?: Point; hand?: Point; neck?: Point; floor?: Point };
type Sheet = { file: string; bounds: Box[]; anchors?: PoseAnchors[] };
export type TeamManifest = { families: Sheet[]; chef: Sheet; seated: Sheet[]; chefSeated: Sheet };
type Pose = PoseImage;
export type TeamContacts = { foot: Point; head: Point; headHeight: number; headScale: number; bodyScale: number;
  legExtension: number; carryContact?: Point; seatContact?: Point; petContact?: Point };
export const TEAM_HAIRSTYLES = ['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves'] as const;
export const TEAM_STANDING_SIZE = Object.freeze({ width: 32, height: 44, footX: 16, footY: 42, figureHeight: 40 });
const D = WORLD_ART_DENSITY;
let gridCache = new WeakMap<Pose, Map<string, GridPose>>();
const SKIN = ['#f4cfad', '#dfaa7d', '#b67c55', '#80533f'];
const HAIR = ['#594237', '#976546', '#dfb96f', '#b9674e', '#626782', '#cc8c9f'];
const CLOTH = ['#bb6b58', '#799ba7', '#8ba477', '#d3a453', '#9b87af', '#cf929e', '#69a295', '#e5d7ba'];
const PANTS = ['#53637b', '#85664f', '#585464'];
let families: Pose[][] = [], seated: Pose[][] = [], chef: Pose[] = [], chefSeated: Pose[] = [];
let pending: Promise<void> | null = null, epoch = 0;
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Poses are read back (alpha cleanup, top edge, seated cut, mirroring), so every
// canvas here is CPU-backed from its first context: attributes cannot change later.
const context = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
const mod = (n: number, length: number) => ((Math.trunc(n) % length) + length) % length;

export function validateTeamManifest(m: TeamManifest): void {
  if (m.families?.length !== 8 || m.families.some(s => s.bounds?.length !== 9) || m.chef?.bounds?.length !== 9 ||
      m.seated?.length !== 2 || m.seated.some(s => s.bounds?.length !== 12) || m.chefSeated?.bounds?.length !== 3)
    throw Error('Incomplete cozy team poses');
  for (const sheet of [...m.families, m.chef, ...m.seated, m.chefSeated]) {
    if (!sheet.file || sheet.bounds.some(b => b.length !== 4 || b.some(v => !Number.isFinite(v)) || b[0] < 0 || b[1] < 0 || b[2] <= b[0] || b[3] <= b[1]))
      throw Error('Invalid cozy team bounds');
  }
}
export function cozyTeamReady(): boolean { return families.length === 8 && seated.length === 8 && chef.length === 9 && chefSeated.length === 3; }
export function clearCozyTeam(): void { epoch++; families = []; seated = []; chef = []; chefSeated = []; pending = null; gridCache = new WeakMap(); }
export function preloadCozyTeam(): Promise<void> {
  if (cozyTeamReady()) return Promise.resolve();
  if (pending) return pending;
  const generation = epoch, base = import.meta.env.BASE_URL + 'art/generated/cozy-team-v7/';
  pending = (async () => {
    const response = await fetch(base + 'manifest.json');
    if (!response.ok) throw Error('Missing cozy team manifest');
    const manifest: TeamManifest = await response.json(); validateTeamManifest(manifest);
    const images = new Map<string, Promise<HTMLImageElement>>();
    const load = (file: string) => { let old = images.get(file); if (!old) { old = (async () => { const image = new Image(); image.src = base + file; await image.decode(); return image; })(); images.set(file, old); } return old; };
    const decode = async (sheet: Sheet): Promise<Pose[]> => {
      const image = await load(sheet.file);
      return sheet.bounds.map(([x, y, right, bottom], index) => {
        if (right > image.naturalWidth || bottom > image.naturalHeight) throw Error('Cozy team pose outside atlas');
        const source = canvas(right - x, bottom - y), ctx = context(source);
        ctx.drawImage(image, x, y, source.width, source.height, 0, 0, source.width, source.height);
        const pixels = ctx.getImageData(0, 0, source.width, source.height);
        for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 100) pixels.data[i] = 0;
        ctx.putImageData(pixels, 0, 0);
        return { data: pixels.data, width: source.width, height: source.height, anchors: sheet.anchors?.[index] ?? {} };
      });
    };
    const [walks, seats, cookWalk, cookSeats] = await Promise.all([
      Promise.all(manifest.families.map(decode)), Promise.all(manifest.seated.map(decode)), decode(manifest.chef), decode(manifest.chefSeated),
    ]);
    if (generation === epoch) { families = walks; const flat = seats.flat(); seated = TEAM_HAIRSTYLES.map((_, i) => flat.slice(i * 3, i * 3 + 3)); chef = cookWalk; chefSeated = cookSeats; }
  })().catch(error => { if (generation === epoch) pending = null; throw error; });
  return pending;
}

/** One uniform transform for the complete figure: the face and limbs are never stretched separately. */
export function teamStandingTransform(sizes: readonly { width: number; height: number }[]) {
  const scale = Math.min(TEAM_STANDING_SIZE.figureHeight / Math.max(...sizes.map(p => p.height)), 28 / Math.max(...sizes.map(p => p.width)));
  return { scale, width: TEAM_STANDING_SIZE.width, height: TEAM_STANDING_SIZE.height,
    foot: { x: TEAM_STANDING_SIZE.footX, y: TEAM_STANDING_SIZE.footY } };
}
/** Segment and vote each source pose once; saved looks only repaint its material ramps. */
function paintPose(p: Pose, look: Look, role: Exclude<Role, 'customer'>, sit: boolean, back: boolean,
  x: number, y: number, scale: number, width: number, height: number): HTMLCanvasElement {
  const key = [role, sit, back, x, y, scale, width, height].join(':');
  let grids = gridCache.get(p);
  if (!grids) { grids = new Map(); gridCache.set(p, grids); }
  let grid = grids.get(key);
  if (!grid) {
    grid = voteTeamPose(segmentTeamPose(p, { role, sit, back }), { x: x * D, y: y * D, scale: scale * D }, width * D, height * D);
    grids.set(key, grid);
  }
  const colours: TeamColours = {
    skin: shadeRamp(hexRgb(SKIN[mod(look.skin, SKIN.length)])),
    hair: shadeRamp(hexRgb(HAIR[mod(look.hair, HAIR.length)])),
    cloth: shadeRamp(hexRgb(CLOTH[mod(look.shirt, CLOTH.length)])),
    pants: shadeRamp(hexRgb(PANTS[mod(look.pants, PANTS.length)])),
  };
  const art = canvas(width * D, height * D), ctx = context(art);
  const image = ctx.createImageData(art.width, art.height);
  image.data.set(paintTeamPose(grid, colours)); ctx.putImageData(image, 0, 0);
  return art;
}
function publish(art: HTMLCanvasElement): HTMLCanvasElement {
  const result = canvas(art.width / D, art.height / D); context(result).drawImage(art, 0, 0, result.width, result.height);
  registerFineSpriteArt(result, art, D); return result;
}
function mirror(art: HTMLCanvasElement): HTMLCanvasElement {
  const result = canvas(art.width, art.height), ctx = context(result);
  ctx.translate(result.width, 0); ctx.scale(-1, 1); ctx.drawImage(art, 0, 0); return result;
}
function top(art: HTMLCanvasElement): number {
  const data = context(art).getImageData(0, 0, art.width, art.height).data;
  for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) if (data[(y * art.width + x) * 4 + 3] > 100) return y / D;
  return 0;
}
/** Cut the table overlap at pixel centres, so a diagonal never adds translucent fringe. */
function seatedForeground(art: HTMLCanvasElement, neck: Point, hand: Point): HTMLCanvasElement {
  const result = canvas(art.width, art.height), ctx = context(result);
  const image = context(art).getImageData(0, 0, art.width, art.height);
  const edge = [{ x: 0, y: neck.y }, { x: neck.x - 4, y: neck.y + 2 },
    { x: neck.x + 3, y: hand.y + 1.5 }, { x: art.width / D, y: hand.y + 1.5 }];
  for (let x = 0; x < art.width; x++) {
    const px = (x + .5) / D;
    const i = px < edge[1].x ? 0 : px < edge[2].x ? 1 : 2;
    const a = edge[i], b = edge[i + 1], limit = a.y + (b.y - a.y) * (px - a.x) / (b.x - a.x);
    for (let y = Math.max(0, Math.ceil(limit * D - .5)); y < art.height; y++) {
      const at = (y * art.width + x) * 4;
      image.data.fill(0, at, at + 4);
    }
  }
  ctx.putImageData(image, 0, 0); return result;
}
/** Complete body poses for the shop team; customers keep their existing painter. */
export function makeCozyTeam(look: Look, role: Exclude<Role, 'customer'>, set: (frame: HTMLCanvasElement, contacts: TeamContacts) => void): CharacterFrames | null {
  if (!cozyTeamReady()) return null;
  // Owner and floor staff share the same authored proportions and material ramps.
  // Keep each saved hairstyle and outfit; the cook retains the chef uniform.
  const style = mod(look.hairStyle, 8), poses = role === 'cook' ? chef : families[style], seats = role === 'cook' ? chefSeated : seated[style];
  const transform = teamStandingTransform(poses);
  const make = (index: number, mirrored = false) => {
    const p = poses[index], { scale, width, height, foot } = transform;
    const dx = foot.x - p.width * scale / 2, dy = foot.y - p.height * scale;
    const art = paintPose(p, look, role, false, index >= 3 && index < 6, dx, dy, scale, width, height);
    const painted = mirrored ? mirror(art) : art, frame = publish(painted);
    const hand = p.anchors.hand ?? { x: p.width * (index >= 6 ? .80 : .50), y: p.height * .66 };
    set(frame, { foot, head: { x: foot.x, y: top(painted) }, headHeight: dy + (p.anchors.neck?.y ?? p.height * (role === 'cook' ? .48 : .46)) * scale - top(painted) + 1, headScale: scale, bodyScale: scale, legExtension: 0,
      carryContact: { x: mirrored ? width - dx - hand.x * scale : dx + hand.x * scale, y: dy + hand.y * scale } });
    return frame;
  };
  const seatScale = Math.min(37 / Math.max(...seats.map(p => p.height)), 31 / Math.max(...seats.map(p => p.width)));
  const seat = (index: number, mirrored = false) => {
    const p = seats[index], scale = seatScale, width = 38, height = 42;
    const floor = p.anchors.floor ?? { x: p.width * .40, y: p.height - 4 };
    const dx = 13 - floor.x * scale, dy = 41 - floor.y * scale;
    const convert = (v: Point): Point => ({ x: dx + v.x * scale, y: dy + v.y * scale });
    const flip = (v: Point): Point => ({ x: mirrored ? width - v.x : v.x, y: v.y });
    const art = paintPose(p, look, role, true, false, dx, dy, scale, width, height);
    const hip = convert(p.anchors.hip ?? { x: floor.x, y: p.height * .74 });
    const neck = convert(p.anchors.neck ?? { x: p.width * .55, y: p.height * .44 });
    const hand = convert(p.anchors.hand ?? { x: p.width * .80, y: p.height * .70 });
    const foreground = seatedForeground(art, neck, hand);
    const painted = mirrored ? mirror(art) : art, frame = publish(painted), floorContact = flip({ x: 13, y: 41 }), petContact = index ? flip(hand) : undefined;
    registerSeatingUnit(frame, { foreground: publish(mirrored ? mirror(foreground) : foreground), floor: floorContact, hip: flip(hip), ...(petContact ? { petContact } : {}) });
    set(frame, { foot: floorContact, head: { x: flip(neck).x, y: top(painted) }, headHeight: neck.y - top(painted) + 1, seatContact: flip(hip), headScale: scale, bodyScale: scale, legExtension: 0, ...(petContact ? { petContact } : {}) });
    return frame;
  };
  // The source front/back steps share the same leading leg. Mirror the second
  // authored step as a whole figure to alternate feet without lengthening limbs.
  const down = [make(0), make(1), make(1, true)], up = [make(3), make(4), make(4, true)], right = [6, 7, 8].map(i => make(i)), left = [6, 7, 8].map(i => make(i, true));
  return { down, up, right, left, stand: down[0], sitRight: seat(0), sitLeft: seat(0, true), sitPetRight: [seat(1), seat(2)], sitPetLeft: [seat(1, true), seat(2, true)] };
}
