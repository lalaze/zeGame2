import { describe, expect, it } from 'vitest';
import { FRANCHISE_SHARE, STAR_EARNINGS, branchEarnings, nextStarAt, starsFor, branchUnlocked, canOpenBranch, collectFranchises, franchiseEarnings, franchiseHourly, openBranch, parseChain, starsOnBranch } from './chain';
import { adoptCat } from './pets';
import { createInitialState, deserialize, serialize } from './state';
import { salePrice } from './economy';
import { OVERFLOW_SHARE, awayHourly, hireManager, tillSeconds } from './manager';

const HOUR = 3_600_000;

function grownCafe(earned = 1_000_000) {
  const state = createInitialState(1);
  state.profile = { cafeName: 'Bean One', ownerName: 'Lin', look: { skin: 1, hair: 2, hairStyle: 0, shirt: 3, pants: 1 } };
  state.regions = ['reading'];
  state.coins = 100_000;
  expect(hireManager(state)).toBe(true);
  expect(adoptCat(state, 'ginger')).toBe(true);
  state.regions = ['reading', 'greenhouse', 'terrace'];
  state.kitchen = true;
  state.upgrades.marketing = 10;
  state.items.latte = 30;
  state.onMenu = ['espresso', 'latte'];
  state.day = 31;
  state.goal = 15;
  state.served = 4_000;
  state.totalEarned = earned;
  state.coins = 250_000;
  return state;
}

describe('café chain', () => {
  it('reads missing or malformed chain data as a first café', () => {
    expect(parseChain(undefined, 7)).toEqual({ stars: 0, branches: 0, baseEarned: 0, location: 'town', franchises: [], franchiseSince: 7, perks: [] });
    expect(parseChain({ stars: -2, branches: 1.7, baseEarned: 'lots', location: 'moon' }, 7)).toEqual({ stars: 0, branches: 1, baseEarned: 0, location: 'town', franchises: [], franchiseSince: 7, perks: [] });
  });

  it('keeps only valid franchises and never a franchise clock in the future', () => {
    const chain = parseChain({ franchises: [{ location: 'town', hourly: 50 }, { location: 'moon', hourly: 5 }, { location: 'city', hourly: -1 }, null, { location: 'city', hourly: 9 }], franchiseSince: 99 }, 10);
    expect(chain.franchises).toEqual([{ location: 'town', hourly: 50 }, { location: 'city', hourly: 9 }]);
    expect(chain.franchiseSince).toBe(10);
  });

  it('awards a star at the first threshold and one more for every doubling after it', () => {
    const state = grownCafe(0);
    expect(starsOnBranch(state)).toBe(0);
    state.totalEarned = STAR_EARNINGS - 1;
    expect(starsOnBranch(state)).toBe(0);
    state.totalEarned = STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(1);
    expect(nextStarAt(state)).toBe(2 * STAR_EARNINGS);
    state.totalEarned = 2 * STAR_EARNINGS - 1;
    expect(starsOnBranch(state)).toBe(1);
    state.totalEarned = 2 * STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(2);
    state.totalEarned = 1024 * STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(11);
    state.chain.baseEarned = 1020 * STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(3);
    // Earnings a thousand times larger bring ten more stars, not thirty times as many.
    expect(starsFor(1e15) - starsFor(1e12)).toBe(10);
  });

  it('opens only with the whole building open, while closed, and with a star to gain', () => {
    const state = grownCafe();
    expect(canOpenBranch(state)).toBe(true);
    state.regions = ['reading', 'greenhouse'];
    expect(branchUnlocked(state)).toBe(false);
    expect(openBranch(state, 'seaside', 2)).toBeNull();
    expect(openBranch(grownCafe(), 'moon' as never, 2)).toBeNull();
    const open = grownCafe();
    open.phase = 'open';
    expect(canOpenBranch(open)).toBe(false);
    expect(canOpenBranch(grownCafe(STAR_EARNINGS - 1))).toBe(false);
  });

  it('starts the café over and carries the owner, manager, cats, stories and records', () => {
    const state = grownCafe();
    const next = openBranch(state, 'seaside', 5)!;
    // Starts over.
    expect(next.coins).toBe(0);
    expect(next.items.latte).toBe(0);
    expect(next.items.espresso).toBe(1);
    expect(next.onMenu).toEqual(['espresso']);
    expect(next.upgrades.marketing).toBe(0);
    expect(next.regions).toEqual([]);
    expect(next.kitchen).toBe(false);
    expect(next.phase).toBe('prep');
    expect(next.reputation.recent).toEqual([]);
    // Carried over.
    expect(next.profile).toEqual(state.profile);
    expect(next.manager.hired).toBe(true);
    expect(next.pets.map(p => p.id)).toEqual(['ginger']);
    expect(next.day).toBe(31);
    expect(next.goal).toBe(15);
    expect(next.served).toBe(4_000);
    expect(next.createdAt).toBe(state.createdAt);
    expect(next.chain).toEqual({ stars: starsFor(1_000_000), branches: 1, baseEarned: 1_000_000, location: 'seaside', franchises: [{ location: 'town', hourly: awayHourly(state) * FRANCHISE_SHARE }], franchiseSince: 5, perks: [] });
    expect(next.chain.franchises[0].hourly).toBeGreaterThan(0);
    // A normal save of the new branch.
    expect(deserialize(serialize(next), 6)).toEqual(next);
    // The old café is untouched until the game swaps the state.
    expect(state.regions).toHaveLength(3);
  });

  it('judges the next branch only on what it earns itself', () => {
    const next = openBranch(grownCafe(), 'seaside', 5)!;
    next.regions = ['reading', 'greenhouse', 'terrace'];
    expect(canOpenBranch(next)).toBe(false);
    next.totalEarned += STAR_EARNINGS;
    const third = openBranch(next, 'city', 6)!;
    expect(third.chain).toMatchObject({ stars: starsFor(1_000_000) + 1, branches: 2, baseEarned: 1_000_000 + STAR_EARNINGS, location: 'city' });
    expect(third.chain.franchises.map(f => f.location)).toEqual(['town', 'seaside']);
  });

  it('pays franchises into the till at the till’s size, on screen or away, without counting toward stars', () => {
    const next = openBranch(grownCafe(), 'seaside', 0)!;
    const hourly = franchiseHourly(next), cap = tillSeconds(next) / 3600;
    expect(franchiseEarnings(next, HOUR / 2)).toEqual({ amount: Math.floor(hourly / 2), fill: 0.5 / cap, full: false });
    const late = franchiseEarnings(next, (cap + 10) * HOUR);
    expect(late.full).toBe(true);
    expect(late.amount).toBe(Math.floor(hourly * (cap + 10 * OVERFLOW_SHARE)));
    const stars = starsOnBranch(next), earned = branchEarnings(next);
    expect(collectFranchises(next, HOUR)).toBe(Math.floor(hourly));
    expect(next.coins).toBe(Math.floor(hourly));
    expect(branchEarnings(next)).toBe(earned);
    expect(starsOnBranch(next)).toBe(stars);
    expect(franchiseEarnings(next, HOUR).amount).toBe(0);
    expect(collectFranchises(createInitialState(0), HOUR)).toBe(0);
  });

  it('hands what the franchises have waiting to the next branch, outside its stars', () => {
    const second = openBranch(grownCafe(), 'seaside', 0)!;
    second.regions = ['reading', 'greenhouse', 'terrace'];
    second.totalEarned += STAR_EARNINGS;
    const waiting = franchiseEarnings(second, HOUR).amount;
    expect(waiting).toBeGreaterThan(0);
    const third = openBranch(second, 'city', HOUR)!;
    expect(third.coins).toBe(waiting);
    expect(branchEarnings(third)).toBe(0);
    expect(third.chain.franchiseSince).toBe(HOUR);
  });

  it('raises every price by ten percent per star', () => {
    const state = createInitialState(0);
    const base = salePrice(state, 'espresso');
    state.chain.stars = 3;
    expect(salePrice(state, 'espresso')).toBeCloseTo(base * 1.3, 8);
  });
});
