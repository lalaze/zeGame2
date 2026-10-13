import { afterEach, describe, expect, it } from 'vitest';
import { finishDay, openShop, type DayReport } from './day';
import { dayNeeds, restock, servingCost } from './economy';
import { GOALS } from './goals';
import { settlementAdvice } from './settlement-advice';
import { createInitialState, emptyDay, type GameState } from './state';
import { Sim } from './sim';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from './layout';

afterEach(() => { setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });

function ready(): GameState {
  const state = createInitialState(0);
  state.goal = GOALS.length;
  state.day = 3;
  state.coins = 500;
  state.pantry.beans = 1_000;
  return state;
}
function report(overrides: Partial<DayReport> = {}): DayReport {
  return { ...emptyDay(), day: 2, duration: 180, rating: 4, ratingCount: 0, ratingTraffic: 1,
    profit: 20, served: 10, revenue: 30, ingredientCost: 10, sales: { espresso: 10 },
    bestSeller: 'espresso', outOfStock: [], shelfSoldOut: [], stale: {}, staleCost: 0, ...overrides };
}

describe('feasible settlement priorities', () => {
  it('puts the first completed goal before spending and does not mutate anything', () => {
    const state = createInitialState(0); state.day = 2;
    const day = report(); const before = structuredClone({ state, day });
    const advice = settlementAdvice(day, state);
    expect(advice.claimableGoal).toEqual({ id: 'firstDay', reward: 30 });
    expect(advice.action).toMatchObject({ kind: 'claimGoal', reward: 30, cost: 0 });
    expect({ state, day }).toEqual(before);
  });

  it('restocks ingredients before an affordable investment', () => {
    const state = ready(); state.pantry.beans = 0;
    const advice = settlementAdvice(report({ soldOut: 4, queueLost: 10, outOfStock: ['espresso'] }), state);
    expect(advice.reasons).toContainEqual({ kind: 'stock', count: 4, extra: 0 });
    expect(advice.action.kind).toBe('restock');
    expect(advice.action.cost).toBe(advice.ingredientReserve);
    expect(advice.action.cost).toBeLessThanOrEqual(state.coins);
    expect(advice.action.ingredients!.beans).toBe(dayNeeds(state).beans);
  });

  it('quotes the actual affordable partial purchase instead of promising a full day', () => {
    const state = ready(); state.pantry.beans = 0; state.coins = 1;
    const advice = settlementAdvice(report({ soldOut: 4 }), state);
    expect(advice.action).toMatchObject({ kind: 'restock', cost: 1, ingredients: { beans: 1 } });
    expect(advice.ingredientReserve).toBeGreaterThan(1);
    expect(state.pantry.beans).toBe(0);
  });

  it('uses existing stock or emergency aid at zero cash, never a paid upgrade', () => {
    const state = ready(); state.coins = 0; state.pantry.beans = 1;
    expect(settlementAdvice(report({ queueLost: 10 }), state).action).toMatchObject({ kind: 'useStock', cost: 0, item: 'espresso' });
    state.pantry.beans = 0;
    expect(settlementAdvice(report({ soldOut: 10 }), state).action).toMatchObject({ kind: 'emergency', cost: 0 });
  });

  it('offers a stocked unlocked recipe when the selected recipe cannot be supplied', () => {
    const state = ready(); state.coins = 0; state.items.latte = 1; state.onMenu = ['latte']; state.pantry.milk = 0;
    expect(settlementAdvice(report({ soldOut: 4 }), state).action).toMatchObject({ kind: 'switchMenu', item: 'espresso', cost: 0 });
  });

  it('never recommends purchasing a locked or maxed upgrade', () => {
    const state = ready(); state.upgrades.machine = 20; state.upgrades.barista = 3;
    expect(settlementAdvice(report({ queueLost: 10 }), state).action.kind).toBe('helpCounter');
    state.upgrades.machine = 0; state.coins = 59;
    expect(settlementAdvice(report({ queueLost: 10 }), state).action.kind).toBe('helpCounter');
    state.coins = 60;
    expect(settlementAdvice(report({ queueLost: 10 }), state).action).toMatchObject({ kind: 'upgrade', upgrade: 'machine', cost: 60 });
  });

  it('does not diagnose table losses as a proven need to buy a server', () => {
    const state = ready(); state.coins = 10000;
    expect(settlementAdvice(report({ tableLost: 2 }), state).action).toMatchObject({ kind: 'watchPass', cost: 0 });
  });

  it('checks bakery planning when real shelf shortages occur despite a stocked pantry', () => {
    const state = ready(); state.kitchen = true; state.items.roll = 1; state.onMenu.push('roll');
    state.pantry.flour = state.pantry.butter = 1000; state.bakePlan.roll = 0;
    const advice = settlementAdvice(report({ extraLost: 3, shortages: { roll: 3 } }), state);
    expect(advice.ingredientReserve).toBe(0);
    expect(advice.action).toMatchObject({ kind: 'reviewBake', item: 'roll', cost: 0 });
  });

  it('does not call an empty closing shelf a failed order', () => {
    const advice = settlementAdvice(report({ shelfSoldOut: ['roll'] }), ready());
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['healthy']);
  });

  it('gives a healthy stocked starter café a no-cost next step', () => {
    const state = ready(); state.coins = 0;
    const advice = settlementAdvice(report(), state);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['healthy']);
    expect(advice.action).toEqual({ kind: 'keepGoing', tab: 'menu', cost: 0 });
  });
});

describe('honest cost explanations', () => {
  it('explains stale goods, promotion, pet care and unsold consumed work together without double-counting', () => {
    const state = ready();
    const day = report({ served: 1, revenue: 3, ingredientCost: 20, sales: { espresso: 1 },
      petCost: 4, promotionCost: 6, profit: -27, stale: { roll: 3 }, staleCost: 12 });
    day.reviews.reasons.cancelled = 2;
    const advice = settlementAdvice(day, state);
    expect(advice.totalCost).toBe(30);
    expect(advice.unrecoveredIngredientCost).toBe(7);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['loss', 'stale', 'promotion', 'pets', 'unfinished', 'unrecovered']);
    expect(advice.action.kind).toBe('finishService');
  });

  it('does not equate ingredients lost with a waiting guest to a closing cancellation', () => {
    const advice = settlementAdvice(report({ tableLost: 1, ingredientCost: 11, profit: 19 }), ready());
    expect(advice.unrecoveredIngredientCost).toBe(1);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['table', 'unrecovered']);
    expect(advice.action.kind).toBe('watchPass');
  });

  it('does not label a mixed-menu waiting loss as an unfinished baking batch', () => {
    const state = ready(); state.kitchen = true; state.items.roll = 1; state.onMenu.push('roll');
    state.pantry.flour = state.pantry.butter = 1000;
    const advice = settlementAdvice(report({ tableLost: 1, ingredientCost: 11, profit: 19 }), state);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['table', 'unrecovered']);
    expect(advice.action.kind).toBe('watchPass');
  });

  it('does not blame closing for completed bakery leftovers with a zero morning plan', () => {
    const state = ready(); state.kitchen = true; state.items.roll = 1; state.onMenu = ['roll'];
    state.bakePlan.roll = 0; state.pantry.flour = state.pantry.butter = 1000;
    const cost = servingCost('roll') * 4;
    const advice = settlementAdvice(report({ sales: { roll: 2 }, baked: { roll: 4 }, ingredientCost: cost,
      stale: { roll: 2 }, staleCost: cost / 2 }), state);
    expect(advice.unrecoveredIngredientCost).toBe(0);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['stale']);
    expect(advice.action).toMatchObject({ kind: 'reviewBake', item: 'roll', cost: 0 });
  });

  it('does not let ambiguous ingredient losses hide a known queue bottleneck or promotion expense', () => {
    const state = ready();
    const queue = settlementAdvice(report({ queueLost: 2, ingredientCost: 11, profit: 19 }), state);
    expect(queue.action).toMatchObject({ kind: 'upgrade', upgrade: 'machine' });
    state.promotion = { id: 'clipLocal', remaining: 20, paused: false };
    const promotion = settlementAdvice(report({ promotionCost: 30, ingredientCost: 11, profit: -11 }), state);
    expect(promotion.action.kind).toBe('pausePromotion');
    expect(promotion.reasons.some((reason) => reason.kind === 'unfinished')).toBe(false);
  });

  it('observes service rather than inventing a closing cause when only the ledger remainder is known', () => {
    const advice = settlementAdvice(report({ ingredientCost: 11, profit: 19 }), ready());
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['unrecovered']);
    expect(advice.action.kind).toBe('watchService');
  });

  it('diagnoses real table timeouts after normal draining as delivery/production checks', () => {
    const state = ready(); state.pantry.beans = 10000; state.coins = 1000;
    state.regions = ['reading', 'greenhouse', 'terrace'];
    state.upgrades.tables = 6; state.upgrades.barista = 3;
    state.upgrades.machine = 20; state.upgrades.marketing = 25;
    let seed = 92;
    const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
    openShop(state);
    for (let seconds = 0; seconds < 360; seconds += 0.1) sim.update(state, 0.1);
    sim.beginClosing(state);
    for (let seconds = 0; seconds < 300 && !sim.finishedService; seconds += 0.1) sim.update(state, 0.1);
    expect(sim.finishedService).toBe(true);
    const day = sim.closeShop(state)!;
    expect(day.tableLost).toBeGreaterThan(0);
    expect(day.reviews.reasons.cancelled ?? 0).toBe(0);
    expect(day.sales.espresso).toBeGreaterThan(0);
    // The traffic envelope changes visit counts. Prove the actual ledger
    // remainder is entirely the espresso consumed by timed-out table orders.
    const unrecovered = day.ingredientCost - day.sales.espresso! * servingCost('espresso');
    expect(unrecovered).toBeCloseTo(day.tableLost * servingCost('espresso'), 8);
    const advice = settlementAdvice(day, state);
    expect(advice.unrecoveredIngredientCost).toBe(unrecovered);
    expect(advice.reasons.some((reason) => reason.kind === 'unfinished' || reason.kind === 'unfinishedBake')).toBe(false);
    expect(advice.reasons).toContainEqual({ kind: 'unrecovered', amount: unrecovered });
    expect(advice.action).toMatchObject({ kind: 'watchPass', cost: 0 });
  });

  it('still recognizes a real baking batch discarded before completion without cancelled guests', () => {
    const state = ready(); state.kitchen = true; state.items.roll = 1;
    state.onMenu = ['roll']; state.bakePlan.roll = 0;
    state.pantry.flour = state.pantry.butter = 1000;
    const sim = new Sim(() => 0.99); openShop(state); sim.update(state, 0.1);
    expect(sim.cooks.some((cook) => cook.batch)).toBe(true);
    expect(Object.values(state.inProduction).some((count) => count! > 0)).toBe(true);
    const day = sim.closeShop(state)!;
    expect(day.reviews.reasons.cancelled ?? 0).toBe(0);
    expect(day.ingredientCost).toBeGreaterThan(0);
    expect(day.baked).toEqual({});
    const advice = settlementAdvice(day, state);
    expect(advice.reasons).toContainEqual({ kind: 'unfinishedBake', amount: day.ingredientCost });
    expect(advice.action.kind).toBe('finishService');
  });

  it('uses the actual morning plan for a free smaller-batch suggestion', () => {
    const state = ready(); state.kitchen = true; state.items.roll = 1; state.onMenu = ['roll'];
    state.bakePlan.roll = 8; state.pantry.flour = state.pantry.butter = 1000;
    const cost = servingCost('roll') * 8;
    const advice = settlementAdvice(report({ served: 0, revenue: 0, sales: {}, profit: -cost,
      ingredientCost: cost, baked: { roll: 8 }, stale: { roll: 8 }, staleCost: cost }), state);
    expect(advice.action).toMatchObject({ kind: 'reduceBake', item: 'roll', amount: 0, cost: 0 });
  });

  it('pauses only a real live promotion and avoids renewing an expired one', () => {
    const state = ready(); state.promotion = { id: 'clipLocal', paused: false, remaining: 20 };
    const day = report({ promotionCost: 30, profit: -10 });
    expect(settlementAdvice(day, state).action.kind).toBe('pausePromotion');
    state.promotion = null;
    expect(settlementAdvice(day, state).action.kind).toBe('skipPromotion');
  });

  it('distinguishes turning off cat auto-refill from one already turned off', () => {
    const state = ready(); state.pets = [{ id: 'ginger', careSeconds: 100, autoRefill: true }];
    const day = report({ petCost: 30, profit: -10 });
    expect(settlementAdvice(day, state).action.kind).toBe('petRefill');
    state.pets[0].autoRefill = false;
    expect(settlementAdvice(day, state).action.kind).toBe('keepPetRefillOff');
  });

  it('finds a cancelled real simulated order without changing the simulation or report schema', () => {
    const state = ready(); const sim = new Sim(() => 0.1); openShop(state);
    for (let i = 0; i < 2000 && !sim.isBrewing(0); i++) sim.update(state, 0.05);
    expect(sim.isBrewing(0)).toBe(true);
    const day = sim.closeShop(state)!;
    expect(day.reviews.reasons.cancelled).toBeGreaterThan(0);
    const advice = settlementAdvice(day, state);
    expect(advice.reasons.some((reason) => reason.kind === 'unfinished')).toBe(true);
    expect(advice.action.kind).toBe('finishService');
  });

  it('a normally finished starter day gets stock guidance, never fictional costs', () => {
    const state = createInitialState(0); state.goal = GOALS.length; state.coins = 100;
    openShop(state); state.today.served = 10; state.today.sales.espresso = 10;
    state.today.revenue = 30; state.today.ingredientCost = 10; state.pantry.beans -= 10;
    const day = finishDay(state); const advice = settlementAdvice(day, state);
    expect(advice.reasons.map((reason) => reason.kind)).toEqual(['healthy']);
    expect(advice.unrecoveredIngredientCost).toBe(0);
    if (advice.action.kind === 'restock') {
      const projected = structuredClone(state); restock(projected);
      expect(advice.action.cost).toBe(state.coins - projected.coins);
    }
  });
});
