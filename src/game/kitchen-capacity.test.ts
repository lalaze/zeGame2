import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MAX_COOK_BATCH, type ItemId } from './data';
import { openShop } from './day';
import { bakeForForecast, dayDemand, isBakery, suggestedBake } from './economy';
import { bakeryPlan, cookBatch, kitchenLoad } from './kitchen';
import { setKitchenLevel } from './layout';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, type GameState } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
const BAKES: ItemId[] = ['roll', 'bagel', 'donut', 'croissant', 'cookie'];
/** A busy café with a kitchen at the given stage, pastries on the menu and a full pantry. */
function bakery(marketing: number, stage = 0): GameState {
  const s = createInitialState(0);
  s.kitchen = true;
  s.upgrades.cook = stage;
  s.upgrades.marketing = marketing;
  s.upgrades.barista = 3;
  for (const id of ['espresso', ...BAKES] as ItemId[]) s.items[id] = 5;
  s.onMenu = ['espresso', ...BAKES];
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 1e6;
  setKitchenLevel(stage);
  return s;
}

describe('kitchen capacity', () => {
  it('bakes bigger batches as the kitchen grows', () => {
    expect([0, 1, 2].map((stage) => cookBatch(bakery(0, stage)))).toEqual([5, 7, 10]);
    expect(MAX_COOK_BATCH).toBe(10);
  });

  it('keeps the morning bake small while the cooks can keep up', () => {
    const s = bakery(0);
    s.onMenu = ['espresso', 'roll'];
    expect(kitchenLoad(s)).toBeLessThan(1);
    for (const [id, plan] of bakeryPlan(s)) {
      expect(plan.morning).toBe(plan.trigger);
      expect(suggestedBake(s, id)).toBeLessThan(Math.ceil(dayDemand(s).get(id)!));
    }
  });

  it('bakes the whole forecast ahead when the day is more than the cooks can make', () => {
    const s = bakery(14);
    expect(kitchenLoad(s)).toBeGreaterThan(1);
    for (const [id, n] of dayDemand(s)) if (isBakery(id)) expect(suggestedBake(s, id)).toBe(Math.ceil(n));
    // A bigger kitchen takes some of that back.
    const bigger = bakery(14, 2);
    expect(kitchenLoad(bigger)).toBeLessThan(kitchenLoad(s));
  });

  it('runs an overloaded day on the suggestion without empty shelves', () => {
    const s = bakery(14);
    bakeForForecast(s);
    openShop(s);
    const sim = new Sim(seeded(3));
    for (let n = 0; n < 3600; n++) sim.update(s, 0.05);
    const pastries = BAKES.reduce((sum, id) => sum + (s.today.sales[id] ?? 0) + (s.today.shortages[id] ?? 0), 0);
    const short = BAKES.reduce((sum, id) => sum + (s.today.shortages[id] ?? 0), 0);
    expect(pastries).toBeGreaterThan(50);
    expect(short / pastries).toBeLessThan(0.05);
  });

  it('saves batches up to the largest tray', () => {
    const s = bakery(14, 2);
    openShop(s);
    const sim = new Sim(seeded(3));
    for (let n = 0; n < 2000 && !sim.cooks.some((c) => c.batch && c.batch.n > 5); n++) sim.update(s, 0.05);
    const snapshot = sim.snapshot(s);
    expect(snapshot.cooks.some((c) => c.batch && c.batch.n > 5)).toBe(true);
    expect(validSnapshot(snapshot, s)).toBe(true);
    snapshot.cooks.find((c) => c.batch)!.batch!.n = MAX_COOK_BATCH + 1;
    expect(validSnapshot(snapshot, s)).toBe(false);
  });
});
