import { describe, expect, it } from 'vitest';
import { LOCATIONS, SPECIALTY_PRICE_BONUS, cafeLocation, isSpecialty, locationDef } from './locations';
import { MENU } from './data';
import { createInitialState, deserialize, serialize } from './state';
import { orderShares, salePrice } from './economy';
import { menuWeights } from './conditions';

const cafe = (location?: 'seaside' | 'city') => {
  const state = createInitialState(0);
  state.day = 5;
  state.items.americano = 1; state.items.latte = 1;
  state.onMenu = ['espresso', 'americano', 'latte'];
  if (location) state.chain.location = location;
  return state;
};
const menu = (state: ReturnType<typeof cafe>) => MENU.filter((m) => state.onMenu.includes(m.id));

describe('café locations', () => {
  it('lists real dishes, four specialties per branch spot, and none for the old town', () => {
    expect(locationDef('town').specialties).toEqual([]);
    for (const l of LOCATIONS.filter((l) => l.id !== 'town')) {
      expect(l.specialties).toHaveLength(4);
      for (const id of l.specialties) expect(MENU.some((m) => m.id === id)).toBe(true);
    }
  });

  it('keeps the first café in the old town, also for older saves', () => {
    expect(cafeLocation(createInitialState(0))).toBe('town');
    const raw = JSON.parse(serialize(cafe()));
    delete raw.chain;
    expect(cafeLocation(deserialize(JSON.stringify(raw), 0))).toBe('town');
    expect(cafeLocation(deserialize(serialize(cafe('seaside')), 0))).toBe('seaside');
  });

  it('sells specialties for more, and only there', () => {
    const town = cafe(), city = cafe('city');
    expect(isSpecialty(city, 'latte')).toBe(true);
    expect(salePrice(city, 'latte')).toBeCloseTo(salePrice(town, 'latte') * (1 + SPECIALTY_PRICE_BONUS), 8);
    expect(salePrice(city, 'americano')).toBeCloseTo(salePrice(town, 'americano'), 8);
  });

  it('gets specialties ordered more often, in forecasts and live picks alike', () => {
    const town = cafe(), seaside = cafe('seaside');
    expect(orderShares(menu(seaside), seaside).get('americano')!).toBeGreaterThan(orderShares(menu(town), town).get('americano')!);
    // Live service picks with the same weights the forecasts use.
    const weights = menuWeights(seaside, menu(seaside))!;
    expect(weights[1]).toBeGreaterThan(weights[0]);
  });
});
