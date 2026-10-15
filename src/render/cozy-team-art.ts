import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { registerFineSpriteArt } from './fine-sprite-art';
import { registerSeatingUnit } from './cozy-seating-art';

type Point = { x: number; y: number };
type Box = [number, number, number, number];
type PoseAnchors = { hip?: Point; hand?: Point; neck?: Point; floor?: Point };
type Sheet = { file: string; bounds: Box[]; anchors?: PoseAnchors[] };
export type TeamManifest = { families: Sheet[]; chef: Sheet; seated: Sheet[]; chefSeated: Sheet };
type Pose = { source: HTMLCanvasElement; width: number; height: number; anchors: PoseAnchors };
export type TeamContacts = { foot: Point; head: Point; headHeight: number; headScale: number; bodyScale: number;
  legExtension: number; carryContact?: Point; seatContact?: Point; petContact?: Point };
export const TEAM_HAIRSTYLES = ['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves'] as const;
export const TEAM_STANDING_SIZE = Object.freeze({ width: 32, height: 44, footX: 16, footY: 42, figureHeight: 40 });
const D = 3;
const SKIN = ['#f4cfad', '#dfaa7d', '#b67c55', '#80533f'];
const HAIR = ['#594237', '#976546', '#dfb96f', '#b9674e', '#626782', '#cc8c9f'];
const CLOTH = ['#bb6b58', '#799ba7', '#8ba477', '#d3a453', '#9b87af', '#cf929e', '#69a295', '#e5d7ba'];
const PANTS = ['#53637b', '#85664f', '#585464'];
let families: Pose[][] = [], seated: Pose[][] = [], chef: Pose[] = [], chefSeated: Pose[] = [];
let pending: Promise<void> | null = null, epoch = 0;
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const mod = (n: number, length: number) => ((Math.trunc(n) % length) + length) % length;
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

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
export function clearCozyTeam(): void { epoch++; families = []; seated = []; chef = []; chefSeated = []; pending = null; }
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
        const source = canvas(right - x, bottom - y), ctx = source.getContext('2d')!;
        ctx.drawImage(image, x, y, source.width, source.height, 0, 0, source.width, source.height);
        const pixels = ctx.getImageData(0, 0, source.width, source.height);
        for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 100) pixels.data[i] = 0;
        ctx.putImageData(pixels, 0, 0);
        return { source, width: source.width, height: source.height, anchors: sheet.anchors?.[index] ?? {} };
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
/** Source peach is separated into connected face/hand islands so hair glints never become skin. */
function skinMask(p: Pose, data: Uint8ClampedArray, neckY: number, sit: boolean, back: boolean): Uint8Array {
  const count = p.width * p.height, seen = new Uint8Array(count), mask = new Uint8Array(count);
  const candidate = (n: number) => { const i = n * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return data[i + 3] > 100 && r > 205 && g > 120 && b > 65 && r - g > 28 && g - b > 24 && g / r > .53; };
  let face: number[] = [];
  const hand = p.anchors.hand ?? { x: p.width * .80, y: p.height * .70 };
  for (let n = 0; n < count; n++) {
    if (seen[n] || !candidate(n)) continue;
    const island = [n]; seen[n] = 1;
    for (let k = 0; k < island.length; k++) {
      const at = island[k], x = at % p.width, y = Math.floor(at / p.width);
      for (const v of [x ? at - 1 : -1, x < p.width - 1 ? at + 1 : -1, y ? at - p.width : -1, y < p.height - 1 ? at + p.width : -1])
        if (v >= 0 && !seen[v] && candidate(v)) { seen[v] = 1; island.push(v); }
    }
    const center = island.reduce((v, at) => ({ x: v.x + at % p.width, y: v.y + Math.floor(at / p.width) }), { x: 0, y: 0 });
    center.x /= island.length; center.y /= island.length;
    if (!back && center.y < neckY && center.y > p.height * .17 && center.x > p.width * .25 && center.x < p.width * .85 && island.length > face.length) face = island;
    const isHand = center.y > neckY && center.y < p.height * (sit ? .85 : .80) &&
      (sit ? ((center.x - hand.x) / (p.width * .25)) ** 2 + ((center.y - hand.y) / (p.height * .17)) ** 2 < 1 || (center.x > p.width * .42 && center.y < p.height * .70) : true);
    const mean = island.reduce((v, at) => { const i = at * 4; return [v[0] + data[i], v[1] + data[i + 1], v[2] + data[i + 2]]; }, [0, 0, 0]);
    const hasPeachCore = mean[1] / mean[0] > .65 && mean[1] / mean[0] < .84 && mean[2] / mean[0] > .35 && mean[2] / mean[0] < .65 && island.some(at => { const i = at * 4; return data[i] > 235 && data[i + 1] > 150 && data[i + 2] > 95 && data[i] - data[i + 1] > 38; });
    const isEar = center.y > p.height * .20 && center.y < neckY - p.height * .055;
    const hasNeckCore = mean[1] / mean[0] > .53 && mean[1] / mean[0] < .70 && mean[2] / mean[0] > .30 && mean[2] / mean[0] < .50 && island.some(at => data[at * 4] > 235);
    const isNeck = center.y >= neckY - p.height * .08 && center.y < neckY + p.height * .055 && center.x > p.width * .35 && center.x < p.width * .70;
    if (((isHand || isEar) && hasPeachCore) || (isNeck && (hasPeachCore || hasNeckCore))) island.forEach(at => { mask[at] = 1; });
  }
  face.forEach(at => { mask[at] = 1; });
  return mask;
}
/** Follow connected warm hair below the neck, including long locks and braids. */
function hairMask(p: Pose, data: Uint8ClampedArray, skin: Uint8Array, neckY: number, sit: boolean, cook: boolean): Uint8Array {
  const count = p.width * p.height, seen = new Uint8Array(count), mask = new Uint8Array(count);
  const candidate = (n: number) => {
    if (skin[n]) return false;
    const i = n * 4, r = data[i], g = data[i + 1], b = data[i + 2], y = Math.floor(n / p.width), lum = r * .299 + g * .587 + b * .114;
    if (cook && (y < p.height * .22 || y > neckY + p.height * .03 || (y < p.height * .34 && r > 150 && r - g < 70 && g - b < 80))) return false;
    // Golden chair wood is much yellower than the source chestnut hair.
    if (sit && y > p.height * .30 && b / r < .25 && g / r > .48) return false;
    return data[i + 3] > 100 && r > g * 1.15 && g > b * 1.12 && r - g > 25 && lum > 40 && b / r < .66;
  };
  const separated: number[][] = [];
  for (let n = 0; n < count; n++) {
    if (seen[n] || !candidate(n)) continue;
    const island = [n]; seen[n] = 1; let seeded = false;
    for (let k = 0; k < island.length; k++) {
      const at = island[k], x = at % p.width, y = Math.floor(at / p.width);
      if (y < neckY - p.height * .035) seeded = true;
      for (const v of [x ? at - 1 : -1, x < p.width - 1 ? at + 1 : -1, y ? at - p.width : -1, y < p.height - 1 ? at + p.width : -1])
        if (v >= 0 && !seen[v] && candidate(v)) { seen[v] = 1; island.push(v); }
    }
    if (seeded) island.forEach(at => { mask[at] = 1; });
    else if (!cook && island.every(at => Math.floor(at / p.width) < p.height * .78)) {
      const mean = island.reduce((v, at) => { const i = at * 4; return [v[0] + data[i], v[1] + data[i + 1], v[2] + data[i + 2]]; }, [0, 0, 0]);
      if (mean[0] > mean[1] * 1.38 && mean[2] < mean[0] * .53) separated.push(island);
    }
  }
  // Ribbons and dark outlines can separate braid tips from the main hair island.
  // Bridge only short gaps to chestnut islands, leaving the ribbon/wood unchanged.
  const radius = Math.max(3, Math.ceil(p.width * .045)), distance = new Uint8Array(count);
  const queue: number[] = [];
  for (let n = 0; n < count; n++) if (mask[n]) { distance[n] = 1; queue.push(n); }
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k]; if (distance[at] > radius) continue;
    const x = at % p.width, y = Math.floor(at / p.width);
    for (const v of [x ? at - 1 : -1, x < p.width - 1 ? at + 1 : -1, y ? at - p.width : -1, y < p.height - 1 ? at + p.width : -1])
      if (v >= 0 && !distance[v]) { distance[v] = distance[at] + 1; queue.push(v); }
  }
  for (const island of separated) if (island.some(at => distance[at] > 0)) island.forEach(at => { mask[at] = 1; });
  return mask;
}
function recolour(p: Pose, look: Look, role: Exclude<Role, 'customer'>, sit: boolean, back = false): HTMLCanvasElement {
  const target = canvas(p.width, p.height), ctx = target.getContext('2d')!; ctx.drawImage(p.source, 0, 0);
  const image = ctx.getImageData(0, 0, p.width, p.height), pixels = image.data;
  const skin = rgb(SKIN[mod(look.skin, 4)]), hair = rgb(HAIR[mod(look.hair, 6)]), pants = rgb(PANTS[mod(look.pants, 3)]);
  const selected = rgb(CLOTH[mod(look.shirt, 8)]), uniform = rgb(role === 'server' ? '#657f88' : role === 'cook' ? '#a76e52' : '#74805a');
  const cloth = role === 'owner' ? selected : selected.map((v, i) => v * .68 + uniform[i] * .32);
  const neckY = p.anchors.neck?.y ?? p.height * (sit ? .44 : role === 'cook' ? .48 : .46);
  const hipY = p.anchors.hip?.y ?? p.height * (sit ? .74 : .78);
  const neckX = p.anchors.neck?.x ?? p.width * (sit ? .55 : .50);
  const skinIslands = skinMask(p, pixels, neckY, sit, back);
  const hairIslands = hairMask(p, pixels, skinIslands, neckY, sit, role === 'cook');
  for (let n = 0; n < p.width * p.height; n++) {
    const i = n * 4; if (!pixels[i + 3]) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], x = n % p.width, y = Math.floor(n / p.width);
    const lum = r * .299 + g * .587 + b * .114;
    let color: number[] | undefined, base = 1;
    // Furniture is authored into seated poses. Its left/back region, cushion and legs
    // stay untouched, while the reaching hand remains eligible for skin recolouring.
    const hand = p.anchors.hand ?? { x: p.width * .80, y: p.height * .70 };
    const nearHand = ((x - hand.x) / (p.width * .18)) ** 2 + ((y - hand.y) / (p.height * .12)) ** 2 < 1;
    const furniture = sit && !nearHand && ((y > p.height * .31 && x < neckX - p.width * .17) || (y > hipY && x < p.width * .50));
    if (furniture && !hairIslands[n] && !skinIslands[n]) continue;
    const warm = r > g * 1.15 && g > b * 1.12;
    if (skinIslands[n]) { color = skin; base = 205; }
    else if (hairIslands[n]) { color = hair; base = role === 'cook' ? 84 : 96; }
    else if (role !== 'cook' && y > neckY - p.height * .04 && y < hipY + p.height * .07 && g > r * .85 && g > b * 1.18 && r < 185) { color = cloth; base = 103; }
    else if (role === 'cook' && y > neckY - p.height * .025 && y < hipY + p.height * .07 && warm && r > 95 && r - g > 32) { color = cloth; base = 113; }
    else if (y > hipY - p.height * .035 && y < p.height * (sit ? .90 : .91) && (!sit || x > p.width * .43) && r > g && g > b && g / r > .55 && b / r > .27) { color = pants; base = role === 'cook' ? 79 : 185; }
    if (color) {
      const light = Math.max(.40, Math.min(1.35, lum / base));
      for (let k = 0; k < 3; k++) pixels[i + k] = Math.max(15, Math.min(250, Math.round(color[k] * light)));
    }
  }
  ctx.putImageData(image, 0, 0); return target;
}
function publish(art: HTMLCanvasElement): HTMLCanvasElement {
  const result = canvas(art.width / D, art.height / D); result.getContext('2d')!.drawImage(art, 0, 0, result.width, result.height);
  registerFineSpriteArt(result, art, D); return result;
}
function mirror(art: HTMLCanvasElement): HTMLCanvasElement {
  const result = canvas(art.width, art.height), ctx = result.getContext('2d')!;
  ctx.translate(result.width, 0); ctx.scale(-1, 1); ctx.drawImage(art, 0, 0); return result;
}
function top(art: HTMLCanvasElement): number {
  const data = art.getContext('2d')!.getImageData(0, 0, art.width, art.height).data;
  for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) if (data[(y * art.width + x) * 4 + 3] > 100) return y / D;
  return 0;
}
/** Complete body poses for the shop team; customers keep their existing painter. */
export function makeCozyTeam(look: Look, role: Exclude<Role, 'customer'>, set: (frame: HTMLCanvasElement, contacts: TeamContacts) => void): CharacterFrames | null {
  if (!cozyTeamReady()) return null;
  const style = mod(look.hairStyle, 8), poses = role === 'cook' ? chef : families[style], seats = role === 'cook' ? chefSeated : seated[style];
  const transform = teamStandingTransform(poses);
  const make = (index: number, mirrored = false) => {
    const p = poses[index], { scale, width, height, foot } = transform, art = canvas(width * D, height * D), ctx = art.getContext('2d')!;
    const dx = foot.x - p.width * scale / 2, dy = foot.y - p.height * scale;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(recolour(p, look, role, false, index >= 3 && index < 6), dx * D, dy * D, p.width * scale * D, p.height * scale * D);
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
    const art = canvas(width * D, height * D), ctx = art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(recolour(p, look, role, true), dx * D, dy * D, p.width * scale * D, p.height * scale * D);
    const hip = convert(p.anchors.hip ?? { x: floor.x, y: p.height * .74 });
    const neck = convert(p.anchors.neck ?? { x: p.width * .55, y: p.height * .44 });
    const hand = convert(p.anchors.hand ?? { x: p.width * .80, y: p.height * .70 });
    const foreground = canvas(width * D, height * D), fg = foreground.getContext('2d')!;
    fg.scale(D, D); fg.beginPath(); fg.moveTo(0, 0); fg.lineTo(width, 0); fg.lineTo(width, hand.y + 1.5);
    fg.lineTo(neck.x + 3, hand.y + 1.5); fg.lineTo(neck.x - 4, neck.y + 2); fg.lineTo(0, neck.y); fg.closePath(); fg.clip(); fg.drawImage(art, 0, 0, width, height);
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
