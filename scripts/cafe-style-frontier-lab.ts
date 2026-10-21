/** Preregistered earned-capability union follow-up. Original v1 harness is unchanged. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, readdirSync } from 'node:fs';
import { INGREDIENTS, ITEM_COST_GROWTH, MENU, type ItemId, type UpgradeId } from '../src/game/data';
import { openShop, type DayReport } from '../src/game/day';
import { useDecor, DECOR_SLOTS, decorDef, comfort } from '../src/game/decor';
import { bakeForForecast, buyUpgrade, isItemAvailable, menuItems, restock, restockQuote, servingCost, setOnMenu } from '../src/game/economy';
import { buyFurniture, canPlace, COLS, FLOOR_ROWS, placeFurniture } from '../src/game/furniture';
import { GOALS } from '../src/game/goals';
import { unlockKitchen } from '../src/game/kitchen';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { adoptCat, catDef, type CatId } from '../src/game/pets';
import { bookPromotion } from '../src/game/promotion';
import { reputationScore } from '../src/game/reputation';
import { mainTableCount, unlockRegion, type RegionId } from '../src/game/regions';
import { Sim } from '../src/game/sim';
import { createInitialState } from '../src/game/state';
import { researchSignature } from '../src/game/taste';
import { setCafeStyle, type CafeStyleId } from '../src/game/styles';
import { PRESSURES, STYLE_DT, STYLE_SECONDS, STYLE_OPEN_SECONDS, STYLE_IDS, STYLE_SEEDS,
  styleAssets, styleLiveFood, styleSourceHash, styleStats, type Pressure, type Purchase } from './cafe-style-lab';

export const UNION_PATH = 'docs/cafe-styles/results/earned-late-union-input.json';
export const UNION = JSON.parse(readFileSync(UNION_PATH, 'utf8'));
export const HOLDOUT_SEEDS = Array.from({ length: 30 }, (_, i) => (0xcafe4321 + i * 2654435761) >>> 0);
export type FrontierRoute = { id: string; menu: string; items: ItemId[]; style: CafeStyleId | null; pressure: Pressure };
export function frontierRoutes(pressures: Pressure[] = ['base']): FrontierRoute[] {
  return pressures.flatMap(pressure => UNION.menus.flatMap((m: { id: string; items: ItemId[] }) => [null, ...STYLE_IDS].map(style => ({
    id: `earned-union/late/${pressure}/${m.id}/${style ?? 'plain'}`, menu: m.id, items: m.items, style, pressure,
  }))));
}
const rng = (seed: number) => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }; };
const foodCost = (items: Partial<Record<ItemId, number>>) => Object.entries(items).reduce((sum, [id, count]) => sum + servingCost(id as ItemId) * count!, 0);
export function buildUnionPortfolio(route: FrontierRoute) {
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
  const s = createInitialState(0), budget = UNION.funding as number, stockReserve = budget * .12;
  s.coins = budget; s.goal = GOALS.length; s.day = UNION.day; s.served = UNION.served;
  s.taste.served = { ...UNION.experience }; s.cafeStyle.handoffs = { ...UNION.handoffs };
  for (const i of INGREDIENTS) s.pantry[i.id] = 0;
  const ledger: Purchase[] = [];
  const transact = (kind: Purchase['kind'], id: string, action: () => boolean, prepaidCare = 0) => {
    const before = s.coins; if (!action()) throw new Error(`Rejected union purchase ${kind}/${id}`);
    const cash = before - s.coins; ledger.push({ kind, id, cash, capital: cash - prepaidCare, prepaidCare });
    if (s.coins + 1e-6 < stockReserve) throw new Error('Union purchase consumed reserve');
  };
  // The union was preregistered when every recipe level cost baseCost × 1.12^level. Level-ups
  // now cost LEVEL_COST_MULTIPLIER times as much (2026-10-21); charge the frozen purchases at
  // their historical price so the setup, ledger and expected cash stay exactly as registered.
  const historicalRecipe = (id: ItemId) => {
    const def = MENU.find(m => m.id === id)!, cost = def.baseCost * ITEM_COST_GROWTH ** s.items[id];
    if (!isItemAvailable(s, id) || cost > s.coins) return false;
    const unlocking = s.items[id] === 0;
    s.coins -= cost; s.items[id] += 1;
    if (unlocking && s.phase === 'prep') setOnMenu(s, id, true);
    return true;
  };
  if (UNION.kitchen) transact('kitchen', 'kitchen', () => unlockKitchen(s));
  for (const m of MENU) while (s.items[m.id] < UNION.items[m.id]) transact('recipe', m.id, () => historicalRecipe(m.id));
  for (const id of Object.keys(UNION.upgrades).sort() as UpgradeId[]) while (s.upgrades[id] < UNION.upgrades[id]) transact('upgrade', id, () => buyUpgrade(s, id, 1));
  for (const id of ['reading', 'greenhouse', 'terrace'] as RegionId[]) if (UNION.regions.includes(id)) transact('region', id, () => unlockRegion(s, id));
  for (const id of UNION.pets as CatId[]) transact('cat', id, () => adoptCat(s, id), catDef(id)!.careCost);
  for (const id of UNION.decorOwned as string[]) if (!s.decor.owned.includes(id)) transact('decor', id, () => useDecor(s, id));
  for (const slot of DECOR_SLOTS) {
    const chosen = [...s.decor.owned].filter(id => decorDef(id)?.slot === slot).sort((a, b) => decorDef(b)!.comfort - decorDef(a)!.comfort || a.localeCompare(b))[0];
    if (!chosen || !useDecor(s, chosen)) throw new Error('Union decor choice failed');
  }
  for (const id of Object.keys(UNION.furnitureCounts).sort()) {
    const owned = s.decor.placed.filter(p => p.id === id).length + (s.decor.stored[id] ?? 0);
    for (let n = owned; n < UNION.furnitureCounts[id]; n++) transact('furniture', id, () => buyFurniture(s, id));
    while ((s.decor.stored[id] ?? 0) > 0) {
      let placed = false;
      for (let row = 0; row < FLOOR_ROWS && !placed; row++) for (let col = 0; col < COLS; col++) if (canPlace(s, id, col, row, mainTableCount(s))) {
        placed = placeFurniture(s, id, col, row, mainTableCount(s)); if (placed) break;
      }
      if (!placed) throw new Error(`Union furniture has no legal main-room position: ${id}`);
    }
  }
  for (const id of UNION.signatures as ItemId[]) transact('signature', id, () => researchSignature(s, id));
  s.onMenu = [...route.items]; if (menuItems(s).length !== route.items.length) throw new Error('Union menu unavailable');
  if (!setCafeStyle(s, route.style)) throw new Error('Union focus rejected');
  setKitchenLevel(s.kitchen ? s.upgrades.cook : 0);
  const cashSpent = ledger.reduce((n, p) => n + p.cash, 0), capital = ledger.reduce((n, p) => n + p.capital, 0);
  if (Math.abs(cashSpent - UNION.expectedPurchaseCash) > 1e-4 || Math.abs(budget - s.coins - cashSpent) > 1e-5 || Math.abs(styleAssets(s).total + capital - budget) > 1e-5) throw new Error('Union ledger disagrees with independent quote');
  return { state: s, budget, stockReserve, ledger, capital, cashSpent, remainingCash: s.coins, comfort: comfort(s),
    ownership: { items: { ...s.items }, upgrades: { ...s.upgrades }, regions: [...s.regions], kitchen: s.kitchen,
      pets: structuredClone(s.pets), decor: structuredClone(s.decor), taste: structuredClone(s.taste), day: s.day, served: s.served, handoffs: structuredClone(s.cafeStyle.handoffs) } };
}
export function frontierSample(route: FrontierRoute, seed: number, seconds = STYLE_SECONDS) {
  const setup = buildUnionPortfolio(route), s = setup.state;
  const ticks = Math.round(seconds / STYLE_DT);
  if (ticks <= 0 || Math.abs(ticks * STYLE_DT - seconds) > 1e-8) throw new Error('Invalid exact horizon');
  const sim = new Sim(rng(seed));
  let openTicks = 0, closingTicks = 0, liveOpen = 0, liveClosing = 0;
  let ingredientsPurchased = 0, promotionsPurchased = 0, queueRemovedAtClosing = 0;
  let promotionBookingAttempts = 0, promotionBookingFailures = 0, cashConstrainedRestocks = 0;
  let rolling = { revenue: 0, ingredientCost: 0, petCost: 0, promotionCost: 0 };
  const settled: { endedAt: number; openSeconds: number; closingSeconds: number; report: DayReport }[] = [];
  const checkpoints: { seconds: number; operating: number; netLiquid: number; capitalRecovered: boolean }[] = [];
  let paybackSeconds: number | null = null;
  for (let tick = 0; tick < ticks; tick++) {
    const now = tick * STYLE_DT;
    if (s.phase === 'open' && liveOpen === STYLE_OPEN_SECONDS / STYLE_DT) {
      queueRemovedAtClosing += sim.customers.filter(c => c.phase === 'queue').length;
      sim.beginClosing(s);
    }
    if (s.phase === 'closing' && sim.finishedService) {
      const report = sim.closeShop(s)!;
      for (const key of ['revenue', 'ingredientCost', 'petCost', 'promotionCost'] as const) rolling[key] += report[key];
      settled.push({ endedAt: now, openSeconds: liveOpen * STYLE_DT, closingSeconds: liveClosing * STYLE_DT, report });
    }
    if (s.phase === 'prep') {
      liveOpen = 0; liveClosing = 0;
      const promotion = PRESSURES[route.pressure];
      if (promotion && !s.promotion) {
        const before = s.coins;
        promotionBookingAttempts++;
        if (!bookPromotion(s, promotion)) promotionBookingFailures++;
        promotionsPurchased += before - s.coins;
      }
      bakeForForecast(s);
      if (restockQuote(s).cost > s.coins) cashConstrainedRestocks++;
      const before = s.coins; restock(s); ingredientsPurchased += before - s.coins;
      openShop(s);
    }
    const open = s.phase === 'open';
    sim.update(s, STYLE_DT);
    if (open) { openTicks++; liveOpen++; } else { closingTicks++; liveClosing++; }
    if (liveClosing > 300 / STYLE_DT) throw new Error(`Drain exceeded 300 seconds: ${route.id}: ${JSON.stringify({ customers: sim.customers.filter(c => !['sitting', 'exiting'].includes(c.phase)), cooks: sim.cooks.filter(c => c.batch), placed: s.decor.placed })}`);
    const operating = rolling.revenue + s.today.revenue - rolling.ingredientCost - s.today.ingredientCost - rolling.petCost - s.today.petCost - rolling.promotionCost - s.today.promotionCost;
    if (paybackSeconds === null && operating >= setup.capital) paybackSeconds = (tick + 1) * STYLE_DT;
    if ((tick + 1) % (STYLE_OPEN_SECONDS / STYLE_DT) === 0 || tick + 1 === ticks) checkpoints.push({ seconds: (tick + 1) * STYLE_DT, operating, netLiquid: styleAssets(s).total - setup.budget, capitalRecovered: operating >= setup.capital });
  }
  const reports = [...settled.map(x => x.report), s.today];
  const sum = (key: 'revenue' | 'ingredientCost' | 'petCost' | 'promotionCost' | 'served' | 'missed' | 'doorLost' | 'soldOut' | 'queueLost' | 'tableLost' | 'extraLost') => reports.reduce((n, r) => n + r[key], 0);
  const revenue = sum('revenue'), ingredientExpense = sum('ingredientCost'), careExpense = sum('petCost'), promotionExpense = sum('promotionCost');
  const operatingProfit = revenue - ingredientExpense - careExpense - promotionExpense;
  const assets = styleAssets(s), netLiquidProfit = assets.total - setup.budget;
  const reconciliationError = netLiquidProfit - (operatingProfit - setup.capital);
  const includedCare = setup.ledger.reduce((n, l) => n + l.prepaidCare, 0);
  const carePurchased = careExpense + assets.care - includedCare;
  const totalCashOut = setup.cashSpent + ingredientsPurchased + promotionsPurchased + carePurchased;
  const cashLedgerError = s.coins - (setup.budget + revenue - totalCashOut);
  const sales: Partial<Record<ItemId, number>> = {};
  for (const r of reports) for (const [id, n] of Object.entries(r.sales) as [ItemId, number][]) sales[id] = (sales[id] ?? 0) + n;
  const liveFood = styleLiveFood(s, sim), soldIngredientCost = foodCost(sales);
  const wasteCost = ingredientExpense - soldIngredientCost - liveFood.total;
  const missed = sum('missed'), doorLost = sum('doorLost');
  if (Math.abs(reconciliationError) > 1e-4 || Math.abs(cashLedgerError) > 1e-4 || wasteCost < -1e-6) throw new Error(`Accounting mismatch ${route.id}: ${reconciliationError}/${cashLedgerError}/${wasteCost}`);
  if ([...Object.values(assets), ...Object.values(s.pantry)].some(n => !Number.isFinite(n) || n < -1e-7)) throw new Error('Invalid ending assets');
  return { routeId: route.id, seed, seconds, openSeconds: openTicks * STYLE_DT, closingSeconds: closingTicks * STYLE_DT,
    budget: setup.budget, capital: setup.capital, investmentCash: setup.cashSpent, initialUnspentCash: setup.remainingCash,
    revenue, operatingProfit, netLiquidProfit, cashProfit: s.coins - setup.budget, assets,
    ingredientExpense, careExpense, promotionExpense, promotionBookingAttempts, promotionBookingFailures, cashConstrainedRestocks, spending: { ingredientsPurchased, promotionsPurchased, carePurchased, totalCashOut },
    served: sum('served'), missed, doorLost, lostIncludingDoor: missed + doorLost,
    queueRemovedAtClosing, unmetDemand: missed + doorLost + queueRemovedAtClosing,
    arrivalAttempts: sum('served') + missed + doorLost + queueRemovedAtClosing + sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length,
    lossRate: (missed + doorLost + queueRemovedAtClosing) / Math.max(1, sum('served') + missed + doorLost + queueRemovedAtClosing + sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length),
    soldOut: sum('soldOut'), queueLost: sum('queueLost'), tableLost: sum('tableLost'), extraLost: sum('extraLost'),
    wasteCost: Math.max(0, wasteCost), closedStaleCost: settled.reduce((n, d) => n + d.report.staleCost, 0), liveFood,
    rating: reputationScore(s.reputation), terminalPhase: s.phase, completedDays: settled.length,
    terminalLiveCustomers: sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length,
    paybackSeconds, censored: paybackSeconds === null, terminalRecovered: operatingProfit >= setup.capital,
    checkpoints, reconciliationError, cashLedgerError };
}

export type FrontierRow = ReturnType<typeof frontierSample>;
export const frontierDesignHash = () => createHash('sha256').update(readFileSync('scripts/cafe-style-frontier-lab.ts')).update(readFileSync('scripts/cafe-style-frontier.test.ts')).update(readFileSync(UNION_PATH)).update(readFileSync('docs/cafe-styles/EARNED-UNION-PREREGISTRATION.md')).digest('hex');
const atomic = (path: string, value: unknown) => { writeFileSync(path + '.tmp', JSON.stringify(value) + '\n'); renameSync(path + '.tmp', path); };
export async function runFrontier() {
  const cohort = process.env.FRONTIER_COHORT ?? 'training'; if (!['training', 'holdout'].includes(cohort)) throw new Error('Unknown cohort');
  const pressures = (process.env.FRONTIER_PRESSURES ?? 'base').split(',') as Pressure[];
  if (pressures.some(p => !(p in PRESSURES)) || new Set(pressures).size !== pressures.length) throw new Error('Invalid pressure scope');
  const label = process.env.FRONTIER_LABEL ?? `earned-union-v1-${cohort}`;
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const shard = Number(process.env.FRONTIER_SHARD ?? 0), shardCount = Number(process.env.FRONTIER_SHARDS ?? 1);
  if (!Number.isInteger(shard) || !Number.isInteger(shardCount) || shard < 0 || shard >= shardCount) throw new Error('Invalid shard');
  const fullRoutes = frontierRoutes(pressures), routes = fullRoutes.filter((_, i) => i % shardCount === shard);
  if (!routes.length) throw new Error('Empty shard');
  const seeds = cohort === 'training' ? STYLE_SEEDS : HOLDOUT_SEEDS, sourceHash = styleSourceHash(), designHash = frontierDesignHash();
  if (sourceHash !== UNION.gameSourceHash) throw new Error('Gameplay changed before frontier follow-up');
  const setups = routes.map(route => { const { state: _, ...setup } = buildUnionPortfolio(route); return { routeId: route.id, ...setup }; });
  const metadata = { version: 1, label, cohort, shard, shardCount, sourceHash, designHash, seeds, fullScope: fullRoutes.map(r => r.id), expectedRoutes: routes.map(r => r.id), setups, seconds: STYLE_SECONDS, dt: STYLE_DT, openSeconds: STYLE_OPEN_SECONDS, pressures, union: UNION,
    methodology: 'Paid common capability union of six pre-existing earned late snapshots, not a single earned save. Five original menus crossed with six focuses plus plain. Identical assets, funding, progress and clock. All stock/care/campaign expenses and pending service retained. Original v1 evidence preserved.' };
  const directory = process.env.FRONTIER_RESULTS_DIR ?? 'docs/cafe-styles/results'; mkdirSync(directory, { recursive: true });
  const path = `${directory}/${label}.json`; let batches: Record<string, FrontierRow[]> = {};
  if (existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['sourceHash', 'designHash', 'seeds', 'fullScope', 'expectedRoutes', 'cohort']) if (JSON.stringify(saved.metadata[key]) !== JSON.stringify(metadata[key])) throw new Error(`Incompatible frontier resume: ${key}`);
    batches = saved.batches;
  }
  const save = () => atomic(path, { metadata, complete: routes.every(r => batches[r.id]?.length === 30), batches });
  for (const route of routes) {
    const rows = batches[route.id] ??= [];
    if (rows.length > 30 || rows.some((r, i) => r.seed !== seeds[i] || r.routeId !== route.id || r.seconds !== STYLE_SECONDS)) throw new Error('Invalid partial frontier batch');
    for (let i = rows.length; i < 30; i++) {
      rows.push(frontierSample(route, seeds[i]));
      if (rows.length % 5 === 0) { if (styleSourceHash() !== sourceHash || frontierDesignHash() !== designHash) throw new Error('Frontier source/design changed'); save(); }
    }
    save(); console.log(`${label}: ${route.id}: 30/30`);
  }
  save(); return { complete: true, scenarios: routes.length, seeds: 30 };
}
export function mergeFrontier(prefix: string, directory = 'docs/cafe-styles/results') {
  if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error('Unsafe merge prefix');
  const files = readdirSync(directory).filter(p => p.startsWith(prefix + '-shard') && /^.+-shard\d+\.json$/.test(p)).sort();
  if (!files.length) throw new Error('No frontier shards');
  const parts = files.map(f => JSON.parse(readFileSync(`${directory}/${f}`, 'utf8'))), ref = parts[0].metadata;
  if (parts.length !== ref.shardCount || new Set(parts.map(p => p.metadata.shard)).size !== ref.shardCount) throw new Error('Incomplete frontier shard set');
  const batches: Record<string, FrontierRow[]> = {};
  for (const part of parts) {
    for (const key of ['sourceHash', 'designHash', 'seeds', 'fullScope', 'cohort', 'shardCount']) if (JSON.stringify(part.metadata[key]) !== JSON.stringify(ref[key])) throw new Error(`Mismatched frontier shards: ${key}`);
    if (!part.complete) throw new Error('Incomplete frontier shard');
    for (const [id, rows] of Object.entries(part.batches) as [string, FrontierRow[]][]) {
      if (batches[id] || rows.length !== 30 || rows.some((r, i) => r.routeId !== id || r.seed !== ref.seeds[i])) throw new Error('Overlapping or invalid frontier batch');
      batches[id] = rows;
    }
  }
  if (Object.keys(batches).length !== ref.fullScope.length || ref.fullScope.some((id: string) => !batches[id])) throw new Error('Incomplete frontier scope');
  const metadata = { ...ref, label: prefix, shard: null, mergedShards: files, expectedRoutes: ref.fullScope, setups: parts.flatMap(p => p.metadata.setups) };
  const fields = ['netLiquidProfit', 'operatingProfit', 'lossRate', 'unmetDemand', 'wasteCost', 'rating', 'served', 'openSeconds', 'closingSeconds'] as const;
  atomic(`${directory}/${prefix}.json`, { metadata, complete: true, batches });
  atomic(`${directory}/${prefix}-summary.json`, { metadata, complete: true, scenarios: Object.entries(batches).map(([id, rows]) => ({ id, ...Object.fromEntries(fields.map(f => [f, styleStats(rows.map(r => r[f]))])) })) });
  return { complete: true, scenarios: Object.keys(batches).length };
}
