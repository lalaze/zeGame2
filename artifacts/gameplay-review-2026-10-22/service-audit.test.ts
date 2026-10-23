import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createInitialState } from '../../src/game/state';
import { Sim } from '../../src/game/sim';
import { openShop } from '../../src/game/day';
import { bakeForForecast, dayDemand, restock, restockQuote } from '../../src/game/economy';
import { bakeryPlan, nextBatch, batchSeconds } from '../../src/game/kitchen';
import type { ItemId } from '../../src/game/data';

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('measures current service decisions without modifying game rules', () => {
  const late = createInitialState(0);
  late.day = 3; late.kitchen = true; late.items.roll = 1;
  late.onMenu = ['roll']; late.coins = 10000;
  for (const key of Object.keys(late.pantry) as (keyof typeof late.pantry)[]) late.pantry[key] = 100;
  openShop(late); late.dayTime = 179.9; late.shelf.roll = 0;
  const lateBatch = { remainingDay: 180 - late.dayTime, nextBatch: nextBatch(late, []), productionSeconds: batchSeconds('roll', late) };
  expect(lateBatch.nextBatch).not.toBeNull();

  const runs: object[] = [];
  for (const menu of [['espresso', 'roll'], ['espresso', 'roll', 'bagel', 'donut']] as ItemId[][]) {
    for (const cooks of [0, 1, 2]) for (let seed = 1; seed <= 15; seed++) {
      const s = createInitialState(seed); s.day = 3; s.coins = 10000; s.kitchen = true;
      s.upgrades.cook = cooks; s.upgrades.marketing = 4; s.upgrades.machine = 2; s.upgrades.barista = 1;
      for (const id of menu) s.items[id] = 1;
      s.onMenu = menu;
      for (const key of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) s.pantry[key] = 0;
      bakeForForecast(s); restock(s);
      const forecast = Object.fromEntries(dayDemand(s));
      const plan = Object.fromEntries(bakeryPlan(s));
      const bake = {...s.bakePlan};
      openShop(s);
      let rng = seed;
      const sim = new Sim(() => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 2 ** 32));
      let lateStarted = 0;
      let atClose: unknown;
      for (let step = 0; step < 10000 && (s.phase === 'open' || !sim.finishedService); step++) {
        const costs = s.today.ingredientCost;
        const wasOpen = s.phase === 'open';
        sim.update(s, .05);
        if (s.dayTime > 170 && s.today.ingredientCost > costs && Object.values(s.inProduction).some(n => (n ?? 0) > 0)) lateStarted++;
        if (wasOpen && s.phase !== 'open') atClose = { time: s.dayTime, inProduction: {...s.inProduction}, shelf: {...s.shelf} };
      }
      const report = sim.closeShop(s)!;
      expect(report).not.toBeNull();
      runs.push({ menu: menu.join('+'), cooks: cooks + 1, seed, forecast, plan, bake, atClose, lateStarted,
        profit: report.profit, served: report.served, soldOut: report.soldOut,
        baked: report.baked, stale: report.stale, staleCost: report.staleCost, duration: report.duration });
    }
  }

  const stock = createInitialState(0); stock.day = 3; stock.coins = 10000;
  for (const key of Object.keys(stock.pantry) as (keyof typeof stock.pantry)[]) stock.pantry[key] = 0;
  openShop(stock);
  const stockAtOpen = restockQuote(stock); stock.dayTime = 175;
  const stockAtEnd = restockQuote(stock);
  const summary = [];
  for (const menu of [...new Set(runs.map((r: any) => r.menu))]) for (const cooks of [1, 2, 3]) {
    const matched: any[] = runs.filter((r: any) => r.menu === menu && r.cooks === cooks);
    const mean = (key: string) => matched.reduce((sum, row) => sum + row[key], 0) / matched.length;
    summary.push({ menu, cooks, profit: mean('profit'), served: mean('served'), soldOut: mean('soldOut'), staleCost: mean('staleCost'), duration: mean('duration'), daysWithInProgressAtClose: matched.filter(r => Object.values(r.atClose.inProduction).some((n: any) => n > 0)).length });
  }
  writeFileSync('artifacts/gameplay-review-2026-10-22/service-audit.json', JSON.stringify({ method: 'Synthetic controlled day-3 states; 15 seeded runs per menu and kitchen size; paid forecast stock, automatic service, no moments; existing game code unchanged. Staff costs excluded from daily operating profit.', lateBatch, stockAtOpen, stockAtEnd, summary, runs }, null, 2));
  console.log(JSON.stringify({lateBatch, stockAtOpen, stockAtEnd, summary}, null, 2));
}, 120000);
