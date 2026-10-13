import type { GeneratedStaffAdapter } from './generated-staff-art';
import type { GeneratedCustomerAdapter } from './generated-customer-art';
import type { GeneratedCatAdapter } from './generated-cat-art';
import type { GeneratedFoodAdapter } from './generated-food-art';

/** Shared ready adapter keeps avatar previews and world rendering on one identity. */
let staffAdapter: GeneratedStaffAdapter | null = null;
export const getGeneratedStaffAdapter = (): GeneratedStaffAdapter | null => staffAdapter;
export function setGeneratedStaffAdapter(adapter: GeneratedStaffAdapter | null): void { staffAdapter = adapter; }
let customerAdapter: GeneratedCustomerAdapter | null = null;
export const getGeneratedCustomerAdapter = (): GeneratedCustomerAdapter | null => customerAdapter;
export function setGeneratedCustomerAdapter(adapter: GeneratedCustomerAdapter | null): void { customerAdapter = adapter; }
let catAdapter: GeneratedCatAdapter | null = null;
export const getGeneratedCatAdapter = (): GeneratedCatAdapter | null => catAdapter;
export function setGeneratedCatAdapter(adapter: GeneratedCatAdapter | null): void { catAdapter = adapter; }

let foodAdapter: GeneratedFoodAdapter | null = null;
export const getGeneratedFoodAdapter = (): GeneratedFoodAdapter | null => foodAdapter;
export function setGeneratedFoodAdapter(adapter: GeneratedFoodAdapter | null): void { foodAdapter = adapter; }

/** Original image-generated bitmaps selected by the user; no procedural substitution. */
export const GENERATED_MAIN_ASSETS = {
  'cabinet-top': 'main-v1/cabinet-top.png',
  'cabinet-front': 'main-v1/cabinet-front.png',
  plant: 'main-v1/plant.png',
  vine: 'main-v1/vine.png',
  table: 'main-v2/table-no-vase.png',
  'chair-right': 'main-v2/chair-facing-right.png',
  'chair-left': 'main-v2/chair-facing-left.png',
  vase: 'main-v2/flower-vase.png',
  croissant: 'main-v2/croissant.png',
  cake: 'main-v2/strawberry-cake.png',
  display: 'main-v2/empty-wide-display.png',
  espresso: 'menu-v1/espresso.png',
  latte: 'menu-v1/latte.png',
  eggtart: 'menu-v1/eggtart.png',
  'barista-down-stand': 'staff-v2/owner-down-stand.png',
  'barista-down-stepA': 'staff-v2/owner-down-stepA.png',
  'barista-down-stepB': 'staff-v2/owner-down-stepB.png',
  'barista-up-stand': 'staff-v2/owner-up-stand.png',
  'barista-up-stepA': 'staff-v2/owner-up-stepA.png',
  'barista-up-stepB': 'staff-v2/owner-up-stepB.png',
  'barista-right-stand': 'staff-v2/owner-right-stand.png',
  'barista-right-stepA': 'staff-v2/owner-right-stepA.png',
  'barista-right-stepB': 'staff-v2/owner-right-stepB.png',
  'mina-down-stand': 'customer-0-v1/mina-down-stand.png',
  'mina-down-stepA': 'customer-0-v1/mina-down-stepA.png',
  'mina-down-stepB': 'customer-0-v1/mina-down-stepB.png',
  'mina-up-stand': 'customer-0-v1/mina-up-stand.png',
  'mina-up-stepA': 'customer-0-v1/mina-up-stepA.png',
  'mina-up-stepB': 'customer-0-v1/mina-up-stepB.png',
  'mina-right-stand': 'customer-0-v1/mina-right-stand.png',
  'mina-right-stepA': 'customer-0-v1/mina-right-stepA.png',
  'mina-right-stepB': 'customer-0-v1/mina-right-stepB.png',
  'mina-right-sit': 'customer-0-v1/mina-right-sit.png',
  'mina-right-sitPetA': 'customer-0-v1/mina-right-sitPetA.png',
  'mina-right-sitPetB': 'customer-0-v1/mina-right-sitPetB.png',
  'mina-left-sit': 'customer-0-v1/mina-left-sit.png',
  'mina-left-sitPetA': 'customer-0-v1/mina-left-sitPetA.png',
  'mina-left-sitPetB': 'customer-0-v1/mina-left-sitPetB.png',

  'service-pickup': 'service-v1/pickup-hutch-two-tier-v2.png',
  'service-machine': 'service-v1/espresso-machine.png',
  'service-cupboard': 'service-v1/low-service-cupboard.png',
  'service-cups': 'service-v1/cups-stack.png',
  'service-jars': 'service-v1/glass-jars-pair.png',
  'service-basket': 'service-v1/empty-wicker-basket.png',
  'wall-window': 'wall-v1/window-gingham-frame.png',
  'wall-board': 'wall-v1/blank-chalkboard.png',
  'wall-lamp': 'wall-v1/brass-wall-lamp.png',
  'siamese-idle': 'cat-siamese-v1/siamese-idle.png',
  'siamese-lookUp': 'cat-siamese-v1/siamese-lookUp.png',
  'siamese-walkA': 'cat-siamese-v1/siamese-walkA.png',
  'siamese-walkB': 'cat-siamese-v1/siamese-walkB.png',
  'siamese-swish': 'cat-siamese-v1/siamese-swish.png',
  'siamese-blink': 'cat-siamese-v1/siamese-blink.png',
  'siamese-happy': 'cat-siamese-v1/siamese-happy.png',
  'siamese-sleep': 'cat-siamese-v1/siamese-sleep.png',
  'siamese-groomA': 'cat-siamese-v1/siamese-groomA.png',
  'siamese-groomB': 'cat-siamese-v1/siamese-groomB.png',
  'siamese-stretch': 'cat-siamese-v1/siamese-stretch.png',
  'siamese-watch': 'cat-siamese-v1/siamese-watch.png',
  'siamese-nuzzleA': 'cat-siamese-v1/siamese-nuzzleA.png',
  'siamese-nuzzleB': 'cat-siamese-v1/siamese-nuzzleB.png',

} as const;
export type GeneratedMainId = keyof typeof GENERATED_MAIN_ASSETS;
type Source = CanvasImageSource & { width: number; height: number };
const sources = new Map<GeneratedMainId, Source>();
/** New Scene load must not inherit successful images from an older load. */
export function clearGeneratedMainAssets(): void {
  sources.clear();
  setGeneratedStaffAdapter(null);
  setGeneratedCustomerAdapter(null);
  setGeneratedCatAdapter(null);
  setGeneratedFoodAdapter(null);
}
export const generatedMainKey = (id: GeneratedMainId) => `generated-main:${id}`;
export function installGeneratedMainAsset(id: GeneratedMainId, source: Source): void {
  if (source.width > 0 && source.height > 0) sources.set(id, source);
}
export const generatedMainSource = (id: GeneratedMainId): Source | undefined => sources.get(id);
/** Release one original bitmap without invalidating its already-baked shared adapter. */
export const removeGeneratedMainSource = (id: GeneratedMainId): boolean => sources.delete(id);
/** Nearest-neighbor source sampling preserves the selected bitmap rather than smoothing it. */
export function paintGeneratedMain(ctx: CanvasRenderingContext2D, id: GeneratedMainId, x: number, y: number, w: number, h: number): boolean {
  const source = sources.get(id);
  if (!source || w <= 0 || h <= 0) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, x, y, w, h); ctx.restore();
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
