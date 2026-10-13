import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { consumeServing, servingCost, salePrice, baseArrivalRate } from './economy';
import { makeSignatureId, saveSignature, setSignatureOnMenu, trialSignature, renameSignature, deleteSignature, replaceSignature } from './signature-drinks';
import { recordServings, tasteScore } from './taste';
import { setCafeStyle, styleStages } from './styles';
import { openShop } from './day';
import { Sim } from './sim';

const formula = { beans: 1, milk: 2 };
const id = makeSignatureId('coffee', formula)!;
function setup() {
  const s = createInitialState(0);
  s.items.latte = 1;
  s.pantry.beans = 100;
  s.pantry.milk = 100;
  expect(trialSignature(s, 'coffee', formula).ok).toBe(true);
  expect(saveSignature(s, id, 'Original')).toBe(true);
  expect(setSignatureOnMenu(s, id, true)).toBe(true);
  return s;
}

describe('independent signature feature integration review', () => {
  it('rebuilding the identical formula cannot farm coins, practice, route mastery or listing traffic', () => {
    let s = setup();
    setCafeStyle(s, 'coffee');
    recordServings(s, Array(100).fill(id));
    const initial = { coins: s.coins, price: salePrice(s, id), score: tasteScore(s, id), route: styleStages(s, 'coffee'), arrival: baseArrivalRate(s) };
    for (let i = 0; i < 10; i++) {
      expect(renameSignature(s, id, `Rename ${i}`)).toBe(true);
      expect(replaceSignature(s, id, id, `Same ${i}`)).toBe(true);
      expect(deleteSignature(s, id)).toBe(true);
      s = deserialize(serialize(s), 0);
      expect(saveSignature(s, id, `Rebuilt ${i}`)).toBe(true);
      expect(setSignatureOnMenu(s, id, true)).toBe(true);
      expect(trialSignature(s, 'coffee', formula).ok).toBe(true);
      expect(s.signatureDrinks.served[id]).toBe(100);
      expect(s.signatureDrinks.tested).toEqual([id]);
      expect(s.signatureDrinks.recipes).toHaveLength(1);
      expect(s.coins).toBe(initial.coins);
      expect(salePrice(s, id)).toBe(initial.price);
      expect(tasteScore(s, id)).toBe(initial.score);
      expect(styleStages(s, 'coffee')).toEqual(initial.route);
      expect(baseArrivalRate(s)).toBe(initial.arrival);
    }
    expect(s.pantry.beans).toBe(97.25);
    expect(s.pantry.milk).toBe(94.5);
  });
  it('a fractional short ingredient never consumes another ingredient or accrues cost', () => {
    const s = setup();
    s.pantry.beans = 3.75;
    s.pantry.milk = 1.75;
    const before = serialize(s);
    expect(consumeServing(s, id, s.today)).toBe(false);
    expect(serialize(s)).toBe(before);
    s.pantry.milk = 2.25;
    expect(consumeServing(s, id, s.today)).toBe(true);
    expect(s.pantry.beans).toBe(2.75);
    expect(s.pantry.milk).toBe(.25);
    expect(s.today.ingredientCost).toBe(servingCost(id));
    expect(s.today.served).toBe(0);
    expect(s.signatureDrinks.served[id]).toBeUndefined();
  });
  it('attempted live deletion leaves an active snapshot and exactly-once handoff intact', () => {
    const s = setup(); s.onMenu = [];
    openShop(s);
    const sim = new Sim(() => 0);
    for (let i = 0; i < 3000 && !sim.customers.some(c => c.phase === 'waiting'); i++) sim.update(s, .05);
    expect(sim.customers.some(c => c.phase === 'waiting')).toBe(true);
    for (const phase of ['open', 'closing'] as const) {
      if (phase === 'closing') sim.beginClosing(s);
      const before = serialize(s);
      expect(deleteSignature(s, id)).toBe(false);
      expect(renameSignature(s, id, 'Changed')).toBe(false);
      expect(replaceSignature(s, id, id, 'Changed')).toBe(false);
      expect(serialize(s)).toBe(before);
    }
    const loaded = deserialize(serialize(s), 0);
    const resumed = new Sim(() => 0);
    expect(resumed.restore(sim.snapshot(s), loaded)).toBe(true);
    for (let i = 0; i < 6000 && !resumed.finishedService; i++) resumed.update(loaded, .05);
    expect(resumed.finishedService).toBe(true);
    const report = resumed.closeShop(loaded)!;
    expect(report.sales[id]).toBe(1);
    expect(loaded.signatureDrinks.served[id]).toBe(1);
    expect(deleteSignature(loaded, id)).toBe(true);
    const historicalCost = Object.entries(report.sales).reduce((sum, [key, n]) => sum + servingCost(key as typeof id) * n!, 0);
    expect(historicalCost).toBe(servingCost(id));
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost);
    expect(deserialize(serialize(loaded), 0).signatureDrinks.served[id]).toBe(1);
  });
});
