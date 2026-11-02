import { describe, expect, it } from 'vitest';
import { STAR_EARNINGS, branchUnlocked, canOpenBranch, openBranch, parseChain, starsOnBranch } from './chain';
import { adoptCat } from './pets';
import { createInitialState, deserialize, serialize } from './state';
import { salePrice } from './economy';
import { hireManager } from './manager';

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
    expect(parseChain(undefined)).toEqual({ stars: 0, branches: 0, baseEarned: 0, location: 'town' });
    expect(parseChain({ stars: -2, branches: 1.7, baseEarned: 'lots', location: 'moon' })).toEqual({ stars: 0, branches: 1, baseEarned: 0, location: 'town' });
  });

  it('awards stars by the square root of what this branch earned', () => {
    const state = grownCafe(0);
    expect(starsOnBranch(state)).toBe(0);
    state.totalEarned = STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(1);
    state.totalEarned = 4 * STAR_EARNINGS - 1;
    expect(starsOnBranch(state)).toBe(1);
    state.totalEarned = 4 * STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(2);
    state.chain.baseEarned = 3 * STAR_EARNINGS;
    expect(starsOnBranch(state)).toBe(1);
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
    expect(next.chain).toEqual({ stars: 4, branches: 1, baseEarned: 1_000_000, location: 'seaside' });
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
    expect(openBranch(next, 'city', 6)!.chain).toEqual({ stars: 5, branches: 2, baseEarned: 1_000_000 + STAR_EARNINGS, location: 'city' });
  });

  it('raises every price by ten percent per star', () => {
    const state = createInitialState(0);
    const base = salePrice(state, 'espresso');
    state.chain.stars = 3;
    expect(salePrice(state, 'espresso')).toBeCloseTo(base * 1.3, 8);
  });
});
