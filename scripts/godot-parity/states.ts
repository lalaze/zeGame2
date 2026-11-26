// Variations on states the seeded player reached: fuller cafés, poorer ones, older saves, and other day reports.
import { MODS, call } from './mods';
import { EPOCH, IDS, Random, recipe } from './ops';
import type { GameState } from '../../src/game/state';
import type { ItemId } from '../../src/game/data';

type Dict = Record<string, unknown>;
const some = <T,>(list: readonly T[], p: number, r: Random) => list.filter(() => r.chance(p));
const set = (target: object, key: string, value: unknown) => { (target as Dict)[key] = value; };
const category = (id: string) => (call('economy', 'menuItem', [id]) as { category: string } | null)?.category ?? '';
const bakery = (id: string) => ['bread', 'pastry'].includes(category(id));

/** Gives a state several things at once that take a real player weeks to collect. */
export function enrich(s: GameState, r: Random): void {
  if (r.chance(0.6)) s.kitchen = r.chance(0.85);
  if (r.chance(0.7)) for (const id of IDS.menu) if (r.chance(0.5)) set(s.items, id, r.pick([1, 1, 3, 5, 10, 25, 60, 300]));
  if (r.chance(0.8)) s.onMenu = some(IDS.menu.filter((id) => s.items[id as ItemId] > 0), r.pick([0.2, 0.5, 0.9]), r) as ItemId[];
  if (r.chance(0.5)) for (const id of IDS.ingredient) set(s.pantry, id, r.pick([0, 0.75, 2, 12, 60, 400]));
  for (const id of s.onMenu) if (bakery(id)) {
    if (r.chance(0.7)) s.bakePlan[id] = r.int(30);
    if (r.chance(0.5)) s.shelf[id] = r.int(9);
    if (s.phase !== 'prep' && r.chance(0.5)) s.inProduction[id] = r.int(8);
    if (s.phase !== 'prep' && r.chance(0.3)) s.today.baked[id] = r.int(20);
    if (s.phase !== 'prep' && r.chance(0.3)) s.today.sales[id] = r.int(20);
  }
  if (r.chance(0.5)) for (const u of MODS.data.UPGRADES as { id: string; max: number }[]) if (r.chance(0.6)) set(s.upgrades, u.id, r.int(u.max + 1));
  if (r.chance(0.5)) { const spots = some(IDS.spot, 0.15, r), kinds = MODS.furniture.FURNITURE as { id: string; surface: string }[];
    s.decor.placed = spots.flatMap((spot) => { const def = call('building-spots', 'buildingSpot', [spot]) as { surface: string }, kind = r.pick(kinds.filter((k) => k.surface === def.surface)); return [{ id: kind.id, col: -1, row: -1, spot }]; }); s.decor.building = true; }
  if (r.chance(0.4)) { s.goal = r.pick([11, 14, 15, 15, 15, 16]); s.milestones.done = some(IDS.milestone, r.pick([0.2, 0.6, 1]), r); s.milestones.reachedOn = Object.fromEntries(s.milestones.done.map((id) => [id, r.pick([s.day, 2])]));
    s.milestones.claimed = some(IDS.chapter, 0.4, r) as typeof s.milestones.claimed; s.milestones.records = { bestDay: r.int(220), bestSmoothDay: r.int(200), weatherWins: some(['rain', 'hot', 'crisp'], 0.4, r) as typeof s.milestones.records.weatherWins, momentsAnswered: r.int(90) };
    if (r.chance(0.5)) s.served = r.int(5000); if (r.chance(0.4)) s.decor.owned.push(...(MODS.milestones.CHAPTERS as { finish: string }[]).map((c) => c.finish).filter((f) => !s.decor.owned.includes(f) && r.chance(0.5))); }
  if (r.chance(0.4)) s.pets = some(IDS.cat, 0.15, r).slice(0, 4).map((id) => ({ id, careSeconds: r.pick([0, 40, 900]), autoRefill: r.chance(0.5), ...(r.chance(0.3) ? { fosterUntilDay: s.day + r.int(3) - 1 } : {}) })) as typeof s.pets;
  if (r.chance(0.5)) s.cafeStyle.focus = r.pick(IDS.style) as typeof s.cafeStyle.focus;
  if (r.chance(0.15)) { s.cafeStyle.introductions = some(['cats', 'bakery'], 0.6, r) as typeof s.cafeStyle.introductions; if (r.chance(0.6)) s.cafeStyle.bakeryTrialDay = s.day; s.kitchen = r.chance(0.2); s.items.roll = 1; if (!s.onMenu.includes('roll')) s.onMenu.push('roll'); if (r.chance(0.3)) delete s.shelf.roll; else s.shelf.roll = r.int(3); }
  if (r.chance(0.3)) s.streets.lots = Object.fromEntries(some(IDS.lot, 0.25, r).map((id) => [id, { business: r.chance(0.2) ? null : r.pick(IDS.region), level: 1 + r.int(3), mode: r.pick(IDS.mode), readyAt: EPOCH + r.pick([-1e9, 0, 5e8]), since: EPOCH - r.int(9e7) }])) as typeof s.streets.lots;
  if (r.chance(0.3)) { s.roomProjects.inspiration = r.pick([0, 79, 200, 5000]); s.regions = IDS.region.slice(0, r.int(6)) as typeof s.regions; s.roomProjects.facilities = Object.fromEntries(some(IDS.project, 0.5, r).map((id) => [id, { level: 1 + r.int(3), mode: r.pick(IDS.mode), since: EPOCH - r.int(9e7) }])) as typeof s.roomProjects.facilities; }
  if (r.chance(0.15)) for (const g of MODS['regular-guests-content'].REGULAR_GUESTS as { id: string; debutDay: number }[]) if (r.chance(0.5)) s.regularGuests.guests[g.id] = {
    firstMetDay: g.debutDay, served: r.int(9), unlockedChapters: [0, 1, 2, 3].slice(0, r.int(4)), readChapters: [], lastUnlockDay: r.pick([null, s.day, 2]),
    servedVisitIds: Array.from({ length: r.pick([0, 2, 160, 160]) }, (_, i) => i + 1), pendingVisitIds: [200, 201], pendingDay: r.pick([s.day, 1]) };
  if (r.chance(0.15)) s.regularGuests.nextVisitId = 400;
  if (r.chance(0.2)) for (let n = r.int(12); n > 0; n--) s.guestMemories[r.int(36)] = { item: r.pick(s.onMenu.length ? s.onMenu : ['espresso' as ItemId]), source: r.pick(['recommend', 'trial']), learnedDay: 1, lastServedDay: 1, returns: r.int(5) };
  if (r.chance(0.2)) s.roomProjects.blueprints = some(IDS.blueprint, 0.5, r) as typeof s.roomProjects.blueprints;
  if (r.chance(0.2)) s.chain.perks = IDS.perk.filter(() => r.chance(0.5)) as typeof s.chain.perks;
  if (r.chance(0.2)) { const made = call('signature-drinks', 'makeSignatureId', recipe(r)) as string | null; if (made && !s.signatureDrinks.recipes.some((x) => x.id === made)) { s.signatureDrinks.recipes.push({ id: made, name: r.pick(['Mix', '']), onMenu: r.chance(0.6) } as typeof s.signatureDrinks.recipes[number]); s.signatureDrinks.tested.push(made); s.items[made as ItemId] = 1; } }
  if (r.chance(0.15)) { s.phase = 'open'; s.dayTime = r.next() * 180; }
  if (r.chance(0.1)) { s.phase = 'closing'; s.dayTime = r.pick([60, 180]); }
}

/** No money, hardly any stock: where the free bean comes in. */
export function poor(s: GameState, r: Random): GameState {
  const out = structuredClone(s);
  out.phase = r.chance(0.9) ? 'prep' : 'open';
  out.coins = r.pick([0, 0, 0.4, 0.99, 1, 30]);
  for (const id of IDS.ingredient) set(out.pantry, id, r.pick([0, 0, 0, 0.25, 0.75, r.chance(0.1) ? 4 : 0]));
  out.shelf = r.chance(0.85) ? {} : { roll: r.int(3) };
  out.inProduction = r.chance(0.9) ? {} : { roll: r.int(3) };
  out.goal = r.pick([0, 1, 3, 6, 9, 11, 11, 11, 13, 15]);
  if (r.chance(0.5)) { out.day = r.pick([1, 2, 4, 40]); for (const id of IDS.menu) set(out.items, id, 0); out.items.espresso = 1; out.onMenu = r.chance(0.5) ? ['espresso'] : []; for (const u of IDS.upgrade) set(out.upgrades, u, 0); out.signatureDrinks = { recipes: [], tested: [], served: {} }; }
  if (r.chance(0.4)) { out.decor.placed = []; out.decor.stored = Object.fromEntries(some(IDS.furniture, r.pick([0.05, 0.1]), r).slice(0, 6).map((id) => [id, 1])); if (r.chance(0.5)) delete out.decor.building; }
  if (r.chance(0.12)) breakOne(out, r);
  return out;
}

/** One thing that cannot be right, which must never earn a free bean. */
function breakOne(s: GameState, r: Random): void {
  const any = s as unknown as Dict;
  r.pick([() => { any.signatureDrinks = { recipes: {}, tested: [], served: {} }; }, () => { s.signatureDrinks.served['sig:bad'] = 2; }, () => { s.items.espresso = 0; }, () => { s.day = 0; }, () => { s.coins = NaN; }, () => { s.onMenu = ['espresso', 'espresso']; }, () => { any.shelf = { nope: 1 }; },
    () => { any.regions = ['greenhouse']; }, () => { s.decor.owned.push('nope'); }, () => { s.decor.placed.push({ id: 'lamp', col: -1, row: 2 }); }, () => { s.decor.stored.nope = 1; }, () => { set(s.items, 'nope', 1); }, () => { set(s.pantry, 'nope', 1); }, () => { s.pantry.beans = 0.1; }, () => { s.profile = undefined as unknown as null; }, () => { s.upgrades.tables = 999; }])();
}
/** A café whose owner could reach the comfort goal with furniture they already have, or not quite. */
export function cosyGoal(s: GameState, r: Random): GameState {
  const out = structuredClone(s);
  out.phase = 'prep'; out.day = 8; out.goal = 11; out.coins = 0; out.shelf = {}; out.inProduction = {}; out.bakePlan = {}; out.regions = r.chance(0.2) ? ['reading'] : []; out.onMenu = ['espresso']; out.signatureDrinks = { recipes: [], tested: [], served: {} };
  for (const id of IDS.menu) set(out.items, id, id === 'espresso' ? 1 : 0);
  for (const id of IDS.ingredient) set(out.pantry, id, 0);
  const cosy = (MODS.furniture.FURNITURE as { id: string; comfort: number }[]).filter((f) => f.comfort > 0).map((f) => f.id);
  if (r.chance(0.8)) out.decor = (call('state', 'createInitialState', [1]) as GameState).decor; // Nothing but the free finishes.
  if (r.chance(0.8)) delete out.decor.building; else out.decor.building = true;
  out.decor.placed = []; out.decor.stored = Object.fromEntries(some(cosy, r.pick([0.06, 0.1, 0.15, 0.3, 0.7]), r).map((id) => [id, 1]));
  for (const u of IDS.upgrade) set(out.upgrades, u, 0);
  out.upgrades.tables = r.pick([0, 3, 6, 6]);
  // Full 8-table main room with varied stored floor-only pieces: total comfort >= target, zero legal floor placements (hits !masks.length and return false, distinct keys so replay misses the 32-entry cache).
  if (out.upgrades.tables === 6 && out.regions.length === 0 && !out.decor.building && Object.keys(out.decor.stored).length % 2 === 0) {
    const base = call('state', 'createInitialState', [1]) as GameState;
    const floor = new Set((MODS.furniture.FURNITURE as { id: string; surface: string }[]).filter((f) => f.surface === 'floor').map((f) => f.id));
    const stored = { piano: 1, ...Object.fromEntries(Object.entries(out.decor.stored).filter(([id]) => floor.has(id))) };
    out.items = base.items;
    out.decor = base.decor;
    delete out.decor.building;
    out.decor.placed = [];
    out.decor.stored = stored;
  }
  return out;
}

/** Nothing to buy and no reward waiting: what the advice looks at next. */
export function stocked(s: GameState, r: Random): GameState {
  const out = structuredClone(s);
  out.phase = 'prep'; out.trialSales.selected = null; out.trialSales.active = null;
  for (const id of IDS.ingredient) set(out.pantry, id, 90_000);
  out.goal = r.pick([15, 15, 15, 0, 9]); out.milestones.done = []; out.coins = r.pick([0, 50, 1e6]);
  if (r.chance(0.5)) for (const id of out.onMenu) if (bakery(id)) out.bakePlan[id] = r.int(9);
  if (r.chance(0.5)) out.promotion = { id: r.pick(IDS.promotion), remaining: 40, paused: r.chance(0.5) } as typeof out.promotion;
  if (r.chance(0.5)) out.upgrades = { ...out.upgrades, machine: r.int(3), barista: 0 };
  return out;
}

/** A little stock and no money for more, or an empty menu with a few coins. */
export function short(s: GameState, r: Random): GameState {
  const out = stocked(s, r), bare = r.chance(0.5);
  for (const id of IDS.ingredient) set(out.pantry, id, bare ? 0 : r.pick([1, 2, 3]));
  out.coins = bare ? r.pick([3, 40, 400]) : 0;
  if (bare) out.onMenu = []; else if (r.chance(0.4)) out.onMenu = out.onMenu.slice(0, 1);
  return out;
}

/** The kinds of things older versions saved. */
export function legacy(s: GameState, r: Random): Dict {
  const out = structuredClone(s) as unknown as Dict & { decor: Dict; upgrades: Dict; pantry: Dict };
  out.version = r.int(28);
  if (r.chance(0.5)) out.upgrades = { ...out.upgrades, decor: r.pick([0, 2, 3, 6, 11]), manager: r.pick([0, 1, 5, 9]) };
  if (r.chance(0.3)) out.pantry = { ...out.pantry, pastry: r.int(9), berries: r.int(9) };
  if (r.chance(0.4)) { const { placed: _p, stored: _s, building: _b, ...rest } = out.decor; out.decor = { ...rest, owned: [...(rest.owned as string[]), ...some(IDS.furniture, 0.1, r), 'art_landscape'], equipped: { ...(rest.equipped as Dict), art: r.pick(['art_landscape', 'art_starry', null]) } }; }
  else if (r.chance(0.5)) out.decor = { ...out.decor, placed: [{ id: 'clock', col: 10, row: r.pick([0, 0, 1]) }, ...(out.decor.placed as object[]), ...(r.chance(0.4) ? [{ id: 'clock', col: 11, row: 0 }] : []), { id: 'lamp', spot: 'nowhere' }, ...(r.chance(0.5) ? [] : [{ id: 'lamp' }]), { id: 'plant_fern', spot: r.pick(IDS.spot) }] };
  if (r.chance(0.2)) out.profile = r.pick([{ cafeName: '  ' }, { cafeName: 'Old Café', ownerName: 7 }, { cafeName: 'Café', look: { skin: 3, hair: 2 } }]);
  if (r.chance(0.1)) delete out.decor.stored;
  if (r.chance(0.1)) delete out.decor.equipped;
  if (r.chance(0.3)) for (const key of some(['streets', 'roomProjects', 'orders', 'catGifts', 'chain', 'manager', 'milestones', 'partners', 'cafeStyle', 'regularGuests', 'today', 'taste', 'reputation', 'bakePlan', 'onMenu', 'speed'], 0.3, r)) delete out[key];
  return out;
}

/** The same report after a different day: lost guests, waste, a loss. */
export function otherDay(report: Dict, s: GameState, r: Random): Dict {
  const out = structuredClone(report) as Dict & { reviews: { reasons: Dict }; shortages: Dict; stale: Dict };
  const maybe = (key: string, p: number, value: () => unknown) => { if (r.chance(p)) out[key] = value(); };
  for (const key of ['soldOut', 'extraLost', 'queueLost', 'doorLost', 'tableLost']) maybe(key, 0.6, () => r.pick([0, 0, 0, 3]));
  maybe('profit', 0.5, () => r.pick([-40, -1e-9, 0, 120])); maybe('petCost', 0.4, () => r.pick([0, 6.5])); maybe('promotionCost', 0.4, () => r.pick([0, 0, 30]));
  maybe('served', 0.3, () => r.pick([0, 12])); maybe('missed', 0.3, () => r.pick([0, 4])); maybe('ingredientCost', 0.4, () => r.pick([0, 5, 400])); maybe('outOfStock', 0.4, () => r.pick([[], ['latte']])); maybe('staleCost', 0.4, () => r.pick([0, 9]));
  if (r.chance(0.6)) out.reviews.reasons.cancelled = r.pick([0, 0, 2]);
  maybe('stale', 0.6, () => (r.chance(0.5) ? {} : Object.fromEntries(some(s.onMenu.length ? s.onMenu : ['roll'], 0.6, r).map((id) => [id, 1 + r.int(5)]))));
  maybe('shortages', 0.6, () => Object.fromEntries(some(s.onMenu, 0.4, r).map((id) => [id, r.int(3)])));
  maybe('sales', 0.5, () => Object.fromEntries(some(IDS.menu, 0.3, r).map((id) => [id, r.int(60)])));
  if (r.chance(0.25)) { const list = s.onMenu.filter(bakery).slice(0, 2); out.stale = Object.fromEntries(list.map((id) => [id, 2])); out.shortages = Object.fromEntries(list.map((id) => [id, 1])); out.profit = 5; out.reviews.reasons.cancelled = 0; out.ingredientCost = 0; for (const key of ['soldOut', 'extraLost']) out[key] = 0; }
  if (r.chance(0.15)) Object.assign(out, { ingredientCost: 500, sales: {}, baked: {}, tableLost: 0 }), out.reviews.reasons.cancelled = 0;
  maybe('day', 0.4, () => 1 + r.int(40));
  return out;
}
