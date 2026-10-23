import { COMBO_CHANCE, MAX_VARIETY_BONUS, VARIETY_BONUS, isDrink, type MenuItemDef } from './data';
import { menuWeights, todayCondition, type ConditionId } from './conditions';
import { itemFlavors } from './flavors';
import type { GameState } from './state';

export const GUEST_KINDS = ['commuter', 'leisure', 'teaTime'] as const;
export type GuestKind = typeof GUEST_KINDS[number];
export const demandEnabled = (state: Pick<GameState, 'day'>) => state.day >= 3;
export const isGuestKind = (value: unknown): value is GuestKind => GUEST_KINDS.some(kind => kind === value);

// Shares of the neighbourhood's potential customers, before menu coverage. Weather
// shifts the audience; it does not invent arrivals or count an unmet wish as a loss.
const AUDIENCES: Record<ConditionId, readonly [number, number, number]> = {
  fair: [.5, .3, .2], rain: [.3, .4, .3], hot: [.35, .5, .15],
  crisp: [.6, .2, .2], market: [.65, .15, .2], quiet: [.25, .35, .4],
};
// A fair-day espresso bar keeps its former arrival rate. Full coverage is bounded
// at 1.6×, the old variety cap; adding copies of the same offer creates no demand.
const BASE_COVERAGE = .625;

/** How well one dish suits a visit. Price and recipe level cannot buy an audience. */
export function guestAffinity(kind: GuestKind, item: MenuItemDef): number {
  const flavors = itemFlavors(item.id);
  const drink = isDrink(item.category);
  if (kind === 'commuter') {
    if (!drink) return item.category === 'bread' ? .8 : .45;
    if (item.prepTime <= 3 && flavors.includes('bold')) return 1;
    if (item.prepTime <= 3 && flavors.includes('tea')) return .6;
    return .3;
  }
  if (kind === 'leisure') {
    if (!drink) return item.category === 'pastry' ? .7 : .4;
    if (flavors.some(flavor => ['milky', 'sweet', 'cocoa', 'fruity'].includes(flavor))) return 1;
    return flavors.includes('tea') ? .35 : .25;
  }
  if (!drink) return item.category === 'pastry' ? .85 : .65;
  if (flavors.includes('tea')) return 1;
  return flavors.some(flavor => ['milky', 'sweet', 'cocoa', 'fruity'].includes(flavor)) ? .4 : .25;
}

export interface GuestDemand {
  kind: GuestKind;
  audience: number;
  coverage: number;
  /** Fraction of actual arrivals expected to belong to this audience. */
  share: number;
}
export interface MainChoice {
  kind?: GuestKind;
  main: MenuItemDef;
  probability: number;
}
export interface DemandPlan {
  traffic: number;
  guests: GuestDemand[];
  mains: MainChoice[];
}

export function demandPlan(state: Pick<GameState, 'day' | 'createdAt'>, items: readonly MenuItemDef[]): DemandPlan {
  if (!items.length) return { traffic: 0, guests: [], mains: [] };
  const weather = menuWeights(state, items) ?? items.map(() => 1);
  if (!demandEnabled(state)) {
    return {
      traffic: 1 + Math.min(MAX_VARIETY_BONUS, VARIETY_BONUS * Math.max(0, items.length - 1)), guests: [],
      mains: items.map((main, i) => ({ main, probability: weather[i] / weather.reduce((sum, w) => sum + w, 0) })),
    };
  }
  const audiences = AUDIENCES[todayCondition(state).id];
  const affinities = GUEST_KINDS.map(kind => items.map(item => guestAffinity(kind, item)));
  const covered = affinities.map((scores, i) => Math.max(...scores) * audiences[i]);
  const total = covered.reduce((sum, value) => sum + value, 0);
  const guests = GUEST_KINDS.map((kind, i) => ({ kind, audience: audiences[i], coverage: Math.max(...affinities[i]), share: covered[i] / total }));
  const mains = guests.flatMap((guest, i) => {
    // Strong preferences preserve a specialist's core trade when another audience
    // gets its first suitable dish. Similar dishes still compete within a group.
    const weights = affinities[i].map((score, n) => score ** 3 * weather[n]);
    const sum = weights.reduce((a, b) => a + b, 0);
    return items.map((main, n) => ({ kind: guest.kind, main, probability: guest.share * weights[n] / sum }));
  });
  return { traffic: total / BASE_COVERAGE, guests, mains };
}

/** Preserve route perks as a change to the group's ordinary pairing appetite. */
export function guestComboChance(kind: GuestKind | undefined, styleChance: number): number {
  const ordinary = kind === 'commuter' ? .15 : kind === 'leisure' ? .4 : kind === 'teaTime' ? .65 : COMBO_CHANCE;
  return Math.max(0, Math.min(.85, ordinary + styleChance - COMBO_CHANCE));
}

export function guestPairWeights(state: Pick<GameState, 'createdAt' | 'day'>, kind: GuestKind | undefined, items: readonly MenuItemDef[]): number[] {
  if (!kind) return items.map(() => 1);
  const weather = menuWeights(state, items);
  return items.map((item, i) => guestAffinity(kind, item) ** 3 * (weather?.[i] ?? 1));
}

export const guestSeatingMultiplier = (kind?: GuestKind) => kind === 'commuter' ? .25 : kind === 'leisure' ? 1.2 : kind === 'teaTime' ? 1.35 : 1;

export interface GuestStats {
  arrived: number;
  served: number;
  paired: number;
  stockLost: number;
  waitLost: number;
  cancelled: number;
  dismissed: number;
  revenue: number;
}
export type GuestDayStats = Record<GuestKind, GuestStats>;
export const emptyGuestStats = (): GuestDayStats => Object.fromEntries(GUEST_KINDS.map(kind => [kind, {
  arrived: 0, served: 0, paired: 0, stockLost: 0, waitLost: 0, cancelled: 0, dismissed: 0, revenue: 0,
}])) as GuestDayStats;

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(1_000_000_000, value) : 0;

/** Old saves start with zero observed visits; aggregate sales cannot reveal intent. */
export function parseGuestStats(value: unknown): GuestDayStats {
  const result = emptyGuestStats();
  if (!object(value)) return result;
  for (const kind of GUEST_KINDS) {
    const raw = value[kind];
    if (!object(raw)) continue;
    const stats = result[kind];
    stats.arrived = count(raw.arrived);
    let remaining = stats.arrived;
    for (const key of ['served', 'stockLost', 'waitLost', 'cancelled', 'dismissed'] as const) {
      stats[key] = Math.min(remaining, count(raw[key]));
      remaining -= stats[key];
    }
    stats.paired = Math.min(stats.served, count(raw.paired));
    stats.revenue = stats.served > 0 && typeof raw.revenue === 'number' && Number.isFinite(raw.revenue) && raw.revenue >= 0 ? raw.revenue : 0;
  }
  return result;
}
