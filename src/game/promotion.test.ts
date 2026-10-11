import { describe, expect, it } from 'vitest';
import { PROMOTION_PLANS, bookPromotion, parsePromotion, promotionTraffic, togglePromotion, updatePromotion } from './promotion';
import { createInitialState, deserialize, serialize } from './state';
import { arrivalRate, baseArrivalRate, expectedCustomers, salePrice, serviceCapacity, tipMultiplier } from './economy';
import { finishDay, openShop } from './day';
import { DAY_SECONDS } from './data';
import { Sim } from './sim';
import { reputationScore } from './reputation';

function shop() { const s = createInitialState(0); s.coins = 10000; return s; }

describe('paid creator promotion', () => {
  it('books every package once at its advertised price without modifying ratings or payouts', () => {
    for (const plan of PROMOTION_PLANS) {
      const s = shop();
      const rate = arrivalRate(s), price = salePrice(s, 'espresso'), tips = tipMultiplier(s);
      expect(bookPromotion(s, plan.id)).toBe(true);
      expect(s.coins).toBe(10000 - plan.cost);
      expect(s.promotion).toEqual({ id: plan.id, remaining: plan.seconds, paused: false });
      expect(arrivalRate(s)).toBeCloseTo(rate * (1 + plan.boost));
      expect(salePrice(s, 'espresso')).toBe(price);
      expect(tipMultiplier(s)).toBe(tips);
      expect(s.reputation.recent).toEqual([]);
      expect(s.today.promotionCost).toBe(0);
      expect(bookPromotion(s, plan.id)).toBe(false);
      expect(s.coins).toBe(10000 - plan.cost);
    }
  });

  it('rejects unknown, unaffordable, closing and empty-menu bookings', () => {
    const s = shop();
    expect(bookPromotion(s, 'unknown')).toBe(false);
    s.coins = 49; expect(bookPromotion(s, 'noteLocal')).toBe(false);
    s.coins = 50; s.phase = 'closing'; expect(bookPromotion(s, 'noteLocal')).toBe(false);
    s.phase = 'prep'; s.onMenu = []; expect(bookPromotion(s, 'noteLocal')).toBe(false);
    expect(s.coins).toBe(50); expect(s.promotion).toBeNull();
    s.onMenu = ['espresso']; s.phase = 'open'; expect(bookPromotion(s, 'noteLocal')).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('consumes prepaid airtime only while open, allows pausing, and never stacks while paused', () => {
    const s = shop(); bookPromotion(s, 'clipLocal');
    updatePromotion(s, 90); expect(s.promotion!.remaining).toBe(180);
    openShop(s); updatePromotion(s, 90);
    expect(s.promotion!.remaining).toBe(90); expect(s.today.promotionCost).toBe(30);
    expect(togglePromotion(s)).toBe(true);
    updatePromotion(s, 90);
    expect(promotionTraffic(s)).toBe(1); expect(s.promotion!.remaining).toBe(90);
    expect(bookPromotion(s, 'noteStar')).toBe(false);
    togglePromotion(s); s.phase = 'closing'; updatePromotion(s, 90);
    expect(s.promotion!.remaining).toBe(90);
    expect(s.coins).toBe(9940);
  });

  it('expires exactly once without refunds, repeat charges or automatic renewal', () => {
    const s = shop(); bookPromotion(s, 'noteStar'); openShop(s);
    updatePromotion(s, NaN); updatePromotion(s, -1); updatePromotion(s, Infinity);
    expect(s.today.promotionCost).toBe(0);
    updatePromotion(s, 10000);
    expect(s.promotion).toBeNull(); expect(s.today.promotionCost).toBe(150);
    updatePromotion(s, 10000); expect(s.today.promotionCost).toBe(150);
    expect(s.coins).toBe(9850); expect(promotionTraffic(s)).toBe(1);
    expect(togglePromotion(s)).toBe(false);
    expect(bookPromotion(s, 'clipLocal')).toBe(true);
  });

  it('carries remaining airtime across days and allocates expense without double charging', () => {
    const s = shop(); bookPromotion(s, 'clipStar'); openShop(s);
    s.today.revenue = 500; s.today.ingredientCost = 30; s.today.petCost = 4;
    updatePromotion(s, 60);
    const report = finishDay(s);
    expect(report.promotionCost).toBe(60); expect(report.profit).toBe(406);
    expect(s.promotion!.remaining).toBe(120); expect(s.today.promotionCost).toBe(0);
    openShop(s); updatePromotion(s, 120);
    expect(finishDay(s).promotionCost).toBe(120);
    expect(s.coins).toBe(9820);
  });

  it('forecasts only the remaining campaign time, capped by counter capacity', () => {
    const s = shop(); s.upgrades.barista = 3;
    bookPromotion(s, 'clipStar'); s.promotion!.remaining = 30;
    const base = baseArrivalRate(s), capacity = serviceCapacity(s);
    expect(expectedCustomers(s)).toBe(Math.ceil(Math.min(base * 2, capacity) * 30 + Math.min(base, capacity) * (DAY_SECONDS - 30)));
    togglePromotion(s);
    expect(expectedCustomers(s)).toBe(Math.ceil(Math.min(base, capacity) * DAY_SECONDS));
  });

  it('combines multiplicatively with cats and reputation', () => {
    const s = shop(); s.pets = [{ id: 'ginger', careSeconds: 180, autoRefill: false }];
    s.reputation.recent = Array.from({ length: 20 }, () => ({ stars: 5, reason: 'prompt', day: 1 }));
    const before = arrivalRate(s); bookPromotion(s, 'noteStar');
    expect(arrivalRate(s)).toBeCloseTo(before * 1.6);
    expect(reputationScore(s.reputation)).toBe(5);
  });

  it('preserves saves without offline expiry and migrates older saves neutrally', () => {
    const s = shop(); bookPromotion(s, 'clipStar'); openShop(s); updatePromotion(s, 30); togglePromotion(s);
    const restored = deserialize(serialize(s), 86400000);
    expect(restored.promotion).toEqual(s.promotion);
    expect(restored.today.promotionCost).toBe(30); expect(restored.coins).toBe(s.coins);
    const old = deserialize(JSON.stringify({ version: 11, coins: 100 }), 0);
    expect(old.promotion).toBeNull(); expect(old.today.promotionCost).toBe(0); expect(old.coins).toBe(100);
    for (const value of [null, {}, { id: 'fake', remaining: 10 }, { id: 'clipStar', remaining: -1 }, { id: 'clipStar', remaining: Infinity }]) expect(parsePromotion(value)).toBeNull();
    expect(parsePromotion({ id: 'clipStar', remaining: 9999 })).toEqual({ id: 'clipStar', remaining: 180, paused: true });
  });

  it('integrates time consumption into the simulation', () => {
    const s = shop(); bookPromotion(s, 'clipLocal'); openShop(s);
    new Sim(() => 0.5).update(s, 2);
    expect(s.promotion!.remaining).toBe(178); expect(s.today.promotionCost).toBeCloseTo(2 / 3);
  });

  it('brings more real visits and creates bad-review risk through stockouts, not a rating penalty', () => {
    const run = (promoted: boolean) => {
      const s = shop(); s.pantry.beans = 30;
      if (promoted) bookPromotion(s, 'clipStar');
      openShop(s);
      const sim = new Sim(() => 0.99);
      for (let n = 0; n < 180 * 20; n++) sim.update(s, 0.05);
      return s;
    };
    const normal = run(false), promoted = run(true);
    expect(promoted.today.served + promoted.today.missed).toBeGreaterThan(normal.today.served + normal.today.missed);
    expect(promoted.today.soldOut).toBeGreaterThan(normal.today.soldOut);
    expect(reputationScore(promoted.reputation)).toBeLessThan(reputationScore(normal.reputation));
    expect(promoted.today.reviews.reasons.soldOut).toBeGreaterThan(0);
  });
});
