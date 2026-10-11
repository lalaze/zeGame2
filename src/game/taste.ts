import { MENU, type ItemId } from './data';
import type { GameState } from './state';

export const SKILLED_SERVINGS = 30;
export const SIGNATURE_SERVINGS = 100;
export interface TasteState {
  /** Lifetime portions actually handed to customers, never batches merely baked. */
  served: Partial<Record<ItemId, number>>;
  signature: ItemId[];
}
export type TasteTier = 'standard' | 'skilled' | 'signature';
export const tasteTier = (state: GameState, id: ItemId): TasteTier => state.taste.signature.includes(id)
  ? 'signature' : (state.taste.served[id] ?? 0) >= SKILLED_SERVINGS ? 'skilled' : 'standard';
export const tasteScore = (state: GameState, id: ItemId): number => ({ standard: 4, skilled: 4.5, signature: 5 })[tasteTier(state, id)];

/** A combo gives equal weight to each dish that was actually delivered. */
export function mealTaste(state: GameState, items: readonly ItemId[]): number {
  return items.length ? items.reduce((sum, id) => sum + tasteScore(state, id), 0) / items.length : 4;
}

export function recordServings(state: GameState, items: readonly ItemId[]): void {
  for (const id of items) state.taste.served[id] = Math.min(1_000_000_000, (state.taste.served[id] ?? 0) + 1);
}

/** A fixed recipe investment, independent of price levels and review bonuses. */
export function signatureCost(id: ItemId): number {
  return Math.max(150, Math.ceil(MENU.find((m) => m.id === id)!.basePrice * 20));
}

export type ResearchBlock = 'locked' | 'owned' | 'experience' | 'open' | 'coins' | null;
export function researchBlock(state: GameState, id: ItemId): ResearchBlock {
  if (state.items[id] <= 0) return 'locked';
  if (state.taste.signature.includes(id)) return 'owned';
  if ((state.taste.served[id] ?? 0) < SIGNATURE_SERVINGS) return 'experience';
  if (state.phase !== 'prep') return 'open';
  if (state.coins < signatureCost(id)) return 'coins';
  return null;
}

export function researchSignature(state: GameState, id: ItemId): boolean {
  if (researchBlock(state, id)) return false;
  state.coins -= signatureCost(id);
  state.taste.signature.push(id);
  return true;
}

export function parseTaste(value: unknown, legacySales: Partial<Record<ItemId, number>>): TasteState {
  const valid = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const source = valid(value) ? value : {};
  const served = valid(source.served) ? source.served : legacySales;
  const out: TasteState = { served: {}, signature: [] };
  for (const m of MENU) {
    const n = served[m.id];
    if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0) out.served[m.id] = Math.min(1_000_000_000, n);
    if (Array.isArray(source.signature) && source.signature.includes(m.id) && (out.served[m.id] ?? 0) >= SIGNATURE_SERVINGS) out.signature.push(m.id);
  }
  return out;
}
