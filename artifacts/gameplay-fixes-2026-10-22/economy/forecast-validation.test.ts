import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../../../src/game/state';
import { INGREDIENTS, type ItemId } from '../../../src/game/data';
import { conditionOn, type ConditionId } from '../../../src/game/conditions';
import { buyItem, restock, expectedCustomers, restockQuote, restockPlan, counterCapacity } from '../../../src/game/economy';
import { checkOpen, openShop } from '../../../src/game/day';
import { Sim } from '../../../src/game/sim';

const rng = (initial: number) => { let n = initial; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const value = (pantry: Record<string, number>) => INGREDIENTS.reduce((sum, ing) => sum + pantry[ing.id] * ing.cost, 0);
const fixture = (weather: ConditionId) => {
  const s = createInitialState(101); s.coins = 20000; s.day = 3;
  while (conditionOn(s, s.day) !== weather) s.day++;
  for (const id of ['espresso', 'espresso', 'espresso', 'espresso', 'americano', 'latte', 'blacktea'] as ItemId[]) expect(buyItem(s, id, 1)).toBe(true);
  s.onMenu = ['espresso', 'latte', 'blacktea'];
  for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] = 0;
  return s;
};

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('validates original forecast cases and independent holdout without overwriting the baseline', () => {
  const old = JSON.parse(readFileSync('artifacts/gameplay-review-2026-10-22/economy/forecast-stock.json', 'utf8'));
  const raw: any[] = [];
  for (const weather of ['fair', 'rain', 'hot', 'market'] as ConditionId[]) for (const cohort of ['original', 'holdout']) for (let seed = 1; seed <= 50; seed++) {
    const s = fixture(weather);
    const randomSeed = cohort === 'original' ? seed * 1701 : (0x71abc013 + Math.imul(seed, 2654435761)) >>> 0;
    const beforeRestock = s.coins;
    const quote = restockQuote(s);
    restock(s); const pantry = {...s.pantry}; const forecast = expectedCustomers(s); const check = checkOpen(s);
    expect(check.ok).toBe(true);
    expect(beforeRestock - s.coins).toBeCloseTo(quote.cost, 8);
    expect(value(pantry)).toBeCloseTo(quote.cost, 8);
    expect(restockQuote(s).cost).toBe(0);
    openShop(s); const sim = new Sim(rng(randomSeed));
    for (let step = 0; step < 10000 && (s.phase === 'open' || !sim.finishedService); step++) sim.update(s, .05);
    expect(sim.finishedService).toBe(true); const report = sim.closeShop(s)!;
    const leftoverValue = value(s.pantry);
    expect(s.coins).toBeGreaterThanOrEqual(0);
    expect(leftoverValue).toBeCloseTo(quote.cost - report.ingredientCost, 8);
    expect(s.coins - beforeRestock + leftoverValue).toBeCloseTo(report.profit, 8);
    expect(Object.values(s.pantry).every(n => Number.isFinite(n) && n >= 0)).toBe(true);
    raw.push({weather, cohort, seed, randomSeed, forecast, pantry, check, purchase: quote.cost, leftoverValue,
      cashChange: s.coins - beforeRestock, profit: report.profit, served: report.served, missed: report.missed,
      stock: report.soldOut, door: report.doorLost, rating: report.rating, sales: report.sales, shortages: report.shortages});
  }
  const summary = [...new Set(raw.map(r => `${r.weather}/${r.cohort}`))].map(group => {
    const rows = raw.filter(r => `${r.weather}/${r.cohort}` === group);
    const baseline = old.raw.filter((r: any) => r.weather === rows[0].weather && r.supply === 'forecast');
    const avg = (k: string) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    const before = (k: string) => baseline.reduce((a: number, r: any) => a + r[k], 0) / baseline.length;
    return {group, samples: rows.length, forecast: rows[0].forecast,
      stockoutRuns: rows.filter(r => r.stock > 0).length, stock: avg('stock'), served: avg('served'), rating: avg('rating'),
      purchase: avg('purchase'), leftoverValue: avg('leftoverValue'), cashChange: avg('cashChange'), profit: avg('profit'),
      priorOriginal: {stockoutRuns: baseline.filter((r: any) => r.stock > 0).length, stock: before('stock'), served: before('served'), rating: before('rating'), purchase: value(baseline[0].pantry), profit: before('profit')},
    };
  });
  writeFileSync('artifacts/gameplay-fixes-2026-10-22/economy/forecast-validation.json', JSON.stringify({
    method: 'Current working-tree source. Same purchased cafe/menu as immutable gameplay-review/forecast-stock.json: espresso5, latte1, blacktea1, initial owner/server, no reinvestment/interactions, forecast restock once. 50 original seeds and 50 independent holdout seeds per each of 4 weather conditions. Baseline columns always refer to prior original seeds; do not interpret holdout as paired before/after. Inventory valued at ingredient purchase cost and confirmed retained after settlement.',
    sourceHash: createHash('sha256').update(readFileSync('src/game/economy.ts')).update(readFileSync('src/game/sim.ts')).digest('hex'), summary, raw,
  }, null, 2));
  console.table(summary.map(({priorOriginal, ...row}) => ({...row, oldStockoutRuns: priorOriginal.stockoutRuns, oldRating: priorOriginal.rating, oldPurchase: priorOriginal.purchase})));
}, 180000);

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('checks forecast purchase bounds with constrained balances and finite capacities', () => {
  const raw: any[] = [];
  for (const weather of ['fair', 'rain', 'hot', 'market'] as ConditionId[]) for (const cash of [0, 0.5, 1, 2, 3, 5, 10, 25, 50, 75, 100, 150, 1000]) {
    const s = fixture(weather); s.coins = cash;
    const plan = restockPlan(s); const capacity = counterCapacity(s);
    expect(Number.isFinite(capacity) && capacity > 0).toBe(true);
    expect(plan.cost).toBeLessThanOrEqual(cash);
    expect(plan.balance).toBeGreaterThanOrEqual(0);
    restock(s);
    expect(s.coins).toBeCloseTo(plan.balance, 8);
    expect(value(s.pantry) + s.coins).toBeCloseTo(cash, 8);
    raw.push({weather, cash, plan, capacity, coins: s.coins, pantry: s.pantry});
  }
  writeFileSync('artifacts/gameplay-fixes-2026-10-22/economy/forecast-balances.json', JSON.stringify(raw, null, 2));
});
