import { DAY_SECONDS } from './data';
import { openShop } from './day';
import { bakeForForecast, dayDemand, earn, hasServiceSupply, menuItems, restock, salePrice, servingCost } from './economy';
import type { GameState } from './state';

/**
 * The shop manager: a mid-game hire who runs ordinary days on their own and keeps
 * the café earning while the player is away. Without one, nothing runs without you.
 */
export interface ManagerState {
  hired: boolean;
  /** Whether the manager prepares and opens each day while the player watches. */
  auto: boolean;
  /** When the player was last looking at the café (ms since epoch); away time starts here. */
  lastSeen: number;
}

export const MANAGER_COST = 2_500;
/**
 * Away, the manager runs this many ordinary days per real hour (a day takes three
 * minutes at 1× on screen). Scripted fresh cafés reinvest about a day's profit a day
 * while it grows 10–15% daily, so a full night away is worth roughly six days of
 * progress: welcome, without replacing play or the on-screen auto days.
 */
export const AWAY_DAYS_PER_HOUR = 1;
/** Time beyond this is not paid; come back to keep the café growing. */
export const AWAY_CAP_SECONDS = 8 * 60 * 60;
/** Shorter absences (a tab switch, a reload) earn nothing and show nothing. */
export const AWAY_MIN_SECONDS = 60;

export const emptyManager = (now: number): ManagerState => ({ hired: false, auto: true, lastSeen: now });

export function parseManager(value: unknown, now: number): ManagerState {
  const base = emptyManager(now);
  if (!value || typeof value !== 'object') return base;
  const m = value as Record<string, unknown>;
  base.hired = m.hired === true;
  base.auto = m.auto !== false;
  // A clock set back later must not pay twice, so a future timestamp counts from now.
  if (typeof m.lastSeen === 'number' && Number.isFinite(m.lastSeen) && m.lastSeen > 0) base.lastSeen = Math.min(m.lastSeen, now);
  return base;
}

/** The manager can be hired once the café has grown into its first extra room. */
export const managerUnlocked = (state: GameState) => state.regions.length > 0;

export function hireManager(state: GameState): boolean {
  if (state.manager.hired || !managerUnlocked(state) || state.coins < MANAGER_COST) return false;
  state.coins -= MANAGER_COST;
  state.manager.hired = true;
  state.manager.auto = true;
  return true;
}

export const managerRunsDays = (state: GameState) => state.manager.hired && state.manager.auto;

/** What a full ordinary day on today's menu is expected to earn, after ingredients. */
export function expectedDayProfit(state: GameState): number {
  let profit = 0;
  for (const [id, servings] of dayDemand(state)) profit += servings * (salePrice(state, id) - servingCost(id));
  return Math.max(0, profit);
}

/** What an hour away earns with the current menu. */
export const awayHourly = (state: GameState) => expectedDayProfit(state) * AWAY_DAYS_PER_HOUR;

export interface AwayEarnings {
  /** Paid seconds away, after the cap. */
  seconds: number;
  /** Whether the absence was longer than the cap. */
  capped: boolean;
  amount: number;
}

/** What the manager earned between the last time the player looked and now. */
export function awayEarnings(state: GameState, now: number): AwayEarnings {
  const away = Math.max(0, (now - state.manager.lastSeen) / 1000);
  if (!state.manager.hired || away < AWAY_MIN_SECONDS) return { seconds: 0, capped: false, amount: 0 };
  const seconds = Math.min(away, AWAY_CAP_SECONDS);
  const amount = Math.floor(awayHourly(state) * seconds / 3600);
  return { seconds, capped: away > AWAY_CAP_SECONDS, amount };
}

/** Pays the away earnings and restarts the away clock. */
export function collectAwayEarnings(state: GameState, now: number): AwayEarnings {
  const result = awayEarnings(state, now);
  if (result.amount > 0) earn(state, result.amount);
  state.manager.lastSeen = now;
  return result;
}

export type AutoOpen = { ok: true; baked: number } | { ok: false; reason: 'emptyMenu' | 'noSupply' };

/**
 * The manager's morning: bake for the forecast, stock what the budget allows, then
 * open. Refuses to open a day that could not sell anything, so an empty pantry can't
 * spin through days.
 */
export function managerOpen(state: GameState): AutoOpen {
  if (state.phase !== 'prep' || menuItems(state).length === 0) return { ok: false, reason: 'emptyMenu' };
  bakeForForecast(state);
  restock(state);
  if (!hasServiceSupply(state)) return { ok: false, reason: 'noSupply' };
  return { ok: true, baked: openShop(state) };
}

/** Sold out during the day: restock and keep serving if that brings anything back. */
export function managerRestock(state: GameState): boolean {
  if (state.dayTime >= DAY_SECONDS) return false;
  return restock(state) && hasServiceSupply(state);
}
