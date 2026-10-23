import { writeFileSync, mkdirSync } from 'node:fs';
import { it, expect } from 'vitest';
import { conditionOn, type ConditionId } from '../src/game/conditions';
import { INGREDIENTS, type ItemId } from '../src/game/data';
import { buyItem, buyUpgrade, bakeForForecast, restock, itemLevelsCost, menuItem } from '../src/game/economy';
import { unlockKitchen } from '../src/game/kitchen';
import { openShop } from '../src/game/day';
import { createInitialState } from '../src/game/state';
import { Sim } from '../src/game/sim';

const menus: Record<string, ItemId[]> = {
  espresso: ['espresso'], bakery: ['espresso', 'roll'], tea: ['blacktea', 'scone'],
};
const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};

// A controlled menu-choice comparison, not a fresh-save speedrun: all three
// policies inherit exactly the same purchased café, recipes, working cash and
// flavour experience. Only the day's menu and production-aware bake differ.
function run(menu: ItemId[], condition: ConditionId, pressure: 'calm' | 'rush', seed: number) {
  const state = createInitialState(seed);
  state.coins = 20000;
  state.day = 3;
  while (conditionOn(state, state.day) !== condition) state.day++;
  expect(unlockKitchen(state)).toBe(true);
  for (const [id, level] of [['espresso', 5], ['blacktea', 2], ['roll', 3], ['donut', 1], ['scone', 1]] as const) {
    const levels = level - state.items[id];
    const cost = itemLevelsCost(menuItem(id), state.items[id], levels);
    for (let n = 0; n < levels; n++) expect(buyItem(state, id, 1)).toBe(true);
    expect(cost).toBeGreaterThanOrEqual(0);
  }
  if (pressure === 'calm') {
    for (const id of ['barista', 'server', 'machine', 'machine'] as const) expect(buyUpgrade(state, id, 1)).toBe(true);
  }
  for (let n = 0; n < (pressure === 'rush' ? 8 : 1); n++) expect(buyUpgrade(state, 'marketing', 1)).toBe(true);
  const capital = 20000 - state.coins;
  for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = 0;
  state.onMenu = [...menu];
  state.bakePlan = {};
  bakeForForecast(state);
  restock(state);
  const startCash = state.coins;
  openShop(state);
  const sim = new Sim(seeded(seed));
  for (let step = 0; step < 7000 && (state.phase === 'open' || !sim.finishedService); step++) sim.update(state, .05);
  expect(state.phase).toBe('closing');
  expect(sim.finishedService).toBe(true);
  const report = sim.closeShop(state)!;
  return { seed, day: report.day, capital, startCash,
    profit: report.profit, rating: report.rating, served: report.served,
    missed: report.missed, doorLost: report.doorLost,
    waste: Object.values(report.stale).reduce<number>((sum, n) => sum + (n ?? 0), 0),
    guests: report.guests,
  };
}

it.skipIf(process.env.CUSTOMER_DEMAND_LAB !== '1')('compares three menus at identical capital and weather with real stock and service', () => {
  const seedCount = Number(process.env.DEMAND_SEEDS ?? 10);
  const raw = [];
  const summary: Record<string, number | string>[] = [];
  for (const pressure of ['calm', 'rush'] as const) for (const weather of ['fair', 'rain', 'hot', 'crisp', 'market', 'quiet'] as const) {
    for (const [menu, items] of Object.entries(menus)) {
      const runs = Array.from({ length: seedCount }, (_, index) => run(items, weather, pressure, 101 + index * 17));
      raw.push({ pressure, weather, menu, runs });
      const average = (key: 'profit' | 'rating' | 'served' | 'missed' | 'doorLost' | 'waste') => Math.round(runs.reduce((sum, run) => sum + run[key], 0) / seedCount * 100) / 100;
      summary.push({ pressure, weather, menu, capital: runs[0].capital, profit: average('profit'), rating: average('rating'), served: average('served'), lost: average('missed'), door: average('doorLost'), waste: average('waste') });
      expect(runs.every(run => run.profit > 0)).toBe(true);
    }
  }
  mkdirSync('artifacts/customer-demand', { recursive: true });
  writeFileSync('artifacts/customer-demand/balance.json', JSON.stringify({ seedCount, method: 'Same purchased café and cash before restocking; no reinvestment, no moments, one full business day per condition. Capital includes kitchen and every owned recipe, including off-menu dishes. Profit charges all consumed ingredients, including waste; unspent pantry stays owned.', summary, raw }, null, 2));
  console.table(summary);
}, 180000);
