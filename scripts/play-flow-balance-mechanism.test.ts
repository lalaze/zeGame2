import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { openShop } from '../src/game/day';
import { bakeForForecast, restock } from '../src/game/economy';
import { bookPromotion } from '../src/game/promotion';
import { reputationScore } from '../src/game/reputation';
import { Sim } from '../src/game/sim';
import { PRESSURES, STYLE_DT, styleAssets, styleLiveFood, styleSourceHash } from './cafe-style-lab';
import { atomic, buildFlowSetup, designHashes, flowScenarios, objectHash, observedFlowSample } from './play-flow-balance-lab';
import { flowStats } from './play-flow-balance-verify';
const seeds = Array.from({ length: 30 }, (_, i) => (0x686f6c64 + i * 2654435761) >>> 0);
const scenarios = ['early', 'mid'].map(stage => flowScenarios().find(s => s.id === `route-purchases/${stage}/rush/bakery/focus`)!);
const dir = process.env.PLAY_FLOW_RESULTS_DIR ?? 'docs/play-flow/evidence';
const runnerHash = () => createHash('sha256').update(readFileSync('scripts/play-flow-balance-mechanism.test.ts')).update(readFileSync('docs/play-flow/BALANCE-MECHANISM.md')).digest('hex');
function sample(scenario: typeof scenarios[number], seed: number, refill: boolean) {
  const setup = buildFlowSetup(scenario), s = setup.state;
  let n = seed >>> 0;
  const sim = new Sim(() => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; });
  const initialHash = objectHash(s), receipts: { atSeconds: number; cash: number; pantryBefore: number; pantryAfter: number }[] = [];
  const promotion = PRESSURES[scenario.route.pressure];
  const beforePromotion = s.coins;
  if (promotion && !bookPromotion(s, promotion)) throw new Error('Promotion rejected');
  const promotionsPurchased = beforePromotion - s.coins;
  const buyStock = (atSeconds: number) => { const before = s.coins, pantryBefore = styleAssets(s).pantry; restock(s); receipts.push({ atSeconds, cash: before - s.coins, pantryBefore, pantryAfter: styleAssets(s).pantry }); };
  bakeForForecast(s); buyStock(0); openShop(s);
  const firstUpdateHash = objectHash(s);
  let peakQueue = 0;
  for (let tick = 0; tick < 180 / STYLE_DT; tick++) {
    if (refill && tick === 90 / STYLE_DT) buyStock(90);
    sim.update(s, STYLE_DT); peakQueue = Math.max(peakQueue, sim.queue.length);
  }
  const { revenue, ingredientCost: ingredientExpense, petCost: careExpense, promotionCost: promotionExpense, served, missed, doorLost, soldOut, queueLost, tableLost } = s.today;
  const assets = styleAssets(s), operatingProfit = revenue - ingredientExpense - careExpense - promotionExpense;
  const includedCare = setup.ledger.reduce((sum, p) => sum + p.prepaidCare, 0), carePurchased = careExpense + assets.care - includedCare;
  const ingredientsPurchased = receipts.reduce((sum, r) => sum + r.cash, 0), totalCashOut = setup.cashSpent + ingredientsPurchased + promotionsPurchased + carePurchased;
  const netLiquidProfit = assets.total - setup.budget, reconciliationError = netLiquidProfit - (operatingProfit - setup.capital);
  const cashLedgerError = s.coins - (setup.initialCash + revenue - totalCashOut);
  if (Math.abs(reconciliationError) > 1e-4 || Math.abs(cashLedgerError) > 1e-4) throw new Error('Unreconciled mechanism ledger');
  const pending = sim.customers.filter(c => !c.hasCup && !['sitting', 'exiting'].includes(c.phase)).length;
  const unmetDemand = missed + doorLost, arrivalAttempts = served + unmetDemand + pending;
  return { scenarioId: scenario.id, seed, seconds: 180, refill, initialHash, firstUpdateHash, receipts, revenue, operatingProfit,
    ingredientExpense, careExpense, promotionExpense, ingredientsPurchased, promotionsPurchased, carePurchased, totalCashOut,
    assets, netLiquidProfit, cashProfit: s.coins - setup.initialCash, reconciliationError, cashLedgerError,
    served, missed, doorLost, soldOut, queueLost, tableLost, peakQueue, pending, unmetDemand, arrivalAttempts,
    lossRate: unmetDemand / Math.max(1, arrivalAttempts), pendingLostRate: (unmetDemand + pending) / Math.max(1, arrivalAttempts),
    rating: reputationScore(s.reputation), liveFood: styleLiveFood(s, sim), midRestockCost: receipts.find(r => r.atSeconds === 90)?.cash ?? 0 };
}
it('diagnostic no-action loop agrees with the frozen existing helper', () => {
  for (const scenario of scenarios) {
    const baseline = observedFlowSample(scenario, seeds[0], 180), own = sample(scenario, seeds[0], false);
    for (const key of ['revenue', 'operatingProfit', 'served', 'missed', 'doorLost', 'soldOut', 'queueLost', 'tableLost', 'rating', 'arrivalAttempts', 'lossRate', 'ingredientExpense', 'careExpense', 'promotionExpense', 'liveFood', 'assets'] as const) expect(own[key]).toEqual(baseline[key]);
    expect(own.firstUpdateHash).toBe(baseline.initialStateHash);
  }
});
it.skipIf(!process.env.PLAY_FLOW_MECHANISM)('records one paid midpoint refill as a non-acceptance mechanism experiment', () => {
  const label = process.env.PLAY_FLOW_MECHANISM!;
  const metadata = { label, sourceHash: styleSourceHash(), designHashes: designHashes(), runnerHash: runnerHash(), seeds, scope: scenarios.map(s => s.id), intervention: 'one existing paid restock at 90s; exact180s endpoint', generatedAt: new Date().toISOString() };
  const batches: Record<string, ReturnType<typeof sample>[]> = {};
  for (const scenario of scenarios) {
    batches[scenario.id] = seeds.map(seed => sample(scenario, seed, true));
    if (styleSourceHash() !== metadata.sourceHash || runnerHash() !== metadata.runnerHash) throw new Error('Mechanism source changed');
    atomic(`${dir}/${label}.json`, { metadata, complete: scenarios.every(s => batches[s.id]?.length === 30), batches });
    console.log(`${label}: ${scenario.id}: 30/30`);
  }
}, 86_400_000);
it.skipIf(!process.env.PLAY_FLOW_MECHANISM_VERIFY)('reports diagnostic restock effects while preserving the no-action comparison', () => {
  const load = (label: string) => JSON.parse(readFileSync(`${dir}/${label}.json`, 'utf8'));
  const base = load('baseline-mechanism-v1'), waves = load('waves10-mechanism-v1'), baseNo = load('baseline-holdout-v1'), wavesNo = load('waves10-holdout-v1');
  if (!base.complete || !waves.complete || objectHash(base.metadata.seeds) !== objectHash(waves.metadata.seeds) || base.metadata.runnerHash !== waves.metadata.runnerHash || waves.metadata.runnerHash !== runnerHash() || waves.metadata.sourceHash !== styleSourceHash()) throw new Error('Unpaired/stale mechanism');
  const results = scenarios.map(scenario => {
    const b = base.batches[scenario.id], w = waves.batches[scenario.id], bn = baseNo.batches[`${scenario.id}@180`], wn = wavesNo.batches[`${scenario.id}@180`];
    if ([b,w,bn,wn].some(rows => rows.length !== 30) || b.some((r: any, i: number) => r.seed !== seeds[i] || w[i].seed !== seeds[i] || r.firstUpdateHash !== w[i].firstUpdateHash || r.firstUpdateHash !== bn[i].initialStateHash || r.firstUpdateHash !== wn[i].initialStateHash)) throw new Error('Different scenario startup');
    const metrics = Object.fromEntries(['operatingProfit', 'rating', 'lossRate', 'soldOut', 'served', 'ingredientExpense', 'cashProfit'].map(key => [key, {
      baselineNoRefill: flowStats(bn.map((r: any) => r[key])), wavesNoRefill: flowStats(wn.map((r: any) => r[key])),
      baselineRefill: flowStats(b.map((r: any) => r[key])), wavesRefill: flowStats(w.map((r: any) => r[key])),
      betweenVersionsAfterRefill: flowStats(w.map((r: any, i: number) => r[key] - b[i][key])),
      baselineRefillEffect: flowStats(b.map((r: any, i: number) => r[key] - bn[i][key])),
      wavesRefillEffect: flowStats(w.map((r: any, i: number) => r[key] - wn[i][key])),
    }]));
    return { scenario: scenario.id, metrics, baselineMidRestockCost: flowStats(b.map((r: any) => r.midRestockCost)), wavesMidRestockCost: flowStats(w.map((r: any) => r.midRestockCost)),
      baselineRemainingPantry: flowStats(b.map((r: any) => r.assets.pantry)), wavesRemainingPantry: flowStats(w.map((r: any) => r.assets.pantry)) };
  });
  writeFileSync(`${dir}/waves10-mechanism-v1-comparison.json`, JSON.stringify({ diagnosticOnly: true, acceptanceReplacement: false, runnerHash: runnerHash(), results }, null, 2) + '\n');
  console.log(JSON.stringify(results));
});
