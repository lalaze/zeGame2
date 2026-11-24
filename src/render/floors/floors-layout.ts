// Where the cross-section building (assets/generated/art-direction-v1) puts the café's tables,
// counter, kitchen and staff, and how people walk between them. The game's Sim keeps its own floor
// plan; the floors view (floors-scene.ts) reads who is doing what from it and walks each person
// here to the matching spot, taking the stairs between floors.
//
// Points are pixels of their floor's plate (assets/generated/floor-sample-v1/kits/angle-plate-*),
// with the floor they are on; `worldPoint` stacks them into one tall scene.

import { BUILDING_SPOTS, storeys, type BuildingSpot } from '../../game/building-spots';

export type FloorId = 'roof' | 'floor-3' | 'floor-2' | 'ground' | 'basement';
export interface Point { x: number; y: number }
export interface FloorPoint extends Point { floor: FloorId }
/** A place people walk to, and the walkway they reach it from. */
export interface Spot extends FloorPoint { aisle: number }
/** One leg of a walk. `jump` appears there (the far end of a flight of stairs); `fadeOut` leaves through it. */
export interface Step extends FloorPoint { jump?: boolean; fadeOut?: boolean }

/**
 * Each floor's image and the plate rows it was cut from (scripts/art-gen/floor-sample-plates.mjs).
 * The top floor is drawn from the attic picture (scripts/art-gen/floor-frame-build.py), which keeps
 * the plate's rows and carries the roof `above` them.
 */
export const FLOOR_ART: Record<FloorId, { image: string; top: number; height: number; above?: number }> = {
  roof: { image: 'frame/attic', top: 0, height: 905, above: 427 },
  'floor-3': { image: 'floor-2', top: 24, height: 877 },
  'floor-2': { image: 'floor-2', top: 24, height: 877 },
  ground: { image: 'floor-1', top: 24, height: 883 },
  basement: { image: 'basement', top: 30, height: 911 },
};
export const WORLD_W = 1672;
/**
 * The building's frame around its floors (build/frame/frame.json): the ground floor stands at street
 * level, so the street's picture runs on below it; with a basement the street is cut open, a band of
 * its paving and earth (SOIL_BAND) over the basement and more earth (SOIL_BELOW) under it.
 */
export const FRAME = { street: 836, soilBand: 150, soilBelow: 420, beam: 70, pillar: 76 } as const;
/**
 * The awning over the ground floor's open front hides the top of its back wall, and the staff the part
 * behind their heads: decor drawn there moves clear of them, by item (pendants and vines hang low
 * enough as they are). The layer is drawn this far from its place, and only the part of it that holds
 * the piece (layers made by comparing pictures have stray specks elsewhere).
 */
export interface DecorShift { dx: number; dy: number; crop: { x: number; y: number; w: number; h: number } }
const HUNG = { x: 60, y: 0, w: 1245, h: 300 }, NEON: DecorShift = { dx: -318, dy: -10, crop: { x: 758, y: 130, w: 170, h: 170 } };
export const GROUND_SHIFT: Partial<Record<string, DecorShift>> = {
  ceiling_lights: { dx: 0, dy: 76, crop: HUNG }, ceiling_chandelier: { dx: 0, dy: 84, crop: HUNG },
  neon_cafe: NEON, neon_heart: NEON, neon_cup: NEON,
};
/** Bottom up, so the stairs can be followed floor by floor. */
const LEVELS: FloorId[] = ['basement', 'ground', 'floor-2', 'floor-3', 'roof'];

export interface Building {
  /** Top down, as drawn. */
  floors: FloorId[];
  /** Where each floor's plate starts; the roof's picture reaches FLOOR_ART.roof.above higher. */
  offsets: Partial<Record<FloorId, number>>;
  /** The street level: the ground floor's front edge. */
  street: number;
  /** The whole picture, roof to the bottom of the street or the earth. */
  height: number;
}

/** The floors a café has: the storeys of its tables (game/building-spots.ts), and the basement kitchen with the kitchen. */
export function building(tables: number, kitchen: boolean): Building {
  const floors: FloorId[] = storeys(tables);
  if (kitchen) floors.push('basement');
  const offsets: Partial<Record<FloorId, number>> = {};
  let height = FLOOR_ART.roof.above ?? 0, street = 0;
  for (const floor of floors) {
    if (floor === 'basement') height += FRAME.soilBand;
    offsets[floor] = height;
    height += FLOOR_ART[floor].height;
    if (floor === 'ground') street = height;
  }
  height += kitchen ? FRAME.soilBelow : FRAME.street;
  return { floors, offsets, street, height };
}

/**
 * Where the camera rests, as the world y at the middle of a screen `view` tall: a building that fits
 * between the page's top bar and its bottom bars is shown whole; a taller one with the street two
 * thirds of the way down, so the counter is always on screen and the upper floors are a drag away.
 */
export function restFocus(b: Building, view: number): number {
  const margin = view * .1;
  return b.street + margin <= view * .88 ? view / 2 - margin : b.street - view * .18;
}

export function worldPoint(b: Building, p: FloorPoint): Point {
  return { x: p.x, y: (b.offsets[p.floor] ?? 0) + p.y - FLOOR_ART[p.floor].top };
}

const spot = (floor: FloorId, x: number, y: number, aisle: number): Spot => ({ floor, x, y, aisle });

/** The ground floor's walkway between the counter and the tables. */
const GROUND_AISLE = 622;
/** The basement's walkway runs in front of the dough table. */
const BASEMENT_AISLE = 786;
/** Where each floor's back and front walkways meet, by the stairs (and left of the dough table downstairs). */
const HUB_X: Record<FloorId, number> = { roof: 1330, 'floor-3': 1330, 'floor-2': 1330, ground: 1350, basement: 425 };
/** Each floor's staircase up: its foot, its top, and the open floor next to its foot. */
const STAIRS: Partial<Record<FloorId, { foot: Point; top: Point; landing: Spot }>> = {
  ground: { foot: { x: 1486, y: 748 }, top: { x: 1418, y: 78 }, landing: spot('ground', 1350, GROUND_AISLE, GROUND_AISLE) },
  'floor-2': { foot: { x: 1480, y: 748 }, top: { x: 1418, y: 78 }, landing: spot('floor-2', 1330, 700, 700) },
  'floor-3': { foot: { x: 1480, y: 748 }, top: { x: 1418, y: 78 }, landing: spot('floor-3', 1330, 700, 700) },
};
/** A floor's staircase up, for those who plan their own way (the cats, floors-cat-places.ts). */
export const stairsOf = (floor: FloorId) => STAIRS[floor];

/**
 * The front step, on the street just below the ground floor's front edge, between the two front
 * tables: guests walk in from the street here and leave the same way.
 */
export const DOOR = spot('ground', 836, 935, GROUND_AISLE);
/** Today's menu on its board, on the street by the right-hand door: its foot below street level, and its size. */
export const BOARD = { x: 1546, y: 134, w: 210, h: 244 } as const;
/** The middle of the blank hanging sign on the ground floor's front wall (pixels of build/frame/wall-ground.webp), and the cup on it. */
export const SHOP_SIGN = { x: 583, y: 286, cup: 92 } as const;
/** Six places in line, the head nearest the till; the tail reaches towards the window seat. */
export const QUEUE: Spot[] = [[612, 606], [510, 608], [408, 610], [318, 614], [246, 598], [186, 584]]
  .map(([x, y]) => spot('ground', x, y, GROUND_AISLE));
/** Behind the counter: the owner in the middle, then the hired baristas, a head's width apart. */
export const BARISTAS: FloorPoint[] = [[770, 470], [1015, 462], [640, 470], [893, 466]].map(([x, y]) => ({ floor: 'ground', x, y }));
/** Where a guest orders from each barista. */
export const SERVICE: Spot[] = BARISTAS.map(b => spot('ground', b.x, 566, GROUND_AISLE));
/**
 * Where finished table orders wait for a server, and where idle servers stand: spread about the
 * floor either side of the way in, then along the cake display, clear of the furniture spots.
 */
export const PASS = spot('ground', 1085, 600, GROUND_AISLE);
export const SERVER_HOMES: Spot[] = [[916, 716], [762, 716], [1036, 680], [1256, 668], [1150, 662], [650, 690]]
  .map(([x, y]) => spot('ground', x, y, GROUND_AISLE));
/** The counter, the cake display and what stands on them hide the staff from the waist down. */
export const COUNTER_FRONT: FloorPoint = { floor: 'ground', x: 0, y: 525 };
export const STEAM: FloorPoint = { floor: 'ground', x: 1190, y: 196 };
export const DISPLAY = { floor: 'ground' as const, left: 1095, right: 1320, top: 315, bottom: 515 };

/** A seat: where a seated guest's feet go and which way they face, towards their table. */
export interface Seat extends Spot { faceLeft: boolean }
const seat = (floor: FloorId, x: number, y: number, faceLeft: boolean, aisle: number): Seat => ({ floor, x, y, faceLeft, aisle });
const GROUND_TABLES = [
  [seat('ground', 446, 812, false, GROUND_AISLE), seat('ground', 700, 815, true, GROUND_AISLE)],
  [seat('ground', 1001, 812, false, GROUND_AISLE), seat('ground', 1244, 815, true, GROUND_AISLE)],
];
/** The two back tables are reached from behind the front one, the front table from in front of it. */
const upperTables = (floor: FloorId) => [
  [seat(floor, 448, 578, false, 630), seat(floor, 628, 581, true, 630)],
  [seat(floor, 1016, 578, false, 630), seat(floor, 1204, 581, true, 630)],
  [seat(floor, 706, 795, false, 875), seat(floor, 930, 798, true, 875)],
];
/** Every table in the building, in the order the café opens them. */
const TABLES: Seat[][] = [...GROUND_TABLES, ...upperTables('floor-2'), ...upperTables('floor-3')];
export const TABLE_SLOTS = TABLES.length;

/** Where the café's next table goes: the middle of its two seats, or null once the building is full. */
export function nextTableSpot(tables: number): FloorPoint | null {
  const pair = TABLES[tables];
  return pair ? { floor: pair[0].floor, x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 } : null;
}

/**
 * The seats of the café's table with this index. Tables keep their index in the save; the
 * building gives each one a place in the order the café has them (`active`, as from
 * activeTableIndices), so the first two are downstairs. Any beyond the building's eight share
 * places from the start.
 */
export function tableSeats(table: number, active: readonly number[]): readonly [Seat, Seat] {
  const slot = Math.max(0, active.indexOf(table));
  return TABLES[slot % TABLE_SLOTS] as [Seat, Seat];
}

/** Basement spots: the baker's oven and the cook's dough table, each with room for a second cook. */
const OVEN = spot('basement', 385, 682, BASEMENT_AISLE);
const DOUGH = spot('basement', 690, 612, 612);
export const LIFT = spot('basement', 1015, 650, BASEMENT_AISLE);
export const LIFT_HATCH: FloorPoint = { floor: 'basement', x: 1015, y: 382 };
export const LIFT_TOP: FloorPoint = { floor: 'basement', x: 1015, y: 70 };
export const OVEN_MOUTH: FloorPoint = { floor: 'basement', x: 362, y: 362 };
/** The dough table hides whoever works behind it from the waist down. */
export const TABLE_FRONT: FloorPoint = { floor: 'basement', x: 0, y: 746 };
export type KitchenPlace = 'oven' | 'dough' | 'cold' | 'dry' | 'lift';
const KITCHEN: Record<KitchenPlace, Spot> = {
  oven: OVEN, dough: DOUGH, lift: LIFT,
  cold: spot('basement', 1280, 720, BASEMENT_AISLE), dry: spot('basement', 220, 760, BASEMENT_AISLE),
};
/** Which part of the basement each of the Sim's kitchen stations is. */
export function kitchenPlace(station: string): KitchenPlace {
  if (['deckOven', 'convection', 'fryer', 'kettle'].includes(station)) return 'oven';
  if (['mixer', 'standMixer', 'proofer', 'bench', 'sheeter'].includes(station)) return 'dough';
  if (['cooler', 'pastryFridge'].includes(station)) return 'cold';
  if (station === 'dryStore') return 'dry';
  return 'lift';
}
/** Where the second and third cook at a place stand, from the first: one each side of them, or along the open floor. */
const COOK_SHIFT: Record<KitchenPlace, readonly [number, number, number]> = {
  oven: [0, 112, -112], dough: [0, 118, -118], lift: [0, 112, -112], cold: [0, -112, 112], dry: [0, 112, 224],
};
/** Cook `i` at a place: up to three cooks work side by side. */
export function kitchenSpot(place: KitchenPlace, i: number): Spot {
  const at = KITCHEN[place];
  return { ...at, x: at.x + COOK_SHIFT[place][i % 3] };
}
/** Where each cook waits for the next batch: the baker by the oven, the next cook at the dough table, the third by the food lift. */
const COOK_HOMES: readonly KitchenPlace[] = ['oven', 'dough', 'lift'];
export const cookHome = (i: number): Spot => kitchenSpot(COOK_HOMES[i % 3], Math.floor(i / 3));

/** The walk across one floor: out to the walkway, along it (via the hub when walkways differ), and in. */
function across(floor: FloorId, from: Point, fromAisle: number, to: Point, toAisle: number): Step[] {
  const points: Point[] = [{ x: from.x, y: fromAisle }];
  if (fromAisle !== toAisle) points.push({ x: HUB_X[floor], y: fromAisle }, { x: HUB_X[floor], y: toAisle });
  points.push({ x: to.x, y: toAisle }, to);
  const steps: Step[] = [];
  let last = from;
  for (const p of points) {
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1) continue;
    steps.push({ floor, x: p.x, y: p.y });
    last = p;
  }
  return steps;
}

/**
 * The steps from where someone stands (on the walkway `aisle` of their floor) to a spot, taking
 * the stairs when it is on another floor: up a flight to its top, on at the foot of the next
 * flight; down from a foot to the top of the flight below, then down it.
 */
export function route(from: FloorPoint, fromAisle: number, to: Spot & { fadeOut?: boolean }): Step[] {
  const end = (steps: Step[]) => {
    if (to.fadeOut && steps.length) steps[steps.length - 1].fadeOut = true;
    return steps;
  };
  const a = LEVELS.indexOf(from.floor), b = LEVELS.indexOf(to.floor);
  if (a === b) return end(across(from.floor, from, fromAisle, to, to.aisle));
  const steps: Step[] = [];
  let at: Point = from, aisle = fromAisle;
  for (let level = a; level !== b; level += b > a ? 1 : -1) {
    const floor = LEVELS[level];
    if (b > a) {
      const flight = STAIRS[floor]!;
      steps.push(...across(floor, at, aisle, flight.landing, flight.landing.aisle), { floor, ...flight.foot }, { floor, ...flight.top });
      const next = LEVELS[level + 1];
      const arrival = STAIRS[next]?.foot ?? flight.top;
      steps.push({ floor: next, ...arrival, jump: true });
      at = arrival;
      aisle = STAIRS[next]?.landing.aisle ?? arrival.y;
      if (STAIRS[next]) { steps.push(STAIRS[next]!.landing); at = STAIRS[next]!.landing; }
    } else {
      const here = STAIRS[floor]!, below = LEVELS[level - 1], flight = STAIRS[below]!;
      steps.push(...across(floor, at, aisle, here.landing, here.landing.aisle), { floor, ...here.foot });
      steps.push({ floor: below, ...flight.top, jump: true }, { floor: below, ...flight.foot }, flight.landing);
      at = flight.landing;
      aisle = flight.landing.aisle;
    }
  }
  return end([...steps, ...across(to.floor, at, aisle, to, to.aisle)]);
}

// ------------------------------------------------------------ pace

/** View pixels a person walks per second of play, and how many times faster they go at most to keep up with the Sim. */
export const WALK = 240, CATCH_UP = 3;
/** Someone the Sim has at their spot already still takes this long to come to a stop there, in seconds. */
const SETTLE = 1;

/** How far is left to walk along the steps; appearing at the far end of a flight takes no walking. */
export function stepsLength(from: Point, steps: readonly Step[]): number {
  let length = 0, at = from;
  for (const step of steps) {
    if (!step.jump) length += Math.hypot(step.x - at.x, step.y - at.y);
    at = step;
  }
  return length;
}

/**
 * How many times the walking speed someone goes with `left` pixels to walk, when the Sim has them
 * there in `seconds`: the building's stairs make its walks longer than the Sim's, so they set out
 * fast enough to arrive with it, as far as that still looks like walking.
 */
export const walkPace = (left: number, seconds: number): number =>
  Math.min(CATCH_UP, Math.max(1, left / (WALK * Math.max(SETTLE, seconds))));

// ------------------------------------------------------------ furniture

/**
 * Where each of the building's furniture spots (game/building-spots.ts) is on its floor's plate.
 * A floor piece stands with its foot at x, y and may be `room` wide; a wall piece hangs in `box`.
 * Floor spots keep off seats, the folded doors and the way in, and stand behind the paths people and cats take
 * along the front edge; wall boxes keep under the awning and over the staff's heads.
 */
export interface FurnitureSpot extends BuildingSpot {
  floor: Exclude<FloorId, 'basement'>;
  x: number;
  y: number;
  room: number;
  box?: { x: number; y: number; w: number; h: number };
}
type Where = [x: number, y: number, room: number] | { x: number; y: number; w: number; h: number };
const SEATING_SPOTS: Record<string, Where> = {
  'front-1': [156, 864, 190], 'front-2': [346, 866, 188], 'front-3': [540, 868, 190],
  'front-4': [1110, 866, 190], 'front-5': [1480, 866, 190], window: [230, 690, 200],
  'wall-1': { x: 548, y: 244, w: 124, h: 112 }, 'wall-2': { x: 910, y: 262, w: 114, h: 108 }, 'wall-3': { x: 326, y: 236, w: 78, h: 150 },
};
const SPOTS: Partial<Record<FloorId, Record<string, Where>>> = {
  ground: {
    left: [272, 872, 168], right: [1402, 874, 164],
    'wall-1': { x: 590, y: 108, w: 166, h: 100 }, 'wall-2': { x: 770, y: 108, w: 180, h: 100 },
  },
  'floor-2': SEATING_SPOTS,
  'floor-3': SEATING_SPOTS,
  roof: {
    'front-1': [425, 885, 190], 'front-2': [615, 887, 180], 'front-3': [1005, 885, 200], back: [775, 566, 150],
    'wall-1': { x: 392, y: 256, w: 200, h: 108 }, 'wall-2': { x: 738, y: 250, w: 112, h: 108 },
  },
};
export const FURNITURE_SPOTS: readonly FurnitureSpot[] = BUILDING_SPOTS.map(spot => {
  const where = SPOTS[spot.storey]![spot.id.slice(spot.storey.length + 1)];
  return Array.isArray(where)
    ? { ...spot, floor: spot.storey, x: where[0], y: where[1], room: where[2] }
    : { ...spot, floor: spot.storey, x: where.x + where.w / 2, y: where.y + where.h / 2, room: where.w, box: where };
});
const SPOT_BY_ID = new Map(FURNITURE_SPOTS.map(spot => [spot.id, spot]));
export const furnitureSpot = (id: string | undefined): FurnitureSpot | undefined => (id === undefined ? undefined : SPOT_BY_ID.get(id));
