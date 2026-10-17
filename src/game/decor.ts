// Room styles: each slot holds one item (wallpaper, floor, counter, ...).
// Furniture and props that go anywhere are in furniture.ts.
import { furnitureComfort, furnitureDef } from './furniture';
import type { GameState } from './state';

export type DecorSlot = 'wallpaper' | 'floor' | 'counter' | 'sill' | 'ceiling' | 'rug' | 'neon' | 'tablecloth' | 'centerpiece' | 'curtain';

export const DECOR_SLOTS: readonly DecorSlot[] = ['tablecloth', 'centerpiece', 'curtain', 'wallpaper', 'floor', 'counter', 'sill', 'ceiling', 'rug', 'neon'];

export interface DecorDef {
  id: string;
  slot: DecorSlot;
  cost: number;
  /** Each comfort point adds +1% tips. Free items give none. */
  comfort: number;
}

// Free items are owned from the start. Ids double as translation keys (decor.<id>).
export const DECOR: readonly DecorDef[] = [
  { id: 'tablecloth_classic', slot: 'tablecloth', cost: 0, comfort: 0 },
  { id: 'tablecloth_mint', slot: 'tablecloth', cost: 0, comfort: 0 },
  { id: 'tablecloth_blue', slot: 'tablecloth', cost: 120, comfort: 2 },
  { id: 'tablecloth_lavender', slot: 'tablecloth', cost: 300, comfort: 3 },
  { id: 'tablecloth_linen', slot: 'tablecloth', cost: 600, comfort: 4 },

  { id: 'centerpiece_flowers', slot: 'centerpiece', cost: 0, comfort: 0 },
  { id: 'centerpiece_none', slot: 'centerpiece', cost: 0, comfort: 0 },
  { id: 'centerpiece_succulent', slot: 'centerpiece', cost: 90, comfort: 2 },
  { id: 'centerpiece_candle', slot: 'centerpiece', cost: 240, comfort: 3 },

  { id: 'curtain_classic', slot: 'curtain', cost: 0, comfort: 0 },
  { id: 'curtain_sage', slot: 'curtain', cost: 0, comfort: 0 },
  { id: 'curtain_blue', slot: 'curtain', cost: 180, comfort: 2 },
  { id: 'curtain_linen', slot: 'curtain', cost: 450, comfort: 3 },

  { id: 'wall_cream', slot: 'wallpaper', cost: 0, comfort: 0 },
  { id: 'wall_mint', slot: 'wallpaper', cost: 0, comfort: 0 },
  { id: 'wall_rose', slot: 'wallpaper', cost: 0, comfort: 0 },
  { id: 'wall_dots', slot: 'wallpaper', cost: 2_000, comfort: 6 },
  { id: 'wall_brick', slot: 'wallpaper', cost: 60_000, comfort: 14 },
  { id: 'wall_walnut', slot: 'wallpaper', cost: 3_000_000, comfort: 25 },
  { id: 'wall_stars', slot: 'wallpaper', cost: 120_000_000, comfort: 40 },

  { id: 'floor_checker', slot: 'floor', cost: 0, comfort: 0 },
  { id: 'floor_planks', slot: 'floor', cost: 0, comfort: 0 },
  { id: 'floor_mint', slot: 'floor', cost: 0, comfort: 0 },
  { id: 'floor_terrazzo', slot: 'floor', cost: 5_000, comfort: 8 },
  { id: 'floor_herringbone', slot: 'floor', cost: 200_000, comfort: 16 },
  { id: 'floor_marble', slot: 'floor', cost: 8_000_000, comfort: 28 },

  { id: 'counter_oak', slot: 'counter', cost: 0, comfort: 0 },
  { id: 'counter_walnut', slot: 'counter', cost: 1_000, comfort: 5 },
  { id: 'counter_marble', slot: 'counter', cost: 40_000, comfort: 12 },
  { id: 'counter_pink', slot: 'counter', cost: 1_500_000, comfort: 22 },
  { id: 'counter_gold', slot: 'counter', cost: 60_000_000, comfort: 35 },

  { id: 'sill_none', slot: 'sill', cost: 0, comfort: 0 },
  { id: 'sill_cactus', slot: 'sill', cost: 60, comfort: 2 },
  { id: 'sill_tulips', slot: 'sill', cost: 1_200, comfort: 6 },
  { id: 'sill_bonsai', slot: 'sill', cost: 50_000, comfort: 13 },

  { id: 'ceiling_none', slot: 'ceiling', cost: 0, comfort: 0 },
  { id: 'ceiling_lights', slot: 'ceiling', cost: 400, comfort: 5 },
  { id: 'ceiling_vines', slot: 'ceiling', cost: 10_000, comfort: 10 },
  { id: 'ceiling_pendants', slot: 'ceiling', cost: 400_000, comfort: 18 },
  { id: 'ceiling_chandelier', slot: 'ceiling', cost: 20_000_000, comfort: 30 },

  { id: 'rug_none', slot: 'rug', cost: 0, comfort: 0 },
  { id: 'rug_red', slot: 'rug', cost: 700, comfort: 5 },
  { id: 'rug_blue', slot: 'rug', cost: 20_000, comfort: 11 },
  { id: 'rug_round', slot: 'rug', cost: 800_000, comfort: 20 },

  { id: 'neon_none', slot: 'neon', cost: 0, comfort: 0 },
  { id: 'neon_cafe', slot: 'neon', cost: 8_000, comfort: 10 },
  { id: 'neon_heart', slot: 'neon', cost: 300_000, comfort: 18 },
  { id: 'neon_cup', slot: 'neon', cost: 10_000_000, comfort: 30 },
];

const BY_ID = new Map(DECOR.map((d) => [d.id, d]));
export const decorDef = (id: string) => BY_ID.get(id);
export const decorForSlot = (slot: DecorSlot) => DECOR.filter((d) => d.slot === slot);

/** Free looks offered in the opening flow; they can be swapped any time later. */
export const STARTER_THEMES: readonly { id: string; equip: Partial<Record<DecorSlot, string>> }[] = [
  { id: 'classic', equip: { wallpaper: 'wall_cream', floor: 'floor_checker', counter: 'counter_oak' } },
  { id: 'mint', equip: { wallpaper: 'wall_mint', floor: 'floor_mint', counter: 'counter_oak' } },
  { id: 'rose', equip: { wallpaper: 'wall_rose', floor: 'floor_planks', counter: 'counter_oak' } },
];

export function comfort(state: GameState): number {
  const room = DECOR_SLOTS.reduce((sum, slot) => sum + (decorDef(state.decor.equipped[slot])?.comfort ?? 0), 0);
  return room + furnitureComfort(state);
}

export const ownsDecor = (state: GameState, id: string) => state.decor.owned.includes(id);
export const hasBoughtDecor = (state: GameState) =>
  state.decor.owned.some((id) => (decorDef(id)?.cost ?? 0) > 0) ||
  [...state.decor.placed.map((p) => p.id), ...Object.keys(state.decor.stored)].some((id) => (furnitureDef(id)?.cost ?? 0) > 0);

/** Buys (if needed) and puts an item in its slot. Returns false if unaffordable. */
export function useDecor(state: GameState, id: string): boolean {
  const def = decorDef(id);
  if (!def) return false;
  if (!ownsDecor(state, id)) {
    if (state.coins < def.cost) return false;
    state.coins -= def.cost;
    state.decor.owned.push(id);
  }
  state.decor.equipped[def.slot] = id;
  return true;
}

export function applyTheme(state: GameState, themeId: string): void {
  const theme = STARTER_THEMES.find((t) => t.id === themeId) ?? STARTER_THEMES[0];
  for (const id of Object.values(theme.equip)) useDecor(state, id!);
}
