import type { ItemId } from '../game/data';
import { registerFineSpriteArt } from './fine-sprite-art';

/** These identities alone have approved, independently generated menu bitmaps. */
export const GENERATED_FOOD_IDS = ['espresso', 'latte', 'eggtart', 'croissant', 'cake'] as const;
export type GeneratedFoodId = typeof GENERATED_FOOD_IDS[number];
export type GeneratedFoodSources = Readonly<Partial<Record<GeneratedFoodId, CanvasImageSource>>>;
export const GENERATED_FOOD_DENSITY = 4;
/** Keep the layout/anchor contract of ITEM_ART, including the optional 1px pad. */
export const GENERATED_FOOD_ENVELOPES: Readonly<Record<GeneratedFoodId, readonly [number, number]>> = Object.freeze({
  espresso: [12, 12], latte: [12, 11], eggtart: [12, 9], croissant: [12, 8], cake: [12, 10],
});
export interface GeneratedFoodAdapter {
  /** At least one complete identity is available. Missing identities stay legacy. */
  readonly ready: boolean;
  readonly readyIds: readonly GeneratedFoodId[];
  icon(id: ItemId, outline?: boolean): HTMLCanvasElement | undefined;
  artwork(id: ItemId): HTMLCanvasElement | undefined;
}
export interface GeneratedFoodOptions { readonly createCanvas?: () => HTMLCanvasElement }
interface FoodArt { readonly bare: HTMLCanvasElement; readonly outlined: HTMLCanvasElement; readonly artwork: HTMLCanvasElement }

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { width: value.naturalWidth ?? value.videoWidth ?? value.displayWidth ?? value.width ?? 0,
    height: value.naturalHeight ?? value.videoHeight ?? value.displayHeight ?? value.height ?? 0 };
}

/**
 * Bake once after loading, without a Phaser or asset-registry dependency. Every
 * PNG is fitted whole with one isotropic scale, so even its faint nonzero alpha
 * fringe survives; an alpha-threshold manifest is never used as a crop. The
 * source's painted outline remains intact in both variants. `outline` adds a
 * thin warm visibility contour and the same logical padding as legacy icons.
 *
 * Five identities × three fixed outputs. Repeated lookups allocate nothing,
 * and recreating/publishing an adapter cannot leave stale fallback cache hits.
 * Source bitmaps are not captured by the returned object after baking.
 */
export function createGeneratedFoodArt(sources: GeneratedFoodSources, options: GeneratedFoodOptions = {}): GeneratedFoodAdapter {
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const result = make(); result.width = width; result.height = height;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated food art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const body = (source: CanvasImageSource, width: number, height: number, density: number) => {
    const art = canvas(width * density, height * density);
    const size = sourceSize(source);
    const scale = Math.min(art.canvas.width / size.width, art.canvas.height / size.height);
    const w = Math.min(art.canvas.width, size.width * scale), h = Math.min(art.canvas.height, size.height * scale);
    art.ctx.drawImage(source, 0, 0, size.width, size.height,
      (art.canvas.width - w) / 2, (art.canvas.height - h) / 2, w, h);
    return art.canvas;
  };
  const outlined = (source: HTMLCanvasElement, pad: number) => {
    const art = canvas(source.width + pad * 2, source.height + pad * 2);
    // One physical pixel, rather than a coarse full logical-pixel halo. Tint
    // the dilated alpha only; never fill the rectangular transparent background.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) art.ctx.drawImage(source, pad + dx, pad + dy);
    art.ctx.globalCompositeOperation = 'source-in';
    art.ctx.fillStyle = '#39281f';
    art.ctx.fillRect(0, 0, art.canvas.width, art.canvas.height);
    // The contour is behind the original bitmap, preserving every source color.
    art.ctx.globalCompositeOperation = 'source-over';
    art.ctx.drawImage(source, pad, pad);
    return art.canvas;
  };
  const logical = (backing: HTMLCanvasElement) => {
    const art = canvas(backing.width / GENERATED_FOOD_DENSITY, backing.height / GENERATED_FOOD_DENSITY);
    art.ctx.drawImage(backing, 0, 0, art.canvas.width, art.canvas.height);
    registerFineSpriteArt(art.canvas, backing, GENERATED_FOOD_DENSITY);
    return art.canvas;
  };
  const baked = new Map<GeneratedFoodId, FoodArt>();
  for (const id of GENERATED_FOOD_IDS) {
    const source = sources[id];
    if (!source) continue;
    const size = sourceSize(source);
    if (![size.width, size.height].every(n => Number.isFinite(n) && n > 0)) continue;
    try {
      const [w, h] = GENERATED_FOOD_ENVELOPES[id];
      const backing = body(source, w, h, GENERATED_FOOD_DENSITY);
      const bare = logical(backing);
      const icon = logical(outlined(backing, GENERATED_FOOD_DENSITY));
      const artwork = outlined(body(source, w, h, 3), 3);
      baked.set(id, Object.freeze({ bare, outlined: icon, artwork }));
    } catch {
      // A failed identity must not replace a working fallback with a blank icon.
    }
  }
  const readyIds = Object.freeze([...baked.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    icon(id: ItemId, outline = true) {
      const art = baked.get(id as GeneratedFoodId);
      return outline ? art?.outlined : art?.bare;
    },
    artwork(id: ItemId) { return baked.get(id as GeneratedFoodId)?.artwork; },
  });
}
