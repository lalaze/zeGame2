import { CHAIN_STAR_BONUS } from './data';
import { createInitialState, deserialize, type GameState } from './state';
import { isLocation, type LocationId } from './locations';

/**
 * The café chain: once the whole building is open, the owner can hand the café over
 * and start a new branch from scratch. Each branch earns chain stars by what it made;
 * stars raise every price in every later branch.
 */
export interface ChainState {
  stars: number;
  /** Branches opened after the first café. */
  branches: number;
  /** Lifetime earnings when this branch opened; the branch is judged on what came after. */
  baseEarned: number;
  /** Where the current café stands. */
  location: LocationId;
}

/** Earnings for the first star. Stars grow with the square root of a branch's earnings. */
export const STAR_EARNINGS = 50_000;

export const emptyChain = (): ChainState => ({ stars: 0, branches: 0, baseEarned: 0, location: 'town' });

export function parseChain(value: unknown): ChainState {
  const base = emptyChain();
  if (!value || typeof value !== 'object') return base;
  const c = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  base.stars = count(c.stars);
  base.branches = count(c.branches);
  base.baseEarned = typeof c.baseEarned === 'number' && Number.isFinite(c.baseEarned) && c.baseEarned >= 0 ? c.baseEarned : 0;
  if (isLocation(c.location)) base.location = c.location;
  return base;
}

/** What this branch has earned since it opened. */
export const branchEarnings = (state: GameState) => Math.max(0, state.totalEarned - state.chain.baseEarned);

/** Stars a new branch would bring now. */
export const starsOnBranch = (state: GameState) => Math.floor(Math.sqrt(branchEarnings(state) / STAR_EARNINGS));

/** A new branch opens once every room of this one is open. */
export const branchUnlocked = (state: GameState) => state.regions.includes('terrace');

export const canOpenBranch = (state: GameState) =>
  branchUnlocked(state) && state.phase === 'prep' && starsOnBranch(state) > 0;

export const chainBonusPercent = (stars: number) => Math.round(stars * CHAIN_STAR_BONUS * 100);

/**
 * Starts a new branch at `location`: a fresh café with the owner, the shop manager,
 * the stories so far, resident cats, custom recipes, café milestones and the day
 * count carried over.
 * The new save is read back through the normal loader, so staff slots, wishes and
 * other cross-checked state settle exactly as they would for a loaded game.
 */
export function openBranch(state: GameState, location: LocationId, now: number): GameState | null {
  if (!canOpenBranch(state) || !isLocation(location)) return null;
  const fresh = createInitialState(state.createdAt);
  const carried: GameState = {
    ...fresh,
    profile: state.profile,
    manager: state.manager,
    milestones: state.milestones,
    goal: state.goal,
    day: state.day,
    speed: state.speed,
    served: state.served,
    totalEarned: state.totalEarned,
    guestMemories: state.guestMemories,
    regularGuests: state.regularGuests,
    regularWishes: state.regularWishes,
    partners: state.partners,
    pets: state.pets,
    signatureDrinks: state.signatureDrinks,
    cafeStyle: { ...state.cafeStyle, bakeryTrialDay: undefined },
    chain: { stars: state.chain.stars + starsOnBranch(state), branches: state.chain.branches + 1, baseEarned: state.totalEarned, location },
  };
  return deserialize(JSON.stringify(carried), now);
}
