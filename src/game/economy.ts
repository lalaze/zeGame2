import {
  BAKE_STEP,
  BASE_ARRIVAL_RATE,
  COMBO_CHANCE,
  MAX_VARIETY_BONUS,
  VARIETY_BONUS,
  isDrink,
  DAY_SECONDS,
  INGREDIENTS,
  RECIPES,
  ITEM_COST_GROWTH,
  MENU,
  PRICE_MILESTONES,
  SERVICE_OVERHEAD,
  UPGRADES,
  VIP_CHANCE,
  VIP_MULTIPLIER,
  type IngredientDef,
  type IngredientId,
  type ItemId,
  type MenuItemDef,
  type UpgradeDef,
  type UpgradeId,
} from './data';
import { comfort } from './decor';
import type { DayStats, GameState } from './state';

export type BuyAmount = 1 | 10 | 'max';

const MENU_BY_ID = Object.fromEntries(MENU.map((m) => [m.id, m])) as Record<ItemId, MenuItemDef>;
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

export const menuItem = (id: ItemId) => MENU_BY_ID[id];
export const upgradeDef = (id: UpgradeId) => UPGRADE_BY_ID[id];

export function milestoneMultiplier(level: number): number {
  let mult = 1;
  for (const m of PRICE_MILESTONES) if (level >= m) mult *= 2;
  return mult;
}

export function nextMilestone(level: number): number | null {
  return PRICE_MILESTONES.find((m) => m > level) ?? null;
}

export function itemPrice(def: MenuItemDef, level: number): number {
  return level <= 0 ? 0 : def.basePrice * level * milestoneMultiplier(level);
}

/** Total cost of `n` purchases of something priced base * growth^level. */
export function bulkCost(base: number, growth: number, level: number, n: number): number {
  if (n <= 0) return 0;
  return (base * growth ** level * (growth ** n - 1)) / (growth - 1);
}

/** Largest n (<= cap) such that bulkCost(..., n) <= coins. */
export function maxAffordable(base: number, growth: number, level: number, coins: number, cap = Infinity): number {
  const first = base * growth ** level;
  if (coins < first || cap <= 0) return 0;
  let n = Math.floor(Math.log((coins * (growth - 1)) / first + 1) / Math.log(growth));
  n = Math.max(0, Math.min(n, cap));
  // Guard against floating point rounding at the boundary.
  while (n > 0 && bulkCost(base, growth, level, n) > coins) n--;
  return n;
}

export interface Quote {
  count: number;
  cost: number;
  affordable: boolean;
}

function quote(base: number, growth: number, level: number, coins: number, amount: BuyAmount, cap: number): Quote {
  if (cap <= 0) return { count: 0, cost: 0, affordable: false };
  if (amount === 'max') {
    const n = maxAffordable(base, growth, level, coins, cap);
    const count = Math.max(1, n);
    const cost = bulkCost(base, growth, level, count);
    return { count, cost, affordable: n > 0 };
  }
  const count = Math.min(amount, cap);
  const cost = bulkCost(base, growth, level, count);
  return { count, cost, affordable: cost <= coins };
}

export function quoteItem(state: GameState, id: ItemId, amount: BuyAmount): Quote {
  const def = menuItem(id);
  return quote(def.baseCost, ITEM_COST_GROWTH, state.items[id], state.coins, amount, Infinity);
}

export function quoteUpgrade(state: GameState, id: UpgradeId, amount: BuyAmount): Quote {
  const def = upgradeDef(id);
  const level = state.upgrades[id];
  return quote(def.baseCost, def.growth, level, state.coins, amount, def.max - level);
}

/** The item unlocked just before this one in its category, if any. */
export function previousInCategory(id: ItemId): MenuItemDef | null {
  const def = menuItem(id);
  const chain = MENU.filter((m) => m.category === def.category);
  return chain[chain.indexOf(def) - 1] ?? null;
}

/** Each category unlocks in order; only its first locked item can be bought. */
export function isItemAvailable(state: GameState, id: ItemId): boolean {
  const prev = previousInCategory(id);
  return !prev || state.items[prev.id] > 0;
}

export function buyItem(state: GameState, id: ItemId, amount: BuyAmount): boolean {
  if (!isItemAvailable(state, id)) return false;
  const q = quoteItem(state, id, amount);
  if (!q.affordable) return false;
  const unlocking = state.items[id] === 0;
  state.coins -= q.cost;
  state.items[id] += q.count;
  // A newly unlocked dish goes straight onto the menu.
  if (unlocking) setOnMenu(state, id, true);
  return true;
}

export function buyUpgrade(state: GameState, id: UpgradeId, amount: BuyAmount): boolean {
  const q = quoteUpgrade(state, id, amount);
  if (!q.affordable || q.count <= 0) return false;
  state.coins -= q.cost;
  state.upgrades[id] += q.count;
  return true;
}

export function unlockedItems(state: GameState): MenuItemDef[] {
  return MENU.filter((m) => state.items[m.id] > 0);
}

export const baristaCount = (s: GameState) => 1 + s.upgrades.barista;
export const prepMultiplier = (s: GameState) => 0.9 ** s.upgrades.machine;
/** Extra customers drawn by a varied menu, as a share (0.12 = +12%). */
export const varietyBonus = (s: GameState) =>
  Math.min(MAX_VARIETY_BONUS, VARIETY_BONUS * Math.max(0, menuItems(s).length - 1));
export const arrivalRate = (s: GameState) =>
  BASE_ARRIVAL_RATE * (1 + 0.2 * s.upgrades.marketing) * (1 + 0.1 * s.upgrades.tables) * (1 + varietyBonus(s));
export const tipMultiplier = (s: GameState) => 1 + comfort(s) / 100;
export const tableCount = (s: GameState) => 1 + s.upgrades.tables;
export const patienceSeconds = (s: GameState) => 40 + comfort(s) / 5;

export function salePrice(state: GameState, id: ItemId, vip = false): number {
  return itemPrice(menuItem(id), state.items[id]) * tipMultiplier(state) * (vip ? VIP_MULTIPLIER : 1);
}

export function prepTime(state: GameState, id: ItemId): number {
  return menuItem(id).prepTime * prepMultiplier(state);
}

/** Today's menu: unlocked items the player chose to sell. */
export function menuItems(state: GameState): MenuItemDef[] {
  return MENU.filter((m) => state.items[m.id] > 0 && state.onMenu.includes(m.id));
}

export function setOnMenu(state: GameState, id: ItemId, on: boolean): void {
  const set = new Set(state.onMenu);
  if (on && state.items[id] > 0) set.add(id);
  else set.delete(id);
  state.onMenu = MENU.filter((m) => set.has(m.id)).map((m) => m.id);
  fillBakePlan(state);
}

/** Breads and pastries are baked in the morning; drinks are made to order. */
export const isBakery = (id: ItemId) => !isDrink(menuItem(id).category);

/**
 * How many of each dish an average customer buys. Everyone picks one dish from the
 * menu at random; some also add a bakery item to a drink (or a drink to a bakery item).
 */
export function orderShares(items: readonly MenuItemDef[]): Map<ItemId, number> {
  const shares = new Map<ItemId, number>();
  if (items.length === 0) return shares;
  const drinks = items.filter((m) => isDrink(m.category));
  const bakery = items.filter((m) => !isDrink(m.category));
  const n = items.length;
  for (const m of items) {
    const others = isDrink(m.category) ? bakery : drinks;
    const mine = isDrink(m.category) ? drinks : bakery;
    // Picked as the main order, plus picked as the extra for someone else's main.
    const asExtra = others.length > 0 ? (COMBO_CHANCE * others.length) / n / mine.length : 0;
    shares.set(m.id, 1 / n + asExtra);
  }
  return shares;
}

/** Today's menu, or every unlocked dish if nothing is on it (for estimates while planning). */
const estimateItems = (state: GameState) => {
  const onMenu = menuItems(state);
  return onMenu.length > 0 ? onMenu : unlockedItems(state);
};

/** Customers per second the staff can actually serve. */
export function serviceCapacity(state: GameState, items = menuItems(state)): number {
  if (items.length === 0) return 0;
  let prep = 0;
  for (const [id, share] of orderShares(items)) prep += share * prepTime(state, id);
  return baristaCount(state) / (prep + SERVICE_OVERHEAD);
}

const VIP_BOOST = 1 + VIP_CHANCE * (VIP_MULTIPLIER - 1);

/** Expected steady-state income, used for the HUD and for away earnings. */
export function incomePerSecond(state: GameState): number {
  const items = estimateItems(state);
  if (items.length === 0) return 0;
  let perCustomer = 0;
  for (const [id, share] of orderShares(items)) perCustomer += share * salePrice(state, id);
  return Math.min(arrivalRate(state), serviceCapacity(state, items)) * perCustomer * VIP_BOOST;
}

export const awayCapSeconds = (s: GameState) => (4 + 2 * s.upgrades.manager) * 3600;
export const awayEfficiency = (s: GameState) => Math.min(1, 0.25 + 0.15 * s.upgrades.manager);

export interface AwayReport {
  seconds: number;
  countedSeconds: number;
  earned: number;
}

/**
 * While the game is closed, the Shift Manager runs about one business day per real
 * hour (a real day is only a few minutes long, so paying for every second away would
 * be worth far more than playing).
 */
export const AWAY_DAYS_PER_HOUR = 1;

/** Expected profit of one full day on today's menu: sales minus ingredient costs. */
export function dayProfit(state: GameState): number {
  const items = estimateItems(state);
  if (items.length === 0) return 0;
  let perCustomer = 0;
  for (const [id, share] of orderShares(items)) perCustomer += share * (salePrice(state, id) * VIP_BOOST - servingCost(id));
  const customers = Math.min(arrivalRate(state), serviceCapacity(state, items)) * DAY_SECONDS;
  return Math.max(0, customers * perCustomer);
}

export function awayEarnings(state: GameState, elapsedSeconds: number): AwayReport {
  const seconds = Math.max(0, elapsedSeconds);
  const countedSeconds = Math.min(seconds, awayCapSeconds(state));
  const days = (countedSeconds / 3600) * AWAY_DAYS_PER_HOUR;
  const earned = dayProfit(state) * awayEfficiency(state) * days;
  return { seconds, countedSeconds, earned };
}

export function earn(state: GameState, amount: number): void {
  state.coins += amount;
  state.totalEarned += amount;
}

// ---------------------------------------------------------------- pantry

const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])) as Record<IngredientId, IngredientDef>;
export const ingredientDef = (id: IngredientId) => INGREDIENT_BY_ID[id];

export const recipe = (id: ItemId) => Object.entries(RECIPES[id]) as [IngredientId, number][];

/** What one serving's ingredients cost. */
export const servingCost = (id: ItemId) => recipe(id).reduce((sum, [ing, n]) => sum + ingredientDef(ing).cost * n, 0);

/** How many servings the pantry's ingredients can make (or bake) of an item. */
export function servingsLeft(state: GameState, id: ItemId): number {
  return Math.min(...recipe(id).map(([ing, n]) => Math.floor(state.pantry[ing] / n)));
}

/**
 * Servings ready to sell today: for breads and pastries, what's on the shelf (or,
 * before opening, what the morning bake will make); for drinks, what the pantry allows.
 */
export function readyServings(state: GameState, id: ItemId): number {
  if (!isBakery(id)) return servingsLeft(state, id);
  if (state.phase === 'open') return state.shelf[id] ?? 0;
  return Math.min(state.bakePlan[id] ?? 0, servingsLeft(state, id));
}

/**
 * Sells one serving: a bread or pastry comes off the shelf (its ingredients were
 * used at the morning bake); a drink uses its ingredients now. Returns false if none left.
 */
export function consumeServing(state: GameState, id: ItemId, today?: DayStats): boolean {
  if (isBakery(id) && state.phase === 'open') {
    if ((state.shelf[id] ?? 0) < 1) return false;
    state.shelf[id]!--;
    return true;
  }
  if (servingsLeft(state, id) < 1) return false;
  for (const [ing, n] of recipe(id)) state.pantry[ing] -= n;
  if (today) today.ingredientCost += servingCost(id);
  return true;
}

// ---------------------------------------------------------------- the morning bake

/** A bake amount that should cover a normal day's sales of an item, in BAKE_STEP steps. */
export function suggestedBake(state: GameState, id: ItemId): number {
  const demand = dayDemand(state).get(id) ?? 0;
  return Math.max(BAKE_STEP, Math.ceil(demand / BAKE_STEP) * BAKE_STEP);
}

/** Gives every bread and pastry on the menu a bake amount if it doesn't have one yet. */
export function fillBakePlan(state: GameState): void {
  for (const m of menuItems(state)) {
    if (isBakery(m.id) && state.bakePlan[m.id] === undefined) state.bakePlan[m.id] = suggestedBake(state, m.id);
  }
}

export function setBakePlan(state: GameState, id: ItemId, n: number): void {
  state.bakePlan[id] = Math.max(0, Math.min(9_999, Math.round(n)));
}

/** Sets every bread and pastry on the menu to bake what a normal day sells. */
export function bakeForForecast(state: GameState): void {
  for (const m of menuItems(state)) if (isBakery(m.id)) state.bakePlan[m.id] = suggestedBake(state, m.id);
}

/**
 * Bakes the morning batch from the pantry onto the shelf, as much of each planned
 * amount as the ingredients allow. Returns how many items were baked in all.
 */
export function bakeMorning(state: GameState): number {
  state.shelf = {};
  let total = 0;
  for (const m of menuItems(state)) {
    if (!isBakery(m.id)) continue;
    const n = Math.min(state.bakePlan[m.id] ?? 0, servingsLeft(state, m.id));
    for (const [ing, k] of recipe(m.id)) state.pantry[ing] -= k * n;
    state.shelf[m.id] = n;
    state.today.baked[m.id] = n;
    state.today.ingredientCost += servingCost(m.id) * n;
    total += n;
  }
  return total;
}

/** Ingredients that any unlocked dish needs; the pantry only lists these. */
export function neededIngredients(state: GameState): IngredientDef[] {
  const used = new Set(unlockedItems(state).flatMap((m) => recipe(m.id).map(([ing]) => ing)));
  return INGREDIENTS.filter((i) => used.has(i.id));
}

/** Dishes (unlocked) that use an ingredient. */
export const usedBy = (state: GameState, ing: IngredientId) =>
  unlockedItems(state).filter((m) => RECIPES[m.id][ing]);

export function buyIngredient(state: GameState, id: IngredientId, count: number): boolean {
  const cost = ingredientDef(id).cost * count;
  if (count <= 0 || cost > state.coins) return false;
  state.coins -= cost;
  state.pantry[id] += count;
  return true;
}

/** About how many customers a full day brings: the slower of arrivals and service. */
export function expectedCustomers(state: GameState): number {
  const items = menuItems(state);
  if (items.length === 0) return 0;
  return Math.ceil(Math.min(arrivalRate(state), serviceCapacity(state, items)) * DAY_SECONDS);
}

/** Servings of each dish a full day on today's menu sells, roughly. */
export function dayDemand(state: GameState): Map<ItemId, number> {
  const customers = expectedCustomers(state);
  const demand = new Map<ItemId, number>();
  for (const [id, share] of orderShares(menuItems(state))) demand.set(id, customers * share);
  return demand;
}

/** Ingredients a full day on today's menu uses, with a little to spare. */
export function dayNeeds(state: GameState): Partial<Record<IngredientId, number>> {
  const needs: Partial<Record<IngredientId, number>> = {};
  for (const [id, servings] of dayDemand(state)) {
    // Breads and pastries need exactly the planned morning bake; drinks a bit of spare.
    const amount = isBakery(id) ? (state.bakePlan[id] ?? 0) : servings * 1.15;
    for (const [ing, n] of recipe(id)) needs[ing] = (needs[ing] ?? 0) + amount * n;
  }
  for (const k of Object.keys(needs) as IngredientId[]) needs[k] = Math.ceil(needs[k]!);
  return needs;
}

/** What it takes to top the pantry up to one day's needs. */
export function restockQuote(state: GameState): { buy: Partial<Record<IngredientId, number>>; cost: number } {
  const buy: Partial<Record<IngredientId, number>> = {};
  let cost = 0;
  for (const [ing, need] of Object.entries(dayNeeds(state)) as [IngredientId, number][]) {
    const n = Math.max(0, need - state.pantry[ing]);
    if (n === 0) continue;
    buy[ing] = n;
    cost += n * ingredientDef(ing).cost;
  }
  return { buy, cost };
}

/** Tops up the pantry for a day; if money is short, every shortfall is filled by the same share. */
export function restock(state: GameState): boolean {
  const q = restockQuote(state);
  if (q.cost <= 0 || state.coins <= 0) return false;
  const share = Math.min(1, state.coins / q.cost);
  let bought = false;
  for (const [ing, n] of Object.entries(q.buy) as [IngredientId, number][]) {
    const count = Math.floor(n * share);
    if (count > 0 && buyIngredient(state, ing, count)) bought = true;
  }
  return bought;
}

/** Menu dishes the pantry can't make a single serving of. */
export const soldOutItems = (state: GameState) => menuItems(state).filter((m) => servingsLeft(state, m.id) < 1);
