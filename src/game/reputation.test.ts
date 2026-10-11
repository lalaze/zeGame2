import { describe, expect, it } from 'vitest';
import { openShop, finishDay } from './day';
import { arrivalRate, dayDemand, salePrice, tipMultiplier } from './economy';
import { recordReview, reputationScore, reputationTraffic, reviewAverage, reviewCount, serviceReview, REVIEW_WINDOW } from './reputation';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';

function shop() {
  const state = createInitialState(0);
  state.pantry.beans = 1000;
  openShop(state);
  return state;
}
function until(state: GameState, sim: Sim, done: () => boolean, seconds = 120) {
  for (let n = 0; n < seconds * 20 && !done(); n++) sim.update(state, 0.05);
  expect(done()).toBe(true);
}

describe('customer reputation', () => {
  it('starts neutral, cushions the first review and bounds the traffic effect', () => {
    const state = shop();
    expect(reputationScore(state.reputation)).toBe(4);
    expect(reputationTraffic(state.reputation)).toBe(1);
    recordReview(state, { stars: 1, reason: 'soldOut' });
    expect(reputationScore(state.reputation)).toBeCloseTo(3.85);
    expect(reputationTraffic(state.reputation)).toBeCloseTo(0.9875);
    for (let n = 0; n < 70; n++) recordReview(state, { stars: 1, reason: 'soldOut' });
    expect(state.reputation.recent).toHaveLength(REVIEW_WINDOW);
    expect(reputationTraffic(state.reputation)).toBe(0.75);
    for (let n = 0; n < REVIEW_WINDOW; n++) recordReview(state, { stars: 5, reason: 'prompt' });
    expect(reputationScore(state.reputation)).toBe(5);
    expect(reputationTraffic(state.reputation)).toBe(1.25);
    expect(reviewCount(state.today.reviews)).toBe(121);
  });

  it('changes arrivals and stock forecasts without changing money, prices or tips', () => {
    const state = shop();
    state.coins = 123;
    const traffic = arrivalRate(state);
    const demand = dayDemand(state).get('espresso')!;
    const price = salePrice(state, 'espresso');
    const vipPrice = salePrice(state, 'espresso', true);
    const tips = tipMultiplier(state);
    for (let n = 0; n < 50; n++) recordReview(state, { stars: 5, reason: 'prompt' });
    expect(arrivalRate(state)).toBeCloseTo(traffic * 1.25);
    expect(dayDemand(state).get('espresso')).toBeGreaterThan(demand);
    expect(salePrice(state, 'espresso')).toBe(price);
    expect(salePrice(state, 'espresso', true)).toBe(vipPrice);
    expect(tipMultiplier(state)).toBe(tips);
    expect(state.coins).toBe(123);
    expect(state.today.revenue).toBe(0);
    expect(state.totalEarned).toBe(0);
  });

  it('grades actual waiting time and limits incomplete orders', () => {
    expect([0, 12, 12.01, 25, 25.01, 40, 40.01].map((n) => serviceReview(n, false).stars)).toEqual([5, 5, 4, 4, 3, 3, 2]);
    expect(serviceReview(8, true)).toEqual({ stars: 3, reason: 'incomplete' });
    expect(serviceReview(42, true)).toEqual({ stars: 2, reason: 'verySlow' });
  });

  it('settles daily reviews independently of the rolling history and preserves saves', () => {
    const state = shop();
    recordReview(state, { stars: 5, reason: 'prompt' });
    recordReview(state, { stars: 1, reason: 'soldOut' });
    const report = finishDay(state);
    expect(reviewAverage(report.reviews)).toBe(3);
    expect(report.rating).toBe(reputationScore(state.reputation));
    expect(report.ratingTraffic).toBe(reputationTraffic(state.reputation));
    expect(reviewCount(state.today.reviews)).toBe(0);
    openShop(state);
    recordReview(state, { stars: 4, reason: 'steady' });
    expect(reviewCount(report.reviews)).toBe(2);
    const restored = deserialize(serialize(state), 0);
    expect(restored.reputation).toEqual(state.reputation);
    expect(restored.today.reviews).toEqual(state.today.reviews);
    expect(restored.reputation.recent.at(-1)?.day).toBe(2);
  });

  it('migrates old saves neutrally and ignores malformed review data', () => {
    const old = deserialize(JSON.stringify({ version: 8, coins: 90, served: 200 }), 0);
    expect(reputationTraffic(old.reputation)).toBe(1);
    expect(old.reputation.recent).toEqual([]);
    expect(old.coins).toBe(90);
    const corrupted = deserialize(JSON.stringify({ reputation: { recent: [null, { stars: 99, reason: 'prompt' }, { stars: 5, reason: 'fake' }, { stars: 5, reason: 'prompt', day: 2 }] }, today: { reviews: { stars: [-1, '2', 0.5, null, 2], reasons: { prompt: 999, soldOut: 999 } } } }), 0);
    expect(corrupted.reputation.recent).toEqual([{ stars: 5, reason: 'prompt', day: 2 }]);
    expect(corrupted.today.reviews.stars).toEqual([0, 0, 0, 0, 2]);
    expect(corrupted.today.reviews.reasons).toEqual({ prompt: 2 });
  });
});

describe('reviews from simulated visits', () => {
  it('rates a takeaway once on handoff, including after a save and restore', () => {
    const state = shop();
    const sim = new Sim(() => 0.99);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'ordering'));
    sim.beginClosing(state);
    const guest = sim.customers[0];
    guest.waitSeconds = 27;
    guest.missingExtra = true;
    const loaded = deserialize(serialize(state), 0);
    const restored = new Sim(() => 0.99);
    expect(restored.restore(sim.snapshot(state), loaded)).toBe(true);
    expect(restored.customers[0].waitSeconds).toBe(27);
    expect(restored.customers[0].missingExtra).toBe(true);
    until(loaded, restored, () => loaded.today.served === 1);
    expect(loaded.reputation.recent).toHaveLength(1);
    expect(loaded.reputation.recent[0]).toMatchObject({ stars: 3, reason: 'incomplete' });
    expect(loaded.today.revenue).toBe(salePrice(loaded, 'espresso'));
    const paid = new Sim(() => 0.99);
    expect(paid.restore(restored.snapshot(loaded), loaded)).toBe(true);
    until(loaded, paid, () => paid.customers.length === 0);
    paid.closeShop(loaded);
    expect(loaded.reputation.recent).toHaveLength(1);
  });

  it('rates a table delivery once, after the server reaches the guest', () => {
    const state = shop();
    const sim = new Sim(() => 0);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'toCounter'));
    sim.beginClosing(state);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'waiting'));
    expect(reviewCount(state.today.reviews)).toBe(0);
    until(state, sim, () => state.today.served === 1);
    expect(sim.customers.some((c) => c.phase === 'sitting' && c.reviewed)).toBe(true);
    expect(reviewCount(state.today.reviews)).toBe(1);
    sim.closeShop(state);
    expect(state.reputation.recent).toHaveLength(1);
  });

  it('produces one bad review for a sold-out main and none for merely closing a queue', () => {
    const state = shop();
    state.pantry.beans = 0;
    const sim = new Sim(() => 0.99);
    until(state, sim, () => state.today.soldOut === 1);
    expect(state.reputation.recent).toEqual([{ stars: 1, reason: 'soldOut', day: 1 }]);
    sim.beginClosing(state);
    sim.closeShop(state);
    expect(state.reputation.recent).toHaveLength(1);
  });

  it('rates an unavailable add-on only when the main is delivered', () => {
    const state = shop();
    state.items.roll = 1;
    state.onMenu = ['espresso', 'roll'];
    const sim = new Sim(() => 0);
    until(state, sim, () => state.today.extraLost > 0);
    expect(reviewCount(state.today.reviews)).toBe(0);
    sim.beginClosing(state);
    until(state, sim, () => state.today.served === 1);
    expect(state.reputation.recent[0]).toMatchObject({ stars: 3, reason: 'incomplete' });
    expect(reviewCount(state.today.reviews)).toBe(1);
  });

  it('records queue and table walkouts without duplicate reviews', () => {
    const state = shop();
    state.upgrades.marketing = 10;
    const sim = new Sim(() => 0.99);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'ordering'));
    sim.baristas[0].remaining = 100;
    until(state, sim, () => sim.queue.length > 0);
    sim.customers.find((c) => c.id === sim.queue[0])!.patience = 0;
    sim.update(state, 0.05);
    expect(state.today.reviews.reasons.queueWait).toBe(1);
    expect(state.reputation.recent[0].stars).toBe(2);
    const seatedState = shop();
    const seatedSim = new Sim(() => 0);
    until(seatedState, seatedSim, () => seatedSim.customers.some((c) => c.phase === 'toCounter'));
    seatedSim.beginClosing(seatedState);
    until(seatedState, seatedSim, () => seatedSim.customers.some((c) => c.phase === 'waiting'));
    seatedSim.customers.find((c) => c.phase === 'waiting')!.timer = 0;
    seatedSim.update(seatedState, 0.05);
    expect(seatedState.reputation.recent).toEqual([{ stars: 1, reason: 'tableWait', day: 1 }]);
    seatedSim.closeShop(seatedState);
    expect(seatedState.reputation.recent).toHaveLength(1);
  });

  it('does not rate full-door rejections or dismissed queues, but rates forced cancellations', () => {
    const state = shop();
    state.upgrades.marketing = 25;
    const sim = new Sim(() => 0.99);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'ordering'));
    sim.baristas[0].remaining = 200;
    until(state, sim, () => state.today.doorLost > 0);
    expect(reviewCount(state.today.reviews)).toBe(0);
    sim.beginClosing(state);
    expect(sim.queue).toEqual([]);
    expect(reviewCount(state.today.reviews)).toBe(0);
    const report = sim.closeShop(state)!;
    expect(report.reviews.reasons).toEqual({ cancelled: 1 });
    expect(state.reputation.recent).toHaveLength(1);
    expect(sim.closeShop(state)).toBeNull();
    expect(state.reputation.recent).toHaveLength(1);
  });

  it('restores legacy in-flight guests and rejects malformed wait data', () => {
    const state = shop(); const sim = new Sim(() => 0.99);
    until(state, sim, () => state.today.served === 1);
    const snapshot = sim.snapshot(state);
    const legacy = JSON.parse(JSON.stringify(snapshot));
    for (const guest of legacy.customers) {
      delete guest.reviewed; delete guest.waitSeconds; delete guest.missingExtra;
    }
    const restored = new Sim(() => 0.99);
    expect(restored.restore(legacy, state)).toBe(true);
    expect(restored.customers[0].reviewed).toBe(true);
    legacy.customers[0].waitSeconds = -1;
    expect(new Sim().restore(legacy, state)).toBe(false);
  });
});
