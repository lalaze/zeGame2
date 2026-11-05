import { PERKS, chainComplete, hasPerk, type PerkId } from './chain-bonuses';
import { CHAIN_STAR_BONUS } from './data';
import { earn } from './economy';
import { awayHourly, paidSeconds, tillSeconds } from './manager';
import { createInitialState, deserialize, type GameState } from './state';
import { isLocation, type LocationId } from './locations';

/**
 * The café chain: once the whole building is open, the owner can hand the café over
 * and start a new branch from scratch. Each branch earns chain stars by what it made;
 * stars raise every price in every later branch. Cafés handed over stay open as
 * franchises and keep paying into the till, so the chain grows instead of restarting.
 */
export interface ChainState {
  stars: number;
  /** Branches opened after the first café. */
  branches: number;
  /** Lifetime earnings when this branch opened; the branch is judged on what came after. */
  baseEarned: number;
  /** Where the current café stands. */
  location: LocationId;
  /** Cafés handed over, still paying into the till (save v24). */
  franchises: Franchise[];
  /** When franchise pay was last collected (ms since epoch). */
  franchiseSince: number;
  /** Perks bought with chain stars (save v24); see chain-bonuses. */
  perks: PerkId[];
}

export interface Franchise {
  location: LocationId;
  /** What it pays into the till per real hour. */
  hourly: number;
}

/**
 * Earnings for a branch's first star; every doubling after that adds one more. Stars
 * follow the order of magnitude of what a branch made, not the amount: within a branch
 * earnings grow exponentially, so a power of them (the old square root) let stars, and
 * with them prices, run away within a couple of weeks. See docs/idle-pacing.
 */
export const STAR_EARNINGS = 50_000;
/** A café handed over keeps paying this share of its away pay, for good. */
export const FRANCHISE_SHARE = 0.25;
const MAX_FRANCHISES = 200;

export const emptyChain = (now = 0): ChainState => ({ stars: 0, branches: 0, baseEarned: 0, location: 'town', franchises: [], franchiseSince: now, perks: [] });

export function parseChain(value: unknown, now = 0): ChainState {
  const base = emptyChain(now);
  if (!value || typeof value !== 'object') return base;
  const c = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  base.stars = count(c.stars);
  base.branches = count(c.branches);
  base.baseEarned = typeof c.baseEarned === 'number' && Number.isFinite(c.baseEarned) && c.baseEarned >= 0 ? c.baseEarned : 0;
  if (isLocation(c.location)) base.location = c.location;
  if (Array.isArray(c.franchises)) {
    for (const f of c.franchises.slice(0, MAX_FRANCHISES) as Record<string, unknown>[]) {
      if (!f || !isLocation(f.location) || typeof f.hourly !== 'number' || !Number.isFinite(f.hourly) || f.hourly < 0) continue;
      base.franchises.push({ location: f.location, hourly: f.hourly });
    }
  }
  // As with away time, a timestamp in the future counts from now.
  if (typeof c.franchiseSince === 'number' && Number.isFinite(c.franchiseSince) && c.franchiseSince > 0) base.franchiseSince = Math.min(c.franchiseSince, now);
  if (Array.isArray(c.perks)) base.perks = PERKS.map((p) => p.id).filter((id) => (c.perks as unknown[]).includes(id));
  return base;
}

/** What every franchise together pays into the till per real hour. */
export const franchiseHourly = (state: GameState) => state.chain.franchises.reduce((sum, f) => sum + f.hourly, 0);

export interface FranchiseEarnings {
  amount: number;
  /** How full the franchises' side of the till is, from 0 to 1. */
  fill: number;
  full: boolean;
}

/** Franchise pay waiting in the till. It shares the till's size, on screen or away. */
export function franchiseEarnings(state: GameState, now: number): FranchiseEarnings {
  const hourly = franchiseHourly(state);
  if (hourly <= 0) return { amount: 0, fill: 0, full: false };
  const elapsed = Math.max(0, (now - state.chain.franchiseSince) / 1000), capacity = tillSeconds(state);
  return { amount: Math.floor(hourly * paidSeconds(elapsed, capacity) / 3600), fill: Math.min(1, elapsed / capacity), full: elapsed >= capacity };
}

/**
 * Takes the franchise pay out of the till. It isn't this branch's own takings, so it
 * leaves the stars a new branch would bring unchanged.
 */
export function collectFranchises(state: GameState, now: number): number {
  const { amount } = franchiseEarnings(state, now);
  if (amount > 0) {
    earn(state, amount);
    state.chain.baseEarned += amount;
  }
  state.chain.franchiseSince = now;
  return amount;
}

/** What this branch has earned since it opened. */
export const branchEarnings = (state: GameState) => Math.max(0, state.totalEarned - state.chain.baseEarned);

/** Stars a new branch would bring now. */
export const starsOnBranch = (state: GameState) => starsFor(branchEarnings(state));

/** Stars for a branch that earned `earned`: one at STAR_EARNINGS, one more per doubling. */
export function starsFor(earned: number): number {
  let stars = 0;
  for (let threshold = STAR_EARNINGS; earned >= threshold && Number.isFinite(threshold); threshold *= 2) stars++;
  return stars;
}

/** What this branch must have earned in all for one more star. */
export const nextStarAt = (state: GameState) => STAR_EARNINGS * 2 ** starsOnBranch(state);

/** A new branch opens once every room of this one is open. */
export const branchUnlocked = (state: GameState) => state.regions.includes('terrace');

export const canOpenBranch = (state: GameState) =>
  branchUnlocked(state) && state.phase === 'prep' && starsOnBranch(state) > 0;

export const chainBonusPercent = (stars: number) => Math.round(stars * CHAIN_STAR_BONUS * 100);

/**
 * Starts a new branch at `location`: a fresh café with the owner, the shop manager,
 * the stories so far, resident cats, custom recipes, café milestones and the day
 * count carried over. The café handed over joins the franchises, and what they have
 * waiting in the till is paid into the new branch.
 * The new save is read back through the normal loader, so staff slots, wishes and
 * other cross-checked state settle exactly as they would for a loaded game.
 */
export function openBranch(state: GameState, location: LocationId, now: number): GameState | null {
  if (!canOpenBranch(state) || !isLocation(location)) return null;
  const waiting = franchiseEarnings(state, now).amount;
  const franchises = [...state.chain.franchises, { location: state.chain.location, hourly: awayHourly(state) * FRANCHISE_SHARE }].slice(-MAX_FRANCHISES);
  const fresh = createInitialState(state.createdAt);
  const carried: GameState = {
    ...fresh,
    profile: state.profile,
    manager: state.manager,
    // The catering order is the owner's, not the building's: it carries on.
    orders: state.orders,
    milestones: state.milestones,
    goal: state.goal,
    day: state.day,
    speed: state.speed,
    served: state.served,
    guestMemories: state.guestMemories,
    regularGuests: state.regularGuests,
    regularWishes: state.regularWishes,
    partners: state.partners,
    pets: state.pets,
    // The cats move with the owner, and so do the gifts on the sills.
    catGifts: state.catGifts,
    signatureDrinks: state.signatureDrinks,
    cafeStyle: { ...state.cafeStyle, bakeryTrialDay: undefined },
    coins: fresh.coins + waiting,
    totalEarned: state.totalEarned + waiting,
    chain: {
      stars: state.chain.stars + starsOnBranch(state), branches: state.chain.branches + 1,
      baseEarned: state.totalEarned + waiting, location, franchises, franchiseSince: now, perks: [...state.chain.perks],
    },
    // The kitchen perk: every new branch opens with its kitchen already built.
    kitchen: hasPerk(state, 'kitchen'),
    // Every branch gets the chain's framed map to hang, and the brass plaque once all five places have a franchise.
    decor: { ...fresh.decor, stored: { ...fresh.decor.stored, chain_map: 1, ...(chainComplete({ chain: { ...state.chain, franchises } }) ? { chain_plaque: 1 } : {}) } },
  };
  return deserialize(JSON.stringify(carried), now);
}
