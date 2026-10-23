import { CUSTOMER_CAST } from './customer-cast';
import { isDrink, MENU, type ItemId } from './data';
import { menuItems, readyServings } from './economy';
import { guestTaste, itemFlavors } from './flavors';
import { REGULAR_GUESTS } from './regular-guests-content';
import { signatureDefinition } from './signature-drinks';
import type { Customer } from './sim';
import type { GameState } from './state';

export interface GuestMemory {
  item: ItemId;
  name?: string;
  source: 'recommend' | 'trial';
  learnedDay: number;
  lastServedDay: number;
  returns: number;
}
/** One remembered drink per ordinary cast member; named regulars keep their stories. */
export type GuestMemories = Partial<Record<number, GuestMemory>>;
export const memoryGuest = (id: number | undefined): id is number =>
  id !== undefined && Number.isInteger(id) && id >= 0 && id < CUSTOMER_CAST.length && !REGULAR_GUESTS.some(g => g.appearanceId === id);
const drink = (id: string) => {
  const def = MENU.find(m => m.id === id) ?? signatureDefinition(id);
  return !!def && isDrink(def.category);
};
function loves(id: number, item: ItemId): boolean {
  const taste = guestTaste({ appearanceId: id, look: CUSTOMER_CAST[id].look });
  const notes = itemFlavors(item);
  return notes.includes(taste.liked) && !notes.includes(taste.avoided);
}

/** No new arrival, pairing, price bonus or random draw: replace an existing drink slot. */
export function rememberedOrder(s: GameState, appearanceId: number, order: ItemId, extra: ItemId | null): { order: ItemId; extra: ItemId | null; rememberedOrder?: ItemId } {
  const memory = memoryGuest(appearanceId) ? s.guestMemories[appearanceId] : undefined;
  if (!memory || !menuItems(s).some(m => m.id === memory.item) || readyServings(s, memory.item) < 1) return { order, extra };
  if (drink(order)) return { order: memory.item, extra, rememberedOrder: memory.item };
  if (extra && drink(extra)) return { order, extra: memory.item, rememberedOrder: memory.item };
  return { order, extra };
}

/** Only the once-only payment/handoff path calls this, before clearing live order tags. */
export function recordGuestMemory(s: GameState, c: Customer, bought: readonly ItemId[], trialItem?: ItemId): void {
  if (s.phase === 'prep' || c.hasCup || c.regularGuestId || !memoryGuest(c.appearanceId)) return;
  const previous = s.guestMemories[c.appearanceId];
  if (previous && c.rememberedOrder === previous.item && bought.includes(previous.item)) {
    previous.lastServedDay = s.day;
    previous.returns = Math.min(1e9, previous.returns + 1);
  }
  const item = c.recommendation ?? trialItem;
  if (!item || !bought.includes(item) || !drink(item) || !loves(c.appearanceId, item)) return;
  // Recommending the same favorite again doesn't invent a new discovery or reset history.
  if (previous?.item === item) { previous.lastServedDay = s.day; return; }
  const name = s.signatureDrinks.recipes.find(recipe => recipe.id === item)?.name;
  s.guestMemories[c.appearanceId] = {
    item, ...(name ? { name } : {}), source: c.recommendation ? 'recommend' : 'trial',
    learnedDay: s.day, lastServedDay: s.day, returns: 0,
  };
}

/** Missing legacy fields never infer a recommendation from ordinary historical sales. */
export function parseGuestMemories(raw: unknown, day: number): GuestMemories {
  const out: GuestMemories = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const int = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
  for (const cast of CUSTOMER_CAST) {
    if (!memoryGuest(cast.id)) continue;
    const entry: unknown = (raw as Record<number, unknown>)[cast.id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const v = entry as Record<string, unknown>;
    if (typeof v.item !== 'string' || !drink(v.item) || !loves(cast.id, v.item as ItemId)
        || v.source !== 'recommend' && v.source !== 'trial' || !int(v.learnedDay, 1, day)
        || !int(v.lastServedDay, v.learnedDay, day) || !int(v.returns, 0, 1e9)) continue;
    out[cast.id] = { item: v.item as ItemId, source: v.source, learnedDay: v.learnedDay, lastServedDay: v.lastServedDay, returns: v.returns,
      ...(typeof v.name === 'string' ? { name: [...v.name.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 24).join('') } : {}),
    };
  }
  return out;
}
