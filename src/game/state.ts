import { parsePromotion, type Promotion } from './promotion';
import {
  INGREDIENTS,
  MENU,
  SPEEDS,
  UPGRADES,
  type IngredientId,
  type ItemId,
  type Speed,
  type UpgradeId,
} from './data';
import { DECOR, DECOR_SLOTS, STARTER_THEMES, decorDef, type DecorSlot } from './decor';
import { bakeMorning, bulkCost, dayNeeds, fillBakePlan } from './economy';
import { DEFAULT_ART_SPOT, STARTER_FURNITURE, evictBlocked, furnitureDef, type Placed } from './furniture';
import { REGIONS, mainTableCount, type RegionId } from './regions';

import { parsePets, type Pet } from './pets';
import { parseTaste, type TasteState } from './taste';
import { emptyReviews, parseReputation, parseReviews, type Reputation, type ReviewSummary } from './reputation';

export const SAVE_KEY = 'tiny-bean-cafe/save';
export const SAVE_VERSION = 12;

export interface Look {
  skin: number;
  hair: number;
  hairStyle: number;
  shirt: number;
  pants: number;
}

export const LOOK_RANGES: Record<keyof Look, number> = { skin: 4, hair: 6, hairStyle: 4, shirt: 8, pants: 3 };

/** Who runs the café. Null until the player finishes the opening flow. */
export interface Profile {
  cafeName: string;
  ownerName: string;
  look: Look;
}

export interface DecorState {
  /** Room styles bought, and which one is in each slot. */
  owned: string[];
  equipped: Record<DecorSlot, string>;
  /** Furniture out in the café, and how many of each are in storage. */
  placed: Placed[];
  stored: Record<string, number>;
}

/** Running totals for the business day in progress, shown in the end-of-day report. */
export interface DayStats {
  reviews: ReviewSummary;
  served: number;
  /** Customers who left without buying: the line was too slow or their order was sold out. */
  missed: number;
  soldOut: number;
  queueLost: number;
  tableLost: number;
  extraLost: number;
  doorLost: number;
  shortages: Partial<Record<ItemId, number>>;
  revenue: number;
  /** What the ingredients used today cost when they were bought. */
  ingredientCost: number;
  /** Value of cat-care supplies consumed while open. */
  petCost: number;
  /** Prepaid promotion airtime delivered today. */
  promotionCost: number;
  sales: Partial<Record<ItemId, number>>;
  /** Breads and pastries baked this morning. */
  baked: Partial<Record<ItemId, number>>;
}

export const emptyDay = (): DayStats => ({
  reviews: emptyReviews(),
  served: 0,
  missed: 0,
  soldOut: 0,
  queueLost: 0, tableLost: 0, extraLost: 0, doorLost: 0, shortages: {},
  revenue: 0,
  ingredientCost: 0,
  petCost: 0,
  promotionCost: 0,
  sales: {},
  baked: {},
});

/** Preparation, open service, or closed doors while accepted orders finish. */
export type Phase = 'prep' | 'open' | 'closing';

export interface GameState {
  promotion: Promotion | null;
  pets: Pet[];
  reputation: Reputation;
  taste: TasteState;
  version: number;
  coins: number;
  totalEarned: number;
  served: number;
  items: Record<ItemId, number>;
  upgrades: Record<UpgradeId, number>;
  /** Connected rooms opened in order, in addition to the original café. */
  regions: RegionId[];
  /** Whether the kitchen has been built, where cooks bake fresh batches during the day. */
  kitchen: boolean;
  profile: Profile | null;
  decor: DecorState;
  /** Index of the next guided goal to complete. */
  goal: number;
  phase: Phase;
  /** The day being planned or run, starting at 1. */
  day: number;
  /** Seconds the shop has been open today (game time, so faster at 2× and 4×). */
  dayTime: number;
  speed: Speed;
  /** Unlocked items the player chose to sell today, in menu order. */
  onMenu: ItemId[];
  pantry: Record<IngredientId, number>;
  /** How many of each bread and pastry to bake when the shop opens. */
  bakePlan: Partial<Record<ItemId, number>>;
  /** Today's baked goods still on the shelf; whatever is left at closing goes stale. */
  shelf: Partial<Record<ItemId, number>>;
  today: DayStats;
  inProduction: Partial<Record<ItemId, number>>;
  createdAt: number;
}

export const NAME_MAX = 20;

function defaultDecor(): DecorState {
  const owned = DECOR.filter((d) => d.cost === 0).map((d) => d.id);
  const equipped = { ...STARTER_THEMES[0].equip } as Record<DecorSlot, string>;
  for (const slot of DECOR_SLOTS) equipped[slot] ??= DECOR.find((d) => d.slot === slot && d.cost === 0)!.id;
  return { owned, equipped, placed: STARTER_FURNITURE.map((p) => ({ ...p })), stored: {} };
}

export function createInitialState(now: number): GameState {
  const items = Object.fromEntries(MENU.map((m) => [m.id, 0])) as Record<ItemId, number>;
  items.espresso = 1;
  const upgrades = Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>;
  const pantry = Object.fromEntries(INGREDIENTS.map((i) => [i.id, 0])) as Record<IngredientId, number>;
  // Enough beans for the first day.
  pantry.beans = STARTER_BEANS;
  return {
    version: SAVE_VERSION,
    pets: [],
    promotion: null,
    reputation: { recent: [] },
    taste: { served: {}, signature: [] },
    coins: 0,
    totalEarned: 0,
    served: 0,
    items,
    upgrades,
    regions: [],
    kitchen: false,
    profile: null,
    decor: defaultDecor(),
    goal: 0,
    phase: 'prep',
    day: 1,
    dayTime: 0,
    speed: 1,
    onMenu: ['espresso'],
    pantry,
    bakePlan: {},
    shelf: {},
    today: emptyDay(),
    inProduction: {},
    createdAt: now,
  };
}

export const STARTER_BEANS = 50;

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

function num(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;
}

const int = (value: unknown, max: number) => Math.min(max - 1, Math.max(0, Math.floor(num(value, 0))));

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? [...value.trim()].slice(0, NAME_MAX).join('') : '';
}

function parseProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  const cafeName = cleanName(p.cafeName);
  if (!cafeName) return null;
  const look = (p.look ?? {}) as Record<string, unknown>;
  return {
    cafeName,
    ownerName: cleanName(p.ownerName),
    look: Object.fromEntries(
      (Object.keys(LOOK_RANGES) as (keyof Look)[]).map((k) => [k, int(look[k], LOOK_RANGES[k])]),
    ) as unknown as Look,
  };
}

function parseDecor(value: unknown, base: DecorState): DecorState {
  if (!value || typeof value !== 'object') return base;
  const d = value as Record<string, unknown>;
  const owned = new Set(base.owned);
  if (Array.isArray(d.owned)) for (const id of d.owned) if (typeof id === 'string' && decorDef(id)) owned.add(id);
  const equipped = { ...base.equipped };
  const eq = (d.equipped ?? {}) as Record<string, unknown>;
  for (const slot of DECOR_SLOTS) {
    const id = eq[slot];
    if (typeof id === 'string' && owned.has(id) && decorDef(id)?.slot === slot) equipped[slot] = id;
  }
  let placed = base.placed;
  const stored: Record<string, number> = {};
  if (Array.isArray(d.placed)) {
    // Spots are checked against the tables once the whole save is read (see deserialize).
    placed = d.placed
      .filter((p): p is Placed => !!p && typeof p === 'object' && !!furnitureDef((p as Placed).id))
      .map((p) => ({ id: p.id, col: Math.floor(num(p.col, -1, -1)), row: Math.floor(num(p.row, -1, -1)) }));
    const st = (d.stored ?? {}) as Record<string, unknown>;
    for (const [id, n] of Object.entries(st)) {
      const count = Math.floor(num(n, 0));
      if (furnitureDef(id) && count > 0) stored[id] = count;
    }
  } else if (Array.isArray(d.owned)) {
    // Before v6, wall art and floor plants were slots. What was bought becomes furniture;
    // the painting that was up goes back on the wall.
    placed = base.placed.map((p) => ({ ...p }));
    for (const id of d.owned) {
      if (typeof id !== 'string' || !furnitureDef(id)) continue;
      if (eq.art === id) placed.push({ id, ...DEFAULT_ART_SPOT });
      else stored[id] = (stored[id] ?? 0) + 1;
    }
  }
  return { owned: [...owned], equipped, placed, stored };
}

/** Parses a save, falling back to defaults for anything missing or malformed. */
export function deserialize(raw: string | null, now: number): GameState {
  const base = createInitialState(now);
  if (!raw) return base;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== 'object') return base;

  const items = (data.items ?? {}) as Record<string, unknown>;
  for (const m of MENU) base.items[m.id] = Math.floor(num(items[m.id], base.items[m.id]));
  base.items.espresso = Math.max(1, base.items.espresso);

  const upgrades = (data.upgrades ?? {}) as Record<string, unknown>;
  for (const u of UPGRADES) {
    base.upgrades[u.id] = Math.min(u.max, Math.floor(num(upgrades[u.id], 0)));
  }
  if (Array.isArray(data.regions)) {
    for (const r of REGIONS) {
      if (!data.regions.includes(r.id)) break;
      base.regions.push(r.id);
    }
  }
  base.kitchen = data.kitchen === true;

  base.coins = num(data.coins, 0);
  base.totalEarned = num(data.totalEarned, base.coins);
  base.served = Math.floor(num(data.served, 0));
  base.createdAt = num(data.createdAt, now);
  base.profile = parseProfile(data.profile);
  base.decor = parseDecor(data.decor, base.decor);
  base.goal = Math.floor(num(data.goal, 0));

  base.day = Math.max(1, Math.floor(num(data.day, 1)));
  base.phase = data.phase === 'closing' ? 'closing' : data.phase === 'open' ? 'open' : 'prep';
  base.dayTime = base.phase !== 'prep' ? num(data.dayTime, 0) : 0;
  base.speed = SPEEDS.find((v) => v === data.speed) ?? 1;
  const pantry = (data.pantry ?? {}) as Record<string, unknown>;
  for (const i of INGREDIENTS) base.pantry[i.id] = Math.floor(num(pantry[i.id], base.pantry[i.id]));
  // v3 sold "flour & butter" as one ingredient and had strawberries instead of fresh fruit.
  const oldPastry = Math.floor(num(pantry.pastry, 0));
  base.pantry.flour += oldPastry;
  base.pantry.butter += oldPastry;
  base.pantry.fruit += Math.floor(num(pantry.berries, 0));
  const unlocked = MENU.filter((m) => base.items[m.id] > 0).map((m) => m.id);
  base.onMenu = Array.isArray(data.onMenu)
    ? unlocked.filter((id) => (data.onMenu as unknown[]).includes(id))
    : unlocked;
  base.today = parseDay(data.today);
  base.pets = parsePets(data.pets);
  base.promotion = parsePromotion(data.promotion);
  // Older saves only retain per-dish sales for the current day; carry that
  // evidence forward without inventing a split of the lifetime customer total.
  base.taste = parseTaste(data.taste, num(data.version, 1) < 10 ? base.today.sales : {});
  base.taste.signature = base.taste.signature.filter((id) => base.items[id] > 0);
  base.reputation = parseReputation(data.reputation);
  base.bakePlan = parseCounts(data.bakePlan);
  base.inProduction = base.phase === 'prep' ? {} : parseCounts(data.inProduction);
  // Suspended pre-kitchen stock survives saves and a later kitchen purchase.
  base.shelf = parseCounts(data.shelf);

  // v1 had a leveled "Cozy Decor" upgrade. It became the decor shop (refund
  // what was spent) and the Add Table upgrade (keep the tables it had built).
  const oldDecor = Math.floor(num(upgrades.decor, 0));
  if (num(data.version, 1) < 2 && oldDecor > 0) {
    base.coins += bulkCost(200, 2.2, 0, oldDecor);
    base.upgrades.tables = Math.max(base.upgrades.tables, [3, 6, 10].filter((l) => oldDecor >= l).length);
  }
  // The Shift Manager, who earned while the game was closed, has retired: what was
  // spent hiring them comes back. The upgrade isn't saved any more, so this happens once.
  const manager = Math.min(5, Math.floor(num(upgrades.manager, 0)));
  if (manager > 0) base.coins += bulkCost(500, 4, 0, manager);
  // Anything placed off the grid or in a table's way goes to storage.
  evictBlocked(base, mainTableCount(base));
  // Every bread and pastry on the menu gets a morning-bake amount. Before v5 nothing was
  // baked ahead, so a day in progress bakes its batch now.
  fillBakePlan(base);
  if (num(data.version, 1) < 5 && base.phase === 'open') bakeMorning(base);
  // Before v3 there were no days or ingredients: start the first day with a full pantry.
  if (num(data.version, 1) < 3) {
    for (const [id, n] of Object.entries(dayNeeds(base))) base.pantry[id as IngredientId] += n;
  }
  return base;
}

function parseCounts(value: unknown): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  if (!value || typeof value !== 'object') return out;
  const v = value as Record<string, unknown>;
  for (const m of MENU) {
    const n = Math.floor(num(v[m.id], -1));
    if (n >= 0) out[m.id] = n;
  }
  return out;
}

function parseDay(value: unknown): DayStats {
  const day = emptyDay();
  if (!value || typeof value !== 'object') return day;
  const d = value as Record<string, unknown>;
  day.reviews = parseReviews(d.reviews);
  day.served = Math.floor(num(d.served, 0));
  day.missed = Math.floor(num(d.missed, 0));
  day.soldOut = Math.floor(num(d.soldOut, 0));
  for (const key of ['queueLost', 'tableLost', 'extraLost', 'doorLost'] as const) day[key] = Math.floor(num(d[key], 0));
  day.shortages = parseCounts(d.shortages);
  day.revenue = num(d.revenue, 0);
  day.ingredientCost = num(d.ingredientCost, 0);
  day.petCost = num(d.petCost, 0);
  day.promotionCost = num(d.promotionCost, 0);
  const sales = (d.sales ?? {}) as Record<string, unknown>;
  for (const m of MENU) {
    const n = Math.floor(num(sales[m.id], 0));
    if (n > 0) day.sales[m.id] = n;
  }
  day.baked = parseCounts(d.baked);
  return day;
}
