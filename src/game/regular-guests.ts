import { isDrink, MENU, type ItemId } from './data';
import { readyServings } from './economy';
import { REGULAR_GUESTS } from './regular-guests-content';
import type { GameState } from './state';

const MAX_COUNT = 1_000_000_000;
/** More than the maximum number of simultaneously saved customer visits. */
const RECENT_SERVICES = 160;

export interface RegularGuestProgress {
  firstMetDay: number;
  /** Successful customer handoffs, rather than orders placed or portions prepared. */
  served: number;
  /** Zero-based chapter indexes. Reading never gates the next chapter. */
  unlockedChapters: number[];
  readChapters: number[];
  lastUnlockDay: number | null;
  servedVisitIds: number[];
  /** Issued visits still awaiting a handoff. Failed/exiting visits are removed. */
  pendingVisitIds: number[];
  pendingDay: number;
}

export interface RegularGuestState {
  guests: Partial<Record<string, RegularGuestProgress>>;
  /** Saved independently of Sim's customer ids, which can restart after a refresh. */
  nextVisitId: number;
}

export const emptyRegularGuests = (): RegularGuestState => ({ guests: {}, nextVisitId: 1 });
export const regularGuestDefinition = (id: string) => REGULAR_GUESTS.find((guest) => guest.id === id);
export const regularGuestForAppearance = (appearanceId: number | undefined, day: number) =>
  REGULAR_GUESTS.find((guest) => guest.appearanceId === appearanceId && day >= guest.debutDay);
export const regularGuestProgress = (state: GameState, id: string): RegularGuestProgress | undefined =>
  regularGuestDefinition(id) ? state.regularGuests.guests[id] : undefined;

export function regularGuestChapterRequirement(id: string, index: number): { day: number; served: number } | null {
  const guest = regularGuestDefinition(id);
  return guest && Number.isInteger(index) && index >= 0 && index < guest.chapters.length
    ? { day: guest.debutDay + index * 2, served: index + 1 } : null;
}

/** Encountered at the door, even when the visit later ends without a sale. */
export function recordRegularGuestArrival(state: GameState, id: string): number | null {
  const guest = regularGuestDefinition(id);
  if (!guest || state.day < guest.debutDay || state.phase !== 'open' || state.regularGuests.nextVisitId >= Number.MAX_SAFE_INTEGER) return null;
  state.regularGuests.guests[id] ??= {
    firstMetDay: state.day, served: 0, unlockedChapters: [], readChapters: [],
    lastUnlockDay: null, servedVisitIds: [], pendingVisitIds: [], pendingDay: state.day,
  };
  const progress = state.regularGuests.guests[id]!;
  if (progress.pendingDay !== state.day) progress.pendingVisitIds = [];
  progress.pendingDay = state.day;
  const visitId = state.regularGuests.nextVisitId++;
  progress.pendingVisitIds.push(visitId);
  return visitId;
}

/** Called only at the existing, successful payment/handoff point. No economic effects. */
export function recordRegularGuestService(state: GameState, id: string, visitId: number): number | null {
  const progress = regularGuestProgress(state, id);
  const guest = regularGuestDefinition(id);
  if (!progress || !guest || state.day < guest.debutDay || state.phase === 'prep' ||
    !Number.isSafeInteger(visitId) || visitId < 1 || visitId >= state.regularGuests.nextVisitId ||
    progress.pendingDay !== state.day || !progress.pendingVisitIds.includes(visitId) || progress.servedVisitIds.includes(visitId)) return null;
  progress.pendingVisitIds = progress.pendingVisitIds.filter((id) => id !== visitId);
  progress.servedVisitIds.push(visitId);
  progress.servedVisitIds.sort((a, b) => a - b);
  if (progress.servedVisitIds.length > RECENT_SERVICES) {
    progress.servedVisitIds.shift();
  }
  progress.served = Math.min(MAX_COUNT, progress.served + 1);
  const index = progress.unlockedChapters.length;
  const requirement = regularGuestChapterRequirement(id, index);
  if (!requirement || progress.lastUnlockDay === state.day || progress.served < requirement.served || state.day < requirement.day) return null;
  progress.unlockedChapters.push(index);
  progress.lastUnlockDay = state.day;
  return index;
}

/** An abandoned visit does not grant service credit, including after a refresh. */
export function recordRegularGuestDeparture(state: GameState, id: string, visitId: number): void {
  const progress = regularGuestProgress(state, id);
  if (progress) progress.pendingVisitIds = progress.pendingVisitIds.filter((pending) => pending !== visitId);
}

/** The journal explicitly marks a completed read; opening or skipping changes nothing. */
export function markRegularGuestChapterRead(state: GameState, id: string, index: number): boolean {
  const progress = regularGuestProgress(state, id);
  if (!progress?.unlockedChapters.includes(index) || progress.readChapters.includes(index)) return false;
  progress.readChapters.push(index);
  progress.readChapters.sort((a, b) => a - b);
  return true;
}

export function regularGuestUnreadCount(state: GameState, id?: string): number {
  const guests = id === undefined ? REGULAR_GUESTS : REGULAR_GUESTS.filter((guest) => guest.id === id);
  return guests.reduce((total, guest) => {
    const progress = regularGuestProgress(state, guest.id);
    return total + (progress?.unlockedChapters.filter((index) => !progress.readChapters.includes(index)).length ?? 0);
  }, 0);
}

/** Replace only a drink slot; preserve whether the original order was a combo and consume no RNG. */
export function regularGuestOrder(state: GameState, id: string | undefined, order: ItemId, extra: ItemId | null): { order: ItemId; extra: ItemId | null } {
  const guest = id ? regularGuestDefinition(id) : undefined;
  if (!guest || state.day < guest.debutDay || state.items[guest.preferredDrink] <= 0 ||
    !state.onMenu.includes(guest.preferredDrink) || readyServings(state, guest.preferredDrink) < 1) return { order, extra };
  const drink = MENU.find((item) => item.id === guest.preferredDrink);
  if (!drink || !isDrink(drink.category)) return { order, extra };
  const original = MENU.find((item) => item.id === order)!;
  if (isDrink(original.category)) return { order: guest.preferredDrink, extra };
  return { order, extra: extra === null ? null : guest.preferredDrink };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;

/** Read only saved evidence. Missing old-save data never invents encounters or chapters. */
export function parseRegularGuests(value: unknown, day = 1): RegularGuestState {
  const out = emptyRegularGuests();
  if (!object(value)) return out;
  if (integer(value.nextVisitId, 1)) out.nextVisitId = value.nextVisitId;
  if (!object(value.guests)) return out;
  for (const guest of REGULAR_GUESTS) {
    const source = value.guests[guest.id];
    if (!object(source) || !integer(source.firstMetDay, guest.debutDay) || source.firstMetDay > day) continue;
    const served = integer(source.served) ? Math.min(MAX_COUNT, source.served) : 0;
    const unlockedChapters: number[] = [];
    if (Array.isArray(source.unlockedChapters)) {
      for (let index = 0; index < guest.chapters.length; index++) {
        const requirement = regularGuestChapterRequirement(guest.id, index)!;
        if (!source.unlockedChapters.includes(index) || served < requirement.served || day < requirement.day || day < source.firstMetDay + index) break;
        unlockedChapters.push(index);
      }
    }
    // A malformed timestamp must not let loading unlock a second chapter that day.
    const earliestUnlockDay = Math.max(guest.debutDay + (unlockedChapters.length - 1) * 2, source.firstMetDay + unlockedChapters.length - 1);
    const lastUnlockDay = unlockedChapters.length === 0 ? null
      : integer(source.lastUnlockDay, earliestUnlockDay) && source.lastUnlockDay <= day ? source.lastUnlockDay : day;
    const servedVisitIds = Array.isArray(source.servedVisitIds)
      ? [...new Set(source.servedVisitIds.filter((id): id is number => integer(id, 1) && id < out.nextVisitId))].sort((a, b) => a - b)
      : [];
    out.guests[guest.id] = {
      firstMetDay: source.firstMetDay, served, unlockedChapters,
      readChapters: unlockedChapters.filter((index) => Array.isArray(source.readChapters) && source.readChapters.includes(index)),
      lastUnlockDay, servedVisitIds: servedVisitIds.slice(-RECENT_SERVICES),
      pendingDay: integer(source.pendingDay, source.firstMetDay) && source.pendingDay <= day ? source.pendingDay : day,
      pendingVisitIds: source.pendingDay === day && Array.isArray(source.pendingVisitIds)
        ? [...new Set(source.pendingVisitIds.filter((id): id is number => integer(id, 1) && id < out.nextVisitId && !servedVisitIds.includes(id)))].slice(-150)
        : [],
    };
  }
  const issued = new Set<number>();
  for (const progress of Object.values(out.guests)) if (progress) {
    progress.pendingVisitIds = progress.pendingVisitIds.filter((id) => {
      if (issued.has(id)) return false;
      issued.add(id);
      return true;
    });
  }
  return out;
}
