// Where the cross-section building (assets/generated/art-direction-v1) puts the café's tables,
// counter, kitchen and staff, and how people walk between them. The game's Sim keeps its own floor
// plan; the floors view (floors-scene.ts) reads who is doing what from it and walks each person
// here to the matching spot, taking the stairs between floors.
//
// Points are pixels of their floor's plate (assets/generated/floor-sample-v1/kits/angle-plate-*),
// with the floor they are on; `worldPoint` stacks them into one tall scene.

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

/**
 * The floors a café has: the ground floor seats its first two tables, a floor above opens for
 * tables three to five and another for six to eight; the basement kitchen comes with the kitchen.
 */
export function building(tables: number, kitchen: boolean): Building {
  const floors: FloorId[] = ['roof'];
  if (tables > 5) floors.push('floor-3');
  if (tables > 2) floors.push('floor-2');
  floors.push('ground');
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

/**
 * The front step, on the street just below the ground floor's front edge, between the two front
 * tables: guests walk in from the street here and leave the same way.
 */
export const DOOR = spot('ground', 836, 935, GROUND_AISLE);
/** Six places in line, the head nearest the till; the tail reaches towards the window seat. */
export const QUEUE: Spot[] = [[612, 606], [510, 608], [408, 610], [318, 614], [246, 598], [186, 584]]
  .map(([x, y]) => spot('ground', x, y, GROUND_AISLE));
/** Behind the counter: the owner in the middle, then the hired baristas. */
export const BARISTAS: FloorPoint[] = [[800, 470], [1010, 462], [640, 470]].map(([x, y]) => ({ floor: 'ground', x, y }));
/** Where a guest orders from each barista. */
export const SERVICE: Spot[] = BARISTAS.map(b => spot('ground', b.x, 566, GROUND_AISLE));
/** Where finished table orders wait for a server, and where idle servers stand. */
export const PASS = spot('ground', 1085, 600, GROUND_AISLE);
export const SERVER_HOMES: Spot[] = [[1180, 640], [1250, 668], [1110, 668], [1310, 640], [1180, 700]]
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
/** Cook `i` at a place: a second cook works beside the first. */
export function kitchenSpot(place: KitchenPlace, i: number): Spot {
  const at = KITCHEN[place], shift = place === 'dough' ? 115 : place === 'oven' ? 95 : 70;
  return { ...at, x: at.x + (i % 2) * shift };
}
/** Where each cook waits for the next batch: the baker by the oven, the next cook at the dough table. */
export const cookHome = (i: number): Spot => kitchenSpot(i % 2 === 0 ? 'oven' : 'dough', Math.floor(i / 2));

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

// ------------------------------------------------------------ furniture

/**
 * Where furniture goes in the building. The game keeps its own furniture grid (game/furniture.ts)
 * and its rules; this building shows floor pieces at a few open spots, each tied to one cell of
 * that grid, and wall pieces on the ground floor's back wall either side of the space above the
 * counter, where the game's two free stretches of wall map (the build clears the fixed decor there).
 */
export interface FurnitureSpot {
  /** The grid column the piece is centred on and the row its front edge is in. */
  col: number;
  row: number;
  floor: FloorId;
  /** Where the piece stands on its floor's plate, and how wide it may be there. */
  x: number;
  y: number;
  room: number;
}
export const FURNITURE_SPOTS: readonly FurnitureSpot[] = [
  { col: 3, row: 17, floor: 'ground', x: 160, y: 868, room: 230 },
  { col: 8, row: 17, floor: 'ground', x: 845, y: 872, room: 130 },
  { col: 13, row: 17, floor: 'ground', x: 1468, y: 872, room: 230 },
  { col: 26, row: 17, floor: 'floor-2', x: 180, y: 862, room: 250 },
  { col: 31, row: 17, floor: 'floor-2', x: 470, y: 868, room: 270 },
  { col: 36, row: 17, floor: 'floor-2', x: 1250, y: 868, room: 380 },
];
/** The cell (top-left of the footprint) a piece `w` by `h` cells takes at a spot. */
export const spotCell = (spot: FurnitureSpot, w: number, h: number) => ({ col: spot.col - Math.floor(w / 2), row: spot.row - h + 1 });
/** The spot a placed piece stands at, if its cell is one of theirs. */
export function spotOf(col: number, row: number, w: number, h: number): FurnitureSpot | undefined {
  return FURNITURE_SPOTS.find(spot => { const cell = spotCell(spot, w, h); return cell.col === col && cell.row === row; });
}

const WALL_ZONES = [{ game: [72, 112], plate: [520, 760] }, { game: [216, 248], plate: [770, 962] }];
const GAME_WALL = [6, 46], WALL_PLATE = [60, 300];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A rectangle of the main café's wall (game pixels) on the ground floor's back wall, or null off the free stretches. */
export function gameWallRectToPlate(r: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } | null {
  const zone = WALL_ZONES.find(z => r.x >= z.game[0] - .5 && r.x + r.w <= z.game[1] + .5);
  if (!zone) return null;
  const sx = (zone.plate[1] - zone.plate[0]) / (zone.game[1] - zone.game[0]), sy = (WALL_PLATE[1] - WALL_PLATE[0]) / (GAME_WALL[1] - GAME_WALL[0]);
  return { x: zone.plate[0] + (r.x - zone.game[0]) * sx, y: WALL_PLATE[0] + (r.y - GAME_WALL[0]) * sy, w: r.w * sx, h: r.h * sy };
}

/** The game wall point under a point of the ground floor's plate, or null off the free stretches. */
export function plateToGameWall(p: Point): Point | null {
  if (p.y < WALL_PLATE[0] || p.y > WALL_PLATE[1]) return null;
  const zone = WALL_ZONES.find(z => p.x >= z.plate[0] && p.x <= z.plate[1]);
  if (!zone) return null;
  return {
    x: lerp(zone.game[0], zone.game[1], (p.x - zone.plate[0]) / (zone.plate[1] - zone.plate[0])),
    y: lerp(GAME_WALL[0], GAME_WALL[1], (p.y - WALL_PLATE[0]) / (WALL_PLATE[1] - WALL_PLATE[0])),
  };
}
