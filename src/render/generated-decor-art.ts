import { registerFineSpriteArt } from './fine-sprite-art';

/** Source metadata from decor-materials/renderer-manifest.json, including oak reuse. */
export const GENERATED_DECOR_CATALOG = {
  'wall_cream-tile': {"id":"wall_cream","state":"tile","slot":"wallpaper","size":[627,1044],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_cream.png","kind":"tile","nominalMotifUnitFromLegacy":[20,15],"estimatedSourcePeriod":[627,261]},
  'wall_mint-tile': {"id":"wall_mint","state":"tile","slot":"wallpaper","size":[1011,1008],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_mint.png","kind":"tile","nominalMotifUnitFromLegacy":[20,15],"estimatedSourcePeriod":[337,336]},
  'wall_rose-tile': {"id":"wall_rose","state":"tile","slot":"wallpaper","size":[836,1015],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_rose.png","kind":"tile","nominalMotifUnitFromLegacy":[20,15],"estimatedSourcePeriod":[418,145]},
  'wall_dots-tile': {"id":"wall_dots","state":"tile","slot":"wallpaper","size":[627,1112],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_dots.png","kind":"tile","nominalMotifUnitFromLegacy":[16,12],"estimatedSourcePeriod":[627,278]},
  'wall_brick-tile': {"id":"wall_brick","state":"tile","slot":"wallpaper","size":[582,1010],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_brick.png","kind":"tile","nominalMotifUnitFromLegacy":[32,16],"estimatedSourcePeriod":[582,202]},
  'wall_walnut-tile': {"id":"wall_walnut","state":"tile","slot":"wallpaper","size":[1152,784],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_walnut.png","kind":"tile","nominalMotifUnitFromLegacy":[24,26],"estimatedSourcePeriod":[384,392]},
  'wall_stars-tile': {"id":"wall_stars","state":"tile","slot":"wallpaper","size":[810,862],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/wall_stars.png","kind":"tile","nominalMotifUnitFromLegacy":[62,46],"estimatedSourcePeriod":[405,431]},
  'floor_checker-tile': {"id":"floor_checker","state":"tile","slot":"floor","size":[1254,1254],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_checker.png","kind":"tile","nominalMotifUnitFromLegacy":[32,32],"estimatedSourcePeriod":[1254,1254]},
  'floor_planks-tile': {"id":"floor_planks","state":"tile","slot":"floor","size":[1245,733],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_planks.png","kind":"tile","nominalMotifUnitFromLegacy":[96,24]},
  'floor_mint-tile': {"id":"floor_mint","state":"tile","slot":"floor","size":[939,939],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_mint.png","kind":"tile","nominalMotifUnitFromLegacy":[32,32],"estimatedSourcePeriod":[313,313]},
  'floor_terrazzo-tile': {"id":"floor_terrazzo","state":"tile","slot":"floor","size":[1239,939],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_terrazzo.png","kind":"tile","nominalMotifUnitFromLegacy":[32,32]},
  'floor_herringbone-tile': {"id":"floor_herringbone","state":"tile","slot":"floor","size":[1062,1044],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_herringbone.png","kind":"tile","nominalMotifUnitFromLegacy":[32,32],"estimatedSourcePeriod":[531,261]},
  'floor_marble-tile': {"id":"floor_marble","state":"tile","slot":"floor","size":[1254,1254],"anchor":{"x":0,"y":0,"kind":"material-origin"},"file":"bulk-candidates/decor-materials/floor_marble.png","kind":"tile","nominalMotifUnitFromLegacy":[64,64]},
  'counter_walnut-top': {"id":"counter_walnut","state":"top","slot":"counter","size":[1522,172],"anchor":{"x":761.0,"y":161,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_walnut-top.png","kind":"counter"},
  'counter_walnut-front': {"id":"counter_walnut","state":"front","slot":"counter","size":[782,409],"anchor":{"x":391.0,"y":398,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_walnut-front.png","kind":"counter"},
  'counter_marble-top': {"id":"counter_marble","state":"top","slot":"counter","size":[1536,184],"anchor":{"x":768.0,"y":173,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_marble-top.png","kind":"counter"},
  'counter_marble-front': {"id":"counter_marble","state":"front","slot":"counter","size":[868,420],"anchor":{"x":434.0,"y":409,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_marble-front.png","kind":"counter"},
  'counter_pink-top': {"id":"counter_pink","state":"top","slot":"counter","size":[1534,192],"anchor":{"x":767.0,"y":181,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_pink-top.png","kind":"counter"},
  'counter_pink-front': {"id":"counter_pink","state":"front","slot":"counter","size":[935,433],"anchor":{"x":467.5,"y":422,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_pink-front.png","kind":"counter"},
  'counter_gold-top': {"id":"counter_gold","state":"top","slot":"counter","size":[1536,151],"anchor":{"x":768.0,"y":140,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_gold-top.png","kind":"counter"},
  'counter_gold-front': {"id":"counter_gold","state":"front","slot":"counter","size":[864,441],"anchor":{"x":432.0,"y":430,"kind":"module-bottom-center"},"file":"bulk-candidates/decor-materials/counter_gold-front.png","kind":"counter"},
  'sill_cactus-default': {"id":"sill_cactus","state":"default","slot":"sill","size":[844,1252],"anchor":{"x":397.0,"y":1241.0,"kind":"pot-base-contact"},"file":"bulk-candidates/decor-props/sprites/sill_cactus.png","kind":"sprite","logicalEnvelope":[6,9]},
  'sill_tulips-default': {"id":"sill_tulips","state":"default","slot":"sill","size":[903,1024],"anchor":{"x":459.0,"y":1013.0,"kind":"pot-base-contact"},"file":"bulk-candidates/decor-props/sprites/sill_tulips.png","kind":"sprite","logicalEnvelope":[8,9]},
  'sill_bonsai-default': {"id":"sill_bonsai","state":"default","slot":"sill","size":[1164,1014],"anchor":{"x":566.5,"y":1003.0,"kind":"pot-base-contact"},"file":"bulk-candidates/decor-props/sprites/sill_bonsai.png","kind":"sprite","logicalEnvelope":[12,9]},
  'ceiling_lights-unlit': {"id":"ceiling_lights","state":"unlit","slot":"ceiling","size":[2038,387],"anchor":{"x":1019.0,"y":10.0,"kind":"ceiling-top-center"},"file":"bulk-candidates/decor-props/sprites/ceiling_lights.png","kind":"sprite","logicalEnvelope":[64,14]},
  'ceiling_vines-default': {"id":"ceiling_vines","state":"default","slot":"ceiling","size":[2163,547],"anchor":{"x":1081.5,"y":10.0,"kind":"ceiling-top-center"},"file":"bulk-candidates/decor-props/sprites/ceiling_vines.png","kind":"sprite","logicalEnvelope":[64,18]},
  'ceiling_pendants-unlit': {"id":"ceiling_pendants","state":"unlit","slot":"ceiling","size":[777,1554],"anchor":{"x":388.5,"y":0.0,"kind":"ceiling-top-center"},"file":"bulk-candidates/decor-props/sprites/ceiling_pendants.png","kind":"sprite","logicalEnvelope":[9,15]},
  'ceiling_chandelier-unlit': {"id":"ceiling_chandelier","state":"unlit","slot":"ceiling","size":[1543,971],"anchor":{"x":771.5,"y":0.0,"kind":"ceiling-top-center"},"file":"bulk-candidates/decor-props/sprites/ceiling_chandelier.png","kind":"sprite","logicalEnvelope":[25,15]},
  'rug_red-default': {"id":"rug_red","state":"default","slot":"rug","size":[1513,813],"anchor":{"x":756.5,"y":406.5,"kind":"floor-center"},"file":"bulk-candidates/decor-props/sprites/rug_red.png","kind":"sprite","logicalEnvelope":[26,16]},
  'rug_blue-default': {"id":"rug_blue","state":"default","slot":"rug","size":[1465,719],"anchor":{"x":732.5,"y":359.5,"kind":"floor-center"},"file":"bulk-candidates/decor-props/sprites/rug_blue.png","kind":"sprite","logicalEnvelope":[26,16]},
  'rug_round-default': {"id":"rug_round","state":"default","slot":"rug","size":[1533,882],"anchor":{"x":766.5,"y":441.0,"kind":"floor-center"},"file":"bulk-candidates/decor-props/sprites/rug_round.png","kind":"sprite","logicalEnvelope":[26,16]},
  'neon_cafe-unlit': {"id":"neon_cafe","state":"unlit","slot":"neon","size":[2091,384],"anchor":{"x":1045.5,"y":192.0,"kind":"wall-center"},"file":"bulk-candidates/decor-props/sprites/neon_cafe.png","kind":"sprite","logicalEnvelope":[42,14]},
  'neon_heart-unlit': {"id":"neon_heart","state":"unlit","slot":"neon","size":[936,841],"anchor":{"x":468.0,"y":420.5,"kind":"wall-center"},"file":"bulk-candidates/decor-props/sprites/neon_heart.png","kind":"sprite","logicalEnvelope":[8,8]},
  'neon_cup-unlit': {"id":"neon_cup","state":"unlit","slot":"neon","size":[1129,1199],"anchor":{"x":564.5,"y":599.5,"kind":"wall-center"},"file":"bulk-candidates/decor-props/sprites/neon_cup.png","kind":"sprite","logicalEnvelope":[9,10]},
  'counter_oak-top': {"id":"counter_oak","state":"top","slot":"counter","size":[580,60],"anchor":{"x":0,"y":0,"kind":"module-origin"},"file":"main-v1/cabinet-top.png","kind":"counter"},
  'counter_oak-front': {"id":"counter_oak","state":"front","slot":"counter","size":[190,138],"anchor":{"x":0,"y":0,"kind":"module-origin"},"file":"main-v1/cabinet-front.png","kind":"counter"},
} as const;

export type GeneratedDecorSourceId = keyof typeof GENERATED_DECOR_CATALOG;
export type GeneratedDecorId = typeof GENERATED_DECOR_CATALOG[GeneratedDecorSourceId]['id'];
export const GENERATED_DECOR_SOURCE_IDS = Object.freeze(Object.keys(GENERATED_DECOR_CATALOG) as GeneratedDecorSourceId[]);
export const GENERATED_DECOR_IDS = Object.freeze([...new Set(GENERATED_DECOR_SOURCE_IDS.map(key => GENERATED_DECOR_CATALOG[key].id))]);
export const GENERATED_DECOR_ASSETS: Readonly<Record<GeneratedDecorSourceId, string>> = Object.freeze(Object.fromEntries(
  GENERATED_DECOR_SOURCE_IDS.map(key => [key, `catalog-v1/decor/${key}.png`])) as Record<GeneratedDecorSourceId, string>);
export const generatedDecorKey = (key: GeneratedDecorSourceId): `decor-${GeneratedDecorSourceId}` => `decor-${key}`;
export const GENERATED_DECOR_DENSITY = 4;
export type GeneratedDecorSources = Readonly<Partial<Record<GeneratedDecorSourceId, CanvasImageSource>>>;
type Point = Readonly<{ x: number; y: number }>;
export interface GeneratedCounterBand {
  /** Authoring-pixel crop. Only this opaque-height band participates in joins. */
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  /** Interior repeat region; the remaining left/right pieces are external caps. */
  readonly repeatX: number; readonly repeatW: number;
}
/** Visually inspected against all ten original PNGs. Alpha checks independently
 * verify the repeat rectangles contain no transparent padding. Source files are
 * unchanged: cropping and repetition happen only when drawing a counter band. */
export const GENERATED_COUNTER_BANDS: Readonly<Partial<Record<GeneratedDecorSourceId, GeneratedCounterBand>>> = Object.freeze({
  'counter_walnut-top': { x: 10, y: 11, w: 1502, h: 148, repeatX: 112, repeatW: 1298 },
  'counter_marble-top': { x: 5, y: 11, w: 1526, h: 163, repeatX: 112, repeatW: 1312 },
  'counter_pink-top': { x: 10, y: 10, w: 1514, h: 172, repeatX: 100, repeatW: 1334 },
  'counter_gold-top': { x: 8, y: 11, w: 1520, h: 129, repeatX: 80, repeatW: 1376 },
  'counter_oak-top': { x: 0, y: 0, w: 580, h: 60, repeatX: 0, repeatW: 580 },
  'counter_walnut-front': { x: 28, y: 11, w: 726, h: 388, repeatX: 28, repeatW: 726 },
  'counter_marble-front': { x: 28, y: 10, w: 812, h: 394, repeatX: 28, repeatW: 812 },
  'counter_pink-front': { x: 24, y: 11, w: 887, h: 407, repeatX: 24, repeatW: 887 },
  'counter_gold-front': { x: 32, y: 10, w: 800, h: 415, repeatX: 32, repeatW: 800 },
  'counter_oak-front': { x: 0, y: 0, w: 190, h: 138, repeatX: 0, repeatW: 190 },
});
export interface GeneratedDecorMeta {
  readonly id: string;
  readonly state: string;
  readonly slot: string;
  readonly kind: string;
  readonly size: readonly [number, number];
  readonly anchor: Point & { readonly kind: string };
  readonly logicalEnvelope?: readonly [number, number];
  readonly nominalMotifUnitFromLegacy?: readonly [number, number];
  readonly estimatedSourcePeriod?: readonly [number, number];
  readonly counterBand?: GeneratedCounterBand;
}
export interface GeneratedDecorOptions {
  readonly createCanvas?: () => HTMLCanvasElement;
  readonly catalog?: Readonly<Partial<Record<GeneratedDecorSourceId, GeneratedDecorMeta>>>;
}
export interface GeneratedDecorAdapter {
  readonly ready: boolean;
  /** Counter identities are available only when their top and front both bake. */
  readonly readyIds: readonly GeneratedDecorId[];
  icon(id: string): HTMLCanvasElement | undefined;
  sprite(id: string): HTMLCanvasElement | undefined;
  /** Logical anchor inside the sprite; sill foot, ceiling mount, or wall/floor center. */
  anchor(id: string): Point | undefined;
  /** Stable world-space repeats keep adjacent painted regions in phase. */
  paintTile(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number,
    originX?: number, originY?: number): boolean;
  paintCounter(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, topH: number, frontH: number): boolean;
  /** Base bitmap only. Lights, neon text/glow and swaying remain runtime layers. */
  paintSprite(ctx: CanvasRenderingContext2D, id: string, anchorX: number, anchorY: number, scale?: number): boolean;
  /** Uniformly fit a prop (e.g. a rug) into a caller-owned rectangle. */
  paintFitted(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number): boolean;
}
interface Bitmap {
  readonly canvas: HTMLCanvasElement;
  /** Fractional content bounds exclude only our own unused rounding padding. */
  readonly width: number;
  readonly height: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly meta: GeneratedDecorMeta;
  readonly sprite?: HTMLCanvasElement;
  readonly anchor?: Point;
  readonly band?: GeneratedCounterBand;
}
interface Identity { readonly base?: Bitmap; readonly top?: Bitmap; readonly front?: Bitmap; readonly icon: HTMLCanvasElement }

function sourceSize(source: CanvasImageSource): Point {
  const s = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { x: s.naturalWidth ?? s.videoWidth ?? s.displayWidth ?? s.width ?? 0,
    y: s.naturalHeight ?? s.videoHeight ?? s.displayHeight ?? s.height ?? 0 };
}
const rectangle = (...values: number[]) => values.every(Number.isFinite) && values[2] > 0 && values[3] > 0;

/**
 * Prepare 31 finish identities from their real generated images. Tiles are
 * repeated at a metadata-derived world scale, never squeezed to fit the room.
 * Counter endcaps occur only at external ends; only opaque interiors repeat.
 * Front panels crop out their transparent surrounds. Props preserve the
 * original contact/mount points. No recoloring, synthesized pattern, alpha
 * cleanup, dynamic light or text is part of this adapter.
 *
 * At most 111 small canvases (36 bitmaps, 13 logical props, 62 thumbnail layers).
 * Source images are released by this function after baking. Lookups and all
 * rendering paths create no canvases, patterns or persistent caches.
 */
export function createGeneratedDecorArt(sources: GeneratedDecorSources, options: GeneratedDecorOptions = {}): GeneratedDecorAdapter {
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (w: number, h: number) => {
    const result = make(); result.width = w; result.height = h;
    const ctx = result.getContext('2d');
    if (!ctx) throw new Error('Generated decor art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: result, ctx };
  };
  const logical = (backing: HTMLCanvasElement, w: number, h: number) => {
    const result = canvas(w, h); result.ctx.drawImage(backing, 0, 0, w, h);
    registerFineSpriteArt(result.canvas, backing, GENERATED_DECOR_DENSITY); return result.canvas;
  };
  const bitmaps = new Map<GeneratedDecorSourceId, Bitmap>();
  for (const key of GENERATED_DECOR_SOURCE_IDS) {
    const source = sources[key], meta: GeneratedDecorMeta = options.catalog?.[key] ?? GENERATED_DECOR_CATALOG[key];
    if (!source) continue;
    const size = sourceSize(source);
    if (![size.x, size.y, ...meta.size].every(n => Number.isFinite(n) && n > 0)) continue;
    const packedScale = Math.max(size.x, size.y) / Math.max(...meta.size);
    if (Math.abs(size.x - meta.size[0] * packedScale) > 1 || Math.abs(size.y - meta.size[1] * packedScale) > 1) continue;
    try {
      if (meta.kind === 'sprite' && meta.logicalEnvelope) {
        const [w, h] = meta.logicalEnvelope;
        const anchor = Object.freeze({ x: w / 2, y: meta.anchor.kind === 'ceiling-top-center' ? 1 :
          meta.anchor.kind === 'pot-base-contact' ? h - 1 : h / 2 });
        const ax = meta.anchor.x * packedScale, ay = meta.anchor.y * packedScale;
        const limits = [anchor.x / ax, (w - anchor.x) / (size.x - ax), (h - anchor.y) / (size.y - ay)];
        if (ay > 0) limits.push(anchor.y / ay);
        const k = Math.min(...limits), d = GENERATED_DECOR_DENSITY;
        if (!Number.isFinite(k) || k <= 0) continue;
        const backing = canvas(w * d, h * d);
        backing.ctx.drawImage(source, 0, 0, size.x, size.y,
          (anchor.x - ax * k) * d, (anchor.y - ay * k) * d, size.x * k * d, size.y * k * d);
        const sprite = logical(backing.canvas, w, h);
        bitmaps.set(key, { canvas: backing.canvas, width: w * d, height: h * d, worldWidth: w, worldHeight: h, meta, sprite, anchor });
      } else {
        const k = Math.min(1, 256 / Math.max(size.x, size.y));
        const width = size.x * k, height = size.y * k;
        let band: GeneratedCounterBand | undefined;
        if (meta.kind === 'counter') {
          const authored = meta.counterBand ?? GENERATED_COUNTER_BANDS[key];
          if (!authored) continue;
          // The pack draws at one scale into ceil-sized canvases. Its short
          // edge can include an extra transparent pixel; do not stretch author
          // coordinates across that rounding pad when selecting source rows.
          const sx = packedScale * k, sy = sx;
          // Snap inward to physical bitmap pixels so nearest-neighbor sampling
          // cannot pick transparent pixels just outside an authored crop.
          const x = Math.ceil(authored.x * sx), y = Math.ceil(authored.y * sy);
          const right = Math.floor((authored.x + authored.w) * sx), bottom = Math.floor((authored.y + authored.h) * sy);
          const repeatX = Math.ceil(authored.repeatX * sx), repeatRight = Math.floor((authored.repeatX + authored.repeatW) * sx);
          if (![x, y, right, bottom, repeatX, repeatRight].every(Number.isFinite) || x < 0 || y < 0 ||
            right > width || bottom > height || right <= x || bottom <= y || repeatX < x || repeatRight > right || repeatRight <= repeatX) continue;
          band = Object.freeze({ x, y, w: right - x, h: bottom - y, repeatX, repeatW: repeatRight - repeatX });
        }
        const backing = canvas(Math.ceil(width), Math.ceil(height));
        backing.ctx.drawImage(source, 0, 0, size.x, size.y, 0, 0, width, height);
        const period = meta.estimatedSourcePeriod ?? meta.size, motif = meta.nominalMotifUnitFromLegacy ?? meta.size;
        const materialScale = Math.min(motif[0] / period[0], motif[1] / period[1]) / packedScale;
        bitmaps.set(key, { canvas: backing.canvas, width, height, worldWidth: size.x * materialScale,
          worldHeight: size.y * materialScale, meta, band });
      }
    } catch {
      // Failed bakes remain absent; both halves of a counter are checked below.
    }
  }
  const draw = (ctx: CanvasRenderingContext2D, bitmap: Bitmap, x: number, y: number, w: number, h: number) => {
    ctx.drawImage(bitmap.canvas, 0, 0, bitmap.width, bitmap.height, x, y, w, h);
  };
  const tile = (ctx: CanvasRenderingContext2D, art: Bitmap, x: number, y: number, w: number, h: number, ox = 0, oy = 0) => {
    const tw = art.worldWidth, th = art.worldHeight;
    // Bound hostile rectangles without silently changing material scale.
    const startX = Math.floor((x - ox) / tw), startY = Math.floor((y - oy) / th);
    const endX = Math.ceil((x + w - ox) / tw), endY = Math.ceil((y + h - oy) / th);
    if (![startX, startY, endX, endY].every(Number.isFinite) || (endX - startX) * (endY - startY) > 16384) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (let row = startY; row < endY; row++) for (let col = startX; col < endX; col++) {
      const tx = ox + col * tw, ty = oy + row * th;
      const left = Math.max(x, tx), top = Math.max(y, ty), right = Math.min(x + w, tx + tw), bottom = Math.min(y + h, ty + th);
      ctx.drawImage(art.canvas, (left - tx) / tw * art.width, (top - ty) / th * art.height,
        (right - left) / tw * art.width, (bottom - top) / th * art.height, left, top, right - left, bottom - top);
    }
    ctx.restore(); return true;
  };
  const canBand = (art: Bitmap, w: number, h: number) => {
    const b = art.band;
    if (!b) return false;
    const scale = h / b.h, caps = (b.w - b.repeatW) * scale;
    // A shorter-than-two-caps slab has no faithful uniform-scale construction.
    // Reject before painting either part instead of shrinking or covering caps.
    return w >= caps && Math.ceil((w - caps) / (b.repeatW * scale)) <= 16384;
  };
  const band = (ctx: CanvasRenderingContext2D, art: Bitmap, x: number, y: number, w: number, h: number) => {
    const b = art.band!, scale = h / b.h;
    const left = (b.repeatX - b.x) * scale, rightX = b.repeatX + b.repeatW;
    const right = (b.x + b.w - rightX) * scale, middle = w - left - right;
    const slice = (sx: number, sw: number, dx: number, dw: number) => {
      if (sw > 0 && dw > 0) ctx.drawImage(art.canvas, sx, b.y, sw, b.h, dx, y, dw, h);
    };
    slice(b.x, b.repeatX - b.x, x, left);
    const tile = b.repeatW * scale;
    for (let i = 0, count = Math.ceil(middle / tile); i < count; i++) {
      const shown = Math.min(tile, middle - i * tile);
      slice(b.repeatX, shown / scale, x + left + i * tile, shown);
    }
    slice(rightX, b.x + b.w - rightX, x + w - right, right);
  };
  const identities = new Map<GeneratedDecorId, Identity>();
  for (const id of GENERATED_DECOR_IDS) {
    const keys = GENERATED_DECOR_SOURCE_IDS.filter(key => GENERATED_DECOR_CATALOG[key].id === id);
    const entries = keys.map(key => bitmaps.get(key));
    if (entries.some(entry => !entry)) continue;
    const base = entries[0]!.meta.kind === 'counter' ? undefined : entries[0];
    const top = entries.find(entry => entry?.meta.state === 'top'), front = entries.find(entry => entry?.meta.state === 'front');
    if (!base && (!top || !front)) continue;
    try {
      const d = GENERATED_DECOR_DENSITY, iconBacking = canvas(28 * d, 24 * d);
      iconBacking.ctx.scale(d, d);
      if (base?.meta.kind === 'tile') tile(iconBacking.ctx, base, 0, 0, 28, 24);
      else if (base) {
        const k = Math.min(28 / base.worldWidth, 24 / base.worldHeight);
        draw(iconBacking.ctx, base, (28 - base.worldWidth * k) / 2, (24 - base.worldHeight * k) / 2,
          base.worldWidth * k, base.worldHeight * k);
      } else if (top && front) {
        if (!canBand(top, 26, 6) || !canBand(front, 26, 15)) continue;
        band(iconBacking.ctx, top, 1, 3, 26, 6); band(iconBacking.ctx, front, 1, 9, 26, 15);
      }
      identities.set(id, { base, top, front, icon: logical(iconBacking.canvas, 28, 24) });
    } catch {
      // A usable thumbnail and world identity are published together.
    }
  }
  const get = (id: string) => identities.get(id as GeneratedDecorId);
  const readyIds = Object.freeze([...identities.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    icon(id: string) { return get(id)?.icon; },
    sprite(id: string) { return get(id)?.base?.sprite; },
    anchor(id: string) { return get(id)?.base?.anchor; },
    paintTile(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, ox = 0, oy = 0) {
      const art = get(id)?.base;
      return !!art && art.meta.kind === 'tile' && rectangle(x, y, w, h) && Number.isFinite(ox) && Number.isFinite(oy) && tile(ctx, art, x, y, w, h, ox, oy);
    },
    paintCounter(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, topH: number, frontH: number) {
      const art = get(id);
      if (!art?.top || !art.front || !rectangle(x, y, w, topH) || !Number.isFinite(frontH) || frontH <= 0) return false;
      if (!canBand(art.top, w, topH) || !canBand(art.front, w, frontH)) return false;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      band(ctx, art.top, x, y, w, topH); band(ctx, art.front, x, y + topH, w, frontH); ctx.restore(); return true;
    },
    paintSprite(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, scale = 1) {
      const art = get(id)?.base;
      if (!art?.sprite || !art.anchor || ![x, y, scale].every(Number.isFinite) || scale <= 0) return false;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      draw(ctx, art, x - art.anchor.x * scale, y - art.anchor.y * scale, art.worldWidth * scale, art.worldHeight * scale);
      ctx.restore(); return true;
    },
    paintFitted(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number) {
      const art = get(id)?.base;
      if (!art?.sprite || !rectangle(x, y, w, h)) return false;
      const k = Math.min(w / art.worldWidth, h / art.worldHeight), dw = art.worldWidth * k, dh = art.worldHeight * k;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      draw(ctx, art, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); return true;
    },
  });
}
