import runtimeCatalog from '../../assets/generated/runtime-catalog-v1/runtime.json';
import { preloadCozyCats, createCozyCatArt } from './cozy-cat-assets';
import cozyEnvironmentMetadata from './cozy-environment-metadata.json';
import { COZY_DECOR_CATALOG } from './cozy-materials';
import { COZY_FURNITURE_CATALOG } from './cozy-furniture-assets';
import { GENERATED_MAIN_ASSETS, installGeneratedMainAsset, generatedMainSource, setGeneratedFoodAdapter,
  setGeneratedIngredientAdapter, setGeneratedFurnitureAdapter, setGeneratedDecorAdapter,
  setGeneratedMainEnvironmentAdapter, setGeneratedTablewareAdapter, setGeneratedCatAdapter, type GeneratedMainId } from './generated-main-art';
import { createGeneratedFoodArt, GENERATED_FOOD_IDS } from './generated-food-art';
import { createGeneratedIngredientArt, GENERATED_INGREDIENT_IDS } from './generated-ingredient-art';
import { createGeneratedFurnitureArt, GENERATED_FURNITURE_IDS, generatedFurnitureKey } from './generated-furniture-art';
import { createGeneratedDecorArt, GENERATED_DECOR_SOURCE_IDS } from './generated-decor-art';
import { createGeneratedMainEnvironmentArt, GENERATED_MAIN_ENVIRONMENT_IDS, generatedMainEnvironmentKey } from './generated-main-environment-art';
import { createGeneratedTablewareArt, GENERATED_TABLEWARE_IDS, generatedTablewareKey } from './generated-tableware-art';
import { createGeneratedSignatureArt, setGeneratedSignatureAdapter, GENERATED_SIGNATURE_IDS, generatedSignatureKey } from './generated-signature-art';

/** Standalone galleries use the same sources and adapters as the production scene. */
export async function preloadArtCatalog(): Promise<void> {
  await preloadCozyCats();
  setGeneratedCatAdapter(createCozyCatArt());
  await Promise.all(Object.entries(GENERATED_MAIN_ASSETS)
    .filter(([id, file]) => !/^(barista|server|mina|customer)-/.test(id) && !file.includes('/cats/'))
    .map(async ([id, file]) => {
      const image = new Image(); image.src = `${import.meta.env.BASE_URL}art/generated/${file}`;
      await image.decode(); installGeneratedMainAsset(id as GeneratedMainId, image);
    }));
  setGeneratedFoodAdapter(createGeneratedFoodArt(Object.fromEntries(GENERATED_FOOD_IDS.map(id => [id, generatedMainSource(id)])), { rasterMetadata: runtimeCatalog.mainStaticMetadata }));
  setGeneratedIngredientAdapter(createGeneratedIngredientArt(Object.fromEntries(GENERATED_INGREDIENT_IDS.map(id => [id, generatedMainSource(`ingredient-${id}`)]))));
  setGeneratedFurnitureAdapter(createGeneratedFurnitureArt(Object.fromEntries(GENERATED_FURNITURE_IDS.map(id => [id, generatedMainSource(generatedFurnitureKey(id))])), { catalog: COZY_FURNITURE_CATALOG }));
  setGeneratedDecorAdapter(createGeneratedDecorArt(Object.fromEntries(GENERATED_DECOR_SOURCE_IDS.map(id => [id, generatedMainSource(`decor-${id}` as GeneratedMainId)])), { catalog: COZY_DECOR_CATALOG }));
  setGeneratedMainEnvironmentAdapter(createGeneratedMainEnvironmentArt(Object.fromEntries(GENERATED_MAIN_ENVIRONMENT_IDS.map(id => [id, generatedMainSource(generatedMainEnvironmentKey(id))])), { catalog: cozyEnvironmentMetadata }));
  setGeneratedTablewareAdapter(createGeneratedTablewareArt(Object.fromEntries(GENERATED_TABLEWARE_IDS.map(id => [id, generatedMainSource(generatedTablewareKey(id))]))));
  setGeneratedSignatureAdapter(createGeneratedSignatureArt(Object.fromEntries(GENERATED_SIGNATURE_IDS.map(id => [id, generatedMainSource(generatedSignatureKey(id))]))));
}
