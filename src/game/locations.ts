import type { ItemId } from './data';
import type { GameState } from './state';

/**
 * Where a café stands. The first café is on the old town street; each new branch
 * picks a spot on the map, with its own view from the windows and local specialties.
 */
export type LocationId = 'town' | 'seaside' | 'forest' | 'city' | 'flowers';

export interface LocationDef {
  id: LocationId;
  /** Dishes the neighborhood loves: ordered more often and worth more. */
  specialties: readonly ItemId[];
  /** Pin position on the map, as fractions of its width and height. */
  pin: readonly [x: number, y: number];
}

// Each list runs from an early unlock to a late one, so a new branch feels its
// neighborhood from the first days and keeps finding specialties as it grows.
export const LOCATIONS: readonly LocationDef[] = [
  { id: 'town', specialties: [], pin: [0.44, 0.52] },
  { id: 'seaside', specialties: ['americano', 'lemontea', 'coldbrew', 'creamcoffee'], pin: [0.8, 0.72] },
  { id: 'forest', specialties: ['blacktea', 'chai', 'hojicha', 'pourover'], pin: [0.18, 0.24] },
  { id: 'city', specialties: ['latte', 'bagel', 'flatwhite', 'cortado'], pin: [0.76, 0.22] },
  { id: 'flowers', specialties: ['scone', 'fruittea', 'smoothie', 'cake'], pin: [0.2, 0.76] },
];

export const LOCATION_IDS = LOCATIONS.map((l) => l.id);
export const isLocation = (id: unknown): id is LocationId => LOCATION_IDS.some((l) => l === id);
export const locationDef = (id: LocationId) => LOCATIONS.find((l) => l.id === id)!;

/** Guests pick a local specialty this many times as often as another dish. */
export const SPECIALTY_WEIGHT = 1.5;
/** A local specialty sells for this much more. */
export const SPECIALTY_PRICE_BONUS = 0.2;

type Located = Partial<Pick<GameState, 'chain'>>;

export const cafeLocation = (state: Located): LocationId => state.chain?.location ?? 'town';
export const isSpecialty = (state: Located, id: ItemId) => locationDef(cafeLocation(state)).specialties.includes(id);
export const specialtyWeight = (state: Located, id: ItemId) => isSpecialty(state, id) ? SPECIALTY_WEIGHT : 1;
export const specialtyPriceMultiplier = (state: Located, id: ItemId) => isSpecialty(state, id) ? 1 + SPECIALTY_PRICE_BONUS : 1;
