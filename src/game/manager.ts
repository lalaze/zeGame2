import { PERK_AWAY_SHARE, extraTillHours, hasPerk } from './chain-bonuses';
import { DAY_SECONDS } from './data';
import { openShop } from './day';
import { bakeForForecast, dayDemand, earn, hasServiceSupply, menuItems, restock, salePrice, servingCost } from './economy';
import type { GameState } from './state';

/**
 * The shop manager: an early hire who runs ordinary days on their own and keeps the
 * café earning while the player is away. Without one, nothing runs without you.
 *
 * Away pay goes into the till, which holds a limited number of hours: a small till
 * early on brings players back often, and each bigger till buys longer absences.
 */
export interface ManagerState {
  hired: boolean;
  /** Whether the manager prepares and opens each day while the player watches. */
  auto: boolean;
  /** When the player was last looking at the café (ms since epoch); away time starts here. */
  lastSeen: number;
  /** Till level, an index into TILL_HOURS (save v24). */
  till: number;
  /** Whether the first real absence has been paid, with its welcome-back minimum (save v24). */
  welcomed: boolean;
}

export const MANAGER_COST = 300;
/** The manager can be hired from this day on: by the end of a first sitting. */
export const MANAGER_UNLOCK_DAY = 3;
/**
 * Away, the manager runs this many ordinary days per real hour while the till has room
 * (on screen a day takes about 3⅓ minutes at 1×, so about 18 an hour). Measured in
 * docs/idle-pacing: see the README there before changing it.
 */
export const AWAY_DAYS_PER_HOUR = 5;
/** Hours of away pay the till holds at each level. */
export const TILL_HOURS = [1, 2, 4, 8, 12] as const;
/** Price of each till upgrade, from level 0 to 1 onwards. */
export const TILL_COSTS = [2_000, 10_000_000, 300_000_000, 5_000_000_000] as const;
/** Once the till is full, pay continues at this share, so a long absence never pays nothing. */
export const OVERFLOW_SHARE = 0.1;
/** ...for at most this long after the till fills. */
export const OVERFLOW_MAX_SECONDS = 24 * 60 * 60;
/** Shorter absences (a tab switch, a reload) earn nothing and show nothing. */
export const AWAY_MIN_SECONDS = 60;
/** The first absence of at least this long pays at least WELCOME_MIN: enough for the kitchen. */
export const WELCOME_MIN_SECONDS = 10 * 60;
export const WELCOME_MIN = 1_000;

export const emptyManager = (now: number): ManagerState => ({ hired: false, auto: true, lastSeen: now, till: 0, welcomed: false });

export function parseManager(value: unknown, now: number): ManagerState {
  const base = emptyManager(now);
  if (!value || typeof value !== 'object') return base;
  const m = value as Record<string, unknown>;
  base.hired = m.hired === true;
  base.auto = m.auto !== false;
  // A clock set back later must not pay twice, so a future timestamp counts from now.
  if (typeof m.lastSeen === 'number' && Number.isFinite(m.lastSeen) && m.lastSeen > 0) base.lastSeen = Math.min(m.lastSeen, now);
  if (typeof m.till === 'number' && Number.isInteger(m.till)) base.till = Math.max(0, Math.min(TILL_HOURS.length - 1, m.till));
  // Before v24 a hired manager paid up to 8 hours: keep that, and skip the welcome a returning owner already had.
  else if (base.hired) base.till = TILL_HOURS.indexOf(8);
  base.welcomed = typeof m.welcomed === 'boolean' ? m.welcomed : base.hired;
  return base;
}

/** The manager can be hired from day 3, or once the café has an extra room (older saves). */
export const managerUnlocked = (state: GameState) => state.day >= MANAGER_UNLOCK_DAY || state.regions.length > 0;

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

/** What an hour away earns with the current menu, while the till has room. */
export const awayHourly = (state: GameState) => expectedDayProfit(state) * AWAY_DAYS_PER_HOUR * (hasPerk(state, 'manager') ? PERK_AWAY_SHARE : 1);

/** Seconds of away pay the till holds now. */
export const tillSeconds = (state: Pick<GameState, 'manager' | 'chain'>) =>
  (TILL_HOURS[Math.max(0, Math.min(TILL_HOURS.length - 1, state.manager.till))] + extraTillHours(state)) * 3600;

/** What the next till costs, or null at the biggest. */
export const tillUpgradeCost = (state: Pick<GameState, 'manager'>): number | null => TILL_COSTS[state.manager.till] ?? null;

export function upgradeTill(state: GameState): boolean {
  const cost = tillUpgradeCost(state);
  if (!state.manager.hired || cost === null || state.coins < cost) return false;
  state.coins -= cost;
  state.manager.till++;
  return true;
}

/** Seconds of pay for `elapsed` seconds into a till holding `capacity`: full rate, then a trickle. */
export const paidSeconds = (elapsed: number, capacity: number) =>
  Math.min(elapsed, capacity) + OVERFLOW_SHARE * Math.min(Math.max(0, elapsed - capacity), OVERFLOW_MAX_SECONDS);

export interface AwayEarnings {
  /** Real seconds away. */
  seconds: number;
  /** How full the till got, from 0 to 1. */
  fill: number;
  /** Whether the till filled up, after which only a trickle came in. */
  full: boolean;
  amount: number;
  /** The part of `amount` that is the one-time welcome-back minimum. */
  welcome: number;
}

const NOTHING: AwayEarnings = { seconds: 0, fill: 0, full: false, amount: 0, welcome: 0 };

/** What the manager put in the till between the last time the player looked and now. */
export function awayEarnings(state: GameState, now: number): AwayEarnings {
  const away = Math.max(0, (now - state.manager.lastSeen) / 1000);
  if (!state.manager.hired || away < AWAY_MIN_SECONDS) return NOTHING;
  const capacity = tillSeconds(state);
  let amount = Math.floor(awayHourly(state) * paidSeconds(away, capacity) / 3600);
  let welcome = 0;
  if (!state.manager.welcomed && away >= WELCOME_MIN_SECONDS && amount < WELCOME_MIN) {
    welcome = WELCOME_MIN - amount;
    amount = WELCOME_MIN;
  }
  return { seconds: away, fill: Math.min(1, away / capacity), full: away >= capacity, amount, welcome };
}

/** Empties the till and restarts the away clock. */
export function collectAwayEarnings(state: GameState, now: number): AwayEarnings {
  const result = awayEarnings(state, now);
  if (result.amount > 0) earn(state, result.amount);
  if (result.seconds >= WELCOME_MIN_SECONDS) state.manager.welcomed = true;
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
