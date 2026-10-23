import { afterEach, describe, expect, it } from 'vitest';
import { DAY_SECONDS, INGREDIENTS, type ItemId } from './data';
import { openShop } from './day';
import { restock, servingCost } from './economy';
import { bakeryPlan, batchSeconds, cookBatch } from './kitchen';
import { setKitchenLevel } from './layout';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => setKitchenLevel(0));

function bakery(item: ItemId = 'roll', stage = 0) {
  const state = createInitialState(0);
  state.kitchen = true;
  state.upgrades.cook = stage;
  state.items[item] = 1;
  state.onMenu = [item];
  state.bakePlan[item] = 0;
  for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = 1_000;
  openShop(state);
  const sim = new Sim(() => .5);
  sim.update(state, 0);
  return { state, sim };
}

describe('kitchen production before closing', () => {
  it('does not spend ingredients on a batch started a tenth of a second before closing', () => {
    const { state, sim } = bakery();
    state.dayTime = DAY_SECONDS - .1;
    const pantry = { ...state.pantry };

    sim.update(state, .05);

    expect(state.inProduction.roll ?? 0).toBe(0);
    expect(sim.cooks.every(cook => !cook.batch)).toBe(true);
    expect(state.pantry).toEqual(pantry);
    for (let tick = 0; tick < 1_000 && state.phase === 'open'; tick++) sim.update(state, .05);
    expect(sim.finishedService).toBe(true);
    const report = sim.closeShop(state)!;
    expect(report.duration).toBeLessThan(DAY_SECONDS + .1);
    expect(report.ingredientCost).toBe(0);
    expect(report.staleCost).toBe(0);
    expect(report.profit).toBe(0);
  });

  it('stops accepting guests when only raw ingredients remain and no batch can finish in time', () => {
    const { state, sim } = bakery();
    state.dayTime = DAY_SECONDS - batchSeconds('roll', state) + 1;
    const pantry = { ...state.pantry };
    const snapshot = sim.snapshot(state);
    snapshot.spawnTimer = 0; // An arrival is due on the same tick as the empty-shelf check.
    expect(sim.restore(snapshot, state)).toBe(true);

    sim.update(state, .05);

    expect(state.phase).toBe('closing');
    expect(state.dayTime).toBeLessThan(DAY_SECONDS);
    expect(sim.customers).toHaveLength(0);
    expect(sim.snapshot(state).nextId).toBe(snapshot.nextId);
    expect(state.today.missed).toBe(0);
    expect(state.reputation.recent).toHaveLength(0);
    expect(state.pantry).toEqual(pantry);
    expect(sim.finishedService).toBe(true);
    expect(sim.resumeAfterRestock(state)).toBe(false);
  });

  it('resumes the same bakery day after buying ingredients while there is still time to bake', () => {
    const { state, sim } = bakery();
    state.dayTime = 40;
    state.coins = 10_000;
    state.pantry.flour = 0;
    state.pantry.butter = 0;
    sim.update(state, .05);
    expect(state.phase).toBe('closing');
    expect(sim.resumeAfterRestock(state)).toBe(false);
    const day = state.day, dayTime = state.dayTime, ledger = state.today;

    expect(restock(state)).toBe(true);
    expect(sim.resumeAfterRestock(state)).toBe(true);

    expect(state.phase).toBe('open');
    expect(state.day).toBe(day);
    expect(state.dayTime).toBe(dayTime);
    expect(state.today).toBe(ledger);
    sim.update(state, .05);
    expect(state.inProduction.roll).toBeGreaterThan(0);
    for (let tick = 0; tick < 2_000 && !state.today.baked.roll; tick++) sim.update(state, .05);
    expect(state.today.baked.roll).toBeGreaterThan(0);
    expect(state.phase).toBe('open');
  });

  it('makes a smaller final tray with a reserve for late order variation', () => {
    const { state, sim } = bakery('roll', 2);
    const rate = bakeryPlan(state).get('roll')!.rate;
    state.dayTime = DAY_SECONDS - batchSeconds('roll', state) - 1.5 / rate;

    sim.update(state, .05);

    const portions = state.inProduction.roll!;
    expect(portions).toBeGreaterThan(0);
    expect(portions).toBeLessThan(cookBatch(state));
    expect(portions).toBeGreaterThanOrEqual(2); // Cover the forecast as well as a bounded reserve.
    expect(state.today.ingredientCost).toBe(servingCost('roll') * portions);
    for (let tick = 0; tick < 2_000 && !state.today.baked.roll; tick++) sim.update(state, .05);
    expect(state.today.baked.roll).toBe(portions);
    expect(state.dayTime).toBeLessThan(DAY_SECONDS);
  });

  it.each([0, 1, 2])('delivers the final roll and chilled cake in time at kitchen stage %i', stage => {
    for (const item of ['roll', 'cake'] as const) {
      const { state, sim } = bakery(item, stage);
      state.dayTime = DAY_SECONDS - batchSeconds(item, state) - 2;
      sim.update(state, .05);
      expect(state.inProduction[item]).toBeGreaterThan(0);
      for (let tick = 0; tick < 2_000 && !state.today.baked[item]; tick++) sim.update(state, .05);
      expect(state.today.baked[item]).toBeGreaterThan(0);
      expect(state.dayTime).toBeLessThan(DAY_SECONDS);
    }
  });

  it('leaves enough shelf stock for the rest of the day without topping it back up', () => {
    const { state, sim } = bakery();
    const plan = bakeryPlan(state).get('roll')!;
    state.dayTime = DAY_SECONDS - batchSeconds('roll', state) - 1;
    state.shelf.roll = Math.ceil(plan.rate * (DAY_SECONDS - state.dayTime));
    expect(state.shelf.roll).toBeLessThanOrEqual(plan.trigger);

    sim.update(state, .05);

    expect(sim.cooks.every(cook => !cook.batch)).toBe(true);
    expect(state.today.ingredientCost).toBe(0);
  });

  it('still finishes a paid batch after closing and restoring the live save', () => {
    const { state, sim } = bakery();
    sim.update(state, .05);
    const portions = state.inProduction.roll!;
    expect(portions).toBe(cookBatch(state));
    sim.beginClosing(state);
    const restored = deserialize(serialize(state), 0);
    const resumed = new Sim(() => .5);
    expect(resumed.restore(sim.snapshot(state), restored)).toBe(true);

    for (let tick = 0; tick < 2_000 && !resumed.finishedService; tick++) resumed.update(restored, .05);

    expect(resumed.finishedService).toBe(true);
    expect(restored.today.baked.roll).toBe(portions);
    expect(restored.shelf.roll).toBe(portions);
    expect(restored.today.ingredientCost).toBe(portions * servingCost('roll'));
    expect(restored.inProduction.roll).toBe(0);
  });
});
