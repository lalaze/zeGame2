import { INGREDIENTS, type IngredientId } from '../game/data';
import { createGeneratedMenuBitmapArt, GENERATED_FOOD_DENSITY, GENERATED_FOOD_UI_DENSITY,
  type GeneratedFoodOptions } from './generated-food-art';

/** Pantry identities are separate from drinks, including their shared `matcha` name. */
export const GENERATED_INGREDIENT_IDS: readonly IngredientId[] = Object.freeze(INGREDIENTS.map(item => item.id));
export type GeneratedIngredientId = IngredientId;
export type GeneratedIngredientSources = Readonly<Partial<Record<IngredientId, CanvasImageSource>>>;
export const GENERATED_INGREDIENT_DENSITY = GENERATED_FOOD_DENSITY;
export const GENERATED_INGREDIENT_UI_DENSITY = GENERATED_FOOD_UI_DENSITY;
/** Bare envelopes from sprites.ts. The catalog's ingredient `logical` includes 1px padding. */
export const GENERATED_INGREDIENT_ENVELOPES: Readonly<Record<IngredientId, readonly [number, number]>> = Object.freeze({
  beans: [12, 10], milk: [12, 10], flour: [12, 10], butter: [12, 9], eggs: [12, 9], sugar: [12, 8],
  tea: [12, 10], spice: [12, 10], cocoa: [12, 10], cream: [12, 9], fruit: [12, 10], matcha: [12, 10],
});
export interface GeneratedIngredientAdapter {
  readonly ready: boolean;
  readonly readyIds: readonly IngredientId[];
  /** Existing ingredientIcon dimensions by default; optional bare world variant. */
  icon(id: IngredientId, outline?: boolean): HTMLCanvasElement | undefined;
  /** Native 3× bitmap for pantry UI/export, with the same logical icon envelope. */
  artwork(id: IngredientId): HTMLCanvasElement | undefined;
}
export type GeneratedIngredientOptions = GeneratedFoodOptions;

/** Each complete identity is published atomically; missing/failed loads stay legacy. */
export function createGeneratedIngredientArt(sources: GeneratedIngredientSources,
  options: GeneratedIngredientOptions = {}): GeneratedIngredientAdapter {
  return createGeneratedMenuBitmapArt(GENERATED_INGREDIENT_IDS, GENERATED_INGREDIENT_ENVELOPES, sources, options);
}
