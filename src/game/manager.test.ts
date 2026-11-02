import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, type IngredientId } from './data';
import {
  AWAY_CAP_SECONDS,
  AWAY_EFFICIENCY,
  AWAY_MIN_SECONDS,
  MANAGER_COST,
  awayEarnings,
  collectAwayEarnings,
  expectedDayProfit,
  hireManager,
  managerOpen,
  managerRestock,
  managerRunsDays,
  parseManager,
} from './manager';
import { createInitialState, deserialize, serialize, SAVE_VERSION } from './state';

const HOUR = 3600 * 1000;

function cafe(coins = 10_000) {
  const state = createInitialState(0);
  state.profile = { cafeName: 'Test', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  state.regions = ['reading'];
  state.coins = coins;
  return state;
}

function hired(now = 0) {
  const state = cafe();
  expect(hireManager(state)).toBe(true);
  state.manager.lastSeen = now;
  return state;
}

describe('shop manager', () => {
  it('starts unhired and survives a save round trip', () => {
    const state = hired(123);
    state.manager.auto = false;
    const restored = deserialize(serialize(state), 456);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.manager).toEqual({ hired: true, auto: false, lastSeen: 123 });
  });

  it('gives older saves no manager and starts their away clock at load', () => {
    const old = JSON.parse(serialize(cafe()));
    delete old.manager;
    old.version = 22;
    expect(deserialize(JSON.stringify(old), 789).manager).toEqual({ hired: false, auto: true, lastSeen: 789 });
  });

  it('never trusts a last-seen time in the future', () => {
    expect(parseManager({ hired: true, lastSeen: 5_000 }, 1_000).lastSeen).toBe(1_000);
    expect(parseManager({ hired: 'yes', lastSeen: -1 }, 1_000)).toEqual({ hired: false, auto: true, lastSeen: 1_000 });
  });

  it('can be hired once, after the first extra room, for its price', () => {
    const locked = cafe();
    locked.regions = [];
    expect(hireManager(locked)).toBe(false);
    expect(hireManager(cafe(MANAGER_COST - 1))).toBe(false);

    const state = cafe(MANAGER_COST + 10);
    expect(managerRunsDays(state)).toBe(false);
    expect(hireManager(state)).toBe(true);
    expect(state.coins).toBe(10);
    expect(managerRunsDays(state)).toBe(true);
    state.coins = MANAGER_COST;
    expect(hireManager(state)).toBe(false);
    expect(state.coins).toBe(MANAGER_COST);
  });

  it('expects a profit from a normal menu and none from an empty one', () => {
    const state = cafe();
    expect(expectedDayProfit(state)).toBeGreaterThan(0);
    state.onMenu = [];
    expect(expectedDayProfit(state)).toBe(0);
  });

  it('pays part of a normal day for time away, from the first minute up to the cap', () => {
    const state = hired(0);
    const perSecond = expectedDayProfit(state) / DAY_SECONDS * AWAY_EFFICIENCY;
    expect(awayEarnings(state, (AWAY_MIN_SECONDS - 1) * 1000).amount).toBe(0);
    expect(awayEarnings(state, 2 * HOUR)).toEqual({ seconds: 7200, capped: false, amount: Math.floor(perSecond * 7200) });
    const week = awayEarnings(state, 7 * 24 * HOUR);
    expect(week).toEqual({ seconds: AWAY_CAP_SECONDS, capped: true, amount: Math.floor(perSecond * AWAY_CAP_SECONDS) });

    const unhired = cafe();
    unhired.manager.lastSeen = 0;
    expect(awayEarnings(unhired, 2 * HOUR).amount).toBe(0);
  });

  it('collects away earnings once and restarts the clock', () => {
    const state = hired(0);
    const coins = state.coins, earned = state.totalEarned;
    const first = collectAwayEarnings(state, HOUR);
    expect(first.amount).toBeGreaterThan(0);
    expect(state.coins).toBe(coins + first.amount);
    expect(state.totalEarned).toBe(earned + first.amount);
    expect(state.manager.lastSeen).toBe(HOUR);
    expect(collectAwayEarnings(state, HOUR + 1000).amount).toBe(0);
  });

  it('stocks and opens a day it can sell', () => {
    const state = hired();
    for (const id of Object.keys(state.pantry) as IngredientId[]) state.pantry[id] = 0;
    const result = managerOpen(state);
    expect(result.ok).toBe(true);
    expect(state.phase).toBe('open');
    expect(state.pantry.beans).toBeGreaterThan(0);
  });

  it('refuses to open a day that cannot sell anything', () => {
    const broke = hired();
    broke.coins = 0;
    for (const id of Object.keys(broke.pantry) as IngredientId[]) broke.pantry[id] = 0;
    expect(managerOpen(broke)).toEqual({ ok: false, reason: 'noSupply' });
    expect(broke.phase).toBe('prep');
    expect(broke.day).toBe(1);

    const empty = hired();
    empty.onMenu = [];
    expect(managerOpen(empty)).toEqual({ ok: false, reason: 'emptyMenu' });
  });

  it('restocks a sold-out day only before closing time and only if it buys something', () => {
    const state = hired();
    expect(managerOpen(state).ok).toBe(true);
    state.phase = 'closing';
    for (const id of Object.keys(state.pantry) as IngredientId[]) state.pantry[id] = 0;
    state.dayTime = DAY_SECONDS;
    expect(managerRestock(state)).toBe(false);
    state.dayTime = DAY_SECONDS / 2;
    expect(managerRestock(state)).toBe(true);
    state.coins = 0;
    for (const id of Object.keys(state.pantry) as IngredientId[]) state.pantry[id] = 0;
    expect(managerRestock(state)).toBe(false);
  });
});
