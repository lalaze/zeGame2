// Where the café's cats live in the cross-section building, and how they get about: the places a
// cat sits, naps or watches from on each floor, the little paths between them, and which place suits
// which cat. Pure data and choices; floors-cats.ts draws the cats and walks them here.
//
// The game's own cat logic (game/living-cats.ts) places cats in the pixel rooms, which this
// building does not have. A cat's saved preferences are mapped onto the building instead: its
// preferred room becomes a floor (the terrace and the greenhouse are the roof, the main café the
// ground floor, the reading nook the seating floor with the bookshelf), and its preferred spot a kind
// of place. Points are plate pixels of their floor, as in floors-layout.ts.
import type { CatArea, CatPersonality, CatSpot, PetPreferences } from '../../game/pets';
import { COUNTER_FRONT, DISPLAY, TABLE_SLOTS, furnitureSpot, stairsOf, tableSeats, type FloorId, type FloorPoint, type Point } from './floors-layout';

/** build/cats/cats.json (scripts/art-gen/floor-cats-build.py). */
export interface CatsManifest {
  /** The cells of every breed's strip, in order. */
  frames: string[];
  sitHeight: number;
  cats: Record<string, { frameWidth: number; frameHeight: number; take: number }>;
  gifts: string[];
  /** Patches over the terrace's plate, in its pixels: they paint away the two cats painted into it. */
  roof?: { file: string; x: number; y: number }[];
}
/** The poses of a breed's strip, in order (the manifest's `frames`). */
export const CAT_FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'sit', 'happy', 'sleep', 'groom'] as const;
/** Cats keep out of the kitchen, as in the pixel café. */
export type CatFloor = Exclude<FloorId, 'basement'>;
/** Bottom up, the order the stairs join them. */
export const CAT_FLOORS: readonly CatFloor[] = ['ground', 'floor-2', 'floor-3', 'roof'];
export type PlaceKind = 'bed' | 'cozy' | 'window' | 'people' | 'explore';

export interface CatPlace extends FloorPoint {
  id: string;
  floor: CatFloor;
  kind: PlaceKind;
  /** The path node the cat leaves the paths at to get here. */
  from: string;
  /** Up on something (a wall, a seat, a bed): the cat jumps the last stretch. */
  hop?: boolean;
  /** Soft or sunny enough for a nap. */
  naps?: boolean;
  /** The floor's furniture spots (named as in SPOTS of floors-layout.ts) whose piece would stand in front of a cat here. */
  behind?: readonly string[];
}

/** One leg of a cat's walk. `jump` appears there (the far end of the stairs); `hop` is jumped in an arc. */
export interface CatStep extends FloorPoint { jump?: boolean; hop?: boolean }

type PlaceSpec = Omit<CatPlace, 'floor'>;
interface FloorPaths { nodes: Record<string, [number, number]>; edges: [string, string][]; entry: string; well?: string; places: PlaceSpec[] }

/**
 * The ground floor: cats keep to the walkway between the counter and the tables, where they can
 * greet the queue, and to the window seat. `land` is the open floor by the stairs.
 */
const GROUND: FloorPaths = {
  nodes: { seat: [345, 628], a1: [520, 628], a2: [720, 628], a3: [905, 628], a4: [1120, 628], land: [1350, 622] },
  edges: [['seat', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'a4'], ['a4', 'land']],
  entry: 'land',
  places: [
    { id: 'window-seat', x: 252, y: 538, kind: 'window', from: 'seat', hop: true, naps: true },
    { id: 'queue', x: 520, y: 628, kind: 'explore', from: 'a1' },
    { id: 'counter', x: 720, y: 628, kind: 'people', from: 'a2' },
    { id: 'till', x: 905, y: 628, kind: 'people', from: 'a3' },
  ],
};

/**
 * A seating floor: the sunny patch under the window and the floor between the back tables on the
 * left, the bookshelf side on the right, joined along the front edge, in front of the front table.
 * `land` is the open floor beside the stairwell's landing, `stairs` the foot of the flight up.
 */
const SEATING: FloorPaths = {
  nodes: {
    sun: [322, 652], mid: [556, 648], fl: [322, 886], fm: [560, 886], fc: [830, 886], fr: [1035, 886],
    r0: [1035, 652], books: [1196, 652], land: [1288, 645], sc: [1288, 886], stairs: [1552, 836],
  },
  edges: [['sun', 'mid'], ['sun', 'fl'], ['fl', 'fm'], ['fm', 'fc'], ['fc', 'fr'], ['fr', 'r0'], ['r0', 'books'], ['books', 'land'],
    ['land', 'sc'], ['fr', 'sc'], ['sc', 'stairs']],
  entry: 'stairs',
  well: 'land',
  places: [
    { id: 'sun', x: 322, y: 652, kind: 'window', from: 'sun', naps: true, behind: ['window', 'front-2'] },
    { id: 'tables', x: 556, y: 648, kind: 'people', from: 'mid', behind: ['front-3'] },
    { id: 'front', x: 830, y: 886, kind: 'explore', from: 'fc' },
    { id: 'books', x: 1196, y: 652, kind: 'cozy', from: 'books', naps: true, behind: ['front-4'] },
  ],
};

/**
 * The roof terrace: the cushion in the middle is the cats' bed, the terrace wall their lookout.
 * `door` is where the stairs come up; the way to it runs along the front, in front of the pots.
 */
const ROOF: FloorPaths = {
  nodes: {
    door: [1490, 802], p1: [1400, 862], p2: [1150, 862], t4: [1120, 800], t3: [960, 800], t2: [790, 800], t1: [600, 800], t0: [390, 800],
    wall: [648, 700],
  },
  edges: [['door', 'p1'], ['p1', 'p2'], ['p2', 't4'], ['t4', 't3'], ['t3', 't2'], ['t2', 't1'], ['t1', 't0'], ['t1', 'wall']],
  entry: 'door',
  places: [
    { id: 'cushion', x: 792, y: 690, kind: 'bed', from: 't2', hop: true, naps: true },
    { id: 'wall', x: 668, y: 380, kind: 'window', from: 'wall', hop: true },
    { id: 'wall-2', x: 588, y: 380, kind: 'window', from: 'wall', hop: true },
    { id: 'planter', x: 390, y: 800, kind: 'cozy', from: 't0', naps: true, behind: ['front-1'] },
    { id: 'terrace', x: 960, y: 800, kind: 'explore', from: 't3', behind: ['front-3'] },
  ],
};

const PATHS: Record<CatFloor, FloorPaths> = { ground: GROUND, 'floor-2': SEATING, 'floor-3': SEATING, roof: ROOF };
/** The path node a cat gets to a cat bed from, at each spot of a floor (none: out of a cat's reach). */
const SEATING_BEDS = { window: 'sun', 'front-1': 'fl', 'front-2': 'fl', 'front-3': 'fm', 'front-4': 'fr', 'front-5': 'sc' };
const BED_FROM: Record<CatFloor, Record<string, string>> = {
  ground: { left: 'seat' }, 'floor-2': SEATING_BEDS, 'floor-3': SEATING_BEDS,
  roof: { 'front-1': 't0', 'front-2': 't1', 'front-3': 't3', back: 'wall' },
};
/** How far above a piece's foot a cat lies in it. */
const BED_RISE = 16;

const nodeId = (floor: CatFloor, name: string) => `${floor}/${name}`;
const floorOf = (id: string) => id.slice(0, id.indexOf('/')) as CatFloor;
const nameOf = (id: string) => id.slice(id.indexOf('/') + 1);

/** A path node as a point of its floor. */
export function catNode(id: string): FloorPoint {
  const floor = floorOf(id), [x, y] = PATHS[floor].nodes[nameOf(id)];
  return { floor, x, y };
}
/** Every path node of a floor, and the node at its stairs. */
export const catNodes = (floor: CatFloor) => Object.keys(PATHS[floor].nodes).map(name => nodeId(floor, name));
export const catEntry = (floor: CatFloor) => nodeId(floor, PATHS[floor].entry);
/** The node where the flight from below comes up: by a floor's stairwell, or the roof's door. */
export const catArrival = (floor: CatFloor) => nodeId(floor, PATHS[floor].well ?? PATHS[floor].entry);
export const catEdges = (floor: CatFloor) => PATHS[floor].edges.map(([a, b]) => [nodeId(floor, a), nodeId(floor, b)] as [string, string]);

/** The floors of a building cats use, bottom up. */
export const catFloors = (floors: readonly FloorId[]): CatFloor[] => CAT_FLOORS.filter(floor => floors.includes(floor));

/**
 * The places cats can use now: those of the floors the building has, less any a placed piece of
 * furniture stands in front of, plus every cat bed the player has put out. `pieces` maps a spot
 * (game/building-spots.ts) to the piece standing there.
 */
export function catPlaces(floors: readonly FloorId[], pieces: ReadonlyMap<string, string> = new Map()): CatPlace[] {
  const places: CatPlace[] = [];
  for (const floor of catFloors(floors)) {
    for (const place of PATHS[floor].places) {
      if (place.behind?.some(name => pieces.has(`${floor}-${name}`))) continue;
      places.push({ ...place, id: nodeId(floor, place.id), from: nodeId(floor, place.from), floor });
    }
  }
  for (const [id, piece] of pieces) {
    const spot = furnitureSpot(id), from = spot && BED_FROM[spot.floor][id.slice(spot.floor.length + 1)];
    if (piece !== 'catbed' || !spot || !from || !floors.includes(spot.floor)) continue;
    places.push({ id: nodeId(spot.floor, `bed-${id}`), floor: spot.floor, x: spot.x, y: spot.y - BED_RISE, kind: 'bed', from: nodeId(spot.floor, from), hop: true, naps: true });
  }
  return places;
}

// ------------------------------------------------------------ preferences

/** The floors a preferred room of the pixel café stands for, best first. */
const AREA_FLOORS: Record<CatArea, readonly CatFloor[]> = {
  main: ['ground'],
  reading: ['floor-2', 'floor-3', 'ground'],
  workshop: ['floor-3', 'floor-2', 'ground'],
  greenhouse: ['roof'],
  terrace: ['roof'],
  observatory: ['roof'],
};
/** The kinds of place a preferred spot stands for. */
const SPOT_KINDS: Record<CatSpot, readonly PlaceKind[]> = { cozy: ['cozy', 'bed'], window: ['window'], explore: ['explore', 'people'] };

/** The floor of this building a cat calls home: the first its preferred room maps to that exists. */
export function homeFloor(area: CatArea, floors: readonly FloorId[]): CatFloor {
  return AREA_FLOORS[area].find(floor => floors.includes(floor)) ?? 'ground';
}

/** The pixel café's room name the pet panel shows for a floor (ui/living-cats.ts has no words for floors). */
export function floorArea(floor: FloorId): CatArea {
  return floor === 'roof' ? 'terrace' : floor === 'ground' || floor === 'basement' ? 'main' : 'reading';
}

/** How well a place suits a cat: its home floor first, then its kind of spot, then a real bed. */
export function placeRank(place: CatPlace, prefs: PetPreferences, floors: readonly FloorId[]): number {
  return (place.floor === homeFloor(prefs.preferredArea, floors) ? 8 : 0)
    + (SPOT_KINDS[prefs.preferredSpot].includes(place.kind) ? 4 : 0) + (place.kind === 'bed' ? 2 : 0);
}

export type CatPlan = 'roam' | 'nap' | 'groom' | 'watch';
const PLANS: readonly CatPlan[] = ['roam', 'nap', 'groom', 'watch'];
/** How a cat of each personality spends its time: playful cats roam, quiet ones nap, affectionate ones keep people company. */
const PLAN_WEIGHTS: Record<CatPersonality, readonly number[]> = { playful: [7, 1, 3, 3], quiet: [1, 7, 3, 4], affectionate: [4, 2, 3, 7] };
/** Seconds a cat stays at each plan before choosing again; a quiet cat naps twice as long. */
const PLAN_SECONDS: Record<CatPlan, number> = { roam: 7, nap: 30, groom: 7, watch: 14 };

export function choosePlan(personality: CatPersonality, random: number): CatPlan {
  const weights = PLAN_WEIGHTS[personality];
  let value = Math.max(0, Math.min(.999999, random)) * weights.reduce((sum, w) => sum + w, 0), index = 0;
  while (index < weights.length - 1 && (value -= weights[index]) >= 0) index++;
  return PLANS[index];
}

export function planSeconds(plan: CatPlan, personality: CatPersonality, random: number): number {
  return PLAN_SECONDS[plan] * (.8 + random * .7) * (plan === 'nap' && personality === 'quiet' ? 2 : 1);
}

/**
 * The place a cat goes to for a plan, from those free now (never where it already is):
 * - a nap is taken at the best-suited place soft enough for one;
 * - watching is done from a window, or by an affectionate cat that isn't a window-watcher, among people;
 * - roaming takes a playful cat anywhere, and others to one of the four places that suit them best.
 * Without a fitting place the plan falls back to the best-suited free one.
 */
export function choosePlace(plan: CatPlan, prefs: PetPreferences, free: readonly CatPlace[], floors: readonly FloorId[],
  at: string | undefined, random: () => number): CatPlace | undefined {
  const ranked = free.filter(place => place.id !== at)
    .map((place, order) => ({ place, rank: placeRank(place, prefs, floors), order }))
    .sort((a, b) => b.rank - a.rank || a.order - b.order).map(entry => entry.place);
  if (!ranked.length) return undefined;
  const pick = (list: readonly CatPlace[], among: number) => list[Math.floor(Math.max(0, Math.min(.999999, random())) * Math.min(among, list.length))];
  if (plan === 'nap') {
    const beds = ranked.filter(place => place.naps);
    return beds.length ? pick(beds, prefs.personality === 'quiet' ? 1 : 2) : ranked[0];
  }
  if (plan === 'watch') {
    const people = prefs.personality === 'affectionate' && prefs.preferredSpot !== 'window' && random() < .7;
    const spots = ranked.filter(place => place.kind === (people ? 'people' : 'window'));
    return spots.length ? pick(spots, 2) : ranked[0];
  }
  return pick(ranked, prefs.personality === 'playful' ? ranked.length : 4);
}

// ------------------------------------------------------------ routes

/** The nodes from one node of a floor to another, along its paths (both ends included). */
function along(from: string, to: string): string[] {
  const floor = floorOf(from), links = new Map<string, string[]>();
  for (const [a, b] of catEdges(floor)) {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  }
  const came = new Map<string, string | null>([[from, null]]), queue = [from];
  while (queue.length) {
    const node = queue.shift()!;
    if (node === to) break;
    for (const next of links.get(node) ?? []) if (!came.has(next)) { came.set(next, node); queue.push(next); }
  }
  if (!came.has(to)) return [from];
  const path: string[] = [];
  for (let node: string | null = to; node; node = came.get(node) ?? null) path.unshift(node);
  return path;
}

/**
 * The steps from a path node to a place: along the floor's paths, by the stairs to another floor
 * (up a flight and out of the well there, or out of the roof's door; down the same way), and
 * off the path to the place itself. A cat on a raised place first jumps down to the node it came by.
 */
export function catRoute(fromNode: string, to: CatPlace, floors: readonly FloorId[]): CatStep[] {
  const levels = catFloors(floors), steps: CatStep[] = [];
  const walk = (from: string, goal: string) => { for (const node of along(from, goal).slice(1)) steps.push(catNode(node)); };
  let node = fromNode, level = levels.indexOf(floorOf(fromNode));
  const target = levels.indexOf(to.floor);
  if (level < 0 || target < 0) return [];
  while (level !== target) {
    const here = levels[level], up = target > level, next = levels[level + (up ? 1 : -1)];
    // To the stairs: the foot of the flight up, or the well (or the roof's door) the one below comes up in.
    walk(node, up ? catEntry(here) : catArrival(here));
    if (up) {
      steps.push({ floor: here, ...stairsOf(here)!.foot }, { floor: here, ...stairsOf(here)!.top });
      const arrival = stairsOf(next)?.well;
      node = catArrival(next);
      if (arrival) steps.push({ floor: next, ...arrival.inside, jump: true }, { floor: next, ...arrival.lip }, { floor: next, ...arrival.on }, { floor: next, x: arrival.out.x, y: arrival.out.y }, catNode(node));
      else steps.push({ ...catNode(node), jump: true });
    } else {
      const leaving = stairsOf(here)?.well, flight = stairsOf(next)!;
      if (leaving) steps.push({ floor: here, x: leaving.out.x, y: leaving.out.y }, { floor: here, ...leaving.on }, { floor: here, ...leaving.lip }, { floor: here, ...leaving.inside });
      node = catEntry(next);
      steps.push({ floor: next, ...flight.top, jump: true }, { floor: next, ...flight.foot }, catNode(node));
    }
    level += up ? 1 : -1;
  }
  walk(node, to.from);
  const last = steps[steps.length - 1] ?? catNode(fromNode);
  if (Math.hypot(last.x - to.x, last.y - to.y) >= 1 || last.floor !== to.floor) steps.push({ floor: to.floor, x: to.x, y: to.y, hop: to.hop });
  return steps;
}

// ------------------------------------------------------------ what cats keep out of

export interface Box { x: number; y: number; w: number; h: number }

/**
 * What stands on a floor's plate that a cat must not be drawn standing in: the counter and the cake
 * display, every table with its two chairs, and the staircase. Plate pixels. (Tables are measured
 * from their seats: a seated guest's feet are under the chair, the chair backs rise about 180 above.)
 */
export function catObstacles(floor: CatFloor): Box[] {
  const boxes: Box[] = [];
  if (floor === 'ground') {
    boxes.push({ x: 455, y: 300, w: 640, h: COUNTER_FRONT.y - 300 }, { x: DISPLAY.left - 20, y: DISPLAY.top - 20, w: DISPLAY.right - DISPLAY.left + 40, h: DISPLAY.bottom - DISPLAY.top + 40 });
  }
  if (floor !== 'roof') {
    // Each table slot of the building, in the order the café opens them.
    const slots = Array.from({ length: TABLE_SLOTS }, (_, i) => i);
    for (const slot of slots) {
      const [a, b] = tableSeats(slot, slots);
      if (a.floor !== floor) continue;
      boxes.push({ x: a.x - 96, y: a.y - 178, w: b.x - a.x + 192, h: 222 });
    }
    // The staircase climbs the right wall to the ceiling; on a seating floor the stairwell is beside it.
    const flight = stairsOf(floor)!;
    if (flight.well) boxes.push({ x: 1520, y: 0, w: 100, h: flight.foot.y }, { x: 1303, y: 548, w: 229, h: 228 });
    else boxes.push({ x: flight.foot.x - 86, y: 0, w: 300, h: flight.foot.y });
  } else {
    // The terrace's two tables with their chairs, its big planter, the pots by the door and the door itself.
    boxes.push({ x: 345, y: 420, w: 345, h: 245 }, { x: 985, y: 420, w: 345, h: 255 }, { x: 876, y: 400, w: 126, h: 150 },
      { x: 1172, y: 700, w: 178, h: 152 }, { x: 1368, y: 440, w: 240, h: 330 });
  }
  return boxes;
}

export const inBox = (p: Point, box: Box) => p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;

/** Whether the straight walk from a to b passes through a box. */
export function crossesBox(a: Point, b: Point, box: Box): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 0; i <= steps; i++) {
    if (inBox({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }, box)) return true;
  }
  return false;
}

// ------------------------------------------------------------ gifts

/**
 * Where the gifts cats leave wait to be picked up, by their spot (GIFT_SPOTS in game/cat-gifts.ts,
 * the pixel café's three places on its windowsill): on the ground floor's window seat, on the step
 * at its foot, and on the terrace wall. Both floors are in every building.
 */
export const GIFT_PLACES: readonly FloorPoint[] = [
  { floor: 'ground', x: 204, y: 548 },
  { floor: 'ground', x: 298, y: 624 },
  { floor: 'roof', x: 760, y: 382 },
];
