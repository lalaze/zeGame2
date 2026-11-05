import { describe, expect, it } from 'vitest';
import { openBranch } from './chain';
import { salePrice, servingCost } from './economy';
import { awayHourly, hireManager } from './manager';
import { ORDERS, collectOrder, orderBlock, orderDef, orderLeft, orderReady, parseOrders, quoteOrder, startOrder } from './orders';
import { createInitialState, deserialize, serialize } from './state';

const HOUR = 3_600_000;

function cafe(coins = 100_000) {
  const state = createInitialState(0);
  state.profile = { cafeName: 'Test', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  state.day = 5;
  state.items.latte = 10;
  state.onMenu = ['espresso', 'latte'];
  state.coins = coins;
  expect(hireManager(state)).toBe(true);
  return state;
}

describe('catering orders', () => {
  it('needs a manager and a menu that sells', () => {
    const state = cafe();
    state.manager.hired = false;
    expect(quoteOrder(state, 'office')).toBeNull();
    expect(orderBlock(state, 'office')).toBe('noManager');
    state.manager.hired = true;
    state.onMenu = [];
    expect(orderBlock(state, 'office')).toBe('noMenu');
    expect(startOrder(state, 'office', 0)).toBeNull();
  });

  it('sizes each order to its share of away pay, and pays more per hour for shorter ones', () => {
    const state = cafe();
    const perHour = ORDERS.map((o) => {
      const q = quoteOrder(state, o.id)!;
      const unit = salePrice(state, q.item) - servingCost(q.item);
      // Whole servings: within half a serving's margin (plus rounding of cost and payout).
      expect(Math.abs(q.payout - q.cost - awayHourly(state) * o.hours * o.rate)).toBeLessThanOrEqual(unit / 2 + 2);
      return (q.payout - q.cost) / o.hours;
    });
    expect(perHour[0]).toBeGreaterThan(perHour[1]);
    expect(perHour[1]).toBeGreaterThan(perHour[2]);
  });

  it('pays ingredients up front, runs in real time, and delivers once', () => {
    const state = cafe();
    const q = quoteOrder(state, 'tea')!;
    const coins = state.coins, earned = state.totalEarned;
    const order = startOrder(state, 'tea', 1_000)!;
    expect(order).toMatchObject(q);
    expect(order.finishAt).toBe(1_000 + orderDef('tea').hours * HOUR);
    expect(state.coins).toBe(coins - q.cost);
    // One at a time.
    expect(orderBlock(state, 'office')).toBe('busy');
    expect(startOrder(state, 'office', 1_000)).toBeNull();
    expect(orderLeft(state, 1_000 + HOUR)).toBe(3600);
    expect(orderReady(state, order.finishAt - 1)).toBe(false);
    expect(collectOrder(state, order.finishAt - 1)).toBeNull();
    expect(collectOrder(state, order.finishAt)).toEqual(order);
    expect(state.coins).toBe(coins - q.cost + q.payout);
    expect(state.totalEarned).toBe(earned + q.payout);
    expect(state.orders).toEqual({ active: null, delivered: 1 });
    expect(collectOrder(state, order.finishAt)).toBeNull();
  });

  it('keeps its promised terms when the menu changes', () => {
    const state = cafe();
    const order = startOrder(state, 'office', 0)!;
    state.items.latte = 200;
    state.onMenu = ['espresso'];
    expect(collectOrder(state, order.finishAt)!.payout).toBe(order.payout);
  });

  it('cannot be taken without the money for its ingredients', () => {
    const state = cafe();
    state.coins = quoteOrder(state, 'banquet')!.cost - 1;
    expect(orderBlock(state, 'banquet')).toBe('coins');
    expect(startOrder(state, 'banquet', 0)).toBeNull();
  });

  it('saves, reads back only valid orders, and never lets a set-back clock stretch one', () => {
    const state = cafe();
    startOrder(state, 'banquet', 5_000);
    expect(deserialize(serialize(state), 5_000).orders).toEqual(state.orders);
    expect(parseOrders({ active: { kind: 'picnic', item: 'latte', servings: 1, cost: 1, payout: 2, finishAt: 9 } }, 0).active).toBeNull();
    expect(parseOrders({ active: { kind: 'tea', item: 'nothing', servings: 1, cost: 1, payout: 2, finishAt: 9 } }, 0).active).toBeNull();
    expect(parseOrders({ active: { kind: 'tea', item: 'latte', servings: -1, cost: 1, payout: 2, finishAt: 9 } }, 0).active).toBeNull();
    expect(parseOrders({ delivered: 'lots' }, 0)).toEqual({ active: null, delivered: 0 });
    const far = parseOrders({ active: { kind: 'office', item: 'latte', servings: 3, cost: 6, payout: 30, finishAt: 1e15 } }, 1_000).active!;
    expect(far.finishAt).toBe(1_000 + orderDef('office').hours * HOUR);
  });

  it('carries an order into a new branch', () => {
    const state = cafe(1_000_000);
    state.regions = ['reading', 'greenhouse', 'terrace'];
    state.totalEarned = 1_000_000;
    const order = startOrder(state, 'banquet', 0)!;
    const next = openBranch(state, 'city', 10)!;
    expect(next.orders.active).toEqual(order);
  });
});
