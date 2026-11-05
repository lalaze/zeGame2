import { describe, expect, it } from 'vitest';
import { tillSeconds } from '../game/manager';
import { createInitialState } from '../game/state';
import { orderWaiting, tillJarId, tillJarLevel } from './idle-props-art';


describe('idle props on the counter', () => {
  it('fills the jar with the day’s tips in a café without franchises', () => {
    const state = createInitialState(0);
    expect(tillJarLevel(state, 0)).toBe(0);
    state.today.served = 15;
    expect(tillJarLevel(state, 0)).toBe(1);
    state.today.served = 45;
    expect(tillJarLevel(state, 0)).toBe(2);
  });

  it('shows the franchises’ side of the till once there are franchises', () => {
    const state = createInitialState(0);
    state.today.served = 100;
    state.chain.franchises = [{ location: 'town', hourly: 1_000 }];
    state.chain.franchiseSince = 0;
    const cap = tillSeconds(state) * 1000;
    expect(tillJarLevel(state, 0)).toBe(0);
    expect(tillJarLevel(state, cap / 2)).toBe(1);
    expect(tillJarLevel(state, cap)).toBe(2);
    expect(tillJarId(2)).toBe('till-jar-2');
  });

  it('puts a catering order out only once it is ready', () => {
    const state = createInitialState(0);
    expect(orderWaiting(state, 0)).toBe(false);
    state.orders.active = { kind: 'office', item: 'latte', servings: 3, cost: 3, payout: 30, finishAt: 1_000 };
    expect(orderWaiting(state, 999)).toBe(false);
    expect(orderWaiting(state, 1_000)).toBe(true);
  });
});
