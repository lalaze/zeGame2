import { MENU, type ItemId } from './data';
import { signatureDefinition } from './signature-drinks';
import type { GameState } from './state';

export const SKILLED_SERVINGS = 30;
export const SIGNATURE_SERVINGS = 100;
export interface TasteState {
  /** Lifetime portions actually handed to customers, never batches merely baked. */
  served: Partial<Record<ItemId, number>>;
  signature: ItemId[];
}
export type TasteTier = 'standard' | 'skilled' | 'signature';
export const tasteTier = (state: GameState, id: ItemId): TasteTier => {
  if (signatureDefinition(id)) {
    const served = state.signatureDrinks.served[id] ?? 0;
    return served >= SIGNATURE_SERVINGS ? 'signature' : served >= SKILLED_SERVINGS ? 'skilled' : 'standard';
  }
  return state.taste.signature.includes(id) ? 'signature'
    : (state.taste.served[id] ?? 0) >= SKILLED_SERVINGS ? 'skilled' : 'standard';
};
export const tasteScore = (state: GameState, id: ItemId): number => {
  const tier = tasteTier(state, id);
  const custom = signatureDefinition(id);
  const foundation = custom?.base === 'coffee' ? 'espresso' : 'blacktea';
  const inherited = custom ? { standard: 4, skilled: 4.5, signature: 5 }[tasteTier(state, foundation)] + custom.quality - 4 : 0;
  return custom ? Math.min(5, Math.round((Math.max(custom.quality, inherited) + { standard: 0, skilled: 0.3, signature: 0.5 }[tier]) * 10) / 10)
    : ({ standard: 4, skilled: 4.5, signature: 5 })[tier];
};

/** A combo gives equal weight to each dish that was actually delivered. */
export function mealTaste(state: GameState, items: readonly ItemId[]): number {
  return items.length ? items.reduce((sum, id) => sum + tasteScore(state, id), 0) / items.length : 4;
}

export function recordServings(state: GameState, items: readonly ItemId[]): void {
  for (const id of items) {
    if (signatureDefinition(id)) {
      const served = Math.min(1_000_000_000, (state.signatureDrinks.served[id] ?? 0) + 1);
      state.signatureDrinks.served[id] = served;
      state.taste.served[id] = served;
    } else if (MENU.some((m) => m.id === id)) {
      state.taste.served[id] = Math.min(1_000_000_000, (state.taste.served[id] ?? 0) + 1);
    }
  }
}

/** A fixed recipe investment, independent of price levels and review bonuses. */
export function signatureCost(id: ItemId): number {
  const definition = MENU.find((m) => m.id === id);
  return definition ? Math.max(150, Math.ceil(definition.basePrice * 20)) : 0;
}

export type ResearchBlock = 'locked' | 'owned' | 'experience' | 'open' | 'coins' | null;
export function researchBlock(state: GameState, id: ItemId): ResearchBlock {
  // Custom drinks practice automatically and cannot buy legacy research.
  if (signatureDefinition(id)) return tasteTier(state, id) === 'signature' ? 'owned' : 'experience';
  if (!MENU.some((m) => m.id === id) || !(state.items[id] > 0)) return 'locked';
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
  const served: Record<string, unknown> = valid(source.served) ? source.served : legacySales;
  const out: TasteState = { served: {}, signature: [] };
  for (const m of MENU) {
    const n = served[m.id];
    if (typeof n === 'number' && Number.isSafeInteger(n) && n > 0) out.served[m.id] = Math.min(1_000_000_000, n);
    if (Array.isArray(source.signature) && source.signature.includes(m.id) && (out.served[m.id] ?? 0) >= SIGNATURE_SERVINGS) out.signature.push(m.id);
  }
  return out;
}
