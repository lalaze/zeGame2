import type { GeneratedSourceTextures } from './generated-character-sources';
import { GENERATED_DECOR_CATALOG, GENERATED_DECOR_SOURCE_IDS, generatedDecorKey } from './generated-decor-art';
import { generatedFurnitureKey } from './generated-furniture-art';
import { generatedMainEnvironmentKey } from './generated-main-environment-art';
import { generatedTablewareKey } from './generated-tableware-art';
import { getGeneratedMainEnvironmentAdapter, getGeneratedTablewareAdapter } from './generated-main-art';
import { generatedMainKey, generatedMainSource, getGeneratedDecorAdapter, getGeneratedFurnitureAdapter,
  getGeneratedIngredientAdapter, removeGeneratedMainSource, type GeneratedMainId } from './generated-main-art';

/**
 * Call after publishing the baked ingredient, furniture and decor adapters.
 * Only complete identities release their catalog sources; failed identities
 * retain their originals for fallback/retry. Decor readyIds is atomic across
 * both counter halves and their thumbnail.
 *
 * Food still has direct source consumers. Food, original room/service/actor
 * keys and canvas-* baked textures must never be released by this helper.
 * Returns the number of source IDs released from either cache; repeats are safe.
 */
export function releaseGeneratedStaticSources(textures: GeneratedSourceTextures): number {
  const ingredient = getGeneratedIngredientAdapter();
  const furniture = getGeneratedFurnitureAdapter();
  const decor = getGeneratedDecorAdapter();
  const environment = getGeneratedMainEnvironmentAdapter();
  const tableware = getGeneratedTablewareAdapter();
  let released = 0;
  const release = (ids: readonly GeneratedMainId[], isCurrent: () => boolean) => {
    for (const id of ids) {
      // Texture destruction can notify listeners. A replacement adapter/load
      // must not have its new sources removed by this earlier snapshot.
      if (!isCurrent()) return;
      const key = generatedMainKey(id), source = generatedMainSource(id);
      const uploaded = textures.exists(key);
      if (!isCurrent()) return;
      // Retain registry ownership if GPU/source destruction throws, so that
      // a later call can retry this source and continue the remaining pack.
      if (uploaded) textures.remove(key);
      const removed = isCurrent() && generatedMainSource(id) === source && removeGeneratedMainSource(id);
      if (uploaded || removed) released++;
    }
  };
  if (ingredient?.ready) release(ingredient.readyIds.map(id => `ingredient-${id}` as GeneratedMainId),
    () => getGeneratedIngredientAdapter() === ingredient);
  if (furniture?.ready) release(furniture.readyIds.map(generatedFurnitureKey),
    () => getGeneratedFurnitureAdapter() === furniture);
  if (decor?.ready) {
    const ready = new Set(decor.readyIds);
    release(GENERATED_DECOR_SOURCE_IDS.filter(id => ready.has(GENERATED_DECOR_CATALOG[id].id)).map(generatedDecorKey),
      () => getGeneratedDecorAdapter() === decor);
  }
  if (environment?.ready) release(environment.readyIds.map(generatedMainEnvironmentKey),
    () => getGeneratedMainEnvironmentAdapter() === environment);
  if (tableware?.ready) release(tableware.readyIds.map(generatedTablewareKey),
    () => getGeneratedTablewareAdapter() === tableware);
  return released;
}
