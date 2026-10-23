import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createInitialState } from '../../src/game/state';
import { openShop } from '../../src/game/day';
import { Sim } from '../../src/game/sim';

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('replays a new automatic batch just before closing, with no pending guests', () => {
  const state = createInitialState(0);
  state.day = 3; state.kitchen = true; state.items.roll = 1; state.onMenu = ['roll'];
  for (const key of Object.keys(state.pantry) as (keyof typeof state.pantry)[]) state.pantry[key] = 100;
  openShop(state); state.dayTime = 179.9; state.shelf.roll = 0;
  const sim = new Sim(() => .5);
  sim.update(state, .05);
  const started = { time: state.dayTime, customers: sim.customers.length, batches: structuredClone(state.inProduction), cost: state.today.ingredientCost };
  expect(started.customers).toBe(0);
  expect(started.batches.roll).toBe(5);
  for (let step = 0; step < 2000 && (state.phase === 'open' || !sim.finishedService); step++) sim.update(state, .05);
  const report = sim.closeShop(state)!;
  const result = { method: 'Synthetic valid empty late-day café, 0.1 simulation second before closing. Actual Sim.update starts and completes batch, then actual closeShop settles it; no source mutation.', started, duration: report.duration, served: report.served, baked: report.baked, stale: report.stale, profit: report.profit };
  expect(report.stale.roll).toBe(5);
  expect(report.served).toBe(0);
  writeFileSync('artifacts/gameplay-review-2026-10-22/late-batch-audit.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
});
