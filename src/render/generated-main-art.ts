import { setGeneratedSignatureAdapter, GENERATED_SIGNATURE_ASSETS } from './generated-signature-art';
import type { GeneratedFurnitureAdapter } from './generated-furniture-art';
import type { GeneratedMainEnvironmentAdapter } from './generated-main-environment-art';
import type { GeneratedTablewareAdapter } from './generated-tableware-art';
import type { GeneratedServerAdapter } from './generated-server-art';
import type { GeneratedDecorAdapter } from './generated-decor-art';
import type { GeneratedIngredientAdapter } from './generated-ingredient-art';
import runtimeCatalog from '../../assets/generated/runtime-catalog-v1/runtime.json';
import { COZY_WORLD_ASSETS } from './cozy-world-assets';
import { COZY_MATERIAL_ASSETS } from './cozy-materials';
import { COZY_FURNITURE_ASSETS } from './cozy-furniture-assets';
import { COZY_MENU_ASSETS } from './cozy-menu-assets';
import { COZY_SERVICE_ASSETS } from './cozy-service-assets';
import type { GeneratedStaffAdapter } from './generated-staff-art';
import type { GeneratedCustomerAdapter } from './generated-customer-art';
import type { GeneratedCatAdapter } from './generated-cat-art';
import type { GeneratedFoodAdapter } from './generated-food-art';
import { generatedRasterGeometry, type GeneratedRasterMetadata } from './generated-raster-geometry';

/** Shared ready adapter keeps avatar previews and world rendering on one identity. */
let staffAdapter: GeneratedStaffAdapter | null = null;
export const getGeneratedStaffAdapter = (): GeneratedStaffAdapter | null => staffAdapter;
export function setGeneratedStaffAdapter(adapter: GeneratedStaffAdapter | null): void { staffAdapter = adapter; }
let serverAdapter: GeneratedServerAdapter | null = null;
export const getGeneratedServerAdapter = (): GeneratedServerAdapter | null => serverAdapter;
export function setGeneratedServerAdapter(adapter: GeneratedServerAdapter | null): void { serverAdapter = adapter; }
let customerAdapter: GeneratedCustomerAdapter | null = null;
export const getGeneratedCustomerAdapter = (): GeneratedCustomerAdapter | null => customerAdapter;
export function setGeneratedCustomerAdapter(adapter: GeneratedCustomerAdapter | null): void { customerAdapter = adapter; }
let catAdapter: GeneratedCatAdapter | null = null;
export const getGeneratedCatAdapter = (): GeneratedCatAdapter | null => catAdapter;
export function setGeneratedCatAdapter(adapter: GeneratedCatAdapter | null): void { catAdapter = adapter; }

let foodAdapter: GeneratedFoodAdapter | null = null;
export const getGeneratedFoodAdapter = (): GeneratedFoodAdapter | null => foodAdapter;
export function setGeneratedFoodAdapter(adapter: GeneratedFoodAdapter | null): void { foodAdapter = adapter; }

let ingredientAdapter: GeneratedIngredientAdapter | null = null;
export const getGeneratedIngredientAdapter = (): GeneratedIngredientAdapter | null => ingredientAdapter;
export function setGeneratedIngredientAdapter(adapter: GeneratedIngredientAdapter | null): void { ingredientAdapter = adapter; }

let furnitureAdapter: GeneratedFurnitureAdapter | null = null;
export const getGeneratedFurnitureAdapter = (): GeneratedFurnitureAdapter | null => furnitureAdapter;
export function setGeneratedFurnitureAdapter(adapter: GeneratedFurnitureAdapter | null): void { furnitureAdapter = adapter; }
let decorAdapter: GeneratedDecorAdapter | null = null;
export const getGeneratedDecorAdapter = (): GeneratedDecorAdapter | null => decorAdapter;
export function setGeneratedDecorAdapter(adapter: GeneratedDecorAdapter | null): void { decorAdapter = adapter; }
let environmentAdapter: GeneratedMainEnvironmentAdapter | null = null;
export const getGeneratedMainEnvironmentAdapter = (): GeneratedMainEnvironmentAdapter | null => environmentAdapter;
export function setGeneratedMainEnvironmentAdapter(adapter: GeneratedMainEnvironmentAdapter | null): void { environmentAdapter = adapter; }
let tablewareAdapter: GeneratedTablewareAdapter | null = null;
export const getGeneratedTablewareAdapter = (): GeneratedTablewareAdapter | null => tablewareAdapter;
export function setGeneratedTablewareAdapter(adapter: GeneratedTablewareAdapter | null): void { tablewareAdapter = adapter; }

/** Historical main-scene keys retained as fallbacks below the current pack. */
const ORIGINAL_MAIN_ASSETS = {
  'reference-machine': 'reference-main-v1/espresso.png',
  'cozy-cafe-atlas': 'cozy-cafe-v1/furniture-atlas.png',
  'cabinet-top': 'main-v1/cabinet-top.png',
  'cabinet-front': 'main-v1/cabinet-front.png',
  plant: 'main-v1/plant.png',
  table: 'main-v2/table-no-vase.png',
  'chair-right': 'main-v2/chair-facing-right.png',
  'chair-left': 'main-v2/chair-facing-left.png',
  vase: 'main-v2/flower-vase.png',
} as const;

/** All consumers share the current image-generated packs. */
export const GENERATED_MAIN_ASSETS = {
  ...runtimeCatalog.assets,
  ...GENERATED_SIGNATURE_ASSETS,
  ...ORIGINAL_MAIN_ASSETS,
  ...COZY_WORLD_ASSETS,
  ...COZY_MATERIAL_ASSETS,
  ...COZY_FURNITURE_ASSETS,
  ...COZY_MENU_ASSETS,
  ...COZY_SERVICE_ASSETS,
} as const;
export type GeneratedMainId = keyof typeof GENERATED_MAIN_ASSETS;
type Source = CanvasImageSource & { width: number; height: number };
const sources = new Map<GeneratedMainId, Source>();
/** New Scene load must not inherit successful images from an older load. */
export function clearGeneratedMainAssets(): void {
  sources.clear();
  setGeneratedSignatureAdapter(null);
  setGeneratedStaffAdapter(null);
  setGeneratedServerAdapter(null);
  setGeneratedCustomerAdapter(null);
  setGeneratedCatAdapter(null);
  setGeneratedFoodAdapter(null);
  setGeneratedIngredientAdapter(null);
  setGeneratedFurnitureAdapter(null);
  setGeneratedDecorAdapter(null);
  setGeneratedMainEnvironmentAdapter(null);
  setGeneratedTablewareAdapter(null);
}
export const generatedMainKey = (id: GeneratedMainId) => `generated-main:${id}`;
export function installGeneratedMainAsset(id: GeneratedMainId, source: Source): void {
  if (source.width > 0 && source.height > 0) sources.set(id, source);
}
export const generatedMainSource = (id: GeneratedMainId): Source | undefined => sources.get(id);
const mainStaticMetadata: Readonly<Partial<Record<GeneratedMainId, GeneratedRasterMetadata>>> = runtimeCatalog.mainStaticMetadata;
/** Original-coordinate geometry, excluding only newly introduced trailing export padding. */
export function generatedMainRaster(id: GeneratedMainId) {
  const source = sources.get(id);
  return source ? generatedRasterGeometry(source, mainStaticMetadata[id]) : null;
}
/** Release one original bitmap without invalidating its already-baked shared adapter. */
export const removeGeneratedMainSource = (id: GeneratedMainId): boolean => sources.delete(id);
/** Nearest-neighbor source sampling preserves the selected bitmap rather than smoothing it. */
export function paintGeneratedMain(ctx: CanvasRenderingContext2D, id: GeneratedMainId, x: number, y: number, w: number, h: number): boolean {
  const raster = generatedMainRaster(id);
  if (!raster || w <= 0 || h <= 0) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (raster.sourceScale === 1) ctx.drawImage(raster.source, x, y, w, h);
  else ctx.drawImage(raster.source, 0, 0, raster.contentWidth, raster.contentHeight, x, y, w, h);
  ctx.restore();
  return true;
}
/** Repeat real cabinet modules at their own aspect, rather than squashing a short cabinet. */
export function paintGeneratedCabinetBand(ctx: CanvasRenderingContext2D, id: 'cabinet-front' | 'cabinet-top', x: number, y: number, w: number, h: number): boolean {
  const source = sources.get(id);
  if (!source || w <= 0 || h <= 0) return false;
  const scale = h / source.height, tile = source.width * scale;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  for (let offset = 0; offset < w; offset += tile) {
    const shown = Math.min(tile, w - offset);
    ctx.drawImage(source, 0, 0, shown / scale, source.height, x + offset, y, shown, h);
  }
  ctx.restore(); return true;
}
