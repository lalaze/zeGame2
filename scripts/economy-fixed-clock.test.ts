/** Equal wall-clock simulation supplement. Opt in with FIXED_CLOCK=1. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ItemId } from '../src/game/data';
import { openShop, type DayReport } from '../src/game/day';
import { bakeForForecast, buyItem, isBakery, menuItems, restock, servingCost } from '../src/game/economy';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { adoptCat, catDef } from '../src/game/pets';
import { bookPromotion } from '../src/game/promotion';
import { reputationScore } from '../src/game/reputation';
import { Sim, type Cook, type Customer, type Plate, type Server } from '../src/game/sim';
import { type GameState } from '../src/game/state';
import { fixture, fixtureInfo, liquidAssets, MENUS, rng, SEEDS, type Stage } from './economy-lab';

const VERSION = 1;
const DT = 0.05;
const OPEN_SECONDS = 180;
const TOTAL_SECONDS = 1800;
type Route = { id: string; stage: Stage; menu: ItemId[]; espressoTen?: boolean; cat?: boolean; promotion?: 'noteLocal'; recovery?: 'one-coin-shared' | 'nine-coin-complex'; control: string | null };
export function fixedRoutes(): Route[] {
  const routes: Route[] = [
    { id: 'early/none', stage: 'early', menu: ['espresso'], control: null },
    { id: 'early/espresso-ten', stage: 'early', menu: ['espresso'], espressoTen: true, control: 'early/none' },
    ...(['cat', 'noteLocal', 'cat-noteLocal'] as const).map((suffix) => ({ id: `early/espresso-ten-${suffix}`, stage: 'early' as const, menu: ['espresso'] as ItemId[], espressoTen: true, cat: suffix.includes('cat'), promotion: suffix.includes('noteLocal') ? 'noteLocal' as const : undefined, control: 'early/espresso-ten' })),
  ];
  for (const stage of ['mid', 'expanded'] as const) for (const name of ['fast', 'high', 'bakery', 'mixed', 'all']) {
    routes.push({ id: `${stage}/${name}`, stage, menu: [...MENUS[stage][name]], control: name === 'fast' ? null : `${stage}/fast` });
  }
  for (const suffix of ['cat', 'noteLocal', 'cat-noteLocal']) routes.push({ id: `expanded/high-${suffix}`, stage: 'expanded', menu: [...MENUS.expanded.high], cat: suffix.includes('cat'), promotion: suffix.includes('noteLocal') ? 'noteLocal' : undefined, control: 'expanded/high' });
  for (const recovery of ['one-coin-shared', 'nine-coin-complex'] as const) routes.push({ id: `recovery/${recovery}`, stage: 'early', menu: recovery === 'one-coin-shared' ? ['espresso', 'latte'] : ['latte', 'hotchoc'], recovery, control: null });
  return routes;
}
const quantityCost = (items: Partial<Record<ItemId, number>>) => Object.entries(items).reduce((sum, [id, count]) => sum + servingCost(id as ItemId) * count!, 0);
const orderIds = (c: Customer): ItemId[] => c.extra ? [c.order, c.extra] : [c.order];

/** Physical cost diagnostics only. Never add these to primary liquid wealth. */
export function paidLiveFood(state: GameState, sim: Sim) {
  const cooking = Object.fromEntries(Object.keys(state.inProduction).map((id) => [id, 0])) as Partial<Record<ItemId, number>>;
  for (const cook of sim.cooks) if (cook.batch) cooking[cook.batch.item] = (cooking[cook.batch.item] ?? 0) + cook.batch.n;
  for (const id of new Set([...Object.keys(cooking), ...Object.keys(state.inProduction)]) as Set<ItemId>) {
    if ((cooking[id] ?? 0) !== (state.inProduction[id] ?? 0)) throw new Error(`Unreconciled kitchen batch ${id}`);
  }
  const orders = sim.customers.filter((c) => !c.hasCup && ['ordering', 'toSeat', 'waiting'].includes(c.phase)).map((c) => {
    // A server's reservations overlap the pass until pickup. Pass takes precedence.
    const location = sim.pass.some((p) => p.customerId === c.id) ? 'pass'
      : sim.servers.some((s) => s.plates.some((p) => p.customerId === c.id)) ? 'server-tray'
      : 'barista-or-accepted';
    const items = orderIds(c).map((id) => ({ id, ingredientCost: servingCost(id), category: isBakery(id) ? 'bakery' : 'drink' }));
    return { customerId: c.id, phase: c.phase, location, items, ingredientCost: items.reduce((sum, i) => sum + i.ingredientCost, 0) };
  });
  if (new Set(orders.map((o) => o.customerId)).size !== orders.length) throw new Error('Duplicate customer allocation');
  const acceptedCost = orders.reduce((sum, o) => sum + o.ingredientCost, 0);
  const byLocation = Object.fromEntries(['pass', 'server-tray', 'barista-or-accepted'].map((location) => [location, orders.filter((o) => o.location === location).reduce((sum, o) => sum + o.ingredientCost, 0)]));
  const drinksCost = orders.reduce((sum, o) => sum + o.items.filter((i) => i.category === 'drink').reduce((a, i) => a + i.ingredientCost, 0), 0);
  const bakeryCost = acceptedCost - drinksCost;
  const kitchenCost = quantityCost(state.inProduction);
  const shelfCost = quantityCost(state.shelf);
  // Already abandoned table orders can linger physically on a server's tray.
  // They are not eligible live work; retain a distinct deduplicated diagnostic.
  const active = new Set(orders.map((o) => o.customerId));
  const references = [...sim.pass, ...sim.servers.flatMap((s) => s.plates)];
  const abandoned = [...new Map(references.filter((p) => !active.has(p.customerId) && !sim.customers.find((c) => c.id === p.customerId)?.hasCup).map((p) => [p.customerId, p])).values()]
    .map((p) => ({ customerId: p.customerId, items: [...p.items], cost: p.items.reduce((sum, id) => sum + servingCost(id), 0) }));
  return { kitchen: { quantities: { ...state.inProduction }, cost: kitchenCost }, shelf: { quantities: { ...state.shelf }, cost: shelfCost }, acceptedOrders: orders,
    acceptedCost, byLocation, byCategory: { drinksCost, bakeryCost },
    totalLivePaidFoodAtIngredientCost: kitchenCost + shelfCost + acceptedCost,
    abandonedAllocatedFood: abandoned, abandonedAllocatedCost: abandoned.reduce((sum, p) => sum + p.cost, 0),
    valuation: 'Ingredient cost only, already expensed by gameplay. Not cash, liquidation value, expected future revenue or guaranteed salvage. Category/location views overlap and must not be added again.' };
}

export function fixedSample(route: Route, seed: number, seconds = TOTAL_SECONDS) {
  const steps = Math.round(seconds / DT);
  if (steps <= 0 || Math.abs(steps * DT - seconds) > 1e-8) throw new Error('Horizon must be positive integral .05-second ticks');
  const state = fixture(route.stage);
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(state.kitchen ? state.upgrades.cook : 0);
  state.onMenu = [...route.menu];
  if (route.recovery) {
    state.coins = route.recovery === 'one-coin-shared' ? 1 : 9;
    state.pantry.beans = 0;
    for (const id of ['espresso', 'americano', 'latte', 'blacktea', 'hotchoc'] as ItemId[]) state.items[id] = 1;
  }
  if (menuItems(state).length !== route.menu.length) throw new Error('Illegal stage menu');
  const starting = liquidAssets(state);
  const startingAssets = { items: { ...state.items }, upgrades: { ...state.upgrades }, kitchen: state.kitchen, regions: [...state.regions], pantry: { ...state.pantry }, goal: state.goal };
  let capital = 0, includedCare = 0;
  const investmentStart = state.coins;
  if (route.espressoTen) { const before = state.coins; if (!buyItem(state, 'espresso', 10)) throw new Error('Unaffordable espresso investment'); capital += before - state.coins; }
  if (route.cat) { const cat = catDef('ginger')!; if (!adoptCat(state, cat.id)) throw new Error('Unaffordable cat'); capital += cat.adoption - cat.careCost; includedCare += cat.careCost; }
  const investmentCash = investmentStart - state.coins;
  const sim = new Sim(rng(seed));
  const settled: { endedAtSeconds: number; openSeconds: number; closingSeconds: number; queueRemovedAtClosing: number; carePurchases: number; report: DayReport }[] = [];
  let liveOpenSteps = 0, liveClosingSteps = 0, totalOpenSteps = 0, totalClosingSteps = 0;
  let queueRemovedAtClosing = 0, liveRemovedQueue = 0, openingCash = state.coins;
  let ingredientsPurchased = 0, promotionsBooked = 0, settledCarePurchases = 0;
  for (let tick = 0; tick < steps; tick++) {
    const now = tick * DT;
    // Administrative transitions happen only before a remaining tick, strictly
    // before the horizon. We never settle, reopen, shop or sell after the last tick.
    if (state.phase === 'open' && liveOpenSteps === OPEN_SECONDS / DT) {
      liveRemovedQueue = sim.customers.filter((c) => c.phase === 'queue').length;
      queueRemovedAtClosing += liveRemovedQueue;
      sim.beginClosing(state);
    }
    if (state.phase === 'closing' && sim.finishedService) {
      const report = sim.closeShop(state)!;
      const carePurchases = openingCash + report.revenue - state.coins;
      settledCarePurchases += carePurchases;
      settled.push({ endedAtSeconds: now, openSeconds: liveOpenSteps * DT, closingSeconds: liveClosingSteps * DT, queueRemovedAtClosing: liveRemovedQueue, carePurchases, report });
    }
    if (state.phase === 'prep') {
      liveOpenSteps = 0; liveClosingSteps = 0; liveRemovedQueue = 0;
      if (route.promotion && !state.promotion) { const before = state.coins; bookPromotion(state, route.promotion); promotionsBooked += before - state.coins; }
      bakeForForecast(state);
      const before = state.coins; restock(state); ingredientsPurchased += before - state.coins;
      openingCash = state.coins;
      openShop(state);
    }
    const open = state.phase === 'open';
    sim.update(state, DT);
    if (open) { totalOpenSteps++; liveOpenSteps++; } else { totalClosingSteps++; liveClosingSteps++; }
  }
  const assets = liquidAssets(state);
  const today = structuredClone(state.today);
  const reports = [...settled.map((d) => d.report), today];
  const sum = (key: 'revenue' | 'ingredientCost' | 'petCost' | 'promotionCost' | 'served' | 'missed' | 'doorLost' | 'soldOut') => reports.reduce((n, r) => n + r[key], 0);
  const revenue = sum('revenue'), ingredientsConsumed = sum('ingredientCost'), careConsumed = sum('petCost'), promotionConsumed = sum('promotionCost');
  const operatingProfitExpensed = revenue - ingredientsConsumed - careConsumed - promotionConsumed;
  const netLiquidProfit = assets.total - starting.total;
  const reconciliationError = netLiquidProfit - (operatingProfitExpensed - capital);
  const carePurchases = settledCarePurchases + openingCash + today.revenue - state.coins;
  const totalCashOut = investmentCash + ingredientsPurchased + promotionsBooked + carePurchases;
  const cashLedgerError = state.coins - (starting.cash + revenue - totalCashOut);
  const liveFood = paidLiveFood(state, sim);
  const sales = {} as Partial<Record<ItemId, number>>;
  for (const report of reports) for (const [id, count] of Object.entries(report.sales) as [ItemId, number][]) sales[id] = (sales[id] ?? 0) + count;
  const soldIngredientCost = quantityCost(sales);
  const ingredientsNotSoldOrLiveCost = ingredientsConsumed - soldIngredientCost - liveFood.totalLivePaidFoodAtIngredientCost;
  if (Math.abs(reconciliationError) > 1e-5 || Math.abs(cashLedgerError) > 1e-5) throw new Error(`Fixed-clock ledger error ${route.id}: ${reconciliationError}/${cashLedgerError}`);
  if (ingredientsNotSoldOrLiveCost < -1e-5) throw new Error(`Live food counted twice: ${route.id}`);
  if ([...Object.values(assets), ...Object.values(state.pantry)].some((n) => !Number.isFinite(n) || n < -1e-7)) throw new Error('Nonfinite/negative assets');
  if ((totalOpenSteps + totalClosingSteps) !== steps) throw new Error('Unequal elapsed clock');
  return { routeId: route.id, seed, totalSeconds: steps * DT, ticks: steps, openSeconds: totalOpenSteps * DT, closingSeconds: totalClosingSteps * DT,
    starting, startingAssets, selectedMenu: [...state.onMenu], investment: { capital, cash: investmentCash, includedCare },
    settled, completedDays: settled.length, queueRemovedAtClosing,
    terminal: { phase: state.phase, day: state.day, dayTime: state.dayTime, openSecondsThisDay: liveOpenSteps * DT, closingSecondsThisDay: liveClosingSteps * DT, assets, pantry: { ...state.pantry }, pets: structuredClone(state.pets), promotion: structuredClone(state.promotion), today, liveFood },
    revenue, sales, soldIngredientCost, ingredientsConsumed, careConsumed, promotionConsumed, operatingProfitExpensed, netLiquidProfit,
    cashProfit: state.coins - starting.cash, spending: { investmentCash, ingredientsPurchased, promotionsBooked, carePurchases, totalCashOut },
    served: sum('served'), lostIncludingDoor: sum('missed') + sum('doorLost'), soldOut: sum('soldOut'), rating: reputationScore(state.reputation),
    closedStaleCost: settled.reduce((n, d) => n + d.report.staleCost, 0), ingredientsNotSoldOrLiveCost,
    reconciliationError, cashLedgerError };
}
type Row = ReturnType<typeof fixedSample>;
function stats(values: number[]) {
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  const half = n > 1 ? 2.04523 * sd / Math.sqrt(n) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  return { n, mean, sd, ci95Low: mean - half, ci95High: mean + half, min: sorted[0], median: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.ceil((n - 1) / 2)]) / 2, max: sorted.at(-1) };
}
function summary(routes: Route[], batches: Record<string, Row[]>) {
  return routes.filter((r) => batches[r.id]).map((route) => {
    const rows = batches[route.id];
    const control = route.control ? batches[route.control] : undefined;
    const fields = ['netLiquidProfit', 'cashProfit', 'operatingProfitExpensed', 'revenue', 'served', 'lostIncludingDoor', 'rating', 'openSeconds', 'closingSeconds', 'completedDays', 'ingredientsNotSoldOrLiveCost'] as const;
    return { route, ...Object.fromEntries(fields.map((key) => [key, stats(rows.map((r) => r[key]))])),
      liveFoodAtCost: stats(rows.map((r) => r.terminal.liveFood.totalLivePaidFoodAtIngredientCost)),
      paired: control ? { control: route.control, netLiquidDifference: stats(rows.map((r) => r.netLiquidProfit - control.find((c) => c.seed === r.seed)!.netLiquidProfit)), liveFoodCostDifference: stats(rows.map((r) => r.terminal.liveFood.totalLivePaidFoodAtIngredientCost - control.find((c) => c.seed === r.seed)!.terminal.liveFood.totalLivePaidFoodAtIngredientCost)), positiveSeeds: rows.filter((r) => r.netLiquidProfit > control.find((c) => c.seed === r.seed)!.netLiquidProfit).length } : null };
  });
}
function sourceHash() { return createHash('sha256').update(readdirSync('src/game').filter((p) => p.endsWith('.ts') && !p.endsWith('.test.ts')).sort().map((p) => `${p}\n${readFileSync(join('src/game', p), 'utf8')}`).join('\n')).digest('hex'); }
function runnerHash() { return createHash('sha256').update(readFileSync('scripts/economy-fixed-clock.test.ts')).update(readFileSync('scripts/economy-lab.ts')).digest('hex'); }
function atomic(path: string, value: unknown) { writeFileSync(path + '.tmp', JSON.stringify(value, null, path.includes('summary') ? 2 : undefined) + '\n'); renameSync(path + '.tmp', path); }
function validate(route: Route, rows: Row[], seeds: number[]) {
  if (rows.length !== seeds.length) throw new Error('Incomplete batch');
  for (const [i, r] of rows.entries()) {
    if (r.routeId !== route.id || r.seed !== seeds[i] || r.totalSeconds !== TOTAL_SECONDS || r.ticks !== TOTAL_SECONDS / DT || Math.abs(r.openSeconds + r.closingSeconds - TOTAL_SECONDS) > 1e-7) throw new Error('Clock/seed mismatch');
    if (r.settled.some((d) => d.endedAtSeconds >= TOTAL_SECONDS || Math.abs(d.report.duration - d.openSeconds - d.closingSeconds) > 1e-5)) throw new Error('Settlement after horizon/invalid duration');
    if (Math.abs(r.netLiquidProfit - (r.operatingProfitExpensed - r.investment.capital)) > 1e-5 || Math.abs(r.cashLedgerError) > 1e-5) throw new Error('Stored ledger mismatch');
    if (![r.netLiquidProfit, r.revenue, r.rating, r.terminal.liveFood.totalLivePaidFoodAtIngredientCost, ...Object.values(r.terminal.assets)].every(Number.isFinite)) throw new Error('Nonfinite stored result');
  }
}
export function runFixedClock() {
  const pilot = process.env.FIXED_CLOCK_PILOT === '1';
  const scope = process.env.FIXED_CLOCK_SCOPE === 'recovery' ? 'recovery-only' : 'full';
  const label = process.env.FIXED_CLOCK_LABEL ?? (pilot ? 'fixed-clock-pilot' : 'fixed-clock-balanced');
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const all = fixedRoutes();
  const routes = pilot ? all.filter((r) => ['early/espresso-ten', 'mid/mixed', 'expanded/all'].includes(r.id)) : scope === 'recovery-only' ? all.filter((r) => r.recovery) : all;
  const seeds = pilot ? SEEDS.slice(0, 1) : SEEDS;
  const source = sourceHash(), runner = runnerHash();
  const metadata = { version: VERSION, label, pilot, scope, sourceHash: source, runnerHash: runner, seeds, dt: DT, totalSeconds: TOTAL_SECONDS, openWindowSeconds: OPEN_SECONDS, expectedRouteIds: routes.map((r) => r.id), fixtures: (['early', 'mid', 'expanded'] as Stage[]).map(fixtureInfo),
    methodology: [
      'Every seed/route advances exactly 36,000 real Sim updates at 0.05s: 1,800 total seconds. Open 180s, naturally drain accepted service, then close books and immediately prepare/reopen; preparation takes 0 simulated seconds.',
      'No final closeShop, finishDay, shopping, promotion booking, extra drain or added revenue occurs at/after the 1,800-second cutoff. A currently open/closing day remains live.',
      'Primary net-liquid gain means cash+raw pantry+unused care+unused promotion less initial same-stage liquid assets. Consumed ingredients, including all shelf and in-flight food, remain expensed exactly as gameplay accounts for them.',
      'Exact primary identity: net-liquid gain = all settled profit + current-day revenue − current-day ingredient/care/promotion expense − capital. Cash spending is independently reconciled.',
      'Paid physical food is reported separately at ingredient cost: kitchen in-production, live shelf, and accepted unpaid orders deduplicated by customer across barista/pass/server. No future sale, resale, refund or salvage value is credited.',
      'Allocated drink/bakery and pass/tray/counter totals are overlapping breakdowns, not additional assets. Abandoned allocated dishes are shown separately and excluded from eligible live food.',
      'Actual paid upgrades/cat adoption come from equal stage cash. Included cat care is prepaid inventory, not capital; care usage and promotion airtime remain operating expenses. Goals are exhausted/excluded. No boosts, reinvestment, offline revenue, debt or rescue money.',
      'Each sample resets global height 240 and kitchen level before forecasts. Same seeds are paired, but changing policies changes random draw paths.',
      'Recovery diagnostics deliberately start with 1 or 9 coins and zero beans, same owned recipes across code variants. They are not ranked against endowed normal stages.',
      '95% intervals use Student t29=2.04523 with 30 fixed seeds. Descriptive paired comparisons, no multiple-testing correction, no global-optimum claim. One-seed pilot intervals are not inferential.',
    ] };
  const dir = 'docs/long-task/results'; mkdirSync(dir, { recursive: true });
  const path = `${dir}/${label}.json`;
  let batches: Record<string, Row[]> = {};
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    if (old.metadata.sourceHash !== source || old.metadata.runnerHash !== runner || JSON.stringify(old.metadata.expectedRouteIds) !== JSON.stringify(metadata.expectedRouteIds) || JSON.stringify(old.metadata.seeds) !== JSON.stringify(seeds)) throw new Error('Source/design/scope/seed mismatch; use a new label');
    batches = old.batches;
  }
  for (const route of routes) {
    if (batches[route.id]) { validate(route, batches[route.id], seeds); continue; }
    const started = Date.now();
    batches[route.id] = seeds.map((seed) => fixedSample(route, seed));
    validate(route, batches[route.id], seeds);
    if (sourceHash() !== source || runnerHash() !== runner) throw new Error('Source changed during run');
    const complete = routes.every((r) => batches[r.id]);
    atomic(path, { metadata, complete, batches });
    atomic(`${dir}/${label}-summary.json`, { metadata, complete, completedRoutes: Object.keys(batches).length, expectedRoutes: routes.length, routes: summary(routes, batches) });
    console.log(`${label}: ${route.id}: ${seeds.length} seeds in ${((Date.now() - started) / 1000).toFixed(1)}s (${Object.keys(batches).length}/${routes.length})`);
  }
  const complete = routes.every((r) => batches[r.id]);
  atomic(path, { metadata, complete, batches });
  atomic(`${dir}/${label}-summary.json`, { metadata, complete, completedRoutes: Object.keys(batches).length, expectedRoutes: routes.length, routes: summary(routes, batches) });
  return { complete, scenarios: routes.length, seeds: seeds.length };
}

describe('fixed total clock and live food accounting', () => {
  it('defines 20 representative routes and 30 seeds with the same stage endowment', () => {
    expect(fixedRoutes()).toHaveLength(20); expect(new Set(SEEDS).size).toBe(30);
    for (const route of fixedRoutes().filter((r) => !r.recovery)) { const s = fixture(route.stage); s.onMenu = route.menu; expect(menuItems(s).length).toBe(route.menu.length); }
  });
  it('stops at an exact tick without end-of-horizon settlement and reconciles cash', () => {
    const route = fixedRoutes()[0];
    const row = fixedSample(route, SEEDS[0], 180);
    expect(row.totalSeconds).toBe(180); expect(row.openSeconds).toBe(180); expect(row.closingSeconds).toBe(0);
    expect(row.completedDays).toBe(0); expect(row.terminal.phase).toBe('open');
    expect(row.reconciliationError).toBeCloseTo(0, 6); expect(row.cashLedgerError).toBeCloseTo(0, 6);
    expect(fixedSample(route, SEEDS[0], 180)).toEqual(row);
  });
  it('deduplicates pass/server allocation, separates abandoned food and kitchen/shelf', () => {
    const s = fixture('mid'); s.shelf = { roll: 3 }; s.inProduction = { bagel: 2 };
    const sim = new Sim(rng(SEEDS[0]));
    sim.cooks = [{ batch: { item: 'bagel', n: 2 } } as Cook];
    sim.customers = [{ id: 1, phase: 'waiting', order: 'latte', extra: 'roll', hasCup: false }, { id: 2, phase: 'exiting', order: 'latte', extra: null, hasCup: false }] as Customer[];
    const plate = { customerId: 1, items: ['latte', 'roll'] } as Plate;
    const abandoned = { customerId: 2, items: ['latte'] } as Plate;
    sim.pass = [plate, abandoned]; sim.servers = [{ plates: [plate, abandoned] } as Server];
    const value = paidLiveFood(s, sim);
    expect(value.totalLivePaidFoodAtIngredientCost).toBe(23);
    expect(value.byLocation.pass).toBe(7); expect(value.byLocation['server-tray']).toBe(0);
    expect(value.byCategory).toEqual({ drinksCost: 3, bakeryCost: 4 }); expect(value.abandonedAllocatedCost).toBe(3);
  });
  it('preserves live food expense in the primary ledger and resets prior layout', () => {
    const route = fixedRoutes().find((r) => r.id === 'expanded/all')!;
    setSceneHeight(360); setKitchenLevel(2);
    const row = fixedSample(route, SEEDS[1], 20);
    expect(row.terminal.liveFood.totalLivePaidFoodAtIngredientCost).toBeGreaterThan(0);
    expect(row.netLiquidProfit).toBeCloseTo(row.operatingProfitExpensed - row.investment.capital, 6);
    setSceneHeight(240); setKitchenLevel(0);
    expect(fixedSample(route, SEEDS[1], 20)).toEqual(row);
  });
});
it.skipIf(process.env.FIXED_CLOCK !== '1')('writes exact-clock economic supplement', () => {
  expect(runFixedClock().complete).toBe(true);
}, 86_400_000);
