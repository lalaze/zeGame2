import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createInitialState } from '../../../src/game/state';
import { INGREDIENTS, type ItemId } from '../../../src/game/data';
import { conditionOn, type ConditionId } from '../../../src/game/conditions';
import { buyItem, restock, expectedCustomers, averageDishPrice, menuTrafficMultiplier, dayNeeds } from '../../../src/game/economy';
import { checkOpen, openShop } from '../../../src/game/day';
import { Sim } from '../../../src/game/sim';
const rng = (initial: number) => { let n = initial; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('measures current early menu decisions', () => {
  const raw: any[] = [];
  for (const weather of ['fair', 'rain', 'hot', 'crisp', 'market', 'quiet'] as ConditionId[]) {
    for (const menu of [['espresso'], ['espresso', 'americano'], ['espresso', 'latte'], ['espresso', 'blacktea'], ['espresso', 'latte', 'blacktea']] as ItemId[][]) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = createInitialState(101); s.coins = 20000; s.day = 3;
        while (conditionOn(s, s.day) !== weather) s.day++;
        for (const id of ['espresso', 'espresso', 'espresso', 'espresso', 'americano', 'latte', 'blacktea'] as ItemId[]) expect(buyItem(s, id, 1)).toBe(true);
        s.onMenu = [...menu]; for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] = 0;
        const forecast = expectedCustomers(s); const traffic = menuTrafficMultiplier(s); const price = averageDishPrice(s); const needs = dayNeeds(s);
        restock(s); openShop(s); const sim = new Sim(rng(seed * 1701));
        for (let step = 0; step < 10000 && (s.phase === 'open' || !sim.finishedService); step++) sim.update(s, .05);
        expect(sim.finishedService).toBe(true); const report = sim.closeShop(s)!;
        raw.push({ weather, menu: menu.join('+'), seed, forecast, traffic, price, needs, profit: report.profit, served: report.served, missed: report.missed, stock: report.soldOut, door: report.doorLost, rating: report.rating, sales: report.sales, shortages: report.shortages });
      }
    }
  }
  const groups = [...new Set(raw.map(r => `${r.weather}/${r.menu}`))];
  const summary = groups.map(group => {
    const rows = raw.filter(r => `${r.weather}/${r.menu}` === group); const avg = (k: string) => rows.reduce((a, r) => a+r[k], 0) / rows.length;
    return {group, forecast: rows[0].forecast, traffic: rows[0].traffic, price: rows[0].price, profit: avg('profit'), served: avg('served'), missed: avg('missed'), stock: avg('stock'), door: avg('door'), rating: avg('rating')};
  });
  writeFileSync('artifacts/gameplay-review-2026-10-22/economy/early-menus.json', JSON.stringify({method: 'Current working-tree code; same cafe purchased espresso Lv5, americano/latte/blacktea Lv1; one initial barista and server; no additional upgrades; day >=3 with selected weather; forecast restock once before opening, no reinvestment or interactions; 20 fixed RNG seeds each.', summary, raw}, null, 2));
  console.table(summary);
}, 180000);

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('isolates forecast restock against ample supply on identical early menus', () => {
  const raw: any[] = [];
  for (const weather of ['fair', 'rain', 'hot', 'market'] as ConditionId[]) for (const supply of ['forecast', 'ample']) for (let seed = 1; seed <= 50; seed++) {
    const s = createInitialState(101); s.coins = 20000; s.day = 3;
    while (conditionOn(s, s.day) !== weather) s.day++;
    for (const id of ['espresso', 'espresso', 'espresso', 'espresso', 'americano', 'latte', 'blacktea'] as ItemId[]) expect(buyItem(s, id, 1)).toBe(true);
    s.onMenu = ['espresso', 'latte', 'blacktea']; for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] = 0;
    restock(s); const pantry = {...s.pantry}; const forecast = expectedCustomers(s); const check = checkOpen(s);
    if (supply === 'ample') for (const ingredient of INGREDIENTS) s.pantry[ingredient.id] += 1000;
    openShop(s); const sim = new Sim(rng(seed * 1701));
    for (let step = 0; step < 10000 && (s.phase === 'open' || !sim.finishedService); step++) sim.update(s, .05);
    expect(sim.finishedService).toBe(true); const report = sim.closeShop(s)!;
    raw.push({weather, supply, seed, forecast, pantry, check, profit: report.profit, served: report.served, missed: report.missed, stock: report.soldOut, door: report.doorLost, rating: report.rating, sales: report.sales, shortages: report.shortages, reviews: report.reviews, guests: report.guests});
  }
  const summary = [...new Set(raw.map(r => `${r.weather}/${r.supply}`))].map(group => {
    const rows = raw.filter(r => `${r.weather}/${r.supply}` === group); const avg = (k: string) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    return {group, forecast: rows[0].forecast, stockoutRuns: rows.filter(r => r.stock > 0).length, profit: avg('profit'), served: avg('served'), stock: avg('stock'), door: avg('door'), rating: avg('rating'), check: rows[0].check, pantry: rows[0].pantry};
  });
  writeFileSync('artifacts/gameplay-review-2026-10-22/economy/forecast-stock.json', JSON.stringify({method:'50 seeded full days per weather and supply policy; same purchased cafe and prices as early-menus.json; ample supply adds 1000 of each ingredient solely to isolate service/demand from stockout; profit still charges actual consumption.',summary, raw}, null,2));
  console.table(summary);
},180000);
