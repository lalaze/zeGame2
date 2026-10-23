import { isDrink, MENU, type ItemId } from './data';
import { itemFlavors } from './flavors';
import { signatureDefinition } from './signature-drinks';
import type { GameState } from './state';

export type MinaWishChoice = 'quiet' | 'milky';
export interface MinaWish {
  choice: MinaWishChoice;
  acceptedDay: number;
  paused: boolean;
  rehearsedDay: number | null;
  completedDay: number | null;
  displayed: boolean;
}
export interface RegularWishState { mina: MinaWish | null }
export interface WishHandoff { seat: number; items: readonly ItemId[] }
export const emptyRegularWishes = (): RegularWishState => ({ mina: null });
export const minaWish = (s: GameState) => s.regularWishes?.mina ?? null;
export const minaWishAvailable = (s: GameState) => (s.regularGuests.guests.mina?.served ?? 0) > 0;
export const isMinaWishChoice = (v: unknown): v is MinaWishChoice => v === 'quiet' || v === 'milky';

/** An optional arrangement, edited only between days. No purchases or menu edits. */
export function chooseMinaWish(s: GameState, choice: MinaWishChoice): boolean {
  if (s.phase !== 'prep' || !minaWishAvailable(s) || !isMinaWishChoice(choice)) return false;
  const previous = minaWish(s);
  if (previous && previous.rehearsedDay !== null) return false;
  if (previous?.choice === choice && !previous.paused) return false;
  s.regularWishes.mina = {
    choice, acceptedDay: previous?.acceptedDay ?? s.day, paused: false,
    rehearsedDay: null, completedDay: null, displayed: false,
  };
  return true;
}

export function setMinaWishPaused(s: GameState, paused: boolean): boolean {
  const wish = minaWish(s);
  if (s.phase !== 'prep' || !wish || wish.rehearsedDay !== null || wish.paused === paused) return false;
  wish.paused = paused;
  return true;
}

/** Table 1 is an existing starter table. Both chairs stay free until her handoff. */
export function minaReservedTable(s: GameState): number | null {
  const wish = minaWish(s);
  return wish?.choice === 'quiet' && !wish.paused && wish.rehearsedDay === null ? 0 : null;
}

export function isMinaWishDrink(id: ItemId): boolean {
  const item = MENU.find(item => item.id === id) ?? signatureDefinition(id);
  return !!item && isDrink(item.category) && itemFlavors(id).includes('milky');
}

/** Called inside the validated, once-only regular-guest handoff transaction. */
export function recordMinaWishHandoff(s: GameState, handoff: WishHandoff): void {
  const wish = minaWish(s);
  if (!wish || wish.paused || wish.completedDay !== null || s.phase === 'prep' || !handoff.items.length) return;
  if (wish.rehearsedDay === null) {
    const ready = wish.choice === 'quiet'
      ? handoff.seat >= 0 && Math.floor(handoff.seat / 2) === minaReservedTable(s)
      : handoff.items.some(isMinaWishDrink);
    if (ready) wish.rehearsedDay = s.day;
  } else if (s.day > wish.rehearsedDay) {
    // A later successful visit, not another order on the rehearsal day.
    wish.completedDay = s.day;
    wish.displayed = true;
  }
}

export function displayMinaMap(s: GameState, displayed: boolean): boolean {
  const wish = minaWish(s);
  if (!wish || wish.completedDay === null || wish.displayed === displayed) return false;
  wish.displayed = displayed;
  return true;
}

export const minaMapChoice = (s: GameState): MinaWishChoice | null => {
  const wish = minaWish(s);
  return wish && wish.completedDay !== null && wish.displayed ? wish.choice : null;
};

/** Loading never invents a wish or advances it from historical sales. */
export function parseRegularWishes(raw: unknown, s: GameState): RegularWishState {
  const out = emptyRegularWishes();
  if (!raw || typeof raw !== 'object' || !minaWishAvailable(s)) return out;
  const value = (raw as { mina?: unknown }).mina;
  if (!value || typeof value !== 'object') return out;
  const v = value as Record<string, unknown>;
  const day = (value: unknown, min: number): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= s.day;
  if (!isMinaWishChoice(v.choice) || !day(v.acceptedDay, s.regularGuests.guests.mina!.firstMetDay)) return out;
  const served = s.regularGuests.guests.mina!.served;
  const rehearsedDay = served >= 2 && day(v.rehearsedDay, v.acceptedDay) ? v.rehearsedDay : null;
  const completedDay = rehearsedDay !== null && served >= 3 && day(v.completedDay, rehearsedDay + 1) ? v.completedDay : null;
  out.mina = {
    choice: v.choice, acceptedDay: v.acceptedDay,
    paused: rehearsedDay === null && v.paused === true,
    rehearsedDay, completedDay, displayed: completedDay !== null && v.displayed === true,
  };
  return out;
}
