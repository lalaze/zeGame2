// Each business day has a condition: the weather, or now and then something happening
// in the neighbourhood. It follows from the café (its creation time) and the day
// number, so it is known a day ahead, never changes on reload and needs no save field.
// The forecast, the suggested bake, the kitchen and the simulation all read the same
// values below. A fair day changes nothing at all.
import { MENU, isDrink, type ItemId } from './data';
import { itemFlavors, type Flavor } from './flavors';
import { signatureDefinition } from './signature-drinks';
import type { GameState } from './state';

export type ConditionId = 'fair' | 'rain' | 'hot' | 'crisp' | 'market' | 'quiet';
/** What a day can call for: a flavor note, an iced drink, or bread and pastries. */
export type ConditionTaste = Flavor | 'iced' | 'bakery';

export interface ConditionDef {
  id: ConditionId;
  /** How often it comes up, out of the weights' total. */
  chance: number;
  /** Dishes guests pick more often today, and less often. */
  favored: readonly ConditionTaste[];
  less: readonly ConditionTaste[];
  /** Arrivals, as a multiplier. */
  traffic: number;
  /** Extra arrivals while today's menu has at least one dish the day calls for. */
  matchBonus: number;
  /** Extra seconds guests wait, in line and at a table. */
  patience: number;
  /** Multiplier on the chance a guest stays at a table rather than taking away. */
  seating: number;
}

export const CONDITIONS: readonly ConditionDef[] = [
  { id: 'fair', chance: 40, favored: [], less: [], traffic: 1, matchBonus: 0, patience: 0, seating: 1 },
  // Guests come in out of the rain for something warm, and stay a while.
  { id: 'rain', chance: 15, favored: ['tea', 'cocoa', 'milky'], less: ['iced'], traffic: 1, matchBonus: 0.1, patience: 0, seating: 1.2 },
  { id: 'hot', chance: 12, favored: ['iced', 'fruity'], less: ['cocoa', 'spiced'], traffic: 1, matchBonus: 0.1, patience: 0, seating: 1 },
  { id: 'crisp', chance: 13, favored: ['spiced', 'toasty'], less: ['iced'], traffic: 1, matchBonus: 0.1, patience: 0, seating: 1 },
  // A bigger crowd on the way to the stalls: mostly takeaway, and keen on bakes.
  { id: 'market', chance: 10, favored: ['bakery'], less: [], traffic: 1.2, matchBonus: 0, patience: 0, seating: 0.6 },
  // Fewer guests, in no hurry at all.
  { id: 'quiet', chance: 10, favored: [], less: [], traffic: 0.85, matchBonus: 0, patience: 15, seating: 1.3 },
];
const BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c])) as Record<ConditionId, ConditionDef>;
export const conditionDef = (id: ConditionId) => BY_ID[id];

/** The first days stay fair while a new owner learns the ropes. */
export const FIRST_CONDITION_DAY = 3;
/** How much more (or less) often a guest picks a dish the day favors (or doesn't). */
export const FAVORED_WEIGHT = 1.6;
export const LESS_WEIGHT = 0.6;
/** Served cold. Custom recipes are always made warm. */
const ICED: ReadonlySet<ItemId> = new Set<ItemId>(['coldbrew', 'frappe', 'smoothie', 'affogato', 'matchafloat']);

/** A stable number in [0, 1) for a café and a day. */
function roll(seed: number, day: number): number {
  let h = (Math.floor(Math.abs(Number.isFinite(seed) ? seed : 0)) % 4294967296) ^ Math.imul(day, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawn(seed: number, day: number): ConditionId {
  if (!Number.isInteger(day) || day < FIRST_CONDITION_DAY) return 'fair';
  const total = CONDITIONS.reduce((sum, c) => sum + c.chance, 0);
  let left = roll(seed, day) * total;
  return (CONDITIONS.find((c) => (left -= c.chance) < 0) ?? CONDITIONS[0]).id;
}

/** The condition of a given day at this café. The same one never lasts three days running. */
export function conditionOn(state: Pick<GameState, 'createdAt'>, day: number): ConditionId {
  const id = drawn(state.createdAt, day);
  return id !== 'fair' && drawn(state.createdAt, day - 1) === id && drawn(state.createdAt, day - 2) === id ? 'fair' : id;
}

/** The day being planned or run. After closing, that is already tomorrow. */
export const todayCondition = (state: Pick<GameState, 'createdAt' | 'day'>): ConditionDef => BY_ID[conditionOn(state, state.day)];

function tastes(id: ItemId): ReadonlySet<ConditionTaste> {
  const def = MENU.find((m) => m.id === id) ?? signatureDefinition(id);
  const out = new Set<ConditionTaste>(itemFlavors(id));
  if (ICED.has(id)) out.add('iced');
  if (def && !isDrink(def.category)) out.add('bakery');
  return out;
}

/** Whether today calls for this dish, or rather not. An iced frappé is still iced on a rainy day, milky or not. */
export function dishMood(state: Pick<GameState, 'createdAt' | 'day'>, id: ItemId): 'favored' | 'less' | null {
  const condition = todayCondition(state), own = tastes(id);
  if (condition.less.some((taste) => own.has(taste))) return 'less';
  if (condition.favored.some((taste) => own.has(taste))) return 'favored';
  return null;
}

/**
 * How likely guests are to pick each dish, relative to one another. Null when today
 * favors nothing on this menu, so callers keep the exact even pick.
 */
export function menuWeights(state: Pick<GameState, 'createdAt' | 'day'>, items: readonly { id: ItemId }[]): number[] | null {
  if (!todayCondition(state).favored.length && !todayCondition(state).less.length) return null;
  const weights = items.map(({ id }) => {
    const mood = dishMood(state, id);
    return mood === 'favored' ? FAVORED_WEIGHT : mood === 'less' ? LESS_WEIGHT : 1;
  });
  return weights.every((w) => w === weights[0]) ? null : weights;
}

/** The index a single random draw in [0, 1) picks, in proportion to `weights`. */
export function weightedIndex(weights: readonly number[], r: number): number {
  let left = r * weights.reduce((sum, w) => sum + w, 0);
  const index = weights.findIndex((w) => (left -= w) < 0);
  return index < 0 ? weights.length - 1 : index;
}

/** Arrivals today: the day's crowd, plus a little extra for a menu that suits it. */
export function conditionTraffic(state: Pick<GameState, 'createdAt' | 'day'>, items: readonly { id: ItemId }[]): number {
  const condition = todayCondition(state);
  const matched = condition.matchBonus > 0 && items.some(({ id }) => dishMood(state, id) === 'favored');
  return condition.traffic * (matched ? 1 + condition.matchBonus : 1);
}

export const conditionPatience = (state: Pick<GameState, 'createdAt' | 'day'>) => todayCondition(state).patience;
export const conditionSeating = (state: Pick<GameState, 'createdAt' | 'day'>) => todayCondition(state).seating;
