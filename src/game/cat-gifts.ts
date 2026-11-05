import { PERK_GIFT_SHARE, hasPerk } from './chain-bonuses';
import { earn } from './economy';
import { awayHourly } from './manager';
import type { CatId } from './pets';
import type { GameState } from './state';

/**
 * Cat gifts: every few real hours, on screen or away, one of the café's resident cats
 * leaves a little something on a windowsill. Gifts wait there to be tapped, which pays a
 * bit of money and files the find in the treasure box. A café without cats gets none.
 */
export type GiftKind = 'leaf' | 'yarn' | 'feather' | 'ribbon' | 'acorn' | 'coin';
export const GIFT_KINDS: readonly GiftKind[] = ['leaf', 'yarn', 'feather', 'ribbon', 'acorn', 'coin'];
export const isGiftKind = (v: unknown): v is GiftKind => GIFT_KINDS.some((k) => k === v);

/** A cat brings a gift this often (less with the windowsill perk). */
export const GIFT_INTERVAL_MS = 4 * 3_600_000;
export const giftInterval = (state: Pick<GameState, 'chain'>) => GIFT_INTERVAL_MS * (hasPerk(state, 'cats') ? PERK_GIFT_SHARE : 1);
/**
 * Windowsill spots in the main café, clear of where cats sit (x 26, 48 and 284) and of the
 * top-right buttons; once they're all taken, cats wait until one is cleared.
 */
export const GIFT_SPOTS: readonly { x: number; y: number }[] = [{ x: 37, y: 53 }, { x: 64, y: 53 }, { x: 258, y: 53 }];
/** Hours of away pay a gift is worth; the shiny coin is the rare one. */
export const GIFT_HOURS = 0.25;
export const COIN_HOURS = 1;
export const COIN_CHANCE = 0.1;
/** Even a brand-new café's cat brings something worth picking up. */
export const GIFT_MIN = 20;

export interface CatGift {
  id: number;
  cat: CatId;
  kind: GiftKind;
  /** Index into GIFT_SPOTS. */
  spot: number;
}

export interface CatGiftState {
  waiting: CatGift[];
  /** When the next gift is due (ms since epoch). */
  next: number;
  /** Gifts brought so far; also seeds what the next one is. */
  brought: number;
  /** How many of each kind have been picked up. */
  found: Partial<Record<GiftKind, number>>;
}

export const emptyCatGifts = (now: number): CatGiftState => ({ waiting: [], next: now + GIFT_INTERVAL_MS, brought: 0, found: {} });

export function parseCatGifts(value: unknown, now: number, cats: readonly CatId[]): CatGiftState {
  const base = emptyCatGifts(now);
  if (!value || typeof value !== 'object') return base;
  const g = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  base.brought = count(g.brought);
  // A clock set back can't push the next gift further than one interval away.
  if (typeof g.next === 'number' && Number.isFinite(g.next)) base.next = Math.min(g.next, now + GIFT_INTERVAL_MS);
  if (g.found && typeof g.found === 'object') {
    for (const kind of GIFT_KINDS) {
      const n = count((g.found as Record<string, unknown>)[kind]);
      if (n > 0) base.found[kind] = n;
    }
  }
  if (Array.isArray(g.waiting)) {
    const spots = new Set<number>();
    for (const raw of g.waiting as Record<string, unknown>[]) {
      if (!raw || !isGiftKind(raw.kind) || typeof raw.cat !== 'string' || !cats.includes(raw.cat as CatId)) continue;
      const spot = count(raw.spot);
      if (spot >= GIFT_SPOTS.length || spots.has(spot)) continue;
      spots.add(spot);
      base.waiting.push({ id: count(raw.id), cat: raw.cat as CatId, kind: raw.kind, spot });
    }
  }
  return base;
}

/** A repeatable number in [0, 1) for the café's nth gift, so reloading never changes it. */
function roll(createdAt: number, n: number, salt: number): number {
  let h = (Math.floor(createdAt) ^ Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/**
 * Brings every gift that has come due. Cats only bring gifts while there's room on the
 * sills; time that passes without room (or without a cat) is not saved up for later.
 */
export function bringGifts(state: GameState, now: number): CatGift[] {
  const gifts = state.catGifts, cats = state.pets.map((p) => p.id);
  const brought: CatGift[] = [];
  const interval = giftInterval(state);
  if (!cats.length) {
    if (now >= gifts.next) gifts.next = now + interval;
    return brought;
  }
  while (now >= gifts.next) {
    const free = GIFT_SPOTS.findIndex((_, i) => !gifts.waiting.some((g) => g.spot === i));
    if (free < 0) {
      // Full sills: the next gift comes one interval after a spot could next be free.
      gifts.next = now + interval;
      break;
    }
    const n = gifts.brought++;
    const cat = cats[Math.floor(roll(state.createdAt, n, 1) * cats.length)];
    const kind: GiftKind = roll(state.createdAt, n, 2) < COIN_CHANCE ? 'coin'
      : GIFT_KINDS[Math.floor(roll(state.createdAt, n, 3) * (GIFT_KINDS.length - 1))];
    const gift = { id: n, cat, kind, spot: free };
    gifts.waiting.push(gift);
    brought.push(gift);
    gifts.next += interval;
  }
  return brought;
}

/** What picking up a gift pays now. */
export const giftValue = (state: GameState, kind: GiftKind) =>
  Math.max(GIFT_MIN, Math.round(awayHourly(state) * (kind === 'coin' ? COIN_HOURS : GIFT_HOURS)));

/** Picks a gift up: pays for it and files it in the treasure box. */
export function collectGift(state: GameState, id: number): { gift: CatGift; amount: number; first: boolean } | null {
  const index = state.catGifts.waiting.findIndex((g) => g.id === id);
  if (index < 0) return null;
  const [gift] = state.catGifts.waiting.splice(index, 1);
  const amount = giftValue(state, gift.kind);
  earn(state, amount);
  const first = !state.catGifts.found[gift.kind];
  state.catGifts.found[gift.kind] = (state.catGifts.found[gift.kind] ?? 0) + 1;
  return { gift, amount, first };
}

/** Kinds found at least once, for the treasure box. */
export const giftKindsFound = (state: GameState) => GIFT_KINDS.filter((k) => (state.catGifts.found[k] ?? 0) > 0).length;
