import { describe, expect, it } from 'vitest';
import { mealTaste, recordServings, researchBlock, researchSignature, signatureCost, tasteScore, tasteTier } from './taste';
import { mealReview, parseReputation, parseReviews, recordReview, reviewAverage, reviewCount } from './reputation';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { openShop, finishDay } from './day';
import { buyItem, prepTime, salePrice, tipMultiplier } from './economy';
import { Sim } from './sim';

function until(state: GameState, sim: Sim, done: () => boolean) {
  for (let n = 0; n < 2400 && !done(); n++) sim.update(state, 0.05);
  expect(done()).toBe(true);
}
function comboShop() {
  const state = createInitialState(0);
  state.pantry.beans = 1000;
  state.pantry.flour = state.pantry.butter = 100;
  state.kitchen = true;
  state.items.roll = 1;
  state.onMenu = ['espresso', 'roll'];
  state.bakePlan.roll = 10;
  openShop(state);
  return state;
}

describe('dish flavor and research', () => {
  it('advances each dish through practice independently of price upgrades', () => {
    const state = createInitialState(0);
    state.coins = 1e9;
    buyItem(state, 'espresso', 10);
    expect(tasteScore(state, 'espresso')).toBe(4);
    state.taste.served.espresso = 29;
    expect(tasteTier(state, 'espresso')).toBe('standard');
    recordServings(state, ['espresso']);
    expect(tasteScore(state, 'espresso')).toBe(4.5);
    expect(tasteScore(state, 'roll')).toBe(4);
    state.taste.served.espresso = 100;
    expect(tasteScore(state, 'espresso')).toBe(4.5);
    expect(researchSignature(state, 'espresso')).toBe(true);
    expect(tasteScore(state, 'espresso')).toBe(5);
  });

  it('requires an unlocked, practiced dish, closed shop and sufficient funds; charges once', () => {
    const state = createInitialState(0);
    expect(signatureCost('espresso')).toBe(150);
    expect(signatureCost('latte')).toBe(200);
    expect(researchBlock(state, 'latte')).toBe('locked');
    expect(researchBlock(state, 'espresso')).toBe('experience');
    state.taste.served.espresso = 99;
    state.coins = 1000;
    expect(researchSignature(state, 'espresso')).toBe(false);
    state.taste.served.espresso = 100;
    for (const phase of ['open', 'closing'] as const) {
      state.phase = phase;
      expect(researchBlock(state, 'espresso')).toBe('open');
      expect(researchSignature(state, 'espresso')).toBe(false);
    }
    state.phase = 'prep';
    state.coins = 149;
    expect(researchBlock(state, 'espresso')).toBe('coins');
    expect(researchSignature(state, 'espresso')).toBe(false);
    expect(state.coins).toBe(149);
    state.coins = 150;
    const level = state.items.espresso;
    const price = salePrice(state, 'espresso');
    const speed = prepTime(state, 'espresso');
    const tips = tipMultiplier(state);
    expect(researchSignature(state, 'espresso')).toBe(true);
    expect(state.coins).toBe(0);
    expect(state.items.espresso).toBe(level);
    expect(salePrice(state, 'espresso')).toBe(price);
    expect(prepTime(state, 'espresso')).toBe(speed);
    expect(tipMultiplier(state)).toBe(tips);
    expect(researchSignature(state, 'espresso')).toBe(false);
    expect(state.coins).toBe(0);
    expect(state.taste.signature).toEqual(['espresso']);
  });

  it('averages delivered flavors before applying the service cap and rounds only the result', () => {
    const state = createInitialState(0);
    state.taste.served.espresso = 30;
    expect(mealTaste(state, ['espresso', 'roll'])).toBe(4.25);
    expect(mealReview(state, ['espresso', 'roll'], 10, false)).toMatchObject({ stars: 4.3, taste: 4.3, reason: 'skilledTaste' });
    state.taste.served.espresso = 100;
    state.taste.signature = ['espresso'];
    expect(mealReview(state, ['espresso'], 8, false)).toMatchObject({ stars: 5, reason: 'signatureTaste' });
    expect(mealReview(state, ['espresso'], 20, false)).toMatchObject({ stars: 4, taste: 5, reason: 'steady' });
    expect(mealReview(state, ['espresso'], 30, false)).toMatchObject({ stars: 3, taste: 5, reason: 'slow' });
    expect(mealReview(state, ['espresso'], 45, false).stars).toBe(2);
    expect(mealReview(state, ['espresso'], 8, true).stars).toBe(3);
    expect(mealReview(state, ['roll'], 8, false)).toMatchObject({ stars: 4, reason: 'standardTaste' });
  });

  it('keeps fractional averages through saves and day reports, and preserves legacy integer reviews', () => {
    const state = createInitialState(0);
    state.taste.served.espresso = 30;
    recordReview(state, mealReview(state, ['espresso', 'roll'], 8, false));
    recordReview(state, mealReview(state, ['espresso'], 8, false));
    expect(reviewCount(state.today.reviews)).toBe(2);
    expect(reviewAverage(state.today.reviews)).toBeCloseTo(4.4);
    const loaded = deserialize(serialize(state), 0);
    expect(loaded.today.reviews).toEqual(state.today.reviews);
    expect(loaded.reputation).toEqual(state.reputation);
    expect(loaded.taste).toEqual(state.taste);
    const report = finishDay(loaded);
    expect(reviewAverage(report.reviews)).toBeCloseTo(4.4);
    expect(reviewCount(loaded.today.reviews)).toBe(0);
    expect(loaded.taste.served.espresso).toBe(30);
    const legacy = parseReviews({ stars: [1, 0, 0, 1, 2], reasons: { prompt: 2, steady: 1, soldOut: 1 } });
    expect(reviewAverage(legacy)).toBe(3.75);
    expect(parseReviews({ stars: [0, 0, 0, 1, 1], totalScore: -9 }).totalScore).toBe(9);
    expect(parseReputation({recent:[{stars:4.5,reason:'skilledTaste',day:2,taste:4.5,items:['espresso','fake']}] }).recent[0]).toEqual({stars:4.5,reason:'skilledTaste',day:2,taste:4.5,items:['espresso']});
  });

  it('migrates only known dish sales and discards corrupt or unearned research', () => {
    const legacy = deserialize(JSON.stringify({ version: 9, served: 999, today: { sales: { espresso: 31, roll: 4 } } }), 0);
    expect(legacy.taste).toEqual({ served: { espresso: 31, roll: 4 }, signature: [] });
    expect(tasteScore(legacy, 'espresso')).toBe(4.5);
    expect(deserialize(serialize(legacy),0).taste).toEqual(legacy.taste);
    const corrupt = deserialize(JSON.stringify({version:10, taste:{served:{espresso:-1,latte:1.5,roll:'100',mocha:100,fake:100},signature:['espresso','mocha','mocha','fake']}}),0);
    expect(corrupt.taste.served).toEqual({mocha:100});
    expect(corrupt.taste.signature).toEqual([]); // Still locked.
  });
});

describe('flavor progression on real handoffs', () => {
  it('counts both combo dishes on delivery, not baking or preparation, and does not recount after refresh', () => {
    const state = comboShop();
    state.taste.served.espresso = 29;
    const sim = new Sim(() => 0);
    expect(state.today.baked.roll).toBe(10);
    expect(state.taste.served.roll).toBeUndefined();
    until(state, sim, () => sim.customers.some((c) => c.phase === 'toCounter'));
    sim.beginClosing(state);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'waiting'));
    expect(state.taste.served.espresso).toBe(29);
    expect(state.taste.served.roll).toBeUndefined();
    const loaded = deserialize(serialize(state), 0);
    const restored = new Sim(() => 0);
    expect(restored.restore(sim.snapshot(state), loaded)).toBe(true);
    until(loaded, restored, () => loaded.today.served === 1);
    expect(loaded.taste.served).toEqual({ espresso: 30, roll: 1 });
    expect(loaded.reputation.recent[0].taste).toBe(4); // Practice improves the next portion.
    expect(tasteScore(loaded, 'espresso')).toBe(4.5);
    expect(loaded.today.sales).toEqual({espresso:1,roll:1});
    const paid = new Sim(() => 0);
    expect(paid.restore(restored.snapshot(loaded), loaded)).toBe(true);
    until(loaded, paid, () => paid.customers.length === 0);
    paid.closeShop(loaded);
    expect(loaded.taste.served).toEqual({espresso:30,roll:1});
    expect(loaded.reputation.recent).toHaveLength(1);
  });

  it('does not progress missing add-ons, cancelled orders or wasted baked goods', () => {
    const state = comboShop();
    state.shelf.roll = 0;
    state.pantry.flour = state.pantry.butter = 0;
    const sim = new Sim(() => 0);
    until(state, sim, () => state.today.extraLost === 1);
    sim.beginClosing(state);
    until(state, sim, () => state.today.served === 1);
    expect(state.taste.served).toEqual({espresso:1});
    expect(state.reputation.recent[0]).toMatchObject({stars:3,items:['espresso']});
    const cancelled = comboShop();
    const interrupted = new Sim(() => 0);
    until(cancelled, interrupted, () => interrupted.customers.some((c) => c.phase === 'ordering'));
    interrupted.closeShop(cancelled);
    expect(cancelled.taste.served).toEqual({});
    expect(cancelled.reputation.recent[0].reason).toBe('cancelled');
  });
});
