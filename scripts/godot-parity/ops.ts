// A seeded player that only uses the game's own functions. Every action is data ([module, function, ...args]),
// so the same list can be replayed in Godot. "$S" is the state, "$N" the clock, "$SIM" the running Sim.
import { MODS, call } from './mods';
import { lcg, type Rng } from './wire';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';
import type { ItemId } from '../../src/game/data';

export type Op = [mod: string, fn: string, ...args: unknown[]];
type Dict = Record<string, unknown>;
const ids = (mod: string, name: string): string[] => (MODS[mod][name] as ({ id: string } | string)[]).map((x) => (typeof x === 'string' ? x : x.id));

export const IDS = {
  menu: ids('data', 'MENU'), ingredient: ids('data', 'INGREDIENTS'), upgrade: ids('data', 'UPGRADES'), cat: ids('pets', 'CATS'),
  partner: ids('partners', 'PARTNERS'), furniture: ids('furniture', 'FURNITURE'), decor: ids('decor', 'DECOR'), theme: ids('decor', 'STARTER_THEMES'),
  region: ids('regions', 'REGIONS'), area: ids('regions', 'AREA_IDS'), location: ids('locations', 'LOCATION_IDS'), perk: ids('chain-bonuses', 'PERKS'),
  order: ids('orders', 'ORDERS'), promotion: ids('promotion', 'PROMOTION_PLANS'), project: ids('room-projects', 'ROOM_PROJECTS'),
  mode: Object.keys(MODS['room-projects'].PROJECT_MODES as object), blueprint: ids('room-projects', 'BLUEPRINTS'), plot: ids('streets', 'STREET_PLOTS'),
  style: ids('styles', 'STYLE_IDS'), spot: ids('building-spots', 'BUILDING_SPOTS'), regular: ids('regular-guests-content', 'REGULAR_GUESTS'),
  condition: ids('conditions', 'CONDITIONS'), guest: ids('customer-demand', 'GUEST_KINDS'), slot: ids('decor', 'DECOR_SLOTS'), role: ids('partners', 'PARTNER_ROLES'),
  gift: ids('cat-gifts', 'GIFT_KINDS'), base: ids('signature-drinks', 'SIGNATURE_BASES'), addon: ids('signature-drinks', 'SIGNATURE_ADDONS'),
  flavor: ids('flavors', 'FLAVORS'), category: ids('data', 'CATEGORIES'), lot: [] as string[], chapter: ids('milestones', 'CHAPTERS'),
  milestone: (MODS.milestones.CHAPTERS as { milestones?: { id: string }[]; goals?: { id: string }[] }[]).flatMap((c) => (c.milestones ?? c.goals ?? []).map((m) => m.id)),
  station: Object.keys(MODS.kitchen.STATION_SECONDS as object), reason: ids('reputation', 'REVIEW_REASONS'),
};
IDS.lot = IDS.location.flatMap((l) => IDS.plot.map((p) => `${l}:${p}`));

export class Random {
  constructor(readonly next: Rng) {}
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(list: readonly T[]): T { return list[this.int(list.length)]; }
  chance(p: number) { return this.next() < p; }
}

/** A recipe the player might try: usually a valid one, built the way the recipe bench offers add-ons. */
export function recipe(r: Random): [string, Dict] {
  const base = r.pick(IDS.base), main = (MODS['signature-drinks'].BASE_INGREDIENT as Record<string, string>)[base];
  const out: Dict = { [main]: 1 + r.int(2) };
  for (let n = r.int(4); n > 0; n--) {
    const offered = r.chance(0.1) ? IDS.addon : call('signature-drinks', 'compatibleSignatureAddons', [base, out]) as string[];
    if (offered.length) out[r.pick(offered)] = 1 + r.int(2);
  }
  return [base, out];
}
const ownSignatures = (s: GameState) => s.signatureDrinks.recipes.map((x) => x.id as string);
export const anyItem = (s: GameState, r: Random) => (r.chance(0.2) && ownSignatures(s).length ? r.pick(ownSignatures(s)) : r.pick(IDS.menu));
const offMenu = (s: GameState) => [...IDS.menu.filter((id) => s.items[id as ItemId] > 0 && !s.onMenu.includes(id as ItemId)), ...s.signatureDrinks.recipes.filter((x) => !x.onMenu).map((x) => x.id as string)];
const petOf = (s: GameState, r: Random) => (s.pets.length && r.chance(0.8) ? r.pick(s.pets).id : r.pick(IDS.cat));
const tables = (s: GameState) => call('regions', 'mainTableCount', [s]) as number;

/** One random thing a player can do between days (and mostly at any time). */
export function prepOp(s: GameState, r: Random): Op {
  const item = () => anyItem(s, r), amount = () => r.pick([1, 1, 10, 'max'] as const);
  const open = () => (s.streets ? Object.keys(s.streets.lots) : []);
  const ops: (() => Op)[] = [
    () => ['economy', 'buyItem', '$S', r.pick(IDS.menu), amount()], () => ['economy', 'buyItem', '$S', r.pick(IDS.menu), amount()],
    () => ['economy', 'buyUpgrade', '$S', r.pick(IDS.upgrade), amount()], () => ['economy', 'buyUpgrade', '$S', r.pick(IDS.upgrade), amount()],
    () => ['economy', 'setOnMenu', '$S', item(), r.chance(0.7)], () => ['economy', 'restock', '$S'], () => ['economy', 'restock', '$S'],
    () => ['economy', 'buyIngredient', '$S', r.pick(IDS.ingredient), 1 + r.int(40)], () => ['economy', 'setBakePlan', '$S', item(), r.int(40)],
    () => ['economy', 'bakeForForecast', '$S'], () => ['kitchen', 'unlockKitchen', '$S'],
    () => ['pets', 'adoptCat', '$S', r.pick(IDS.cat)], () => ['pets', 'refillPet', '$S', petOf(s, r)],
    () => ['partners', 'recruitPartner', '$S', r.pick(IDS.partner)], () => ['partners', 'assignPartner', '$S', r.pick(IDS.partner), r.int(4) - 1],
    () => ['partners', 'trainPartner', '$S', r.pick(IDS.partner), r.pick(['a', 'b'])], () => ['partners', 'readPartnerChapter', '$S', r.pick(IDS.partner), r.int(4)],
    () => ['signature-drinks', 'trialSignature', '$S', ...recipe(r)], () => ['signature-drinks', 'trialSignature', '$S', ...recipe(r)],
    () => ['signature-drinks', 'saveSignature', '$S', r.pick([...s.signatureDrinks.tested, 'none']), r.pick([`特调 ${r.int(9)}`, 'Blend', ' ', '\u0007x'])],
    () => ['signature-drinks', 'saveSignature', '$S', r.pick([...s.signatureDrinks.tested, 'none']), `Blend ${r.int(99)}`],
    () => ['signature-drinks', 'setSignatureOnMenu', '$S', r.pick([...ownSignatures(s), 'none']), r.chance(0.8)],
    () => ['signature-drinks', 'renameSignature', '$S', r.pick([...ownSignatures(s), 'none']), r.pick(['  新名字 ', '', 'Ünïcode 👍🏽', 'x'.repeat(60)])],
    () => ['signature-drinks', 'deleteSignature', '$S', r.pick([...ownSignatures(s), 'none'])],
    () => ['signature-drinks', 'replaceSignature', '$S', r.pick([...ownSignatures(s), 'none']), r.pick([...s.signatureDrinks.tested, 'none']), 'Swap'],
    () => ['trial-sales', 'selectTrialSale', '$S', r.chance(0.15) ? null : item()], () => ['trial-sales', 'selectTrialSale', '$S', r.pick([...offMenu(s), 'espresso'])],
    () => ['trial-sales', 'selectTrialSale', '$S', r.pick([...offMenu(s), 'espresso'])], () => ['regular-wishes', 'chooseMinaWish', '$S', r.pick(['quiet', 'milky'])],
    () => ['regular-wishes', 'setMinaWishPaused', '$S', r.chance(0.5)], () => ['regular-wishes', 'displayMinaMap', '$S', r.chance(0.5)],
    () => ['regular-guests', 'markRegularGuestChapterRead', '$S', r.pick(IDS.regular), r.int(4)],
    () => ['styles', 'startStyleWelcome', '$S', r.pick(['cats', 'bakery'])], () => ['styles', 'setCafeStyle', '$S', r.chance(0.1) ? null : r.pick(IDS.style)],
    () => ['decor', 'useDecor', '$S', r.pick(IDS.decor)], () => ['decor', 'applyTheme', '$S', r.pick(IDS.theme)],
    () => ['furniture', 'buyFurniture', '$S', r.pick(IDS.furniture)], () => ['furniture', 'buyFurniture', '$S', r.pick(IDS.furniture)],
    () => ['furniture', 'placeFurniture', '$S', r.pick(Object.keys(s.decor.stored).length ? Object.keys(s.decor.stored) : IDS.furniture), r.int(40), r.int(20), tables(s)],
    () => ['furniture', 'standFurniture', '$S', r.pick(Object.keys(s.decor.stored).length ? Object.keys(s.decor.stored) : IDS.furniture), r.pick(IDS.spot)],
    () => ['furniture', 'moveToSpot', '$S', r.int(s.decor.placed.length + 1), r.pick(IDS.spot)],
    () => ['furniture', 'moveFurniture', '$S', r.int(s.decor.placed.length + 1), r.int(40), r.int(20), tables(s)],
    () => ['furniture', 'storeFurniture', '$S', r.int(s.decor.placed.length + 1)], () => ['furniture', 'settleInBuilding', '$S'],
    () => ['promotion', 'bookPromotion', '$S', r.pick(IDS.promotion)], () => ['promotion', 'togglePromotion', '$S'],
    () => ['manager', 'hireManager', '$S'], () => ['manager', 'upgradeTill', '$S'], () => ['manager', 'collectAwayEarnings', '$S', '$N'],
    () => ['chain-bonuses', 'buyPerk', '$S', r.pick(IDS.perk)], () => ['chain', 'collectFranchises', '$S', '$N'],
    () => ['orders', 'startOrder', '$S', r.pick(IDS.order), '$N'], () => ['orders', 'collectOrder', '$S', '$N'],
    () => ['cat-gifts', 'bringGifts', '$S', '$N'], () => ['cat-gifts', 'collectGift', '$S', s.catGifts.waiting.length ? r.pick(s.catGifts.waiting).id : 1],
    () => ['room-projects', 'upgradeProject', '$S', r.pick(IDS.project), '$N'], () => ['room-projects', 'setProjectMode', '$S', r.pick(IDS.project), r.pick(IDS.mode), '$N'],
    () => ['room-projects', 'collectAllProjects', '$S', '$N'], () => ['room-projects', 'buyBlueprint', '$S', r.pick(IDS.blueprint), '$N'],
    () => ['streets', 'buyStreetPlot', '$S', r.pick(IDS.location), r.pick(IDS.plot), '$N'], () => ['streets', 'buyStreetPlot', '$S', s.chain.location, r.pick(IDS.plot), '$N'],
    () => ['streets', 'fitOutStreetPlot', '$S', r.pick(open().length ? open() : IDS.lot), r.pick(IDS.region), '$N'],
    () => ['streets', 'collectStreetShops', '$S', '$N'], () => ['streets', 'upgradeStreetShop', '$S', r.pick(open().length ? open() : IDS.lot), '$N'],
    () => ['streets', 'setStreetSchedule', '$S', r.pick(open().length ? open() : IDS.lot), r.pick(IDS.mode), '$N'],
    () => ['regions', 'startConstruction', '$S', r.pick(IDS.region), '$N'], () => ['regions', 'finishConstruction', '$S', '$N'],
    () => ['goals', 'claimGoal', '$S'], () => ['goals', 'claimGoal', '$S'], () => ['milestones', 'checkMilestones', '$S'], () => ['milestones', 'claimChapter', '$S'],
    () => ['taste', 'researchSignature', '$S', item()], () => ['recovery', 'emergencyRestock', '$S'],
  ];
  return r.pick(ops)();
}

/** Things done while the café is open, on top of some of the above. */
export function serviceOp(s: GameState, sim: Sim, r: Random): Op {
  const guest = () => (sim.customers.length ? r.pick(sim.customers).id : 1);
  const ops: (() => Op)[] = [
    () => ['$SIM', 'boost'], () => ['$SIM', 'boost'], () => ['$SIM', 'prioritizeQueue', '$S', guest()], () => ['$SIM', 'offerTrialTo', '$S', guest()],
    () => ['economy', 'restock', '$S'], () => ['economy', 'buyUpgrade', '$S', r.pick(IDS.upgrade), 1], () => ['economy', 'buyItem', '$S', r.pick(IDS.menu), 1],
    () => ['economy', 'setOnMenu', '$S', anyItem(s, r), r.chance(0.8)], () => ['milestones', 'recordMomentAnswered', '$S'], () => ['milestones', 'checkMilestones', '$S'],
    () => ['$STATE', 'speed', r.pick([1, 2, 4])], () => ['pets', 'refillPet', '$S', petOf(s, r)], () => ['promotion', 'togglePromotion', '$S'],
    () => ['partners', 'assignPartner', '$S', r.pick(IDS.partner), r.int(4) - 1], () => ['furniture', 'storeFurniture', '$S', r.int(s.decor.placed.length + 1)],
    () => ['kitchen', 'unlockKitchen', '$S'], () => ['partners', 'trainPartner', '$S', r.pick(IDS.partner), r.pick(['a', 'b'])],
    () => ['$SIM', 'resumeAfterRestock', '$S'], () => ['$GUEST', 'recommend', guest(), r.pick(s.onMenu.length ? s.onMenu : ['espresso'])],
    () => ['$GUEST', 'recommend', guest(), r.pick(s.onMenu.length ? s.onMenu : ['espresso'])], () => ['$SIM', 'beginClosing', '$S'],
  ];
  // Closing early is rare: most days should run to the end.
  const op = r.pick(ops)();
  return op[1] === 'beginClosing' && !r.chance(0.1) ? ['$SIM', 'boost'] : op;
}

export function run(op: Op, s: GameState, now: number, sim?: Sim): unknown {
  const [mod, fn, ...raw] = op;
  const args = raw.map((a) => (a === '$S' ? s : a === '$N' ? now : a));
  if (mod === '$SIM') return (sim as unknown as Record<string, (...a: unknown[]) => unknown>)[fn](...args);
  if (mod === '$GUEST') { // What answering a "recommend" moment does to the guest.
    const c = sim?.customers.find((x) => x.id === args[0]);
    if (c && fn === 'mark') { c.vip = true; c.extra = args[1] as ItemId; } else if (c && !c.hasCup) { c.order = args[1] as ItemId; c.recommendation = args[1] as ItemId; }
    return undefined;
  }
  if (mod === '$STATE') { (s as unknown as Dict)[fn] = args[0]; return undefined; }
  return call(mod, fn, args);
}

export interface Shot { state: GameState; now: number; seed: number; tag: string; customers: unknown[]; report?: unknown; snapshot?: unknown }
export const EPOCH = 1_763_000_000_000;

/** Plays `days` days from a seed and keeps states along the way: preparing, serving, closing, reports. */
export function play(seed: number, days: number, keep: (shot: Shot) => void): void {
  const r = new Random(lcg(seed * 7919 + 17)), make = MODS.state.createInitialState as (now: number) => GameState;
  let now = EPOCH + seed * 1_234_567.25;
  let state = make(now);
  state.profile = { cafeName: `Café ${seed}`, ownerName: seed % 3 ? '店主' : '', look: { skin: seed % 4, hair: seed % 6, hairStyle: seed % 32, shirt: seed % 8, pants: seed % 3 } };
  const SimClass = MODS.sim.Sim as new (rng: () => number) => Sim;
  const simRng = lcg(seed * 31 + 5);
  let sim = new SimClass(simRng);
  const rich = [0, 400, 20_000, 2_000_000, 5e9][seed % 5];
  const shot = (tag: string, report?: unknown) => keep({ state: structuredClone(state), now, seed, tag, customers: structuredClone(sim.customers), report: structuredClone(report),
    snapshot: state.phase === 'prep' ? undefined : sim.snapshot(state) });
  const step = (op: Op) => { Date.now = () => now; try { run(op, state, now, sim); } catch { /* an id the game never passes */ } };
  for (let d = 0; d < days; d++) {
    now += Math.floor(r.next() * r.pick([60_000, 3_600_000, 40_000_000])) + r.pick([0, 0.5]);
    Date.now = () => now;
    if (r.chance(0.5)) step(['economy', 'earn', '$S', rich * r.next()]);
    if (seed % 7 === 3) state.roomProjects.inspiration += r.int(120);
    if (seed % 11 === 4 && d === 2) { state.regions = ['reading', 'greenhouse', 'terrace'].slice(0, seed % 2 ? 3 : 1 + r.int(3)) as GameState['regions']; step(['economy', 'earn', '$S', 1e6 * r.next()]); }
    if (seed % 9 === 2 && d === 3) state.chain.stars += 2 + r.int(30);
    if (seed % 5 && d % 3 === 1) for (const id of IDS.ingredient) step(['economy', 'buyIngredient', '$S', id, 5 + r.int(60)]);
    for (let n = 6 + r.int(14); n > 0; n--) step(prepOp(state, r));
    if (r.chance(0.3) && (MODS.chain.canOpenBranch as (s: GameState) => boolean)(state)) {
      const next = (MODS.chain.openBranch as (...a: unknown[]) => GameState | null)(state, r.pick(IDS.location), now);
      if (next) { state = next; sim = new SimClass(simRng); }
    }
    if (seed % 3 === 1 && d === 2) { // A day at the recipe bench.
      step(['economy', 'earn', '$S', 4000]);
      for (const id of IDS.ingredient) step(['economy', 'buyIngredient', '$S', id, 40]);
      for (let n = 0; n < 6; n++) step(['signature-drinks', 'trialSignature', '$S', ...recipe(r)]);
      for (const id of state.signatureDrinks.tested.slice(0, 4)) step(['signature-drinks', 'saveSignature', '$S', id, `特调 ${id.length}`]);
      for (const x of state.signatureDrinks.recipes.slice(0, 2)) step(['signature-drinks', 'setSignatureOnMenu', '$S', x.id, true]);
      step(['trial-sales', 'selectTrialSale', '$S', r.pick([...offMenu(state), 'espresso'])]);
    }
    if (r.chance(0.5)) for (const id of IDS.menu) step(['economy', 'setOnMenu', '$S', id, r.chance(0.8)]);
    if (r.chance(0.6)) step(['economy', 'restock', '$S']);
    shot('prep');
    const opened = (MODS.day.checkOpen as (s: GameState) => { reason?: string })(state).reason !== 'emptyMenu';
    if (!opened) { state.onMenu = ['espresso']; state.coins += 50; step(['economy', 'restock', '$S']); }
    step(['day', 'openShop', '$S']);
    const dt = r.pick([0.2, 0.25, 0.1]);
    const marks = [r.int(400), 200 + r.int(700)];
    for (let i = 0; i < 4000 && state.phase !== 'prep'; i++) {
      sim.update(state, dt);
      now += dt * 1000;
      if (r.chance(0.02)) step(serviceOp(state, sim, r));
      if (marks.includes(i)) shot(state.phase);
      if (state.phase === 'closing' && i % 40 === 0 && r.chance(0.25)) shot('closing');
      if (state.phase === 'closing' && sim.finishedService) { const report = sim.closeShop(state); shot('closed', report ?? undefined); }
    }
    if (state.phase !== 'prep') { const report = sim.closeShop(state); shot('forced', report ?? undefined); }
  }
}
