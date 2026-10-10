// The kitchen: a back-of-house room off the main café's left side, where cooks bake
// fresh batches of breads and pastries while the shop is open.
//
// It's laid out so a batch flows one way, from left to right, and ends at the door
// to the café:
//   storage (cold room, dry store, ingredient bins) → prep (dough mixer, proofer,
//   the bench with its sheeter and stand mixer) → the hot line under the hood
//   (bagel kettle, deck oven, convection oven, fryer) → out (the cooling rack, the
//   pastry fridge where cakes set, and the door to the pastry case).
// The hand sink sits between storage and prep, and the dish pit is by the door,
// where dirty plates come back in, away from the food.
import { COOK_BATCH, type IngredientId, type ItemId } from './data';
import { isBakery, menuItems, recipe, servingCost, servingsLeft, unlockedItems } from './economy';
import { FLOOR_Y, areaOrigin, floorY, passageY } from './layout';
import type { GameState } from './state';

export const KITCHEN_COST = 800;
export const MAX_COOKS = 3;
/** Cooks start another batch of anything on the menu with this many or fewer left on the shelf. */
export const RESTOCK_AT = 3;

export type KitchenBlock = 'owned' | 'open' | 'coins' | null;
export function kitchenBlock(state: GameState): KitchenBlock {
  if (state.kitchen) return 'owned';
  if (state.phase !== 'prep') return 'open';
  if (state.coins < KITCHEN_COST) return 'coins';
  return null;
}

/** Builds the kitchen, which comes with its first cook. */
export function unlockKitchen(state: GameState): boolean {
  if (kitchenBlock(state)) return false;
  state.coins -= KITCHEN_COST;
  state.kitchen = true;
  return true;
}

// ---------------------------------------------------------------- equipment

/** Equipment a cook works at, in the order a batch might visit it. */
export type Station =
  | 'cooler'
  | 'dryStore'
  | 'mixer'
  | 'proofer'
  | 'bench'
  | 'sheeter'
  | 'standMixer'
  | 'kettle'
  | 'deckOven'
  | 'convection'
  | 'fryer'
  | 'pastryFridge'
  | 'rack'
  | 'door';

/** Everything in the kitchen, including the fixtures nobody works at. */
export type Equipment = Exclude<Station, 'door'> | 'handSink' | 'dishPit';

/** Fitted in every kitchen; the rest arrives with the dishes that need it. */
export const BASE_EQUIPMENT: readonly Equipment[] = ['cooler', 'dryStore', 'handSink', 'bench', 'rack', 'dishPit'];

/** Against the back wall, left to right: where each piece stands. */
export const WALL_EQUIPMENT: Partial<Record<Equipment, { x: number; w: number }>> = {
  cooler: { x: 6, w: 34 },
  dryStore: { x: 44, w: 36 },
  handSink: { x: 84, w: 16 },
  mixer: { x: 104, w: 24 },
  proofer: { x: 132, w: 24 },
  kettle: { x: 160, w: 26 },
  deckOven: { x: 190, w: 56 },
  convection: { x: 250, w: 28 },
  fryer: { x: 282, w: 26 },
};
/** The exhaust hood over the hot line. */
export const HOOD = { x: 158, w: 152 };
/** The prep bench in the middle of the floor; the sheeter and stand mixer sit on it. */
export const BENCH = { x: 88, w: 104, front: 134, height: 14, depth: 12 };
export const SHEETER_X = 92;
export const STAND_MIXER_X = 170;
/** The speed rack where finished trays cool, beside the door. */
export const RACK = { x: 270, w: 22, foot: 118 };
export const PASTRY_FRIDGE = { x: 294, w: 20, foot: 118 };
/** Rolling bins of flour and sugar, at the front of the storage end. */
export const BINS = { x: 14, w: 40, foot: 172 };
export const DISH_PIT = { x: 232, w: 64, foot: 168 };

export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * Where a cook stands at a piece of equipment, and which way they face: `dy` from
 * the front edge (`foot`, at the minimum height) of what they're working at, so
 * they stay at it as the floor stretches on taller screens.
 */
interface Spot {
  x: number;
  foot: number;
  dy: number;
  facing: Facing;
}
// The back wall doesn't move as the floor stretches, so neither does anyone working at it.
const atWall = (x: number): Spot => ({ x, foot: FLOOR_Y, dy: 14, facing: 'up' });
// Behind the bench, facing into the room, with the worktop at their waist.
const atBench = (x: number): Spot => ({ x, foot: BENCH.front, dy: -BENCH.depth - 6, facing: 'down' });

const STATION_SPOTS: Record<Exclude<Station, 'door'>, Spot> = {
  cooler: atWall(23),
  dryStore: atWall(62),
  mixer: atWall(116),
  proofer: atWall(144),
  kettle: atWall(173),
  deckOven: atWall(218),
  convection: atWall(264),
  fryer: atWall(295),
  bench: atBench(132),
  sheeter: atBench(SHEETER_X + 10),
  standMixer: atBench(STAND_MIXER_X + 6),
  rack: { x: RACK.x - 10, foot: RACK.foot, dy: -2, facing: 'right' },
  pastryFridge: { x: PASTRY_FRIDGE.x + PASTRY_FRIDGE.w / 2, foot: PASTRY_FRIDGE.foot, dy: 10, facing: 'up' },
};
/** Where idle cooks wait: at the bench, washing up, and at the other end of the bench. */
const HOMES: readonly Spot[] = [
  atBench(150),
  { x: DISH_PIT.x + 30, foot: DISH_PIT.foot, dy: 10, facing: 'up' },
  atBench(110),
];

/** A spot in the kitchen at the current height, in building coordinates. */
function place(spot: Spot) {
  const o = areaOrigin('kitchen');
  return { x: o.x + spot.x, y: o.y + floorY(spot.foot) + spot.dy, facing: spot.facing };
}
/** Just inside the door to the café, wherever the shared doorway is. */
function doorSpot() {
  const o = areaOrigin('kitchen');
  return { x: o.x + 302, y: o.y + passageY(), facing: 'right' as Facing };
}
export const stationSpot = (station: Station) => (station === 'door' ? doorSpot() : place(STATION_SPOTS[station]));
export const cookHome = (i: number) => place(HOMES[i % HOMES.length]);

/** Seconds a cook spends at each station. */
export const STATION_SECONDS: Record<Station, number> = {
  cooler: 1,
  dryStore: 1,
  mixer: 3,
  proofer: 3,
  bench: 3,
  sheeter: 3,
  standMixer: 3,
  kettle: 2,
  deckOven: 6,
  convection: 5,
  fryer: 3,
  pastryFridge: 3,
  rack: 1.5,
  door: 0.6,
};

/** How each bread and pastry is made, after its ingredients are fetched. */
const METHODS: Partial<Record<ItemId, readonly Station[]>> = {
  roll: ['mixer', 'deckOven'],
  bagel: ['mixer', 'kettle', 'deckOven'],
  baguette: ['mixer', 'deckOven'],
  pretzel: ['mixer', 'kettle', 'deckOven'],
  focaccia: ['mixer', 'deckOven'],
  ciabatta: ['mixer', 'deckOven'],
  sourdough: ['mixer', 'deckOven'],
  rye: ['mixer', 'deckOven'],
  shokupan: ['mixer', 'proofer', 'deckOven'],
  brioche: ['mixer', 'proofer', 'deckOven'],
  garlicbread: ['mixer', 'deckOven'],
  donut: ['bench', 'proofer', 'fryer'],
  scone: ['bench', 'convection'],
  croissant: ['sheeter', 'proofer', 'convection'],
  painchoc: ['sheeter', 'proofer', 'convection'],
  cinnamon: ['bench', 'proofer', 'convection'],
  muffin: ['standMixer', 'convection'],
  melonpan: ['mixer', 'proofer', 'convection'],
  eggtart: ['bench', 'convection'],
  cake: ['standMixer', 'convection'],
  cheesecake: ['standMixer', 'convection'],
  macaron: ['standMixer', 'convection'],
};

const CHILLED: readonly IngredientId[] = ['milk', 'butter', 'eggs', 'cream', 'fruit'];
/** Bakes that set in the pastry fridge after cooling. */
const SET_IN_FRIDGE: readonly ItemId[] = ['cake', 'cheesecake'];

/**
 * Every stop a batch makes: ingredients from the cold room if anything in it is
 * kept cold (otherwise the dry store), the dish's own method, the rack to cool,
 * the pastry fridge for cakes, and out through the door.
 */
export function batchSteps(item: ItemId): Station[] {
  const chilled = recipe(item).some(([ing]) => CHILLED.includes(ing));
  const set: Station[] = SET_IN_FRIDGE.includes(item) ? ['pastryFridge'] : [];
  return [chilled ? 'cooler' : 'dryStore', ...(METHODS[item] ?? ['bench']), 'rack', ...set, 'door'];
}

/** Which part of the kitchen a station is in; a batch only ever moves forward through them. */
export const ZONES: Record<Station, number> = {
  cooler: 0, dryStore: 0,
  mixer: 1, proofer: 1, bench: 1, sheeter: 1, standMixer: 1,
  kettle: 2, deckOven: 2, convection: 2, fryer: 2,
  rack: 3, pastryFridge: 3, door: 3,
};

/** The equipment this café's unlocked dishes call for, plus the basics. */
export function installedEquipment(state: GameState): Set<Equipment> {
  const set = new Set<Equipment>(BASE_EQUIPMENT);
  for (const m of unlockedItems(state)) {
    if (!isBakery(m.id)) continue;
    for (const s of batchSteps(m.id)) if (s !== 'door') set.add(s);
  }
  return set;
}

// ---------------------------------------------------------------- batches

/**
 * What a free cook should bake next, if anything: the bread or pastry on today's
 * menu that's lowest on the shelf, once it's down to RESTOCK_AT. Nothing that
 * another cook is already making, or that the pantry can't stretch to.
 */
export function nextBatch(state: GameState, baking: readonly ItemId[]): { item: ItemId; n: number } | null {
  if (state.phase !== 'open') return null;
  let best: { item: ItemId; n: number; left: number } | null = null;
  for (const m of menuItems(state)) {
    if (!isBakery(m.id) || baking.includes(m.id)) continue;
    const left = state.shelf[m.id] ?? 0;
    if (left > RESTOCK_AT) continue;
    const n = Math.min(COOK_BATCH, servingsLeft(state, m.id));
    if (n >= 1 && (!best || left < best.left)) best = { item: m.id, n, left };
  }
  return best && { item: best.item, n: best.n };
}

/** A cook takes the ingredients for a batch out of the pantry. */
export function startBatch(state: GameState, item: ItemId, n: number): void {
  for (const [ing, k] of recipe(item)) state.pantry[ing] -= k * n;
  state.today.ingredientCost += servingCost(item) * n;
}

/** A finished batch goes into the pastry case. */
export function shelveBatch(state: GameState, item: ItemId, n: number): void {
  if (state.phase !== 'open') return;
  state.shelf[item] = (state.shelf[item] ?? 0) + n;
  state.today.baked[item] = (state.today.baked[item] ?? 0) + n;
}

// ---------------------------------------------------------------- getting around

/**
 * The points a cook walks through to get from `from` to `to` without cutting
 * through the bench: the back of the kitchen (the wall stations, behind the bench,
 * the rack and the door) is one open aisle, and the front (pastry fridge and dish
 * pit) is reached down either end of the bench.
 */
export function kitchenPath(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const o = areaOrigin('kitchen');
  const front = (p: { y: number }) => p.y - o.y > floorY(145);
  if (front(from) === front(to)) {
    // Down the back aisle to the door, round the end of the bench rather than over its corner.
    if (!crossesBench(from, to)) return [to];
    const right = Math.max(from.x, to.x) - o.x > BENCH.x + BENCH.w;
    return [{ x: o.x + (right ? BENCH.x + BENCH.w + 6 : BENCH.x - 6), y: o.y + floorY(112) }, to];
  }
  const local = (from.x + to.x) / 2 - o.x;
  // Down the left end of the bench, or between its right end and the dish pit.
  const x = o.x + (local < BENCH.x + BENCH.w / 2 ? 66 : 212);
  const back = { x, y: o.y + floorY(108) };
  const ahead = { x, y: o.y + floorY(182) };
  return front(from) ? [ahead, back, to] : [back, ahead, to];
}

/** Whether walking straight from `a` to `b` would go through the bench. */
function crossesBench(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const o = areaOrigin('kitchen');
  const x0 = o.x + BENCH.x;
  const y1 = o.y + floorY(BENCH.front);
  const y0 = y1 - BENCH.depth;
  for (let k = 0; k <= 24; k++) {
    const x = a.x + ((b.x - a.x) * k) / 24;
    const y = a.y + ((b.y - a.y) * k) / 24;
    if (x > x0 && x < x0 + BENCH.w && y > y0 && y < y1) return true;
  }
  return false;
}
