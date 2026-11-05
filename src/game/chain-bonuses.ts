import type { Category } from './data';
import type { Flavor } from './flavors';
import { LOCATION_IDS, type LocationId } from './locations';
import type { GameState } from './state';

/**
 * What the chain gives back beyond prices: every place a café was handed over in adds a
 * chain-wide bonus of its own, and chain stars can be spent on perks instead of
 * raising prices. Only data and state are read here, so the economy, the manager, the
 * builders and the other systems can all ask without import cycles.
 */

// ---------------------------------------------------------------- franchise places

export type PlaceBonus =
  | { kind: 'till'; hours: number }
  | { kind: 'traffic'; share: number }
  | { kind: 'price'; share: number; flavors?: readonly Flavor[]; categories?: readonly Category[] };

/**
 * The bonus a franchise in each place brings the whole chain. A café counts once it's
 * been handed over, so where a branch opens decides what it will add later on.
 */
export const PLACE_BONUS: Record<LocationId, PlaceBonus> = {
  town: { kind: 'till', hours: 1 },
  seaside: { kind: 'price', share: 0.15, flavors: ['fruity', 'tangy'] },
  forest: { kind: 'price', share: 0.15, flavors: ['tea', 'spiced'] },
  city: { kind: 'traffic', share: 0.08 },
  flowers: { kind: 'price', share: 0.15, categories: ['pastry'] },
};
/** Every franchise after the first in the same place adds this share of the bonus again. */
export const REPEAT_SHARE = 1 / 3;
/** With a franchise in every place, every price rises this much more. */
export const COMPLETE_BONUS = 0.1;

export const franchisesIn = (state: Pick<GameState, 'chain'>, place: LocationId) =>
  state.chain.franchises.filter((f) => f.location === place).length;

/** How strongly a place's bonus applies: 1 for the first franchise there, a third more for each after. */
export const placeStrength = (count: number) => (count <= 0 ? 0 : 1 + (count - 1) * REPEAT_SHARE);

/** Places with at least one franchise. */
export const placesCovered = (state: Pick<GameState, 'chain'>) => LOCATION_IDS.filter((place) => franchisesIn(state, place) > 0).length;
export const chainComplete = (state: Pick<GameState, 'chain'>) => placesCovered(state) === LOCATION_IDS.length;

/** Franchise price bonus for a dish of this category and these flavors, as a multiplier. */
export function placePriceMultiplier(state: Pick<GameState, 'chain'>, category: Category, flavors: readonly Flavor[]): number {
  let share = chainComplete(state) ? COMPLETE_BONUS : 0;
  for (const place of LOCATION_IDS) {
    const bonus = PLACE_BONUS[place];
    if (bonus.kind !== 'price') continue;
    const fits = bonus.categories?.includes(category) || bonus.flavors?.some((f) => flavors.includes(f));
    if (fits) share += bonus.share * placeStrength(franchisesIn(state, place));
  }
  return 1 + share;
}

/** Franchise customer bonus, as a multiplier on arrivals. */
export function placeTrafficMultiplier(state: Pick<GameState, 'chain'>): number {
  let share = 0;
  for (const place of LOCATION_IDS) {
    const bonus = PLACE_BONUS[place];
    if (bonus.kind === 'traffic') share += bonus.share * placeStrength(franchisesIn(state, place));
  }
  return 1 + share;
}

/** Extra hours the till holds thanks to franchises and perks. */
export function extraTillHours(state: Pick<GameState, 'chain'>): number {
  let hours = hasPerk(state, 'till') ? PERK_TILL_HOURS : 0;
  for (const place of LOCATION_IDS) {
    const bonus = PLACE_BONUS[place];
    if (bonus.kind === 'till') hours += bonus.hours * placeStrength(franchisesIn(state, place));
  }
  return hours;
}

// ---------------------------------------------------------------- perks

export type PerkId = 'till' | 'kitchen' | 'builders' | 'catering' | 'manager' | 'cats';
export interface PerkDef {
  id: PerkId;
  /** Chain stars it takes; spent stars no longer raise prices. */
  cost: number;
}
export const PERKS: readonly PerkDef[] = [
  { id: 'till', cost: 3 },
  { id: 'cats', cost: 4 },
  { id: 'kitchen', cost: 5 },
  { id: 'builders', cost: 8 },
  { id: 'catering', cost: 8 },
  { id: 'manager', cost: 12 },
];
export const isPerk = (id: unknown): id is PerkId => PERKS.some((p) => p.id === id);
export const perkDef = (id: PerkId) => PERKS.find((p) => p.id === id)!;

/** Perk effects. */
export const PERK_TILL_HOURS = 2;
export const PERK_BUILD_SHARE = 0.7;
export const PERK_CATERING_SHARE = 1.5;
export const PERK_AWAY_SHARE = 1.25;
export const PERK_GIFT_SHARE = 0.75;

export const hasPerk = (state: Pick<GameState, 'chain'>, id: PerkId) => state.chain.perks.includes(id);
export const starsSpent = (state: Pick<GameState, 'chain'>) => state.chain.perks.reduce((sum, id) => sum + perkDef(id).cost, 0);
/** Stars still raising prices. */
export const starsFree = (state: Pick<GameState, 'chain'>) => Math.max(0, state.chain.stars - starsSpent(state));

export type PerkBlock = 'owned' | 'stars' | null;
export function perkBlock(state: Pick<GameState, 'chain'>, id: PerkId): PerkBlock {
  if (hasPerk(state, id)) return 'owned';
  if (starsFree(state) < perkDef(id).cost) return 'stars';
  return null;
}

/** Spends stars on a perk, for good. */
export function buyPerk(state: Pick<GameState, 'chain'>, id: PerkId): boolean {
  if (perkBlock(state, id)) return false;
  state.chain.perks.push(id);
  return true;
}
