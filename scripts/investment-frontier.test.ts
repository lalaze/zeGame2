/** Equal-wealth, paid-unlock investment routes; optional reproducible simulation. */
import { it, expect } from 'vitest';
import { writeFileSync, renameSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MENU, INGREDIENTS, type ItemId } from '../src/game/data';
import { createInitialState } from '../src/game/state';
import { buyItem, requiresKitchen, restockQuote, salePrice, servingCost, serviceCapacity, arrivalRate, restock, bakeForForecast } from '../src/game/economy';
import { unlockKitchen } from '../src/game/kitchen';
import { openShop } from '../src/game/day';
import { Sim } from '../src/game/sim';
import { MIN_SCENE_H, MAX_SCENE_H, setSceneHeight, setKitchenLevel } from '../src/game/layout';

const BUDGETS = [1200, 100_000, 10_000_000, 1_000_000_000, 100_000_000_000];
const SEEDS = Array.from({ length: 30 }, (_, i) => (0x5eed1234 + i * 2654435761) >>> 0);
const DAYS = 8, OPEN_SECONDS = 180, DT = .05;
const rng = (seed: number) => { let n = seed; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }; };
function route(budget: number, target: ItemId) {
  setSceneHeight(MIN_SCENE_H);
  setKitchenLevel(0);
  const s = createInitialState(0); s.coins = budget;
  for (const i of INGREDIENTS) s.pantry[i.id] = 0;
  if (requiresKitchen(target) && !unlockKitchen(s)) return null;
  const def = MENU.find(m => m.id === target)!;
  const chain = MENU.filter(m => m.category === def.category);
  for (const item of chain.slice(0, chain.indexOf(def) + 1)) {
    if (!s.items[item.id] && !buyItem(s, item.id, 1)) return null;
  }
  s.onMenu = [target]; bakeForForecast(s);
  const unlockCost = budget - s.coins;
  const stockReserve = 2 * restockQuote(s).cost;
  if (s.coins < stockReserve) return null;
  // Keep two forecast days' ingredients in working cash, never spend reserve on levels.
  s.coins -= stockReserve; buyItem(s, target, 'max'); s.coins += stockReserve;
  return { s, budget, target, unlockCost, stockReserve, capital: budget - s.coins,
    level: s.items[target], price: salePrice(s, target), margin: salePrice(s, target) - servingCost(target),
    capacity: serviceCapacity(s), arrival: arrivalRate(s),
    // Forecast proxy only: ignores physical travel, seating, reviews, waste and VIPs.
    marginRate: Math.min(serviceCapacity(s), arrivalRate(s)) * (salePrice(s, target) - servingCost(target)),
  };
}
function distribution(v: number[]) {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { n: v.length, mean, sd, ci95: [mean - 1.96 * sd / Math.sqrt(v.length), mean + 1.96 * sd / Math.sqrt(v.length)] };
}
function simulate(budget: number, target: ItemId, seed: number) {
  const r = route(budget, target)!; const s = r.s; const sim = new Sim(rng(seed));
  let operating = 0, served = 0, lost = 0, waste = 0, rating = 0, timeout = 0, closingSeconds = 0;
  const daily: unknown[] = [];
  let ownCapitalPaybackDay: number | null = null;
  for (let day = 0; day < DAYS; day++) {
    bakeForForecast(s); restock(s); openShop(s);
    for (let step = 0; step < OPEN_SECONDS / DT; step++) sim.update(s, DT);
    sim.beginClosing(s); let steps = 0;
    while (!sim.finishedService && steps < 300 / DT) { sim.update(s, DT); steps++; }
    timeout += Number(!sim.finishedService); closingSeconds += steps * DT;
    const report = sim.closeShop(s)!; operating += report.profit; served += report.served; lost += report.missed + report.doorLost;
    waste += Math.max(0, report.ingredientCost - Object.entries(report.sales).reduce((sum, [id, n]) => sum + servingCost(id as ItemId) * n, 0));
    rating = report.rating;
    if (ownCapitalPaybackDay === null && operating >= r.capital) ownCapitalPaybackDay = day + 1;
    daily.push({ day: day + 1, profit: report.profit, served: report.served, rating: report.rating });
  }
  const inventory = INGREDIENTS.reduce((sum, i) => sum + s.pantry[i.id] * i.cost, 0);
  const netLiquid = s.coins + inventory - budget;
  expect(netLiquid).toBeCloseTo(operating - r.capital, 2);
  return { seed, operating, netLiquid, served, lost, waste, rating, ownCapitalPaybackDay, timeout, closingSeconds, daily };
}
it('charges all prerequisite ownership and kitchen; keeps paid-stock reserve', () => {
  const r = route(100_000, 'cookie')!;
  expect(r.unlockCost).toBe(800 + 300 + 1100 + 3500);
  expect(r.s.kitchen).toBe(true);
  expect(r.s.coins).toBeGreaterThanOrEqual(r.stockReserve);
  expect(r.s.pantry.beans).toBe(0);
  expect(route(1200, 'flatwhite')).toBeNull();
  for (const budget of BUDGETS) for (const m of MENU) {
    const row = route(budget, m.id); if (!row) continue;
    expect(row.capital + row.stockReserve).toBeLessThanOrEqual(budget + 1e-5);
  }
});
it('isolates investment forecasts and simulations from previous layout globals', () => {
  const expected = route(100_000, 'roll');
  setSceneHeight(MAX_SCENE_H); setKitchenLevel(2);
  expect(route(100_000, 'roll')).toEqual(expected);
  const first = simulate(1200, 'espresso', SEEDS[0]);
  setSceneHeight(MAX_SCENE_H); setKitchenLevel(2);
  expect(simulate(1200, 'espresso', SEEDS[0])).toEqual(first);
});
it.skipIf(process.env.INVESTMENT_FRONTIER !== '1')('writes analytical frontier and 30-seed representative route evidence', () => {
  const analytical = BUDGETS.map(budget => ({ budget, rows: MENU.map(m => route(budget, m.id)).filter(r => r !== null).map(({ s: _, ...r }) => r).sort((a, b) => b.marginRate - a.marginRate) }));
  const fingerprint = createHash('sha256').update(readdirSync('src/game').filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort().map(f => `${f}\n${readFileSync(`src/game/${f}`, 'utf8')}`).join('\n')).digest('hex');
  const runnerFingerprint = createHash('sha256').update(readFileSync('scripts/investment-frontier.test.ts')).digest('hex');
  const expectedScenarioCount = BUDGETS.length * 2;
  const scenarios: any[] = [];
  mkdirSync('docs/long-task/results', { recursive: true });
  const save = () => {
    const complete = scenarios.length === expectedScenarioCount && scenarios.every(scenario =>
      scenario.raw.length === SEEDS.length && new Set(scenario.raw.map((row: ReturnType<typeof simulate>) => row.seed)).size === SEEDS.length &&
      scenario.raw.every((row: ReturnType<typeof simulate>, index: number) => row.seed === SEEDS[index] && row.daily.length === DAYS && row.timeout === 0));
    const path = 'docs/long-task/results/investment-frontier.json';
    writeFileSync(`${path}.tmp`, JSON.stringify({ complete, expectedScenarioCount, completedScenarioCount: scenarios.length,
      metadata: { fingerprint, runnerFingerprint, seeds: SEEDS, expectedSeedCountPerScenario: SEEDS.length, days: DAYS, openSeconds: OPEN_SECONDS, dt: DT, budgets: BUDGETS }, analytical, scenarios }, null, 2) + '\n');
    renameSync(`${path}.tmp`, path);
  };
  save();
  for (const { budget, rows } of analytical) {
    const later = rows.find(r => r.target !== 'espresso')!;
    for (const target of ['espresso', later.target] as ItemId[]) {
      const raw = SEEDS.map(seed => simulate(budget, target, seed));
      expect(simulate(budget, target, SEEDS[0])).toEqual(raw[0]);
      expect(raw.every(row => row.timeout === 0)).toBe(true);
      const setup = rows.find(r => r.target === target)!;
      scenarios.push({ budget, target, setup, operating: distribution(raw.map(r => r.operating)), netLiquid: distribution(raw.map(r => r.netLiquid)), served: distribution(raw.map(r => r.served)), lost: distribution(raw.map(r => r.lost)), waste: distribution(raw.map(r => r.waste)), rating: distribution(raw.map(r => r.rating)), ownCapitalRecovered: raw.filter(r => r.ownCapitalPaybackDay !== null).length, ownCapitalCensored: raw.filter(r => r.ownCapitalPaybackDay === null).length, retainCashBenchmarkNetLiquid: 0, closingTimeouts: raw.reduce((a,r) => a+r.timeout,0), raw });
      console.log(JSON.stringify({ budget, target, level: setup.level, capital: setup.capital, operating: scenarios.at(-1).operating, netLiquid: scenarios.at(-1).netLiquid })); save();
    }
  }
}, 1_800_000);
