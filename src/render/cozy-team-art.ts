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
/**
 * Hairstyle families, in save order (a saved look stores the index). The first eight are
 * the original cozy-team-v7 figures; the rest were added in cozy-team-v8, men first.
 */
export const TEAM_HAIRSTYLES = ['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves',
  'crop', 'curls', 'undercut', 'slick', 'beard', 'buzz', 'pixie', 'buns', 'afro', 'bangs', 'twintails', 'curtain',
  'fauxhawk', 'manbun', 'shaggy', 'centerpart', 'mustache', 'locs', 'halfup', 'sidebraid', 'braidcrown', 'curlybob', 'asymbob', 'ringlets'] as const;
/**
 * Floor staff and partners only wear the first eight, so those decode with the game. The
 * rest are owner looks: each decodes when first asked for, so nobody holds every sheet.
 */
export const TEAM_BASE_STYLES = 8;
/** A look whose sheet failed keeps its stand-in this long before trying again (the scene asks every frame). */
const STYLE_RETRY_MS = 30_000;
/** Each seated sheet holds four hairstyles, three poses each. */
const SEATED_PER_SHEET = 4;
export const TEAM_STANDING_SIZE = Object.freeze({ width: 32, height: 44, footX: 16, footY: 42, figureHeight: 40 });
const D = WORLD_ART_DENSITY;
let gridCache = new WeakMap<Pose, Map<string, GridPose>>();
const SKIN = ['#f4cfad', '#dfaa7d', '#b67c55', '#80533f'];
const HAIR = ['#594237', '#976546', '#dfb96f', '#b9674e', '#626782', '#cc8c9f'];
const CLOTH = ['#bb6b58', '#799ba7', '#8ba477', '#d3a453', '#9b87af', '#cf929e', '#69a295', '#e5d7ba'];
const PANTS = ['#53637b', '#85664f', '#585464'];
let families: Pose[][] = [], seated: Pose[][] = [], chef: Pose[] = [], chefSeated: Pose[] = [];
let pending: Promise<void> | null = null, manifestLoad: Promise<TeamManifest> | null = null, epoch = 0;
const sheetImages = new Map<string, Promise<HTMLImageElement>>();
const styleLoads = new Map<number, Promise<void>>();
/** Owner looks the first picture should already show. */
const wanted = new Set<number>();
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Poses are read back (alpha cleanup, top edge, seated cut, mirroring), so every
// canvas here is CPU-backed from its first context: attributes cannot change later.
const context = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
const mod = (n: number, length: number) => ((Math.trunc(n) % length) + length) % length;

export function validateTeamManifest(m: TeamManifest): void {
  if (m.families?.length !== TEAM_HAIRSTYLES.length || m.families.some(s => s.bounds?.length !== 9) || m.chef?.bounds?.length !== 9 ||
      m.seated?.length !== TEAM_HAIRSTYLES.length / SEATED_PER_SHEET || m.seated.some(s => s.bounds?.length !== SEATED_PER_SHEET * 3) || m.chefSeated?.bounds?.length !== 3)
    throw Error('Incomplete cozy team poses');
  for (const sheet of [...m.families, m.chef, ...m.seated, m.chefSeated]) {
    if (!sheet.file || sheet.bounds.some(b => b.length !== 4 || b.some(v => !Number.isFinite(v)) || b[0] < 0 || b[1] < 0 || b[2] <= b[0] || b[3] <= b[1]))
      throw Error('Invalid cozy team bounds');
  }
}
const baseStyles = () => Array.from({ length: TEAM_BASE_STYLES }, (_, style) => style);
export function cozyTeamStyleReady(style: number): boolean {
  const s = mod(style, TEAM_HAIRSTYLES.length);
  return !!families[s] && !!seated[s];
}
/** Everything the café needs to open; owner looks arrive through preloadCozyTeamStyle. */
export function cozyTeamReady(): boolean {
  return baseStyles().every(cozyTeamStyleReady) && chef.length === 9 && chefSeated.length === 3;
}
/** The always-loaded family a look wears while its own sheet is on its way. */
export function cozyTeamStandIn(style: number): number { return mod(style, TEAM_BASE_STYLES); }
export function clearCozyTeam(): void {
  epoch++; families = []; seated = []; chef = []; chefSeated = []; pending = null; manifestLoad = null;
  sheetImages.clear(); styleLoads.clear(); gridCache = new WeakMap();
}
const assetBase = () => import.meta.env.BASE_URL + 'art/generated/cozy-team-v8/';
function teamManifest(): Promise<TeamManifest> {
  if (manifestLoad) return manifestLoad;
  const generation = epoch;
  // The v8 manifest lists the v7 sheets (by relative path) as well as its own.
  manifestLoad = (async () => {
    const response = await fetch(assetBase() + 'manifest.json');
    if (!response.ok) throw Error('Missing cozy team manifest');
    const manifest: TeamManifest = await response.json(); validateTeamManifest(manifest);
    return manifest;
  })().catch(error => { if (generation === epoch) manifestLoad = null; throw error; });
  return manifestLoad;
}
function sheetImage(file: string): Promise<HTMLImageElement> {
  let load = sheetImages.get(file);
  if (!load) {
    load = (async () => { const image = new Image(); image.src = assetBase() + file; await image.decode(); return image; })();
    load.catch(() => { if (sheetImages.get(file) === load) sheetImages.delete(file); });
    sheetImages.set(file, load);
  }
  return load;
}
async function decodePoses(sheet: Sheet, start = 0, count = sheet.bounds.length): Promise<Pose[]> {
  const image = await sheetImage(sheet.file);
  return sheet.bounds.slice(start, start + count).map(([x, y, right, bottom], index) => {
    if (right > image.naturalWidth || bottom > image.naturalHeight) throw Error('Cozy team pose outside atlas');
    const source = canvas(right - x, bottom - y), ctx = context(source);
    ctx.drawImage(image, x, y, source.width, source.height, 0, 0, source.width, source.height);
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 100) pixels.data[i] = 0;
    ctx.putImageData(pixels, 0, 0);
    return { data: pixels.data, width: source.width, height: source.height, anchors: sheet.anchors?.[start + index] ?? {} };
  });
}
/** One hairstyle's walking poses and its three seated poses (seated sheets are shared by four). */
export function preloadCozyTeamStyle(style: number): Promise<void> {
  const s = mod(style, TEAM_HAIRSTYLES.length);
  if (cozyTeamStyleReady(s)) return Promise.resolve();
  const running = styleLoads.get(s);
  if (running) return running;
  const generation = epoch;
  const load = (async () => {
    const manifest = await teamManifest();
    const [walk, seats] = await Promise.all([
      decodePoses(manifest.families[s]),
      decodePoses(manifest.seated[Math.floor(s / SEATED_PER_SHEET)], (s % SEATED_PER_SHEET) * 3, 3),
    ]);
    if (generation === epoch) { families[s] = walk; seated[s] = seats; }
  })();
  load.catch(() => { setTimeout(() => { if (styleLoads.get(s) === load) styleLoads.delete(s); }, STYLE_RETRY_MS); });
  styleLoads.set(s, load);
  return load;
}
/** Asks for a saved owner's look ahead of the first picture, so they never appear in a stand-in. */
export function wantCozyTeamStyle(style: number): void {
  const s = mod(style, TEAM_HAIRSTYLES.length);
  wanted.add(s);
  preloadCozyTeamStyle(s).catch(() => {});
}
export function preloadCozyTeam(): Promise<void> {
  if (cozyTeamReady() && [...wanted].every(cozyTeamStyleReady)) return Promise.resolve();
  if (pending) return pending;
  const generation = epoch;
  pending = (async () => {
    const manifest = await teamManifest();
    const [, cookWalk, cookSeats] = await Promise.all([
      Promise.all(baseStyles().map(preloadCozyTeamStyle)), decodePoses(manifest.chef), decodePoses(manifest.chefSeated),
    ]);
    if (generation === epoch) { chef = cookWalk; chefSeated = cookSeats; }
    // A look that cannot load keeps its stand-in; the café can still open.
    await Promise.all([...wanted].map(style => preloadCozyTeamStyle(style).catch(() => {})));
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
type SetContacts = (frame: HTMLCanvasElement, contacts: TeamContacts) => void;
function standingFrame(poses: Pose[], look: Look, role: Exclude<Role, 'customer'>, set: SetContacts, index: number, mirrored = false): HTMLCanvasElement {
  const { scale, width, height, foot } = teamStandingTransform(poses), p = poses[index];
  const dx = foot.x - p.width * scale / 2, dy = foot.y - p.height * scale;
  const art = paintPose(p, look, role, false, index >= 3 && index < 6, dx, dy, scale, width, height);
  const painted = mirrored ? mirror(art) : art, frame = publish(painted);
  const hand = p.anchors.hand ?? { x: p.width * (index >= 6 ? .80 : .50), y: p.height * .66 };
  set(frame, { foot, head: { x: foot.x, y: top(painted) }, headHeight: dy + (p.anchors.neck?.y ?? p.height * (role === 'cook' ? .48 : .46)) * scale - top(painted) + 1, headScale: scale, bodyScale: scale, legExtension: 0,
    carryContact: { x: mirrored ? width - dx - hand.x * scale : dx + hand.x * scale, y: dy + hand.y * scale } });
  return frame;
}
/** Just the owner's front pose, for the look picker; null until that hairstyle has loaded. */
export function cozyTeamFront(look: Look, set: SetContacts): HTMLCanvasElement | null {
  const style = mod(look.hairStyle, TEAM_HAIRSTYLES.length);
  return cozyTeamStyleReady(style) ? standingFrame(families[style], look, 'owner', set, 0) : null;
}
/** Complete body poses for the shop team; customers keep their existing painter. */
export function makeCozyTeam(look: Look, role: Exclude<Role, 'customer'>, set: SetContacts): CharacterFrames | null {
  const style = mod(look.hairStyle, TEAM_HAIRSTYLES.length);
  if (!cozyTeamReady() || (role !== 'cook' && !cozyTeamStyleReady(style))) return null;
  // Owner and floor staff share the same authored proportions and material ramps.
  // Keep each saved hairstyle and outfit; the cook retains the chef uniform.
  const poses = role === 'cook' ? chef : families[style], seats = role === 'cook' ? chefSeated : seated[style];
  const make = (index: number, mirrored = false) => standingFrame(poses, look, role, set, index, mirrored);
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
