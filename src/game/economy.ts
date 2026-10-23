import { signatureDefinition, setSignatureOnMenu, availableSignatureIngredients, isPlainSignatureCopy } from './signature-drinks';
import { partnerBrewMultiplier } from './partners';
import { stylePrepMultiplier, styleSaleMultiplier, styleOrderPairs, styleComboChance, styleArrivalMultiplier, styleSeatChance, styleTablePatienceExtra } from './styles';
import { promotionTraffic } from './promotion';
import { petTraffic, forecastPetTraffic } from './pets';
import { conditionPatience, conditionSeating, conditionTraffic } from './conditions';
import { demandPlan, demandEnabled, guestComboChance, guestPairWeights, guestSeatingMultiplier, type GuestKind, type MainChoice } from './customer-demand';
import { queueSpot, serviceSpot, roomRoute, tableArea } from './layout';
import {
  BASE_ARRIVAL_RATE,
  MAX_VARIETY_BONUS,
  VARIETY_BONUS,
  isDrink,
  DAY_SECONDS,
  INGREDIENTS,
  RECIPES,
  ITEM_COST_GROWTH,
  LEVEL_COST_MULTIPLIER,
  MENU,
  PASS_SLOTS,
  PRICE_MILESTONES,
  CUSTOMER_WALK_SPEED,
  UPGRADES,
  VIP_MULTIPLIER,
  type IngredientDef,
  type IngredientId,
  type ItemId,
  type MenuItemDef,
  type UpgradeDef,
  type UpgradeId,
} from './data';
import { comfort } from './decor';
import { activeTableIndices, regionDemand } from './regions';
import type { DayStats, GameState } from './state';
import { bakeryPlan, nextBatch } from './kitchen';
import { reputationTraffic } from './reputation';

export type BuyAmount = 1 | 10 | 'max';

const MENU_BY_ID = Object.fromEntries(MENU.map((m) => [m.id, m])) as Record<ItemId, MenuItemDef>;
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

export const menuItem = (id: ItemId): MenuItemDef => MENU_BY_ID[id] ?? signatureDefinition(id)!;
// These ice-cream desserts need the kitchen despite their drinks-menu placement.
export const requiresKitchen = (id: ItemId) => id === 'affogato' || id === 'matchafloat' || !isDrink(menuItem(id).category);
export const canPrepareItem = (state: GameState, id: ItemId) => !requiresKitchen(id) || state.kitchen || id === 'roll' && state.cafeStyle.bakeryTrialDay === state.day;

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
  if (level <= 0) return 0;
  const next = nextMilestone(level);
  const previous = [...PRICE_MILESTONES].reverse().find((m) => m <= level) ?? 1;
  const progress = next ? (level - previous) / (next - previous) : 0;
  return def.basePrice * level * milestoneMultiplier(level) * (1 + 0.8 * progress);
}

/** Total cost of `n` purchases of something priced base * growth^level. */
export function bulkCost(base: number, growth: number, level: number, n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return base * growth ** level;
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

/** What `n` more levels of a dish cost from `level`: the unlock at its base cost, every level-up after it at LEVEL_COST_MULTIPLIER times that. */
export function itemLevelsCost(def: Pick<MenuItemDef, 'baseCost'>, level: number, n: number): number {
  if (n <= 0) return 0;
  const levelUp = def.baseCost * LEVEL_COST_MULTIPLIER;
  return level > 0 ? bulkCost(levelUp, ITEM_COST_GROWTH, level, n) : def.baseCost + bulkCost(levelUp, ITEM_COST_GROWTH, 1, n - 1);
}

function itemQuote(def: MenuItemDef, level: number, coins: number, amount: BuyAmount): Quote {
  const levelUp = def.baseCost * LEVEL_COST_MULTIPLIER;
  if (level > 0) return quote(levelUp, ITEM_COST_GROWTH, level, coins, amount, Infinity);
  // Unlocking first, then any further levels bought together with it.
  if (amount !== 'max') { const cost = itemLevelsCost(def, 0, amount); return { count: amount, cost, affordable: cost <= coins }; }
  if (coins < def.baseCost) return { count: 1, cost: def.baseCost, affordable: false };
  const more = maxAffordable(levelUp, ITEM_COST_GROWTH, 1, coins - def.baseCost);
  return { count: 1 + more, cost: itemLevelsCost(def, 0, 1 + more), affordable: true };
}

export function quoteItem(state: GameState, id: ItemId, amount: BuyAmount): Quote {
  const def = menuItem(id);
  if (id.startsWith('sig:')) return { count: 0, cost: 0, affordable: false };
  const q = itemQuote(def, state.items[id], state.coins, amount);
  return isItemAvailable(state, id) ? q : { ...q, affordable: false };
}

/** Cooks work in the kitchen, so there's no hiring them until it's built. */
export const upgradeLocked = (state: GameState, id: UpgradeId) => id === 'cook' && !state.kitchen;

/**
 * How far an upgrade can go right now. Servers are limited by the building: two hires to
 * begin with and one more per opened room, since every room sends them further.
 */
export function upgradeMax(state: GameState, id: UpgradeId): number {
  const def = upgradeDef(id);
  return id === 'server' ? Math.min(def.max, 2 + state.regions.length) : def.max;
}

/** Finished table orders the pass can hold before baristas have to keep hold of them. */
export const passCapacity = (state: GameState) => PASS_SLOTS * (1 + (state.upgrades.pass ?? 0));

export function quoteUpgrade(state: GameState, id: UpgradeId, amount: BuyAmount): Quote {
  const def = upgradeDef(id);
  const level = state.upgrades[id];
  const q = quote(def.baseCost, def.growth, level, state.coins, amount, upgradeMax(state, id) - level);
  return upgradeLocked(state, id) ? { ...q, affordable: false } : q;
}

/** The item unlocked just before this one in its category, if any. */
export function previousInCategory(id: ItemId): MenuItemDef | null {
  const def = menuItem(id);
  const chain = MENU.filter((m) => m.category === def.category);
  return chain[chain.findIndex((m) => m.id === id) - 1] ?? null;
}

/** Unlock after the preceding dish; owned dishes stay upgradeable as the menu grows. */
export function isItemAvailable(state: GameState, id: ItemId): boolean {
  if (id.startsWith('sig:')) return false;
  if (!canPrepareItem(state, id)) return false;
  const prev = previousInCategory(id);
  return state.items[id] > 0 || !prev || state.items[prev.id] > 0;
}

export function buyItem(state: GameState, id: ItemId, amount: BuyAmount): boolean {
  if (!isItemAvailable(state, id)) return false;
  const q = quoteItem(state, id, amount);
  if (!q.affordable) return false;
  state.coins -= q.cost;
  state.items[id] += q.count;
  // Unlocking expands the recipe book. The player chooses whether it belongs on
  // today's menu; buying a level must never silently dilute their existing offer.
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
  return [...MENU.filter((m) => state.items[m.id] > 0), ...state.signatureDrinks.recipes.map((r) => signatureDefinition(r.id)!).filter(Boolean)];
}

export const baristaCount = (s: GameState) => 1 + s.upgrades.barista;
/** Servers carry orders from the pass to the tables; the café opens with one. */
export const serverCount = (s: GameState) => 1 + s.upgrades.server;
/** The kitchen comes with one cook. */
export const cookCount = (s: GameState) => (s.kitchen ? 1 + s.upgrades.cook : 0);
export const prepMultiplier = (s: GameState) => 0.9 ** s.upgrades.machine;
/** Extra customers drawn by a varied menu, as a share (0.12 = +12%). */
export const varietyBonus = (s: GameState) =>
  Math.min(MAX_VARIETY_BONUS, VARIETY_BONUS * Math.max(0, menuItems(s).length - 1));
/** Menu-driven arrivals, independent of stock, staff, promotion and reputation. */
export const menuTrafficMultiplier = (s: GameState, items = menuItems(s)) => demandPlan(s, items).traffic;
export const baseArrivalRate = (s: GameState) =>
  BASE_ARRIVAL_RATE * (1 + 0.2 * s.upgrades.marketing) * (1 + 0.1 * s.upgrades.tables + regionDemand(s)) * menuTrafficMultiplier(s) * reputationTraffic(s.reputation) * petTraffic(s) * styleArrivalMultiplier(s) * conditionTraffic(s, menuItems(s));
export const arrivalRate = (s: GameState) => baseArrivalRate(s) * promotionTraffic(s);
export const tipMultiplier = (s: GameState) => 1 + comfort(s) / 100;
/** The café opens with a table in each nook; Expand the Shop adds the rest. */
export const tableCount = (s: GameState) => activeTableIndices(s).length;
export const patienceSeconds = (s: GameState) => 40 + comfort(s) / 5 + conditionPatience(s);
/** How long a seated guest waits for their order to be brought over before giving up. */
export const tablePatience = (s: GameState) => 50 + comfort(s) / 4 + styleTablePatienceExtra(s) + conditionPatience(s);

export function salePrice(state: GameState, id: ItemId, vip = false, dineIn = false, meal: readonly ItemId[] = [id]): number {
  if (!canPrepareItem(state, id)) return 0;
  return (id.startsWith('sig:') ? signaturePrice(state, id) : itemPrice(menuItem(id), state.items[id])) * tipMultiplier(state) * (vip ? VIP_MULTIPLIER : 1) * styleSaleMultiplier(state, id, dineIn, meal);
}

/** Added doses or ingredients earn a 25% house premium; a plain copy retains
 * its foundation's price. Neither can copy an unrelated late-game drink. */
export function signaturePrice(state: GameState, id: ItemId): number {
  const def = signatureDefinition(id)!;
  const foundation = menuItem(def.base === 'coffee' ? 'espresso' : 'blacktea');
  const established = state.items[foundation.id] > 0 ? itemPrice(foundation, state.items[foundation.id]) : def.basePrice / 1.25;
  if (isPlainSignatureCopy(def)) return established;
  const baseCost = ingredientDef(def.base === 'coffee' ? 'beans' : def.base === 'tea' ? 'tea' : def.base === 'milk' ? 'milk' : 'fruit').cost;
  return Math.max(def.basePrice, established * 1.25 + Math.max(0, def.cost - baseCost) * 1.6);
}

export function prepTime(state: GameState, id: ItemId): number {
  return menuItem(id).prepTime * prepMultiplier(state) * stylePrepMultiplier(state, id);
}

/**
 * Expected main-dish takeaway price, weighted by today's customer demand.
 * Locked dishes are priced as they would be at Lv1. Pairings are separate.
 */
export function averageDishPrice(state: GameState, items: readonly MenuItemDef[] = menuItems(state)): number {
  if (items.length === 0) return 0;
  const price = (m: MenuItemDef) => (m.id.startsWith('sig:') ? signaturePrice(state, m.id) : itemPrice(m, Math.max(1, state.items[m.id] ?? 0)))
    * tipMultiplier(state) * styleSaleMultiplier(state, m.id, false, [m.id]);
  return demandPlan(state, items).mains.reduce((sum, choice) => sum + price(choice.main) * choice.probability, 0);
}

/** Today's menu: unlocked items the player chose to sell. */
export function menuItems(state: GameState): MenuItemDef[] {
  return [...MENU.filter((m) => state.items[m.id] > 0 && canPrepareItem(state, m.id) && state.onMenu.includes(m.id)
    && !(m.id === 'roll' && !state.kitchen && state.phase !== 'prep' && (state.shelf.roll ?? 0) < 1)), ...state.signatureDrinks.recipes.filter((r) => r.onMenu).map((r) => signatureDefinition(r.id)!).filter(Boolean)];
}

export function setOnMenu(state: GameState, id: ItemId, on: boolean): void {
  if (id.startsWith('sig:')) { setSignatureOnMenu(state, id, on); return; }
  if (state.phase !== 'prep' || !canPrepareItem(state, id)) return;
  const set = new Set(state.onMenu);
  if (on && state.items[id] > 0) set.add(id);
  else set.delete(id);
  state.onMenu = MENU.filter((m) => set.has(m.id)).map((m) => m.id);
  fillBakePlan(state);
}

/** Breads and pastries are baked in the morning; drinks are made to order. */
export const isBakery = (id: ItemId) => !isDrink(menuItem(id).category);

export interface OrderChoice extends MainChoice {
  pairs: MenuItemDef[];
  pairWeights: number[];
  comboChance: number;
}

/** One model shared by arriving guests, ingredient forecasts and service capacity. */
export function orderChoices(items: readonly MenuItemDef[], state?: GameState): OrderChoice[] {
  const mains = state ? demandPlan(state, items).mains : items.map(main => ({ main, probability: 1 / items.length }));
  return mains.map((choice: MainChoice) => {
    const pairs = styleOrderPairs(state, choice.main, items);
    return { ...choice, pairs,
      pairWeights: state ? guestPairWeights(state, choice.kind, pairs) : pairs.map(() => 1),
      comboChance: pairs.length ? guestComboChance(choice.kind, styleComboChance(state, choice.main, pairs)) : 0,
    };
  });
}

export const orderSeatChance = (state: GameState, meal: readonly ItemId[], kind?: GuestKind) =>
  Math.min(1, styleSeatChance(state, meal) * conditionSeating(state) * guestSeatingMultiplier(kind));

/** Expected portions per arrival, including actual pairing preferences. */
export function orderShares(items: readonly MenuItemDef[], state?: GameState): Map<ItemId, number> {
  const shares = new Map<ItemId, number>(items.map(item => [item.id, 0]));
  for (const choice of orderChoices(items, state)) {
    shares.set(choice.main.id, shares.get(choice.main.id)! + choice.probability);
    const total = choice.pairWeights.reduce((sum, w) => sum + w, 0);
    choice.pairs.forEach((extra, i) => shares.set(extra.id, shares.get(extra.id)! + choice.probability * choice.comboChance * choice.pairWeights[i] / total));
  }
  return shares;
}

/** Customers per second the baristas can take orders from and serve at the counter. */
export function counterCapacity(state: GameState, items = menuItems(state)): number {
  if (items.length === 0) return 0;
  const shares = orderShares(items, state), front = queueSpot(0);
  let capacity = 0;
  for (let index = 0; index < baristaCount(state); index++) {
    const partner = index === 0 ? undefined : state.partners.active.barista[index - 1];
    let prep = 0;
    for (const [id, share] of shares) prep += share * prepTime(state, id) * partnerBrewMultiplier(state, partner, isBakery(id));
    const counter = serviceSpot(index);
    // A queued customer walks from the head of the line to this till. The old
    // fixed 1.2s overhead described an earlier floor plan and understocked drinks.
    const walk = Math.hypot(counter.x - front.x, counter.y - front.y) / CUSTOMER_WALK_SPEED;
    capacity += 1 / (prep + walk);
  }
  return capacity;
}

/**
 * A server's round trip from the pass, and how many plates it carries, by how far the
 * tables are (waypoints on the route from the main room). Measured in the simulation:
 * the main room, the Reading Room, the Glasshouse and the Garden patio.
 */
const SERVER_TRIPS: readonly [route: number, seconds: number, plates: number][] = [[0, 5.8, 1.96], [4, 14.7, 2.01], [9, 21.4, 2.43], [13, 29, 2.61]];
/** Share of guests who stay at a table when the floor keeps up, at the base seating chance. */
const DINE_IN_SHARE = 0.52, BASE_SEAT_CHANCE = 0.6;
/** A larger pass lets servers leave with fuller trays and baristas keep working through rushes. */
const PASS_FLOW = [1, 1.3, 1.7] as const;
/** Roughly how long a guest holds a seat: walking over, waiting for the order and eating it. */
const SEAT_SECONDS = 30;

function serverTrip(route: number): { seconds: number; plates: number } {
  const i = SERVER_TRIPS.findIndex(([r]) => r >= route);
  if (i <= 0) return { seconds: SERVER_TRIPS[i < 0 ? SERVER_TRIPS.length - 1 : 0][1], plates: SERVER_TRIPS[i < 0 ? SERVER_TRIPS.length - 1 : 0][2] };
  const [r0, s0, p0] = SERVER_TRIPS[i - 1], [r1, s1, p1] = SERVER_TRIPS[i], f = (route - r0) / (r1 - r0);
  return { seconds: s0 + (s1 - s0) * f, plates: p0 + (p1 - p0) * f };
}

/**
 * Customers per second the floor staff can keep up with: finished table orders leave the
 * pass only as fast as the servers carry them, and a full pass stops the baristas. Infinite
 * while the tables are too few for the servers to fall behind.
 */
export function tableServiceCapacity(state: GameState, items = menuItems(state)): number {
  const tables = activeTableIndices(state);
  if (items.length === 0 || tables.length === 0) return Infinity;
  const route = tables.reduce((sum, i) => sum + roomRoute('main', tableArea(i)).length, 0) / tables.length;
  const trip = serverTrip(route);
  const plates = serverCount(state) * trip.plates / trip.seconds * PASS_FLOW[Math.min(PASS_FLOW.length - 1, state.upgrades.pass ?? 0)];
  // Guests only dine in at free seats, so a small dining room can't outpace its servers.
  if (tables.length * 2 / SEAT_SECONDS <= plates) return Infinity;
  let seatChance: number;
  if (demandEnabled(state)) {
    seatChance = orderChoices(items, state).reduce((sum, choice) => {
      const pairTotal = choice.pairWeights.reduce((a, b) => a + b, 0);
      const paired = choice.pairs.reduce((part, extra, i) => part + orderSeatChance(state, [choice.main.id, extra.id], choice.kind) * choice.pairWeights[i] / pairTotal, 0);
      return sum + choice.probability * ((1 - choice.comboChance) * orderSeatChance(state, [choice.main.id], choice.kind) + choice.comboChance * paired);
    }, 0);
  } else seatChance = items.reduce((sum, m) => sum + styleSeatChance(state, [m.id]), 0) / items.length * conditionSeating(state);
  const dineIn = DINE_IN_SHARE * seatChance / BASE_SEAT_CHANCE;
  return dineIn > 0 ? plates / dineIn : Infinity;
}

/** Customers per second the staff can actually serve: the counter, or the floor if it falls behind. */
export function serviceCapacity(state: GameState, items = menuItems(state)): number {
  return Math.min(counterCapacity(state, items), tableServiceCapacity(state, items));
}

export function earn(state: GameState, amount: number): void {
  state.coins += amount;
  state.totalEarned += amount;
}

// ---------------------------------------------------------------- pantry

const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])) as Record<IngredientId, IngredientDef>;
export const ingredientDef = (id: IngredientId) => INGREDIENT_BY_ID[id];

export const recipe = (id: ItemId) => Object.entries(signatureDefinition(id)?.recipe ?? RECIPES[id as keyof typeof RECIPES]) as [IngredientId, number][];

/** What one serving's ingredients cost. */
export const servingCost = (id: ItemId) => recipe(id).reduce((sum, [ing, n]) => sum + ingredientDef(ing).cost * n, 0);

/** How many servings the pantry's ingredients can make (or bake) of an item. */
export function servingsLeft(state: GameState, id: ItemId): number {
  return Math.min(...recipe(id).map(([ing, n]) => Math.floor(state.pantry[ing] / n)));
}

/**
 * Servings ready to sell today: for breads and pastries, what's on the shelf (or,
 * before opening, what the morning bake will make); for drinks, what the pantry allows
 * after reserving that bake. Drink counts are individual capacities, not additive.
 */
export function readyServings(state: GameState, id: ItemId): number {
  if (!canPrepareItem(state, id)) return 0;
  if (state.phase !== 'prep') return isBakery(id) ? state.shelf[id] ?? 0 : servingsLeft(state, id);
  const projected = projectMorningBake(state);
  return isBakery(id) ? projected.shelf[id] ?? 0 : servingsLeft({ ...state, pantry: projected.pantry }, id);
}

/** Whether today's menu has sellable stock or bakery stock the kitchen can replenish. */
export function hasServiceSupply(state: GameState): boolean {
  const items = menuItems(state);
  if (items.some(({ id }) => readyServings(state, id) >= 1 || state.kitchen && isBakery(id) && (state.inProduction[id] ?? 0) >= 1)) return true;
  // Raw flour is no longer serviceable stock when a fresh batch cannot finish
  // before closing. A stocked bakery may resume from a sold-out closing state.
  return state.kitchen && nextBatch(state.phase === 'closing' ? { ...state, phase: 'open' } : state, []) !== null;
}

/**
 * Sells one serving: a bread or pastry comes off the shelf (its ingredients were
 * used at the morning bake); a drink uses its ingredients now. Returns false if none left.
 */
export function consumeServing(state: GameState, id: ItemId, today?: DayStats): boolean {
  if (!canPrepareItem(state, id) || (id.startsWith('sig:') ? !state.signatureDrinks.recipes.some((r) => r.id === id) : state.items[id] <= 0)) return false;
  if (isBakery(id) && state.phase !== 'prep') {
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

/** Exact forecast portions, or enough shelf stock to bridge kitchen replenishment. */
export function suggestedBake(state: GameState, id: ItemId): number {
  if (!canPrepareItem(state, id) || !isBakery(id)) return 0;
  const demand = dayDemand(state).get(id) ?? 0;
  if (!state.kitchen) return Math.ceil(demand);
  return bakeryPlan(state).get(id)?.morning ?? Math.ceil(demand);
}

/** Gives every bread and pastry on the menu a bake amount if it doesn't have one yet. */
export function fillBakePlan(state: GameState): void {
  for (const m of menuItems(state)) {
    if (isBakery(m.id) && state.bakePlan[m.id] === undefined) state.bakePlan[m.id] = suggestedBake(state, m.id);
  }
}

export function setBakePlan(state: GameState, id: ItemId, n: number): void {
  if (state.phase !== 'prep' || !canPrepareItem(state, id) || !isBakery(id) || state.items[id] <= 0 || !Number.isFinite(n)) return;
  state.bakePlan[id] = Math.max(0, Math.min(9_999, Math.round(n)));
}

/** Sets every bread and pastry on the menu to bake what a normal day sells. */
export function bakeForForecast(state: GameState): void {
  if (state.phase !== 'prep') return;
  for (const m of menuItems(state)) if (isBakery(m.id)) state.bakePlan[m.id] = suggestedBake(state, m.id);
}

/** Projects the real bake order against a shared pantry without changing the game. */
export function projectMorningBake(state: GameState): Pick<GameState, 'pantry' | 'shelf'> {
  const pantry = { ...state.pantry };
  // Preserve suspended legacy stock; it becomes usable only when the kitchen is built.
  const shelf: GameState['shelf'] = { ...state.shelf };
  for (const m of menuItems(state)) {
    if (!isBakery(m.id) || !state.kitchen) continue;
    const n = Math.min(state.bakePlan[m.id] ?? 0, servingsLeft({ ...state, pantry }, m.id));
    for (const [ing, k] of recipe(m.id)) pantry[ing] -= k * n;
    shelf[m.id] = (shelf[m.id] ?? 0) + n;
  }
  return { pantry, shelf };
}

/**
 * Bakes the morning batch from the pantry onto the shelf, as much of each planned
 * amount as the ingredients allow. Returns how many items were baked in all.
 */
export function bakeMorning(state: GameState): number {
  if (!state.kitchen) return 0;
  const previousShelf = state.shelf;
  const projected = projectMorningBake(state);
  Object.assign(state.pantry, projected.pantry);
  state.shelf = projected.shelf;
  let total = 0;
  for (const [id, stock] of Object.entries(state.shelf) as [ItemId, number][]) {
    const n = stock - (previousShelf[id] ?? 0);
    if (n <= 0) continue;
    state.today.baked[id] = (state.today.baked[id] ?? 0) + n;
    state.today.ingredientCost += servingCost(id) * n;
    total += n;
  }
  return total;
}

/** Ingredients that any unlocked dish needs; the pantry only lists these. */
export function neededIngredients(state: GameState): IngredientDef[] {
  const used = new Set(unlockedItems(state).filter((m) => canPrepareItem(state, m.id)).flatMap((m) => recipe(m.id).map(([ing]) => ing)));
  for (const ing of availableSignatureIngredients(state)) used.add(ing);
  return INGREDIENTS.filter((i) => used.has(i.id));
}

/** Dishes (unlocked) that use an ingredient. */
export const usedBy = (state: GameState, ing: IngredientId) =>
  unlockedItems(state).filter((m) => canPrepareItem(state, m.id) && recipe(m.id).some(([id]) => id === ing));

export function buyIngredient(state: GameState, id: IngredientId, count: number): boolean {
  if (!Number.isSafeInteger(count) || count <= 0) return false;
  const cost = ingredientDef(id).cost * count;
  if (cost > state.coins) return false;
  state.coins -= cost;
  state.pantry[id] += count;
  return true;
}

/** About how many customers a full day brings: the slower of arrivals and service. */
export function expectedCustomers(state: GameState): number {
  const items = menuItems(state);
  if (items.length === 0) return 0;
  const capacity = serviceCapacity(state, items);
  const promotedSeconds = state.promotion && !state.promotion.paused ? Math.min(DAY_SECONDS, state.promotion.remaining) : 0;
  const careForecast = forecastPetTraffic(state) / petTraffic(state);
  return Math.ceil(Math.min(arrivalRate(state) * careForecast, capacity) * promotedSeconds
    + Math.min(baseArrivalRate(state) * careForecast, capacity) * (DAY_SECONDS - promotedSeconds));
}

/** Servings of each dish a full day on today's menu sells, roughly. */
export function dayDemand(state: GameState): Map<ItemId, number> {
  const customers = expectedCustomers(state);
  const demand = new Map<ItemId, number>();
  for (const [id, share] of orderShares(menuItems(state), state)) demand.set(id, customers * share);
  return demand;
}

/** Ingredients a full day on today's menu uses, with a little to spare. */
export function dayNeeds(state: GameState): Partial<Record<IngredientId, number>> {
  const needs: Partial<Record<IngredientId, number>> = {};
  const demand = dayDemand(state), customers = expectedCustomers(state);
  for (const [id, servings] of demand) {
    if (isBakery(id) && !state.kitchen) continue; // Neighbor-supplied trial stock cannot be replenished here.
    // Cover planned morning production or forecast consumption, never both twice.
    // Live shelf stock and paid in-flight batches reduce future ingredient needs.
    const morning = state.phase === 'prep' ? state.bakePlan[id] ?? 0 : 0;
    const shelf = state.phase === 'prep' ? 0 : state.shelf[id] ?? 0;
    const inProgress = state.phase === 'prep' ? 0 : state.inProduction[id] ?? 0;
    const amount = isBakery(id)
      ? state.kitchen
        ? Math.max(morning, Math.ceil(servings * 1.1) - shelf - inProgress)
        : morning
      // A percentage alone offers very little protection to less common drinks.
      // Add a menu-mix reserve (~95th percentile per dish). Raw ingredients keep
      // overnight; this does not increase perishable morning baking quantities.
      : servings * 1.15 + 1.65 * Math.sqrt(servings * Math.max(0, 1 - servings / Math.max(1, customers)));
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
    // Tastings leave quarters, but suppliers sell whole ingredient units.
    const n = Math.max(0, Math.ceil(need - state.pantry[ing]));
    if (n === 0) continue;
    buy[ing] = n;
    cost += n * ingredientDef(ing).cost;
  }
  return { buy, cost };
}

/** Tops up a forecast proportionally, prioritizing one complete recipe when cash is scarce. */
export function restockPlan(state: GameState): { buy: Partial<Record<IngredientId, number>>; cost: number; balance: number; missing: Partial<Record<IngredientId, number>>; missingCost: number } {
  const q = restockQuote(state);
  if (q.cost <= 0 || state.coins <= 0) return { buy: {}, cost: 0, balance: state.coins, missing: q.buy, missingCost: q.cost };
  const share = q.cost > 0 ? Math.max(0, Math.min(1, state.coins / q.cost)) : 0;
  let buy = (Object.entries(q.buy) as [IngredientId, number][])
    .map(([ing, n]) => [ing, Math.floor(n * share)] as [IngredientId, number]);
  const projected = { ...state, pantry: { ...state.pantry } };
  for (const [ing, count] of buy) projected.pantry[ing] += count;
  const items = menuItems(state);
  const hasSupply = items.some(({ id }) => servingsLeft(projected, id) >= 1 ||
    isBakery(id) && ((state.shelf[id] ?? 0) >= 1 || (state.inProduction[id] ?? 0) >= 1));
  if (!hasSupply) {
    // Rounding a small budget across ingredients can buy fragments of several
    // recipes while completing none. Keep a route back to earning revenue.
    const recipes = items.map(({ id }) => {
      const deficits = recipe(id).map(([ing, n]) => [ing, Math.max(0, Math.ceil(n - state.pantry[ing]))] as [IngredientId, number]);
      const cost = deficits.reduce((sum, [ing, n]) => sum + ingredientDef(ing).cost * n, 0);
      return { deficits, cost };
    }).filter(({ cost }) => cost > 0 && cost <= state.coins).sort((a, b) => a.cost - b.cost);
    buy = recipes[0]?.deficits ?? [];
  }
  const planned = Object.fromEntries(buy.filter(([, n]) => n > 0));
  const cost = buy.reduce((sum, [ing, n]) => sum + ingredientDef(ing).cost * n, 0);
  const missing = Object.fromEntries(Object.entries(q.buy).map(([ing, n]) => [ing, n - (planned[ing] ?? 0)]).filter(([, n]) => Number(n) > 0));
  return { buy: planned, cost, balance: state.coins - cost, missing, missingCost: q.cost - cost };
}

/** Execute the same quote shown before purchase. */
export function restock(state: GameState): boolean {
  const plan = restockPlan(state);
  let bought = false;
  for (const [ing, count] of Object.entries(plan.buy) as [IngredientId, number][]) {
    if (count > 0 && buyIngredient(state, ing, count)) bought = true;
  }
  return bought;
}

/** Menu dishes the pantry can't make a single serving of. */
export const soldOutItems = (state: GameState) => menuItems(state).filter((m) => servingsLeft(state, m.id) < 1);
