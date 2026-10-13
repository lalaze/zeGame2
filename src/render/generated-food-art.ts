import { MENU, type ItemId, type StaticItemId } from '../game/data';
import { registerFineSpriteArt } from './fine-sprite-art';
import { generatedRasterGeometry, type GeneratedRasterGeometry, type GeneratedRasterMetadata } from './generated-raster-geometry';

/** The complete static menu; signature recipes retain their procedural renderer. */
export const GENERATED_FOOD_IDS: readonly StaticItemId[] = Object.freeze(MENU.map(item => item.id));
export type GeneratedFoodId = StaticItemId;
export type GeneratedFoodSources = Readonly<Partial<Record<GeneratedFoodId, CanvasImageSource>>>;
export const GENERATED_FOOD_DENSITY = 4;
export const GENERATED_FOOD_UI_DENSITY = 3;
/** Keep the layout/anchor contract of ITEM_ART, including the optional 1px pad. */
export const GENERATED_FOOD_ENVELOPES: Readonly<Record<GeneratedFoodId, readonly [number, number]>> = Object.freeze({
  espresso: [12, 12],
  americano: [12, 10],
  latte: [12, 11],
  cappuccino: [12, 11],
  flatwhite: [12, 10],
  cortado: [12, 10],
  mocha: [12, 10],
  vienna: [12, 10],
  macchiato: [12, 10],
  coldbrew: [12, 10],
  dirty: [12, 10],
  pourover: [12, 10],
  creamcoffee: [12, 10],
  affogato: [12, 10],
  blacktea: [12, 10],
  hotchoc: [12, 10],
  lemontea: [12, 10],
  chai: [12, 10],
  fruittea: [12, 10],
  hojicha: [12, 10],
  matcha: [12, 10],
  frappe: [12, 11],
  smoothie: [12, 10],
  milktea: [12, 10],
  matchafloat: [12, 10],
  roll: [12, 9],
  bagel: [12, 8],
  baguette: [12, 11],
  cheesebun: [12, 9],
  pretzel: [12, 11],
  focaccia: [12, 9],
  ciabatta: [12, 9],
  raisinbread: [12, 9],
  sourdough: [12, 9],
  rye: [12, 8],
  chocobread: [12, 9],
  shokupan: [12, 10],
  brioche: [12, 9],
  fruitbrioche: [12, 9],
  garlicbread: [12, 9],
  donut: [12, 8],
  scone: [12, 9],
  cookie: [12, 9],
  croissant: [12, 8],
  painchoc: [12, 9],
  brownie: [12, 9],
  cinnamon: [12, 9],
  muffin: [12, 9],
  creampuff: [12, 10],
  melonpan: [12, 9],
  eggtart: [12, 9],
  cake: [12, 10],
  swissroll: [12, 11],
  cheesecake: [12, 10],
  macaron: [12, 12],
});
export interface GeneratedFoodAdapter {
  /** At least one complete identity is available. Missing identities stay legacy. */
  readonly ready: boolean;
  readonly readyIds: readonly GeneratedFoodId[];
  icon(id: ItemId, outline?: boolean): HTMLCanvasElement | undefined;
  artwork(id: ItemId): HTMLCanvasElement | undefined;
}
export interface GeneratedFoodOptions {
  readonly createCanvas?: () => HTMLCanvasElement;
  /** Explicit per-ID production metadata; unrelated menu/pantry identities keep their existing path. */
  readonly rasterMetadata?: Readonly<Partial<Record<string, GeneratedRasterMetadata>>>;
}
interface BitmapArt { readonly bare: HTMLCanvasElement; readonly outlined: HTMLCanvasElement; readonly artwork: HTMLCanvasElement }

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const value = source as unknown as { complete?: boolean; naturalWidth?: number; naturalHeight?: number;
    videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  // A CSS-sized or not-yet-decoded image is never a valid blank replacement.
  // Read intrinsic dimension pairs together; do not mix CSS and native sizes.
  if (value.complete === false) return { width: 0, height: 0 };
  if (value.naturalWidth !== undefined || value.naturalHeight !== undefined) {
    return { width: value.naturalWidth ?? 0, height: value.naturalHeight ?? 0 };
  }
  if (value.videoWidth !== undefined || value.videoHeight !== undefined) {
    return { width: value.videoWidth ?? 0, height: value.videoHeight ?? 0 };
  }
  if (value.displayWidth !== undefined || value.displayHeight !== undefined) {
    return { width: value.displayWidth ?? 0, height: value.displayHeight ?? 0 };
  }
  return { width: value.width ?? 0, height: value.height ?? 0 };
}

export interface GeneratedMenuBitmapAdapter<Id extends string> {
  readonly ready: boolean;
  readonly readyIds: readonly Id[];
  icon(id: string, outline?: boolean): HTMLCanvasElement | undefined;
  artwork(id: string): HTMLCanvasElement | undefined;
}

/** Shared bounded baker for static menu and pantry images. No source crop is applied. */
export function createGeneratedMenuBitmapArt<Id extends string>(ids: readonly Id[],
  envelopes: Readonly<Record<Id, readonly [number, number]>>,
  sources: Readonly<Partial<Record<Id, CanvasImageSource>>>,
  options: GeneratedFoodOptions = {}): GeneratedMenuBitmapAdapter<Id> {
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (width: number, height: number) => {
    const result = make(); result.width = width; result.height = height;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated food art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const body = (raster: GeneratedRasterGeometry, width: number, height: number, density: number) => {
    const art = canvas(width * density, height * density);
    const size = raster;
    const scale = Math.min(art.canvas.width / size.width, art.canvas.height / size.height);
    const w = Math.min(art.canvas.width, size.width * scale), h = Math.min(art.canvas.height, size.height * scale);
    art.ctx.drawImage(raster.source, 0, 0, raster.contentWidth, raster.contentHeight,
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
  const baked = new Map<Id, BitmapArt>();
  for (const id of ids) {
    try {
      const source = sources[id];
      if (!source) continue;
      const size = sourceSize(source);
      if (![size.width, size.height].every(n => Number.isFinite(n) && n > 0)) continue;
      const raster = generatedRasterGeometry(source, options.rasterMetadata?.[id]);
      if (!raster) continue;
      const [w, h] = envelopes[id];
      const backing = body(raster, w, h, GENERATED_FOOD_DENSITY);
      const bare = logical(backing);
      const icon = logical(outlined(backing, GENERATED_FOOD_DENSITY));
      const artwork = outlined(body(raster, w, h, GENERATED_FOOD_UI_DENSITY), GENERATED_FOOD_UI_DENSITY);
      baked.set(id, Object.freeze({ bare, outlined: icon, artwork }));
    } catch {
      // A failed identity must not replace a working fallback with a blank icon.
    }
  }
  const readyIds = Object.freeze([...baked.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    icon(id: string, outline = true) {
      const art = baked.get(id as Id);
      return outline ? art?.outlined : art?.bare;
    },
    artwork(id: string) { return baked.get(id as Id)?.artwork; },
  });
}

/**
 * Bake once after loading, without a Phaser or asset-registry dependency. Every
 * PNG is fitted whole with one isotropic scale, so even its faint nonzero alpha
 * fringe survives; an alpha-threshold manifest is never used as a crop. The
 * source's painted outline remains intact in both variants. `outline` adds a
 * thin warm visibility contour and the same logical padding as legacy icons.
 *
 * Fifty-five identities × three fixed outputs. Repeated lookups allocate nothing,
 * and recreating/publishing an adapter cannot leave stale fallback cache hits.
 * Source bitmaps are not captured by the returned object after baking.
 */
export function createGeneratedFoodArt(sources: GeneratedFoodSources, options: GeneratedFoodOptions = {}): GeneratedFoodAdapter {
  return createGeneratedMenuBitmapArt(GENERATED_FOOD_IDS, GENERATED_FOOD_ENVELOPES, sources, options);
}
