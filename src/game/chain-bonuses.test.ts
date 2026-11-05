import { describe, expect, it } from 'vitest';
import { GIFT_INTERVAL_MS, giftInterval } from './cat-gifts';
import { openBranch } from './chain';
import {
  COMPLETE_BONUS, PERKS, PERK_AWAY_SHARE, PERK_BUILD_SHARE, PERK_TILL_HOURS, PLACE_BONUS, REPEAT_SHARE,
  buyPerk, chainComplete, extraTillHours, perkBlock, placePriceMultiplier, placeStrength, placeTrafficMultiplier, placesCovered, starsFree, starsSpent,
} from './chain-bonuses';
import { arrivalRate, chainMultiplier, salePrice } from './economy';
import { AWAY_DAYS_PER_HOUR, TILL_HOURS, awayHourly, expectedDayProfit, hireManager, tillSeconds } from './manager';
import { buildSeconds, regionDef } from './regions';
import { createInitialState, deserialize, serialize } from './state';
import type { LocationId } from './locations';

const cafe = (...places: LocationId[]) => {
  const state = createInitialState(0);
  state.chain.franchises = places.map((location) => ({ location, hourly: 100 }));
  return state;
};

describe('franchise places', () => {
  it('gives the first franchise in a place its whole bonus and each later one a third', () => {
    expect(placeStrength(0)).toBe(0);
    expect(placeStrength(1)).toBe(1);
    expect(placeStrength(3)).toBeCloseTo(1 + 2 * REPEAT_SHARE);
  });

  it('raises the right dishes: fruity at the seaside, tea in the woods, pastries from the flower fields', () => {
    const none = cafe();
    expect(placePriceMultiplier(none, 'tea', ['tea'])).toBe(1);
    const sea = cafe('seaside');
    expect(placePriceMultiplier(sea, 'tea', ['tea', 'fruity'])).toBeCloseTo(1.15);
    expect(placePriceMultiplier(sea, 'coffee', ['bold'])).toBe(1);
    const woods = cafe('forest', 'forest');
    expect(placePriceMultiplier(woods, 'tea', ['tea'])).toBeCloseTo(1 + 0.15 * (1 + REPEAT_SHARE));
    expect(placePriceMultiplier(cafe('flowers'), 'pastry', ['buttery'])).toBeCloseTo(1.15);
  });

  it('feeds the actual sale price, forecasts included', () => {
    const plain = createInitialState(0), sea = cafe('seaside');
    for (const s of [plain, sea]) { s.items.blacktea = 5; s.items.lemontea = 5; }
    expect(salePrice(sea, 'lemontea') / salePrice(plain, 'lemontea')).toBeCloseTo(1.15);
    expect(salePrice(sea, 'blacktea')).toBeCloseTo(salePrice(plain, 'blacktea'));
  });

  it('brings more guests from the city and a bigger till from the old town', () => {
    const plain = createInitialState(0);
    expect(arrivalRate(cafe('city')) / arrivalRate(plain)).toBeCloseTo(1 + (PLACE_BONUS.city as { share: number }).share);
    expect(placeTrafficMultiplier(cafe('city', 'city'))).toBeCloseTo(1 + 0.08 * (1 + REPEAT_SHARE));
    const town = cafe('town');
    expect(extraTillHours(town)).toBe(1);
    expect(tillSeconds(town)).toBe((TILL_HOURS[0] + 1) * 3600);
  });

  it('adds a last bonus to every price once every place has a franchise', () => {
    const four = cafe('town', 'seaside', 'forest', 'city');
    expect(placesCovered(four)).toBe(4);
    expect(chainComplete(four)).toBe(false);
    const five = cafe('town', 'seaside', 'forest', 'city', 'flowers');
    expect(chainComplete(five)).toBe(true);
    expect(placePriceMultiplier(five, 'coffee', ['bold'])).toBeCloseTo(1 + COMPLETE_BONUS);
  });
});

describe('star perks', () => {
  it('spends stars that then stop raising prices, once per perk', () => {
    const state = createInitialState(0);
    state.chain.stars = 10;
    expect(perkBlock(state, 'manager')).toBe('stars');
    expect(buyPerk(state, 'kitchen')).toBe(true);
    expect(starsSpent(state)).toBe(5);
    expect(starsFree(state)).toBe(5);
    expect(chainMultiplier(state)).toBeCloseTo(1.5);
    expect(perkBlock(state, 'kitchen')).toBe('owned');
    expect(buyPerk(state, 'kitchen')).toBe(false);
    expect(buyPerk(state, 'builders')).toBe(false);
    expect(buyPerk(state, 'till')).toBe(true);
    expect(starsFree(state)).toBe(2);
  });

  it('applies each perk where it belongs', () => {
    const state = createInitialState(0);
    state.chain.stars = PERKS.reduce((n, p) => n + p.cost, 0);
    state.items.latte = 10; state.onMenu = ['espresso', 'latte'];
    state.chain.branches = 0;
    const before = { till: tillSeconds(state), build: buildSeconds(state, 'terrace'), away: awayHourly(state), gift: giftInterval(state) };
    for (const p of PERKS) expect(buyPerk(state, p.id)).toBe(true);
    expect(tillSeconds(state)).toBe(before.till + PERK_TILL_HOURS * 3600);
    expect(buildSeconds(state, 'terrace')).toBe(Math.round(regionDef('terrace').buildSeconds * PERK_BUILD_SHARE));
    expect(awayHourly(state)).toBeCloseTo(expectedDayProfit(state) * AWAY_DAYS_PER_HOUR * PERK_AWAY_SHARE);
    expect(before.away).toBeGreaterThan(0);
    expect(giftInterval(state)).toBeLessThan(GIFT_INTERVAL_MS);
    expect(before.gift).toBe(GIFT_INTERVAL_MS);
  });

  it('keeps perks across saves and branches, and opens branches with a kitchen once bought', () => {
    const state = createInitialState(1);
    state.profile = { cafeName: 'Chain', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
    state.regions = ['reading', 'greenhouse', 'terrace'];
    state.coins = 1_000;
    hireManager(state);
    state.totalEarned = 1_000_000;
    state.chain.stars = 5;
    expect(buyPerk(state, 'kitchen')).toBe(true);
    expect(deserialize(serialize(state), 2).chain.perks).toEqual(['kitchen']);
    const next = openBranch(state, 'forest', 3)!;
    expect(next.chain.perks).toEqual(['kitchen']);
    expect(next.kitchen).toBe(true);
    expect(deserialize(JSON.stringify({ ...JSON.parse(serialize(state)), chain: { ...state.chain, perks: ['kitchen', 'rocket', 'kitchen'] } }), 2).chain.perks).toEqual(['kitchen']);
  });
});
