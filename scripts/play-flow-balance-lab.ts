/** Read-only paired before/after traffic evidence. Existing style helper remains untouched. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { INGREDIENTS, type ItemId } from '../src/game/data';
import { openShop, type DayReport } from '../src/game/day';
import { arrivalRate, bakeForForecast, buyIngredient, restock, restockQuote, servingCost } from '../src/game/economy';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { bookPromotion } from '../src/game/promotion';
import { reputationScore } from '../src/game/reputation';
import { saveSignature, setSignatureOnMenu, trialSignature, type SignatureRecipe } from '../src/game/signature-drinks';
import { Sim } from '../src/game/sim';
import { createInitialState } from '../src/game/state';
import { setCafeStyle } from '../src/game/styles';
import { buildStylePortfolio, PRESSURES, STYLE_DT, STYLE_OPEN_SECONDS, STYLE_SECONDS, styleAssets, styleLiveFood, styleRoutes, styleSample, styleSourceHash, type Route } from './cafe-style-lab';

export const FLOW_SEEDS = Array.from({ length: 30 }, (_, i) => (0x706c6179 + i * 2654435761) >>> 0);
export const PILOT_SEEDS = [0x70696c6f, 0x74657374];
export const FLOW_HORIZONS = [180, 1800];
const rng = (seed: number) => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }; };
export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export const objectHash = (value: unknown) => hash(JSON.stringify(value));
export interface Scenario { id: string; kind: 'route' | 'fresh' | 'signature'; route: Route }
export function flowScenarios(): Scenario[] {
  const routes = styleRoutes().filter(r => r.panel === 'route-purchases' && r.focus && ['base', 'rush'].includes(r.pressure));
  return [...routes.map(route => ({ id: route.id, kind: 'route' as const, route })),
    { id: 'sanity/fresh/base', kind: 'fresh', route: { ...routes[0], id: 'sanity/fresh/base', focus: false, pressure: 'base' } },
    ...(['base', 'rush'] as const).map(pressure => ({ id: `sanity/signature-heavy/mid/${pressure}`, kind: 'signature' as const,
      route: { ...routes.find(r => r.stage === 'mid' && r.style === 'coffee' && r.pressure === pressure)!, id: `sanity/signature-heavy/mid/${pressure}` } }))];
}
export function pilotScenarios(): Scenario[] {
  const labels = ['early/base/coffee', 'early/rush/bakery', 'mid/base/cats', 'mid/rush/takeaway', 'late/base/garden', 'late/rush/community'];
  return flowScenarios().filter(s => s.kind !== 'route' || labels.some(label => s.id.includes(label)));
}
export function buildFlowSetup(scenario: Scenario) {
  if (scenario.kind === 'fresh') {
    setSceneHeight(MIN_SCENE_H); setKitchenLevel(0);
    const state = createInitialState(0), assets = styleAssets(state);
    return { state, budget: assets.total, initialCash: state.coins, initialPantryValue: assets.pantry,
      stockReserve: 0, ledger: [], capital: 0, cashSpent: 0, remainingCash: 0, trialSetupExpense: 0 };
  }
  const setup = buildStylePortfolio(scenario.route, setCafeStyle), s = setup.state;
  let trialSetupExpense = 0, trialSetupPurchased = 0;
  if (scenario.kind === 'signature') {
    const before = s.coins;
    s.onMenu = [];
    const recipes: SignatureRecipe[] = [{ beans: 1 }, { beans: 1, milk: 2 }, { beans: 2, milk: 1 }];
    const needed: SignatureRecipe = {};
    for (const recipe of recipes) for (const [id, n] of Object.entries(recipe)) needed[id as keyof SignatureRecipe] = (needed[id as keyof SignatureRecipe] ?? 0) + n * .25;
    for (const [id, n] of Object.entries(needed)) if (!buyIngredient(s, id as keyof typeof s.pantry, Math.ceil(n))) throw new Error('Trial purchase rejected');
    recipes.forEach((recipe, i) => {
      const trial = trialSignature(s, 'coffee', recipe);
      if (!trial.ok || !trial.id || !saveSignature(s, trial.id, `Flow sample ${i + 1}`) || !setSignatureOnMenu(s, trial.id, true)) throw new Error('Signature setup rejected');
      trialSetupExpense += servingCost(trial.id) * .25;
    });
    trialSetupPurchased = before - s.coins;
  }
  return { ...setup, initialCash: setup.budget, initialPantryValue: 0, trialSetupExpense,
    capital: setup.capital + trialSetupExpense, cashSpent: setup.cashSpent + trialSetupPurchased, remainingCash: s.coins };
}
export function setupEvidence(scenario: Scenario) {
  const setup = buildFlowSetup(scenario);
  return { scenario: scenario.id, initialStateHash: objectHash(setup.state), initialState: setup.state,
    budget: setup.budget, initialCash: setup.initialCash, initialPantryValue: setup.initialPantryValue,
    capital: setup.capital, investmentCash: setup.cashSpent, remainingCash: setup.remainingCash,
    trialSetupExpense: setup.trialSetupExpense, ledger: setup.ledger };
}
const phaseNames = ['calm', 'rising', 'busy', 'easing'] as const;
const phaseAt = (time: number) => { const t = (time + 1e-7) % 90; return t < 30 ? 'calm' : t < 45 ? 'rising' : t < 75 ? 'busy' : 'easing'; };
const foodCost = (items: Partial<Record<ItemId, number>>) => Object.entries(items).reduce((sum, [id, count]) => sum + servingCost(id as ItemId) * count!, 0);

/** Copied exact-clock loop; only scenario setup and fresh initial cash differ. */
export function customFlowSample(scenario: Scenario, seed: number, seconds = STYLE_SECONDS) {
  const route = scenario.route, setup = buildFlowSetup(scenario), s = setup.state;
  const ticks = Math.round(seconds / STYLE_DT);
  if (ticks <= 0 || Math.abs(ticks * STYLE_DT - seconds) > 1e-8) throw new Error('Invalid exact horizon');
  const sim = new Sim(rng(seed));
  let openTicks = 0, closingTicks = 0, liveOpen = 0, liveClosing = 0;
  let ingredientsPurchased = 0, promotionsPurchased = 0, queueRemovedAtClosing = 0;
  let promotionBookingAttempts = 0, promotionBookingFailures = 0, cashConstrainedRestocks = 0;
  // As in styleSample: the sim also closes on its own (dcacd65), so count every dismissed queue.
  const beginClosing = sim.beginClosing.bind(sim);
  sim.beginClosing = (state) => {
    if (state.phase === 'open') queueRemovedAtClosing += sim.customers.filter(c => c.phase === 'queue').length;
    beginClosing(state);
  };
  let rolling = { revenue: 0, ingredientCost: 0, petCost: 0, promotionCost: 0 };
  const settled: { endedAt: number; openSeconds: number; closingSeconds: number; report: DayReport }[] = [];
  const checkpoints: { seconds: number; operating: number; netLiquid: number; capitalRecovered: boolean }[] = [];
  let paybackSeconds: number | null = null;
  for (let tick = 0; tick < ticks; tick++) {
    const now = tick * STYLE_DT;
    if (s.phase === 'open' && liveOpen === STYLE_OPEN_SECONDS / STYLE_DT) sim.beginClosing(s);
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
  const cashLedgerError = s.coins - (setup.initialCash + revenue - totalCashOut);
  const sales: Partial<Record<ItemId, number>> = {};
  for (const r of reports) for (const [id, n] of Object.entries(r.sales) as [ItemId, number][]) sales[id] = (sales[id] ?? 0) + n;
  const liveFood = styleLiveFood(s, sim), soldIngredientCost = foodCost(sales);
  const wasteCost = ingredientExpense - soldIngredientCost - liveFood.total;
  const missed = sum('missed'), doorLost = sum('doorLost');
  if (Math.abs(reconciliationError) > 1e-4 || Math.abs(cashLedgerError) > 1e-4 || wasteCost < -1e-6) throw new Error(`Accounting mismatch ${route.id}: ${reconciliationError}/${cashLedgerError}/${wasteCost}`);
  if ([...Object.values(assets), ...Object.values(s.pantry)].some(n => !Number.isFinite(n) || n < -1e-7)) throw new Error('Invalid ending assets');
  return { routeId: route.id, seed, seconds, openSeconds: openTicks * STYLE_DT, closingSeconds: closingTicks * STYLE_DT,
    budget: setup.budget, capital: setup.capital, investmentCash: setup.cashSpent, initialUnspentCash: setup.remainingCash,
    revenue, operatingProfit, netLiquidProfit, cashProfit: s.coins - setup.initialCash, assets,
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
export function observedFlowSample(scenario: Scenario, seed: number, seconds: number) {
  const update = Sim.prototype.update;
  const phases = Object.fromEntries(phaseNames.map(phase => [phase, { openSeconds: 0, admitted: 0, doorLost: 0, arrivalAttempts: 0, baseRateExposure: 0 }])) as Record<typeof phaseNames[number], { openSeconds: number; admitted: number; doorLost: number; arrivalAttempts: number; baseRateExposure: number }>;
  const servedIds = new Set<number>();
  const servedWaits: number[] = [];
  let initialStateHash = '', peakQueue = 0, queueExposure = 0, totalSeconds = 0;
  Sim.prototype.update = function(s, dt) {
    if (!initialStateHash) initialStateHash = objectHash(s);
    const open = s.phase === 'open', phase = phaseAt(s.dayTime), priorDoor = s.today.doorLost;
    const priorId = (this as unknown as { nextId: number }).nextId;
    const rate = open ? arrivalRate(s) : 0;
    const result = update.call(this, s, dt);
    if (open) {
      const admitted = (this as unknown as { nextId: number }).nextId - priorId;
      const door = s.today.doorLost - priorDoor;
      phases[phase].openSeconds += dt; phases[phase].baseRateExposure += rate * dt;
      phases[phase].admitted += admitted; phases[phase].doorLost += door; phases[phase].arrivalAttempts += admitted + door;
    }
    peakQueue = Math.max(peakQueue, this.queue.length); queueExposure += this.queue.length * dt; totalSeconds += dt;
    for (const c of this.customers) if (c.hasCup && !servedIds.has(c.id)) { servedIds.add(c.id); servedWaits.push(c.waitSeconds); }
    return result;
  };
  try {
    const row = scenario.kind === 'route' ? styleSample(scenario.route, seed, setCafeStyle, seconds) : customFlowSample(scenario, seed, seconds);
    const arrivals = Object.values(phases).reduce((n, phase) => n + phase.arrivalAttempts, 0);
    if (arrivals !== row.arrivalAttempts || servedWaits.length !== row.served) throw new Error(`Observer counter mismatch: ${scenario.id}: ${arrivals}/${row.arrivalAttempts}, ${servedWaits.length}/${row.served}`);
    servedWaits.sort((a, b) => a - b);
    return { ...row, scenarioId: scenario.id, initialStateHash, phases, peakQueue, meanQueue: queueExposure / totalSeconds,
      servedWaitMean: servedWaits.length ? servedWaits.reduce((a, b) => a + b, 0) / servedWaits.length : 0,
      servedWaitP95: servedWaits[Math.max(0, Math.ceil(servedWaits.length * .95) - 1)] ?? 0,
      servedWaitMax: servedWaits.at(-1) ?? 0,
      resolvedLossRate: row.unmetDemand / Math.max(1, row.served + row.unmetDemand),
      pendingLostRate: (row.unmetDemand + row.terminalLiveCustomers) / Math.max(1, row.arrivalAttempts) };
  } finally { Sim.prototype.update = update; }
}
export type FlowRow = ReturnType<typeof observedFlowSample>;
export const designFiles = ['scripts/play-flow-balance-lab.ts', 'scripts/play-flow-balance.test.ts', 'scripts/cafe-style-lab.ts', 'docs/play-flow/BALANCE-PROTOCOL.md'];
export const designHashes = () => Object.fromEntries(designFiles.map(path => [path, hash(readFileSync(path))]));
export function atomic(path: string, value: unknown) { writeFileSync(path + '.tmp', JSON.stringify(value) + '\n'); renameSync(path + '.tmp', path); }
export async function runFlowLab() {
  const pilot = process.env.PLAY_FLOW_PILOT === '1';
  const label = process.env.PLAY_FLOW_LABEL ?? 'baseline-pilot';
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Unsafe label');
  const shard = Number(process.env.PLAY_FLOW_SHARD ?? 0), shardCount = Number(process.env.PLAY_FLOW_SHARDS ?? 1);
  if (!Number.isInteger(shard) || !Number.isInteger(shardCount) || shard < 0 || shard >= shardCount) throw new Error('Invalid shard');
  const scenarios = pilot ? pilotScenarios() : flowScenarios();
  const fullScope = scenarios.flatMap(scenario => FLOW_HORIZONS.map(seconds => ({ id: `${scenario.id}@${seconds}`, scenario, seconds })));
  const scope = fullScope.filter((_, i) => i % shardCount === shard);
  const seeds = pilot ? PILOT_SEEDS : FLOW_SEEDS;
  const metadata = { version: 1, label, pilot, shard, shardCount, fullScope: fullScope.map(c => c.id), expectedScope: scope.map(c => c.id), seeds,
    sourceHash: styleSourceHash(), designHashes: designHashes(), dt: STYLE_DT, horizons: FLOW_HORIZONS, openSeconds: STYLE_OPEN_SECONDS,
    setups: scenarios.map(setupEvidence), generatedAt: new Date().toISOString() };
  const dir = process.env.PLAY_FLOW_RESULTS_DIR ?? 'docs/play-flow/evidence'; mkdirSync(dir, { recursive: true });
  const path = `${dir}/${label}.json`;
  let batches: Record<string, FlowRow[]> = {};
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['sourceHash', 'designHashes', 'expectedScope', 'seeds', 'setups'] as const) if (JSON.stringify(old.metadata[key]) !== JSON.stringify(metadata[key])) throw new Error(`Incompatible resume: ${key}`);
    batches = old.batches;
  }
  const assertSource = () => { if (styleSourceHash() !== metadata.sourceHash || objectHash(designHashes()) !== objectHash(metadata.designHashes)) throw new Error('Source changed during run'); };
  const save = () => { assertSource(); atomic(path, { metadata, complete: scope.every(c => batches[c.id]?.length === seeds.length), batches }); };
  save();
  for (const cell of scope) {
    const rows = batches[cell.id] ??= [];
    if (rows.length > seeds.length || rows.some((r, i) => r.seed !== seeds[i] || r.scenarioId !== cell.scenario.id || r.seconds !== cell.seconds)) throw new Error('Invalid resume rows');
    const started = Date.now();
    for (let i = rows.length; i < seeds.length; i++) { rows.push(observedFlowSample(cell.scenario, seeds[i], cell.seconds)); if (rows.length % 5 === 0) save(); }
    save(); console.log(`${label}: ${cell.id}: ${rows.length}/${seeds.length}; ${((Date.now() - started) / 1000).toFixed(2)}s`);
  }
  return { complete: true, cells: scope.length, seeds: seeds.length };
}
