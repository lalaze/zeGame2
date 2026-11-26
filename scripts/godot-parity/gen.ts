// Writes bit-exact TS → Godot vectors for every exported function of the rules modules.
// Arguments come from the functions' own parameter types, fed with states a seeded player really reached.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSIDE, MODS, call } from './mods';
import { EPOCH, IDS, Random, anyItem, play, recipe, type Shot } from './ops';
import { cosyGoal, enrich, legacy, otherDay, poor, short, stocked } from './states';
import { tamper } from './snapshots';
import { Pool, lcg, wire } from './wire';
import { HAND } from './hand';
import { JUNK, NUMBERS, damage } from './damage';
import { bundleText, reached, startCoverage, stretches } from './coverage';
import { checkGate, type Tally, type Whitelist } from './gate.mjs';
import { setLocale } from '../../src/i18n';
import type { GameState } from '../../src/game/state';
import type { ItemId } from '../../src/game/data';

type Dict = Record<string, unknown>;
interface Param { name: string; type: string; optional: boolean }
interface Setup { height: number; kitchen: number; locale: 'zh' | 'en'; clock: number; seed: number }
export interface Case { mod: string; fn: string; args: unknown[]; setup: Setup }
interface Ctx { r: Random; shot: Shot; s: GameState; cell?: [number, number, number]; dish?: string }
type Gen = (c: Ctx, p: Param) => unknown;

/** Modules whose rarer branches need more attempts. */
const TRIES: Record<string, number> = { 'settlement-advice': 9000, 'sim-snapshot': 12000, recovery: 5000, 'signature-drinks': 2600, 'regular-guests': 2600, regions: 2600, furniture: 2200 };
const THROWS = new Set(['kitchen.kitchenPath']);
const clone = <T,>(v: T): T => structuredClone(v);

/** The same state with the numbers a player could also have: poor, rich, out of stock, another day. */
function vary(s: GameState, r: Random): GameState {
  const out = clone(s);
  if (r.chance(0.5)) enrich(out, r);
  if (r.chance(0.25)) out.coins = r.pick([0, 1, 40, 299, 300, 800, 5_000, 1e5, 3e6, 1e8, 1e11]);
  if (r.chance(0.12)) for (const id of IDS.ingredient) out.pantry[id as keyof typeof out.pantry] = r.pick([0, 0, 1, 2.75, 10, 500]);
  if (r.chance(0.1)) out.day = r.pick([1, 2, 3, 5, 8, 30, 365]);
  if (r.chance(0.06)) out.totalEarned += r.pick([0, 49_999, 50_000, 1e7]);
  if (r.chance(0.08) && out.phase !== 'prep') out.dayTime = r.pick([0, 10, 90, 165, 179.9, 180, 200]);
  if (r.chance(0.2)) out.chain.location = r.pick(IDS.location) as typeof out.chain.location;
  if (r.chance(0.05)) out.cafeStyle.focus = r.pick(IDS.style) as typeof out.cafeStyle.focus;
  if (r.chance(0.05)) out.shelf = Object.fromEntries(IDS.menu.map((id) => [id, r.int(4)])) as typeof out.shelf;
  if (r.chance(0.04)) for (const id of IDS.menu) if (r.chance(0.5)) out.items[id as keyof typeof out.items] = r.pick([0, 1, 5, 10, 24, 25, 60, 300]);
  if (r.chance(0.03)) out.phase = r.pick(['prep', 'open', 'closing'] as const);
  if (r.chance(0.04)) for (const p of out.pets) p.careSeconds = r.pick([0, 0.5, 90, 4000]);
  if (r.chance(0.04) && out.promotion) { out.promotion.remaining = r.pick([0, 0.05, 30, 400]); out.promotion.paused = r.chance(0.5); }
  if (r.chance(0.04)) out.kitchen = !out.kitchen;
  if (r.chance(0.07)) {
    out.chain.franchises = Array.from({ length: r.pick([0, 1, 2, 5, 9, 14]) }, (_, i) => ({ location: (i < 5 ? IDS.location[i] : r.pick(IDS.location)) as typeof out.chain.location, hourly: r.pick([0, 12.5, 900, 4e5]) }));
    out.chain.perks = IDS.perk.filter(() => r.chance(0.5)) as typeof out.chain.perks; out.chain.stars = r.int(70); out.chain.branches = r.int(14);
  }
  if (r.chance(0.04)) { out.regions = IDS.region.slice(0, r.int(6)) as typeof out.regions; out.construction = IDS.region.slice(out.regions.length, out.regions.length + r.int(3)).map((x) => ({ id: x as typeof out.regions[number], finishAt: EPOCH + r.int(4e8) })); }
  if (r.chance(0.04)) for (const u of IDS.upgrade) out.upgrades[u as keyof typeof out.upgrades] = r.int(7);
  if (r.chance(0.04)) out.reputation.recent = Array.from({ length: r.pick([0, 3, 19, 20, 50]) }, () => ({ stars: 1 + r.int(5), reason: r.pick(IDS.reason) })) as typeof out.reputation.recent;
  if (r.chance(0.05)) out.regularWishes = { mina: r.chance(0.2) ? null : { choice: r.pick(['quiet', 'milky']), acceptedDay: 1 + r.int(5), paused: r.chance(0.2), rehearsedDay: r.pick([null, 1, 2, out.day]), completedDay: r.pick([null, null, 3]), displayed: r.chance(0.5) } } as typeof out.regularWishes;
  if (r.chance(0.04)) for (const x of IDS.menu) out.taste.served[x as keyof typeof out.taste.served] = r.pick([0, 29, 30, 99, 100, 400]);
  if (r.chance(0.04)) out.taste.signature = IDS.menu.filter((x) => r.chance(0.2) && out.items[x as keyof typeof out.items] > 0) as typeof out.taste.signature;
  if (r.chance(0.05)) { out.regularGuests.guests.mina = { firstMetDay: 1, served: 3, unlockedChapters: [0, 1], readChapters: [0], lastUnlockDay: 2, servedVisitIds: [1, 2, 3], pendingVisitIds: [], pendingDay: out.day }; }
  if (r.chance(0.12)) for (let n = 1 + r.int(4); n > 0; n--) {
    const made = call('signature-drinks', 'makeSignatureId', recipe(r)) as string | null;
    if (!made || out.signatureDrinks.recipes.some((x) => x.id === made)) continue;
    out.signatureDrinks.recipes.push({ id: made, name: `Mix ${n}`, onMenu: r.chance(0.4) } as typeof out.signatureDrinks.recipes[number]);
    if (r.chance(0.7)) out.signatureDrinks.tested.push(made);
    out.signatureDrinks.served[made] = r.pick([0, 12, 30, 99, 100, 250]); out.items[made as ItemId] = 1;
  }
  if (r.chance(0.08)) for (const p of IDS.partner) if (r.chance(0.6)) out.partners.roster[p] = { ...(call('partners', 'freshPartner', []) as typeof out.partners.roster[string]), xp: r.pick([0, 11, 30, 200]), workedDays: r.int(6), unlocked: r.int(4), read: r.pick([[], [0], [1, 0, 1], [0, 2.5]]), specialty: r.pick([null, 'a', 'b']), todayDay: r.chance(0.5) ? out.day : 0, todayJobs: r.int(4) };
  if (r.chance(0.1)) {
    const off = [...IDS.menu.filter((x) => out.items[x as ItemId] > 0 && !out.onMenu.includes(x as ItemId)), ...out.signatureDrinks.recipes.filter((x) => !x.onMenu).map((x) => x.id as string)];
    if (off.length) {
      const pickd = r.pick(off) as ItemId;
      out.trialSales.selected = pickd;
      if (r.chance(0.75)) { out.phase = 'open'; out.trialSales.active = { item: pickd, day: out.day, prepared: r.int(6), served: r.int(3), reserved: r.int(3), visits: r.int(9), ingredientCost: r.next() * 20, revenue: r.next() * 90, feedback: { love: r.int(3), fine: r.int(3), meh: 0 }, practiceBefore: r.int(60), qualityBefore: 4.1 }; }
      if (r.chance(0.3)) out.trialSales.last = { item: r.pick(off) as ItemId, day: Math.max(1, out.day - 1), prepared: 3, served: 3, ingredientCost: 9, revenue: 30, feedback: { love: 1, fine: 1, meh: 1 }, practiceBefore: 5, qualityBefore: 4, qualityAfter: 4.5 };
    }
  }
  if (r.chance(0.05)) for (let n = r.int(4); n > 0 && out.decor.placed.length; n--) out.decor.placed.push({ ...r.pick(out.decor.placed) });
  if (r.chance(0.04)) { delete out.decor.building; for (const p of out.decor.placed) if (r.chance(0.6)) { delete p.spot; p.col = r.int(40); p.row = r.int(14); } }
  if (r.chance(0.04) && out.trialSales.active) Object.assign(out.trialSales.active, { prepared: r.int(6), served: r.int(3), reserved: r.int(3), visits: r.int(9) });
  return out;
}
const state: Gen = (c) => c.s;
const item = (c: Ctx) => anyItem(c.s, c.r) as ItemId;
const meal = (c: Ctx) => Array.from({ length: c.r.pick([0, 1, 1, 2, 2, 3]) }, () => (c.r.chance(0.02) ? 'nope' as ItemId : item(c)));
const menu = (c: Ctx) => {
  const all = call('economy', 'menuItems', [c.s]) as unknown[];
  return c.r.chance(0.5) ? all : Array.from({ length: c.r.int(6) }, () => call('economy', 'menuItem', [item(c)]));
};
const point = (c: Ctx) => c.r.chance(0.4) && c.shot.customers.length ? (({ x, y }) => ({ x, y }))(c.r.pick(c.shot.customers) as { x: number; y: number })
  : { x: c.r.pick([-700, -320, -10, 0, 12, 160, 202, 310, 320, 640, 900]) + c.r.int(30) * c.r.pick([0, 1, 0.5]), y: c.r.pick([-260, -10, 0, 48, 80, 88, 120, 138, 180, 233, 252, 320, 480]) + c.r.int(30) * c.r.pick([0, 1, 0.5]) };
const near = (c: Ctx) => (c.r.chance(0.03) ? { x: NaN, y: 100 } : { x: c.r.int(320), y: 80 + c.r.int(160) });
const rect = (c: Ctx) => ({ x: c.r.int(300), y: 60 + c.r.int(180), w: 4 + c.r.int(80), h: 3 + c.r.int(40) });
const look = (c: Ctx) => ({ skin: c.r.int(4), hair: c.r.int(6), hairStyle: c.r.int(32), shirt: c.r.int(8), pants: c.r.int(3) });
const id = (list: () => string[]): Gen => (c) => (c.r.chance(0.04) ? 'nope' : c.r.pick(list()));
const clock = (c: Ctx) => c.shot.now + c.r.pick([0, 0, 0, 1, 500.5, -60_000, 59_999, 600_000, 3_600_000, 20_000_000, 90_000_000, 4e8]);

const BY_TYPE: Record<string, Gen> = {
  GuestTaste: (c) => ({ liked: c.r.pick(IDS.flavor), avoided: c.r.pick(IDS.flavor) }),
  ItemId: item, 'ItemId | null': (c) => (c.r.chance(0.2) ? null : item(c)), 'ItemId[]': meal, 'readonly ItemId[]': meal, IngredientId: id(() => IDS.ingredient), UpgradeId: id(() => IDS.upgrade),
  LocationId: id(() => IDS.location), PerkId: id(() => IDS.perk), OrderKind: id(() => IDS.order), ProjectId: id(() => IDS.project), ProjectMode: id(() => IDS.mode), BlueprintId: id(() => IDS.blueprint),
  PlotId: id(() => IDS.plot), StreetLotId: (c) => (Object.keys(c.s.streets.lots).length && c.r.chance(0.8) ? c.r.pick(Object.keys(c.s.streets.lots)) : c.r.pick(IDS.lot)), RegionId: id(() => IDS.region), AreaId: (c) => c.r.pick(IDS.area),
  Direction: (c) => c.r.pick(['left', 'right', 'up', 'down']), DecorSlot: id(() => IDS.slot), CafeStyleId: (c) => c.r.pick(IDS.style), 'CafeStyleId | null': (c) => c.r.pick([...IDS.style, null, 'nope']),
  "'cats' | 'bakery'": (c) => c.r.pick(['cats', 'bakery']), Category: (c) => c.r.pick(IDS.category), 'readonly Flavor[]': (c) => IDS.flavor.filter(() => c.r.chance(0.3)), ConditionId: id(() => IDS.condition),
  GuestKind: (c) => c.r.pick(IDS.guest), 'GuestKind | undefined': (c) => c.r.pick([...IDS.guest, undefined]), GiftKind: (c) => c.r.pick(IDS.gift), Station: (c) => c.r.pick(IDS.station), PartnerRole: (c) => c.r.pick(IDS.role),
  MinaWishChoice: (c) => c.r.pick(['quiet', 'milky', 'nope']), Surface: (c) => c.r.pick(['floor', 'wall']), BuyAmount: (c) => c.r.pick([1, 1, 10, 'max']), boolean: (c) => c.r.chance(0.5), '0 | 1': (c) => c.r.int(2),
  "'a' | 'b'": (c) => c.r.pick(['a', 'b']), MenuItemDef: (c) => call('economy', 'menuItem', [item(c)]), 'readonly MenuItemDef[]': menu, 'readonly { id: ItemId }[]': menu, "Pick<MenuItemDef, 'baseCost'>": (c) => call('economy', 'menuItem', [item(c)]),
  FloorPoint: point, '{ x: number; y: number }': point, FloorObstacle: rect, 'readonly FloorObstacle[]': (c) => Array.from({ length: c.r.int(7) }, () => rect(c)), Look: look, "Pick<Look, 'skin' | 'hair'>": look, Reputation: (c) => c.s.reputation,
  ReviewSummary: (c) => c.s.today.reviews, DayStats: (c) => clone(c.s.today), 'readonly RegionId[]': (c) => c.s.regions, 'readonly CatId[]': (c) => c.s.pets.map((p) => p.id), Guest: (c) => ({ ...(c.r.chance(0.8) ? { appearanceId: c.r.int(40) } : {}), look: look(c) }),
  '{ appearanceId?: number; look: Look }': (c) => ({ ...(c.r.chance(0.8) ? { appearanceId: c.r.int(36) } : {}), look: look(c) }), FurnitureDef: (c) => call('furniture', 'furnitureDef', [c.r.pick(IDS.furniture)]), Pet: (c) => (c.s.pets.length ? c.r.pick(c.s.pets) : undefined),
  SignatureBase: (c) => c.r.pick(IDS.base), WishHandoff: (c) => ({ seat: c.r.int(6) - 1, items: meal(c) }), SignatureDefinition: (c) => { const [b, x] = recipe(c.r); return call('signature-drinks', 'signatureDefinition', [call('signature-drinks', 'makeSignatureId', [b, x])]); },
  Customer: (c) => (c.shot.customers.length ? c.r.pick(c.shot.customers) : undefined), DayReport: (c) => otherDay(c.shot.report as Dict, c.s, c.r), 'readonly number[]': (c) => Array.from({ length: 1 + c.r.int(5) }, () => c.r.pick([0, 0.5, 1, 1.25, 3]) * c.r.next()),
  ReviewInput: (c) => ({ stars: 1 + c.r.int(5), reason: c.r.pick(IDS.reason) }), 'Partial<Record<ItemId, number>>': (c) => c.s.today.sales, 'readonly Dict[]': () => [], SignatureRecipe: (c) => recipe(c.r)[1], 'string | null': (c) => JSON.stringify(c.s),
  'Located': state, FloorRouteOptions: (c) => ({ ...(c.r.chance(0.5) ? { bounds: { x: 0, y: 80, w: c.r.chance(0.05) ? 0 : 320, h: 153 } } : {}), ...(c.r.chance(0.5) ? { clearance: c.r.int(6) } : {}), ...(c.r.chance(0.3) ? { startApproach: near(c) } : {}), ...(c.r.chance(0.3) ? { endApproach: near(c) } : {}), ...(c.r.chance(0.1) ? (({ x, y }) => ({ startApproach: { x, y }, endApproach: { x, y } }))(near(c)) : {}) }),
};
const BY_NAME: Record<string, Gen> = {
  now: clock, seconds: (c) => c.r.pick(NUMBERS), dt: (c) => c.r.pick([0.05, 0.2, 1, 60, 0, -1]), level: (c) => c.r.pick([0, 1, 2, 5, 9, 10, 11, 25, 40, 50, 99, 100, 149, 200, 300, 420]), appearanceId: (c) => c.r.int(40), day: (c) => c.s.day + c.r.int(4) - 2,
  i: (c) => c.r.int(24), index: (c) => c.r.int(8) - 1, table: (c) => c.r.int(24), row: (c) => c.r.int(18), col: (c) => c.r.int(c.s.regions.length ? 240 : 40) + (c.r.chance(0.02) ? 0.5 : 0), tables: (c) => c.r.int(9), skip: (c) => c.r.int(8) - 1, side: (c) => c.r.int(2), slot: (c) => c.r.int(5) - 1, stars: (c) => c.r.int(60),
  earned: (c) => c.r.pick([0, 49_999, 50_000, 99_999, 1e5, 3e6, 1e12, NaN]), count: (c) => c.r.pick([1, 2, 10, 0, -1, 1.5, 400]), n: (c) => c.r.pick([0, 1, 2, 5, 10, 37, -3, 2.5, 20_000, NaN]), branches: (c) => c.r.int(14), height: (c) => c.r.pick([240, 257, 300, 333, 360]),
  fromHeight: (c) => c.r.pick([240, 251, 300, 360]), yMin: (c) => 70 + c.r.int(180) + c.r.pick([0, 0.5]), y: (c) => c.r.int(420) - 20, x: (c) => c.r.int(2200) - 400, h: (c) => c.r.pick([0, 200, 240.4, 271.5, 299, 360, 999, NaN]), r: (c) => c.r.next(), load: (c) => c.r.int(4), cost: (c) => c.r.next() * 9,
  amount: (c) => c.r.next() * 300, coins: (c) => c.r.pick([0, 5, 120, 4e4, 1e9]), base: (c) => c.r.pick([4, 12.5, 200, 9000]), growth: (c) => c.r.pick([1.07, 1.15, 1.6, 2.2, 4]), cap: (c) => c.r.pick([0, 3, 10, 400]), elapsed: (c) => c.r.int(200_000), capacity: (c) => c.r.pick([3600, 7200, 43_200]),
  waitSeconds: (c) => c.r.int(60) + c.r.next(), styleChance: (c) => c.r.pick([0.3, 0.5, 0.85, 0.1]), anchorY: (c) => 100 + c.r.int(90), dayTime: (c) => c.r.next() * 200, seat: (c) => c.r.int(12), visitId: (c) => 1 + c.r.int(6), chapter: (c) => c.r.int(5) - 1,
};
const services = new WeakMap<Ctx, [unknown, GameState]>();
/** A saved service and the save it belongs to, as they are, damaged anywhere, or wrong in a way only the two together show. */
function service(c: Ctx): [unknown, GameState] {
  let made = services.get(c);
  if (!made) {
    const snap = clone(c.shot.snapshot ?? null), s = clone(c.shot.state), how = c.r.next();
    if (how < 0.75 && snap) tamper(snap as never, s, c.r);
    services.set(c, made = [how < 0.75 || how > 0.95 ? snap : damage(snap, c.r, 1 + c.r.int(2)), s]);
  }
  return made;
}
const mut = (f: (c: Ctx) => unknown): Gen => (c) => (c.r.chance(0.25) ? clone(f(c)) : damage(f(c), c.r));
const any: Gen = (c) => clone(c.r.pick([...JUNK, ...IDS.location, ...IDS.perk, ...IDS.order, ...IDS.gift, ...IDS.guest, ...IDS.style, 'quiet', 'milky', 'sig:coffee:beans=1']));
const str = (list: (c: Ctx) => string[]): Gen => (c) => (c.r.chance(0.07) ? c.r.pick(['', 'nope', 'sig:bad']) : c.r.pick(list(c)));
const sig: Gen = (c) => (c.s.signatureDrinks.recipes.length && c.r.chance(0.5) ? c.r.pick(c.s.signatureDrinks.recipes).id : c.s.signatureDrinks.tested.length && c.r.chance(0.5) ? c.r.pick(c.s.signatureDrinks.tested)
  : c.r.chance(0.15) ? c.r.pick(['nope', 'sig:', `sig:coffee:${'beans=1,'.repeat(40)}`, 'sig:coffee', 'sig:coffee:beans=9', 'sig:tea:beans=1', 'sig:milk:milk=1,milk=1', 'sig:coffee:milk=1,beans=1', 'sig:coffee:beans=01']) : (call('signature-drinks', 'makeSignatureId', recipe(c.r)) as string | null) ?? 'none');
const ownFurniture = (c: Ctx) => (Object.keys(c.s.decor.stored).length && c.r.chance(0.7) ? Object.keys(c.s.decor.stored) : IDS.furniture);

/** A café nobody has opened yet, or one small step further. */
function fresh(c: Ctx): GameState {
  const out = call('state', 'createInitialState', [c.shot.now]) as GameState;
  if (c.r.chance(0.6)) c.r.pick([() => { out.day = 2; }, () => { out.served = 1; }, () => { out.totalEarned = 4; }, () => { out.kitchen = true; }, () => { out.items.americano = 1; }, () => { out.profile = c.s.profile; }, () => { out.pets = c.s.pets; }, () => { out.regions = ['reading']; },
    () => { out.phase = 'open'; out.dayTime = c.r.pick([5, 50]); }, () => { out.phase = 'open'; out.today.served = 6; }, () => { out.phase = 'open'; out.pantry.beans = 0; }, () => { out.phase = 'closing'; }, () => { out.day = 3; out.phase = 'open'; }])();
  return out;
}
/** A guest at the moment of being served; the dishes are kept so the other arguments can match them. */
function guest(c: Ctx): unknown {
  const ids = Array.from({ length: 36 }, (_, i) => i).filter((i) => call('guest-memories', 'memoryGuest', [i])), known = Object.keys(c.s.guestMemories).map(Number);
  const base = c.shot.customers.length ? c.r.pick(c.shot.customers) as Dict : { look: look(c), order: 'espresso', extra: null };
  const id = known.length && c.r.chance(0.5) ? c.r.pick(known) : c.r.pick(ids), favorite = c.s.guestMemories[id]?.item, dish = favorite && c.r.chance(0.5) ? favorite : item(c);
  c.dish = dish;
  return { ...base, appearanceId: id, hasCup: c.r.chance(0.1), regularGuestId: c.r.chance(0.1) ? 'mina' : undefined, recommendation: c.r.chance(0.6) ? dish : undefined, rememberedOrder: c.r.chance(0.4) ? dish : undefined };
}
/** A save as it could be on a phone: today's, from an older version, or damaged. */
const rawSave = (c: Ctx) => c.r.pick([() => JSON.stringify(c.shot.state), () => JSON.stringify(c.s), () => JSON.stringify({ ...c.s, runtime: c.shot.snapshot }), () => JSON.stringify(legacy(c.s, c.r)), () => JSON.stringify(legacy(c.s, c.r)), () => JSON.stringify(damage(legacy(c.s, c.r), c.r, 1 + c.r.int(6)))])();
/** Mina's milky wish waiting for a trial drink that could be hers. */
function forMina(c: Ctx): GameState {
  if (c.r.chance(0.3)) return c.s;
  const s = c.s, milky = c.r.pick(['latte', 'cappuccino', 'mocha', 'espresso']) as ItemId;
  s.items[milky] = Math.max(1, s.items[milky]); s.onMenu = s.onMenu.filter((x) => x !== milky); s.phase = c.r.pick(['prep', 'open', 'open']);
  s.regularGuests.guests.mina = { firstMetDay: 1, served: 3, unlockedChapters: [0, 1], readChapters: [0], lastUnlockDay: 1, servedVisitIds: [1], pendingVisitIds: [], pendingDay: s.day };
  s.regularWishes = { mina: { choice: c.r.pick(['milky', 'milky', 'quiet']), acceptedDay: 1, paused: c.r.chance(0.2), rehearsedDay: c.r.pick([null, null, 1]), completedDay: null, displayed: false } } as typeof s.regularWishes;
  s.trialSales.selected = milky;
  s.trialSales.active = { item: milky, day: s.day, prepared: c.r.int(5), served: 0, reserved: c.r.int(3), visits: c.r.int(9), ingredientCost: 0, revenue: 0, feedback: { love: 0, fine: 0, meh: 0 }, practiceBefore: 0, qualityBefore: 4 };
  return s;
}
/** A garden café with a plant, whatever else it has. */
function gardening(c: Ctx): GameState {
  if (c.r.chance(0.5)) { c.s.cafeStyle.focus = 'garden'; const cosy = (MODS.furniture.FURNITURE as { id: string; comfort: number }[]).filter((f) => f.comfort >= 3).map((f) => f.id); c.s.decor.placed.push({ id: 'plant_fern', col: 1, row: 1 }, ...cosy.slice(0, 4).map((x) => ({ id: x, col: 2, row: 2 }))); }
  return c.s;
}
let lastCosy: GameState | null = null;
/** Sometimes the same café again: the layout search remembers its answers. */
const beanless = (c: Ctx) => (c.r.chance(0.4) ? (lastCosy = lastCosy && c.r.chance(0.2) ? lastCosy : cosyGoal(c.s, c.r)) : poor(c.s, c.r));
const trialling = (c: Ctx) => { const own = c.s.signatureDrinks.recipes; if (own.length && c.r.chance(0.5)) c.s.trialSales.selected = c.r.pick(own).id as ItemId; return c.s; };
const onSale = (c: Ctx) => (c.s.onMenu.length && c.r.chance(0.8) ? c.r.pick(c.s.onMenu) : item(c));
const baked = (c: Ctx) => { const list = c.s.onMenu.filter((x) => call('economy', 'isBakery', [x])); return list.length && c.r.chance(0.85) ? c.r.pick(list) : item(c); };
/** Somewhere a cook can be: at a station, in the kitchen, in the doorway, on the lane behind the counter. */
const cookPoint = (c: Ctx) => c.r.pick([() => call('kitchen', 'stationSpot', [c.r.pick(IDS.station)]), () => call('kitchen', 'cookHome', [c.r.int(3)]), () => ({ x: -300 + c.r.int(290), y: 90 + c.r.int(80) }), () => ({ x: c.r.pick([-11, -8, -12, 12, 60, 202]), y: 88 }), () => ({ x: c.r.pick([12, 202, 90]), y: c.r.pick([88, 88, 90]) })])();
const bought = (c: Ctx) => (c.r.chance(0.8) ? [c.dish ?? 'espresso', ...meal(c)] : meal(c));
/** Often a cell where one of the placed pieces could really go. */
function cell(c: Ctx): [index: number, col: number, row: number] {
  if (c.cell) return c.cell;
  const at = c.r.int(Math.max(1, c.s.decor.placed.length)), piece = c.s.decor.placed[at];
  for (let n = 0; piece && n < 60; n++) {
    const col = c.r.int(c.s.regions.length ? 240 : 40), row = c.r.int(20);
    if (call('furniture', 'canPlace', [c.s, piece.id, col, row, call('regions', 'mainTableCount', [c.s]), at])) return (c.cell = [at, col, row]);
  }
  return (c.cell = [c.r.int(9) - 1, c.r.int(40), c.r.int(20)]);
}
/** Where the parameter type alone says too little. */
const BY_FUNCTION: Record<string, (Gen | undefined)[]> = {
  'sim-snapshot.validSnapshot': [(c) => service(c)[0], (c) => service(c)[1]],
  'cat-gifts.parseCatGifts': [mut((c) => c.s.catGifts)], 'chain.parseChain': [mut((c) => c.s.chain)], 'customer-cast.validCustomerCastSnapshot': [mut((c) => (c.shot.snapshot as Dict | undefined)?.customerCast ?? null)],
  'customer-demand.parseGuestStats': [mut((c) => c.s.today.guests)], 'guest-memories.parseGuestMemories': [mut((c) => Object.fromEntries(Object.entries(c.s.guestMemories).map(([k, v]) => [k, c.r.chance(0.5) ? { ...v, name: c.r.pick(['拿铁 ', '\u0001x', 4]) } : v])))], 'manager.parseManager': [mut((c) => c.s.manager)], 'milestones.parseMilestones': [mut((c) => c.s.milestones)],
  'orders.parseOrders': [mut((c) => c.s.orders)], 'partners.parsePartners': [mut((c) => c.s.partners)], 'pets.parsePets': [mut((c) => c.s.pets)], 'promotion.parsePromotion': [mut((c) => c.s.promotion)], 'regions.parseConstruction': [mut((c) => c.s.construction.length ? c.s.construction : [{ id: 'reading', finishAt: c.shot.now + 1e6 }])],
  'regular-guests.parseRegularGuests': [mut((c) => c.s.regularGuests)], 'regular-wishes.parseRegularWishes': [mut((c) => c.s.regularWishes)], 'reputation.parseReputation': [mut((c) => c.s.reputation)], 'reputation.parseReviews': [mut((c) => c.s.today.reviews)],
  'room-projects.parseRoomProjects': [mut((c) => c.s.roomProjects)], 'signature-drinks.parseSignatureDrinks': [mut((c) => (c.r.chance(0.3) ? ((ids) => ({ ...c.s.signatureDrinks, tested: ids, recipes: ids.map((id) => ({ id, name: 'Many', onMenu: c.r.chance(0.5) })) }))(Array.from({ length: 30 }, () => call('signature-drinks', 'makeSignatureId', recipe(c.r)) as string)) : c.s.signatureDrinks))], 'streets.parseStreetEstate': [mut((c) => c.s.streets)],
  'styles.parseCafeStyle': [mut((c) => c.s.cafeStyle)], 'taste.parseTaste': [mut((c) => c.s.taste)], 'trial-sales.parseTrialSales': [mut((c) => c.s.trialSales)], 'state.cleanName': [(c) => c.r.pick([...JUNK, '  小豆咖啡馆 ', '👩‍🍳👍🏽éé'.repeat(4), 'abcdefghijklmnopqrstuvwxyz', '　x '])],
  'state.roundTrip': [(c) => rawSave(c)], 'state.deserialize': [(c) => c.r.pick([() => JSON.stringify(c.s), () => JSON.stringify(legacy(c.s, c.r)), () => JSON.stringify(legacy(c.s, c.r)), () => JSON.stringify(damage(legacy(c.s, c.r), c.r)), () => JSON.stringify(damage(c.s, c.r, 1 + c.r.int(9))), () => JSON.stringify({ ...(damage(c.s, c.r, 2) as object), version: c.r.int(28) }), () => c.r.pick([null, '', '{', 'null', '[]', '3', '"x"', '{"version":1e999}'])])()],
  'signature-drinks.validateSignatureRecipe': [(c) => c.r.pick([...IDS.base, 'nope', null]), (c) => (c.r.chance(0.5) ? recipe(c.r)[1] : damage(recipe(c.r)[1], c.r))], 'signature-drinks.makeSignatureId': [undefined, (c) => (c.r.chance(0.7) ? recipe(c.r)[1] : damage(recipe(c.r)[1], c.r))],
  'signature-drinks.signatureDefinition': [sig], 'signature-drinks.isSignatureId': [(c) => (c.r.chance(0.6) ? sig(c, {} as Param) : c.r.pick(JUNK))], 'signature-drinks.saveSignature': [state, sig, (c) => c.r.pick(['My Blend', '  ', '\u0007拿铁\n', 'x'.repeat(40)])],
  'signature-drinks.replaceSignature': [(c) => { c.s.phase = c.r.pick(['prep', 'prep', 'prep', 'open']); c.s.kitchen = true; for (const x of IDS.menu) c.s.items[x as ItemId] = 1; return trialling(c); }, (c) => (c.s.trialSales.selected && c.r.chance(0.6) ? c.s.trialSales.selected : sig(c, {} as Param)), (c) => (c.s.signatureDrinks.tested.length && c.r.chance(0.6) ? c.r.pick(c.s.signatureDrinks.tested) : sig(c, {} as Param)), () => 'Swap'], 'signature-drinks.renameSignature': [state, sig, (c) => c.r.pick(['New', '', ' 茶 '])], 'signature-drinks.deleteSignature': [trialling, sig], 'signature-drinks.trialSignature': [(c) => { if (c.r.chance(0.2)) c.s.pantry.milk = c.r.pick([NaN, -1]); return c.s; }, (c) => c.r.pick(IDS.base), (c) => recipe(c.r)[1]], 'signature-drinks.listSignatureDrinks': [(c) => (c.r.chance(0.1) ? {} : c.s)], 'signature-drinks.setSignatureOnMenu': [state, sig],
  'building-spots.buildingSpot': [(c) => c.r.pick([...IDS.spot, undefined, 'nope'])], 'decor.hasBoughtDecor': [(c) => { if (c.r.chance(0.3)) { c.s.decor = { ...c.s.decor, owned: [...c.s.decor.owned.slice(0, 3), 'nope'], placed: [{ id: 'nope', col: 1, row: 1 }, { id: 'clock', col: 2, row: 1 }], stored: {} }; } return c.s; }], 'regions.buildSeconds': [(c) => (c.r.chance(0.1) ? {} : c.s)], 'regions.canBookAhead': [(c) => (c.r.chance(0.1) ? {} : c.s)], 'regions.startConstruction': [(c) => { if (c.r.chance(0.5)) { c.s.coins = 1e9; c.s.chain.branches = 3; c.s.phase = 'prep'; } return c.s; }], 'decor.comfort': [(c) => { if (c.r.chance(0.1)) (c.s.decor.equipped as Dict).sill = 'nope'; return c.s; }], 'locations.cafeLocation': [(c) => (c.r.chance(0.1) ? {} : c.s)], 'milestones.claimChapter': [(c) => { if (c.r.chance(0.25)) { for (const k of Object.keys(c.s.decor.equipped)) (c.s.decor.equipped as Dict)[k] = 'nope'; } return c.s; }], 'building-spots.storeys': [(c) => c.r.int(30)], 'decor.decorDef': [str(() => IDS.decor)], 'decor.ownsDecor': [state, str(() => [...IDS.decor, ...IDS.furniture])], 'decor.useDecor': [state, str(() => IDS.decor)], 'decor.applyTheme': [state, str(() => IDS.theme)],
  'furniture.furnitureDef': [str(() => IDS.furniture)], 'furniture.canPlace': [(c) => { if (c.r.chance(0.3)) c.s.regions = IDS.region.slice() as typeof c.s.regions; return c.s; }, (c) => (c.r.chance(0.5) ? c.r.pick(IDS.furniture) : str(ownFurniture)(c, {} as Param)), (c) => (c.r.chance(0.4) ? (call('regions', 'regionOffset', [c.r.pick(IDS.area)]) as number) / 8 + 12 + c.r.int(14) : c.r.int(c.s.regions.length ? 240 : 40))], 'furniture.blocksNextTable': [state, str(ownFurniture)], 'furniture.storedCount': [state, str(ownFurniture)], 'furniture.placedCount': [state, str((c) => [...c.s.decor.placed.map((p) => p.id), 'lamp'])],
  'furniture.buyFurniture': [state, str(() => IDS.furniture)], 'furniture.placeFurniture': [state, str(ownFurniture)], 'furniture.moveFurniture': [state, (c) => cell(c)[0], (c) => cell(c)[1], (c) => cell(c)[2], (c) => call('regions', 'mainTableCount', [c.s])], 'furniture.openSpots': [state, str(ownFurniture)], 'furniture.canStand': [state, str(ownFurniture), str(() => IDS.spot)], 'furniture.standFurniture': [state, str(ownFurniture), str(() => IDS.spot)], 'furniture.moveToSpot': [state, undefined, str(() => IDS.spot)],
  'goals.claimGoal': [state], 'goals.goalProgress': [(c) => c.r.pick((MODS.goals.GOALS as { id: string }[]).map((g) => g.id)), state], 'milestones.milestoneProgress': [(c) => c.r.pick(IDS.milestone), state], 'milestones.milestoneReady': [(c) => c.r.pick(['rating40', 'rating40', 'served1000']), state], 'milestones.milestoneDef': [str(() => IDS.milestone)], 'milestones.chapterOf': [str(() => IDS.milestone)], 'milestones.milestoneDone': [state, str(() => IDS.milestone)], 'milestones.recordDay': [state, (c) => otherDay(c.shot.report as Dict, c.s, c.r)], 'orders.isOrderKind': [any], 'cat-gifts.isGiftKind': [any], 'styles.isCafeStyle': [any],
  'locations.isLocation': [any], 'chain-bonuses.isPerk': [any], 'customer-demand.isGuestKind': [any], 'regular-wishes.isMinaWishChoice': [any], 'partners.partnerDefinition': [str(() => IDS.partner)], 'partners.recruitPartner': [state, str(() => IDS.partner)], 'partners.assignPartner': [state, str((c) => Object.keys(c.s.partners.roster))],
  'partners.trainPartner': [state, str((c) => Object.keys(c.s.partners.roster))], 'partners.recordPartnerWork': [state, str((c) => Object.keys(c.s.partners.roster))], 'partners.readPartnerChapter': [state, str((c) => Object.keys(c.s.partners.roster))], 'partners.activePartner': [state, undefined, (c) => c.r.int(4) - 1],
  'partners.partnerBrewMultiplier': [state, str(() => IDS.partner)], 'partners.partnerServerSpeed': [state, str(() => IDS.partner)], 'partners.partnerTraySize': [state, str(() => IDS.partner)], 'partners.partnerCookSpeed': [state, str(() => IDS.partner)], 'partners.partnerStationTime': [state, str(() => IDS.partner)],
  'pets.petPreferences': [(c) => damage(c.s.pets[0] ?? { id: 'ginger' }, c.r, c.r.int(2))], 'pets.catDef': [str(() => IDS.cat)], 'pets.adoptCat': [state, str((c) => (c.s.pets.length && c.r.chance(0.5) ? c.s.pets.map((p) => p.id) : IDS.cat))], 'pets.refillPet': [state, str((c) => [...c.s.pets.map((p) => p.id), 'ginger'])], 'promotion.promotionPlan': [str(() => IDS.promotion)], 'promotion.bookPromotion': [state, str(() => IDS.promotion)],
  'regular-guests.regularGuestDefinition': [str(() => IDS.regular)], 'regular-guests.regularGuestProgress': [state, str(() => IDS.regular)], 'regular-guests.regularGuestChapterRequirement': [str(() => IDS.regular), (c) => c.r.int(5) - 1], 'regular-guests.recordRegularGuestArrival': [state, str(() => IDS.regular)],
  'regular-guests.recordRegularGuestService': [(c) => { if (c.r.chance(0.5)) c.s.regularGuests.nextVisitId = 400; return c.s; }, str((c) => (c.r.chance(0.4) ? ['mina'] : IDS.regular)), (c) => c.r.pick([...Object.values(c.s.regularGuests.guests).flatMap((g) => g?.pendingVisitIds ?? []), 1, c.s.regularGuests.nextVisitId])], 'regular-guests.recordRegularGuestDeparture': [state, str(() => IDS.regular), (c) => c.r.pick([...Object.values(c.s.regularGuests.guests).flatMap((g) => g?.pendingVisitIds ?? []), 1])],
  'regular-guests.markRegularGuestChapterRead': [state, str(() => IDS.regular), (c) => c.r.int(5) - 1], 'regular-guests.regularGuestUnreadCount': [state, str(() => IDS.regular)], 'regular-guests.regularGuestOrder': [state, str((c) => (c.r.chance(0.5) ? ['mina'] : IDS.regular)), onSale, (c) => (c.r.chance(0.5) ? null : onSale(c))], 'streets.validStreetLotId': [str(() => IDS.lot)], 'streets.applyStreetBlueprint': [state, (c) => (call('streets', 'streetLotIds', [c.s]) as string[]).map((x) => ({ id: x, progress: c.r.next() }))],
  'economy.maxAffordable': [(c) => c.r.pick([4, 12.5, 200, 9000, 0.3]), undefined, undefined, (c) => c.r.pick([() => 4, () => c.r.next() * 1e6, () => (call('economy', 'bulkCost', [12.5, 1.15, 3, 1 + c.r.int(60)]) as number)])()], 'economy.offerTrialSale': [(c) => { const s = forMina(c); if (c.r.chance(0.6)) { s.kitchen = true; s.phase = 'open'; for (const i of IDS.ingredient) s.pantry[i as keyof typeof s.pantry] = 50; s.onMenu.push('roll'); } return s; }, (c) => (c.r.chance(0.4) ? c.r.pick(['roll', 'cake'] as const) : onSale(c)), (c) => (c.r.chance(0.5) ? null : onSale(c)), (c) => c.r.pick([undefined, ...IDS.regular])], 'trial-sales.canTrialDrink': [state, item], 'trial-sales.trialOfferDue': [state, (c) => c.r.pick([undefined, ...IDS.regular])], 'trial-sales.canReserveTrialSale': [state, (c) => c.r.pick([undefined, ...IDS.regular])], 'trial-sales.reserveTrialSale': [state, (c) => c.r.pick([undefined, ...IDS.regular])],
  'cat-gifts.collectGift': [state, (c) => (c.s.catGifts.waiting.length ? c.r.pick(c.s.catGifts.waiting).id : 1)], 'locations.locationDef': [(c) => c.r.pick(IDS.location)], 'layout.resizeRoomPoint': [(c) => (c.r.chance(0.4) ? { x: c.r.pick([4, 8, 316, 324, 330, -6, -315]), y: (call('layout', 'doorwayY', [c.r.pick(IDS.area), c.r.pick(['left', 'right']), c.r.pick([240, 251, 300, 360])]) as number) } : point(c))], 'layout.tableRowY': [(c) => c.r.int(3)], 'layout.setKitchenLevel': [(c) => c.r.pick([0, 1, 2, 3, -1, 1.7, NaN, Infinity])], 'format.formatDuration': [(c) => c.r.pick(NUMBERS.filter(Number.isFinite))],
  'customer-cast.x': [], 'taste.mealTaste': [state, meal], 'trial-sales.trialFeedback': [item], 'settlement-advice.settlementAdvice': [(c) => otherDay(c.shot.report as Dict, c.s, c.r), (c) => c.r.pick([() => poor(c.s, c.r), () => stocked(c.s, c.r), () => stocked(c.s, c.r), () => short(c.s, c.r), () => c.s])()], 'recovery.canEmergencyRestock': [(c) => beanless(c)], 'traffic.trafficAt': [(c) => c.r.pick([c.r.next() * 220, NaN, -4])], 'recovery.emergencyRestock': [(c) => beanless(c)], 'first-service.isFirstCafe': [(c) => fresh(c)], 'first-service.firstServiceStep': [(c) => (c.r.chance(0.5) ? fresh(c) : c.s)],
  'guest-memories.recordGuestMemory': [state, (c) => guest(c), (c) => bought(c), (c) => c.r.pick([undefined, anyItem(c.s, c.r), c.dish])], 'guest-memories.rememberedOrder': [state, (c) => c.r.pick([...Object.keys(c.s.guestMemories).map(Number), c.r.int(40)])], 'trial-sales.trialHeldForMina': [(c) => forMina(c)], 'trial-sales.canReserveTrialSale': [(c) => forMina(c), (c) => c.r.pick([undefined, 'mina', 'theo'])], 'trial-sales.reserveTrialSale': [(c) => forMina(c), (c) => c.r.pick([undefined, 'mina', 'theo'])], 'trial-sales.trialOfferDue': [(c) => forMina(c), (c) => c.r.pick([undefined, 'mina', 'theo'])], 'streets.upgradeStreetShop': [(c) => { c.s.coins = c.r.pick([c.s.coins, 1e9, 1e9]); c.s.roomProjects.inspiration = c.r.pick([0, 400, 400]); return c.s; }], 'streets.migrateIndoorShops': [(c) => { if (c.r.chance(0.5) && c.s.regions.length) { delete c.s.decor.building; c.s.decor.placed.push({ id: 'lamp', col: 50 + c.r.int(60), row: 5 }, { id: 'lamp', col: 90, row: 6 }); } return c.s; }],
  'conditions.conditionOn': [(c) => (c.r.chance(0.1) ? { createdAt: c.r.pick([NaN, -5, 2 ** 33 + 0.5, Infinity]) } : c.s), (c) => c.r.int(60)], 'reputation.mealReview': [state, (c) => { const best = c.s.taste.signature; return best.length && c.r.chance(0.6) ? [c.r.pick(best)] : meal(c); }, (c) => c.r.pick([0, 3, 9, 20, 45])], 'kitchen.cookHome': [(c) => c.r.int(4)], 'kitchen.startBatch': [state, baked, (c) => c.r.pick([1, 2, 5, 0, 2.5])], 'kitchen.shelveBatch': [state, baked, (c) => c.r.pick([1, 2, 5, 0, 1.5, 40])], 'kitchen.nextBatch': [state, (c) => (c.r.chance(0.5) ? [] : [baked(c)])],
  'kitchen.kitchenPath': [cookPoint, cookPoint], 'navigation.routeFloorSegment': [near, near, (c) => (c.r.chance(0.12) ? [{ x: 0, y: 120, w: 320, h: 6 }, { x: 100, y: 90, w: 8, h: 160 }] : Array.from({ length: c.r.pick([0, 1, 3, 6, 9]) }, () => rect(c))), undefined], 'navigation.segmentCrossesObstacle': [near, near, (c) => (c.r.chance(0.9) ? rect(c) : { ...rect(c), w: c.r.pick([0, -4, NaN]) })], 'furniture.footprint': [undefined, (c) => c.r.int(30), (c) => c.r.int(14)], 'styles.styleSaleMultiplier': [(c) => gardening(c), undefined, undefined, undefined, (c) => (c.r.chance(0.5) ? [c.r.pick(['blacktea', 'chai']), c.r.pick(['scone', 'cake'])] as ItemId[] : meal(c))], 'styles.nextStyleGoal': [(c) => { if (c.r.chance(0.4)) c.s.signatureDrinks.served['sig:bad'] = 3; return c.s; }], 'styles.styleStages': [(c) => { if (c.r.chance(0.4)) { c.s.signatureDrinks.served['sig:bad'] = 3; c.s.taste.signature.push('nope' as ItemId); } return c.s; }],
  'economy.passCapacity': [(c) => { if (c.r.chance(0.2)) delete (c.s.upgrades as Dict).pass; return c.s; }], 'economy.tableServiceCapacity': [(c) => { if (c.r.chance(0.2)) delete (c.s.upgrades as Dict).pass; return c.s; }], 'economy.setOnMenu': [(c) => { const off = IDS.menu.filter((x) => c.s.items[x as ItemId] > 0 && !c.s.onMenu.includes(x as ItemId)); if (off.length && c.r.chance(0.6)) { c.s.phase = 'prep'; c.s.trialSales.selected = c.r.pick(off) as ItemId; } return c.s; }, (c) => (c.s.trialSales.selected && c.r.chance(0.6) ? c.s.trialSales.selected : item(c))],
  'manager.managerOpen': [(c) => (c.r.chance(0.4) ? poor(c.s, c.r) : c.s)], 'manager.tillUpgradeCost': [(c) => { if (c.r.chance(0.3)) c.s.manager.till = 9; return c.s; }], 'cat-gifts.giftKindsFound': [(c) => { if (c.r.chance(0.5)) c.s.catGifts.found = Object.fromEntries(IDS.gift.slice(0, 1 + c.r.int(3)).map((k) => [k, 1])) as typeof c.s.catGifts.found; return c.s; }], 'styles.currentStyleStage': [(c) => { if (c.r.chance(0.35)) { const s = c.s; s.day = 50; s.served = 5000; s.kitchen = true; s.regions = IDS.region.slice() as typeof s.regions; s.upgrades.barista = 3; s.upgrades.server = 5; s.upgrades.tables = 6; s.upgrades.machine = 20; s.pets = IDS.cat.map((id) => ({ id, careSeconds: 500, autoRefill: true })) as never; s.reputation.recent = Array.from({ length: 50 }, () => ({ stars: 5, reason: 'prompt', day: 50 })); for (const m of IDS.menu) { s.items[m as ItemId] = 20; s.taste.served[m as ItemId] = 100; } s.cafeStyle.handoffs = { tableServed: 500, catServed: 500, fastServed: 500, teaPairs: 500 }; s.decor.placed.push({ id: 'bookshelf', col: 1, row: 1 }); } return c.s; }], 'furniture.furnitureComfort': [(c) => { if (c.r.chance(0.1)) c.s.decor.placed.push({ id: 'nope', col: 1, row: 1 }); return c.s; }], 'furniture.settleInBuilding': [(c) => { if (c.r.chance(0.5)) { delete c.s.decor.building; c.s.decor.placed = [{ id: 'plant_fern', col: 2, row: 17 }, ...Array.from({ length: c.r.pick([2, 8, 70]) }, () => ({ id: c.r.pick(IDS.furniture), col: c.r.int(40), row: c.r.int(14) }))]; } return c.s; }],
  'taste.researchSignature': [state, (c) => (c.r.chance(0.7) ? c.r.pick(IDS.menu.filter((x) => c.s.items[x as ItemId] > 0)) : item(c))], 'taste.researchBlock': [state, (c) => (c.r.chance(0.7) ? c.r.pick(IDS.menu.filter((x) => c.s.items[x as ItemId] > 0)) : item(c))],
  'format.formatNumber': [(c) => c.r.pick([...NUMBERS, -5, 999.99, 1000, 12_345, 1e6, 999_999_999, 1.234e40, c.r.next() * 10 ** c.r.int(40)])], 'format.formatMoney': [(c) => c.r.next() * 10 ** c.r.int(20)], 'format.formatTransactionMoney': [(c) => c.r.pick([1e40, 0, 0.001, -0.004, 0.005, 12.345, 999.999, 1000, 99_999, 1e5, 123_456_789.5, 1e6, -3, NaN, c.r.next() * 10 ** c.r.int(12)])],
  'format.formatExactMoney': [(c) => c.r.next() * 10 ** (c.r.int(30) - 8)], 'format.formatAccountMoney': [(c) => (c.r.next() - 0.3) * 10 ** c.r.int(9)], 'format.formatRate': [(c) => c.r.pick([0, 0.05, 0.6, 12.34, 99.99, 100, 1e7, -2, c.r.next() * 100])],
};

function argument(key: string, at: number, p: Param, c: Ctx): unknown {
  const own = BY_FUNCTION[key]?.[at];
  if (own) return own(c, p);
  if (/\bGameState\b|^Located$|SignatureGameState/.test(p.type)) return /undefined/.test(p.type) && c.r.chance(0.12) ? undefined : c.s;
  if (p.type === 'number' || p.type === 'number | undefined' || (p.type === '' && BY_NAME[p.name])) return (BY_NAME[p.name] ?? ((x: Ctx) => x.r.pick(NUMBERS)))(c, p);
  if (BY_TYPE[p.type]) return BY_TYPE[p.type](c, p);
  if (p.type === '' && p.name === 'items') return menu(c);
  if (p.type === '' && (p.name === 'vip' || p.name === 'dineIn')) return c.r.chance(0.5);
  if (p.type === 'unknown') return any(c, p);
  throw new Error(`No argument generator for ${key} parameter ${p.name}: ${p.type || '(untyped)'}`);
}

/** Which fields a call changed, and to what, so a setter's different effects count as different outcomes. */
function changes(before: unknown[], after: unknown[]): string {
  const out: string[] = [];
  after.forEach((x, i) => {
    if (!x || typeof x !== 'object') return;
    for (const k of new Set([...Object.keys(x), ...Object.keys(before[i] as Dict)])) {
      const was = JSON.stringify(wire((before[i] as Dict)[k])), is = JSON.stringify(wire((x as Dict)[k]));
      if (was !== is) out.push(`${k}=${is.slice(-160)}`);
    }
  });
  return `~${out.join()}`;
}

// ---------------------------------------------------------------- running one case

const layout = MODS.layout as Record<string, (...a: unknown[]) => unknown>;
function enter(setup: Setup) {
  layout.setSceneHeight(setup.height); layout.setKitchenLevel(setup.kitchen); setLocale(setup.locale); Date.now = () => setup.clock;
}
export function perform(c: Case): { args: unknown[]; ret: unknown; after: [unknown, unknown] } | null {
  enter(c.setup);
  const args = clone(c.args);
  let ret: unknown;
  // Godot has no exceptions: the few functions that throw on purpose return null there.
  try { ret = call(c.mod, c.fn, args); } catch { if (!THROWS.has(`${c.mod}.${c.fn}`)) return null; ret = null; }
  return { args, ret: ret === undefined ? undefined : ret, after: [layout.sceneHeight(), layout.kitchenLevel()] };
}

/** Shuffled guest appearances: what it hands out, what it saves, and how many random numbers it took. */
function castCycles(r: Random): unknown[] {
  const Cycle = MODS['customer-cast'].CustomerCastCycle as new (rng: () => number) => { next(): number; snapshot(): unknown; restore(v: unknown): boolean };
  return Array.from({ length: 80 }, (_, n) => {
    const rng = lcg(n + 1), cycle = new Cycle(rng), steps: unknown[] = [];
    let saved: unknown = null;
    for (let i = 0; i < 160; i++) {
      const op = r.pick(['next', 'next', 'next', 'next', 'next', 'next', 'next', 'next', 'snapshot', 'restore']);
      const arg = op === 'restore' ? (r.chance(0.5) ? clone(saved) : damage(saved ?? {}, r)) : undefined;
      const ret = op === 'next' ? cycle.next() : op === 'snapshot' ? (saved = clone(cycle.snapshot())) : cycle.restore(clone(arg));
      steps.push({ m: op, a: op === 'restore' ? [wire(arg)] : [], r: wire(ret) });
    }
    return { c: 'CustomerCastCycle', s: n + 1, steps, d: rng.draws() };
  });
}

/** Candidates that run something no kept case has run yet. */
function widening(candidates: Case[], have: Uint8Array): Case[] {
  const adds = (map: Uint8Array) => { for (let i = 0; i < map.length; i++) if (map[i] && !have[i]) return true; return false; };
  const search = (list: Case[]): Case[] => {
    if (!list.length) return [];
    reached(); for (const c of list) perform(c);
    const map = reached();
    if (!adds(map)) return [];
    if (list.length === 1) { for (let i = 0; i < map.length; i++) if (map[i]) have[i] = 1; return list; }
    const half = list.length >> 1;
    return [...search(list.slice(0, half)), ...search(list.slice(half))];
  };
  const out: Case[] = [];
  for (let at = 0; at < candidates.length; at += 128) out.push(...search(candidates.slice(at, at + 128)));
  return out;
}

function main(): void {
  startCoverage();
  const out = process.argv[2], only = (process.argv[3] ?? '').split(',').filter(Boolean);
  const signatures = JSON.parse(readFileSync(join(out, 'signatures.json'), 'utf8')) as Record<string, Record<string, Param[]>>;
  const whitelist = JSON.parse(readFileSync(process.argv[4], 'utf8')) as Whitelist;
  for (const name of only) if (!MODS[name]) throw new Error(`Unknown module: ${name}`);
  const shots: Shot[] = [];
  for (let seed = 1; seed <= 40; seed++) play(seed, seed % 3 ? 7 : 16, (shot) => shots.push(shot));
  const reports = shots.filter((s) => s.report), serving = shots.filter((s) => s.snapshot);
  const modules = Object.keys(MODS).filter((m) => (only.length ? only.includes(m) : whitelist.modules.includes(m)));
  const dir = process.argv[5];
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const kept: Case[] = [], errors: string[] = [], manifest: Dict[] = [], have = new Uint8Array(bundleText.length);
  for (const mod of modules) {
    const pool = new Pool(), tallies = new Map<string, Tally>(), rows: unknown[] = [];
    const r = new Random(lcg([...mod].reduce((h, ch) => Math.imul(h, 31) + ch.charCodeAt(0) | 0, 7)));
    const record = (c: Case, always: boolean): boolean => {
      const before = JSON.stringify(wire(c.args)), result = perform(c);
      if (!result) return false;
      const after = JSON.stringify(wire(result.args)), ret = wire(result.ret), tally = tallies.get(c.fn) ?? { cases: 0, outcomes: new Set<string>(), mutated: 0 };
      const outcome = JSON.stringify(ret).slice(0, 4000) + (before === after ? '' : changes(c.args, result.args));
      if (!always && tally.outcomes.has(outcome)) return false;
      tally.cases++; tally.outcomes.add(outcome); if (before !== after) tally.mutated++;
      tallies.set(c.fn, tally);
      rows.push({ f: c.fn, a: c.args.map((x) => pool.put(x)), r: pool.put(result.ret), ...(before === after ? {} : { b: result.args.map((x) => pool.put(x)) }),
        h: wire(c.setup.height), k: c.setup.kitchen, l: c.setup.locale, t: wire(c.setup.clock), g: wire(result.after) });
      kept.push({ ...c, args: clone(c.args) });
      return true;
    };
    for (const c of HAND(mod, shots.map((s) => s.state), r)) record({ mod, fn: c.fn, args: c.args, setup: { height: 240, kitchen: 0, locale: 'zh', clock: EPOCH, seed: 0, ...c.setup } }, true);
    const exports: Record<string, unknown> = { ...MODS[mod], ...INSIDE[mod] };
    for (const fn of Object.keys(exports)) {
      const key = `${mod}.${fn}`;
      if (typeof exports[fn] !== 'function' || whitelist.elsewhere[key]) continue;
      const params = key === 'state.roundTrip' ? signatures.state.deserialize : INSIDE[mod]?.[fn] ? [{ name: 'id', type: 'string', optional: false }, { name: 's', type: 'GameState', optional: false }] : signatures[mod]?.[fn];
      if (!params) throw new Error(`No signature for ${key}`);
      const tries = params.length === 0 ? 40 : TRIES[mod] ?? 1400, plainly = key === 'state.roundTrip' ? 600 : 45;
      let plain = 0, quiet = 0;
      const from = kept.length, rest: Case[] = [];
      for (let n = 0; n < tries && (plain < plainly || quiet < (TRIES[mod] ?? 900)); n++) {
        const needsReport = params.some((p) => /DayReport/.test(p.type));
        const shot = r.pick(needsReport ? reports : key === 'sim-snapshot.validSnapshot' ? serving : shots), c: Ctx = { r, shot, s: vary(shot.state, r) };
        let args = params.map((p, i) => argument(key, i, p, c));
        for (let i = params.length - 1; i >= 0 && params[i].optional && r.chance(0.4); i--) args = args.slice(0, i);
        const setup: Setup = { height: r.pick([240, 240, 264, 300, 333, 360]), kitchen: r.int(3), locale: r.pick(['zh', 'en']), clock: clock(c), seed: 0 };
        const c1 = { mod, fn, args, setup };
        if (plain < Math.max(160, plainly) && record(c1, plain < plainly)) { plain++; quiet = 0; } else { quiet++; rest.push(c1); }
      }
      reached(); for (const c1 of kept.slice(from)) perform(c1);
      const map = reached(); for (let i = 0; i < map.length; i++) if (map[i]) have[i] = 1;
      for (const c1 of widening(rest, have)) record(c1, true);
    }
    errors.push(...checkGate(mod, exports, tallies, whitelist));
    const constants = Object.fromEntries(Object.entries(MODS[mod]).filter(([k, v]) => typeof v !== 'function' && !whitelist.constants?.[`${mod}.${k}`]).map(([k, v]) => [k, wire(v)]));
    const objects = mod === 'customer-cast' ? castCycles(new Random(lcg(1))) : [];
    writeFileSync(join(dir, `${mod}.json`), `{"module":${JSON.stringify(mod)},"constants":${JSON.stringify(constants)},"pool":[${pool.items.join(',')}],"cases":${JSON.stringify(rows)},"objects":${JSON.stringify(objects)}}`);
    manifest.push({ name: mod, cases: rows.length, constants: Object.keys(constants).length });
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  // Other processes cover other modules; only branches none of them reached are missing.
  const { branches, map } = unreached(kept);
  writeFileSync(join(dir, 'reached.bin'), map);
  writeFileSync(join(dir, 'gate.json'), JSON.stringify({ errors, cases: kept.length, states: shots.length, branches }));
}

/** Replays only the kept cases: which characters of the bundle ran, and every stretch of rules code that did not. */
function unreached(cases: Case[]): ReturnType<typeof stretches> {
  reached(); // Starts counting from zero.
  for (const c of cases) perform(c);
  castCycles(new Random(lcg(1)));
  return stretches();
}
main();
