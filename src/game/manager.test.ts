import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, type IngredientId } from './data';
import {
  AWAY_DAYS_PER_HOUR,
  AWAY_MIN_SECONDS,
  MANAGER_COST,
  MANAGER_UNLOCK_DAY,
  OVERFLOW_MAX_SECONDS,
  OVERFLOW_SHARE,
  TILL_COSTS,
  TILL_HOURS,
  WELCOME_MIN,
  WELCOME_MIN_SECONDS,
  awayEarnings,
  collectAwayEarnings,
  expectedDayProfit,
  hireManager,
  managerOpen,
  managerRestock,
  managerRunsDays,
  parseManager,
  tillSeconds,
  tillUpgradeCost,
  upgradeTill,
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
  // Most checks are about the till itself, not the one-time welcome-back gift.
  state.manager.welcomed = true;
  return state;
}

describe('shop manager', () => {
  it('starts unhired and survives a save round trip', () => {
    const state = hired(123);
    state.manager.auto = false;
    state.manager.till = 2;
    const restored = deserialize(serialize(state), 456);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.manager).toEqual({ hired: true, auto: false, lastSeen: 123, till: 2, welcomed: true });
  });

  it('gives older saves no manager and starts their away clock at load', () => {
    const old = JSON.parse(serialize(cafe()));
    delete old.manager;
    old.version = 22;
    expect(deserialize(JSON.stringify(old), 789).manager).toEqual({ hired: false, auto: true, lastSeen: 789, till: 0, welcomed: false });
  });

  it('keeps the eight hours a v23 manager already paid, without a second welcome', () => {
    const old = JSON.parse(serialize(hired(100)));
    old.manager = { hired: true, auto: true, lastSeen: 100 };
    old.version = 23;
    const manager = deserialize(JSON.stringify(old), 200).manager;
    expect(TILL_HOURS[manager.till]).toBe(8);
    expect(manager.welcomed).toBe(true);
  });

  it('never trusts a last-seen time in the future or an unknown till', () => {
    expect(parseManager({ hired: true, lastSeen: 5_000 }, 1_000).lastSeen).toBe(1_000);
    expect(parseManager({ hired: 'yes', lastSeen: -1 }, 1_000)).toEqual({ hired: false, auto: true, lastSeen: 1_000, till: 0, welcomed: false });
    expect(parseManager({ hired: true, till: 99, welcomed: false }, 0).till).toBe(TILL_HOURS.length - 1);
    expect(parseManager({ hired: true, till: -3 }, 0).till).toBe(0);
    expect(parseManager({ hired: true, till: 1.5 }, 0).till).toBe(TILL_HOURS.indexOf(8));
  });

  it('can be hired once, from day 3 (or with an extra room), for its price', () => {
    const locked = cafe();
    locked.regions = [];
    expect(hireManager(locked)).toBe(false);
    locked.day = MANAGER_UNLOCK_DAY;
    expect(hireManager(locked)).toBe(true);
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

  it('fills the till at full rate up to its size, then at a trickle for a day, then stops', () => {
    const state = hired(0);
    const perSecond = expectedDayProfit(state) * AWAY_DAYS_PER_HOUR / 3600;
    const cap = tillSeconds(state);
    expect(cap).toBe(TILL_HOURS[0] * 3600);
    expect(awayEarnings(state, (AWAY_MIN_SECONDS - 1) * 1000).amount).toBe(0);
    const half = awayEarnings(state, cap / 2 * 1000);
    expect(half).toEqual({ seconds: cap / 2, fill: 0.5, full: false, amount: Math.floor(perSecond * cap / 2), welcome: 0 });
    const later = awayEarnings(state, (cap + 3600) * 1000);
    expect(later.full).toBe(true);
    expect(later.fill).toBe(1);
    expect(later.amount).toBe(Math.floor(perSecond * (cap + OVERFLOW_SHARE * 3600)));
    const week = awayEarnings(state, 7 * 24 * HOUR);
    expect(week.amount).toBe(Math.floor(perSecond * (cap + OVERFLOW_SHARE * OVERFLOW_MAX_SECONDS)));

    const unhired = cafe();
    unhired.manager.lastSeen = 0;
    expect(awayEarnings(unhired, 2 * HOUR).amount).toBe(0);
  });

  it('pays the first real absence at least the welcome-back minimum, once', () => {
    const state = cafe(MANAGER_COST);
    state.onMenu = [];
    expect(hireManager(state)).toBe(true);
    state.manager.lastSeen = 0;
    // A quick tab switch neither pays the gift nor uses it up.
    expect(collectAwayEarnings(state, (WELCOME_MIN_SECONDS - 1) * 1000).welcome).toBe(0);
    expect(state.manager.welcomed).toBe(false);
    const first = collectAwayEarnings(state, state.manager.lastSeen + WELCOME_MIN_SECONDS * 1000);
    expect(first).toMatchObject({ amount: WELCOME_MIN, welcome: WELCOME_MIN });
    expect(state.coins).toBe(WELCOME_MIN);
    expect(collectAwayEarnings(state, state.manager.lastSeen + 2 * HOUR).welcome).toBe(0);
  });

  it('sells bigger tills in order, to a hired manager who can pay', () => {
    const state = cafe(TILL_COSTS[0]);
    expect(upgradeTill(state)).toBe(false);
    state.manager.hired = true;
    expect(tillUpgradeCost(state)).toBe(TILL_COSTS[0]);
    expect(upgradeTill(state)).toBe(true);
    expect(state.coins).toBe(0);
    expect(tillSeconds(state)).toBe(TILL_HOURS[1] * 3600);
    expect(upgradeTill(state)).toBe(false);
    state.manager.till = TILL_HOURS.length - 1;
    state.coins = Number.MAX_SAFE_INTEGER;
    expect(tillUpgradeCost(state)).toBeNull();
    expect(upgradeTill(state)).toBe(false);
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
