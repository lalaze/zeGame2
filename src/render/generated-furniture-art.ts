import { registerFineSpriteArt } from './fine-sprite-art';

/** Compact renderer metadata copied from the frozen furniture renderer manifest.
 * Files are relative to public/art/generated; every bitmap remains unmodified.
 * Source alpha bounds are deliberately not used to crop faint painted fringes. */
export const GENERATED_FURNITURE_CATALOG = {
  clock: {"file":"bulk-candidates/furniture-initial/clock.png","size":[1089,1102],"surface":"wall","logicalEnvelope":[21,21],"footprintCells":[3,3],"anchor":{"x":544.5,"y":1091,"kind":"wall-bottom-center"},"clock":{"dial":{"x":544,"y":545},"minute":254,"hour":178}},
  coatrack: {"file":"bulk-candidates/furniture-initial/coatrack.png","size":[562,1980],"surface":"floor","logicalEnvelope":[10,28],"footprintCells":[1,1],"anchor":{"x":281.0,"y":1969,"kind":"foot-bottom-center"}},
  bookshelf: {"file":"bulk-candidates/furniture-initial/bookshelf.png","size":[1082,1134],"surface":"floor","logicalEnvelope":[32,34],"footprintCells":[4,1],"anchor":{"x":541.0,"y":1123,"kind":"foot-bottom-center"}},
  catbed: {"file":"bulk-candidates/furniture-initial/catbed.png","size":[1326,623],"surface":"floor","logicalEnvelope":[18,11],"footprintCells":[2,1],"anchor":{"x":663.0,"y":612,"kind":"foot-bottom-center"}},
  mugrack: {"file":"bulk-candidates/furniture/mugrack.png","size":[1481,524],"surface":"wall","logicalEnvelope":[32,16],"footprintCells":[4,2],"anchor":{"x":740.5,"y":513,"kind":"wall-bottom-center"}},
  aframe: {"file":"bulk-candidates/furniture/aframe.png","size":[1018,1211],"surface":"floor","logicalEnvelope":[16,19],"footprintCells":[2,1],"anchor":{"x":509.0,"y":1200,"kind":"foot-bottom-center"}},
  lamp: {"file":"bulk-candidates/furniture/lamp.png","size":[632,1610],"surface":"floor","logicalEnvelope":[13,24],"footprintCells":[2,1],"anchor":{"x":316.0,"y":1599,"kind":"foot-bottom-center"}},
  bench: {"file":"bulk-candidates/furniture/bench.png","size":[1704,738],"surface":"floor","logicalEnvelope":[32,16],"footprintCells":[4,1],"anchor":{"x":852.0,"y":727,"kind":"foot-bottom-center"}},
  armchair: {"file":"bulk-candidates/furniture/armchair.png","size":[1164,1063],"surface":"floor","logicalEnvelope":[24,22],"footprintCells":[3,1],"anchor":{"x":582.0,"y":1052,"kind":"foot-bottom-center"}},
  gramophone: {"file":"bulk-candidates/furniture/gramophone.png","size":[1032,1345],"surface":"floor","logicalEnvelope":[18,22],"footprintCells":[2,1],"anchor":{"x":516.0,"y":1334,"kind":"foot-bottom-center"}},
  piano: {"file":"bulk-candidates/furniture/piano.png","size":[1237,930],"surface":"floor","logicalEnvelope":[40,30],"footprintCells":[5,2],"anchor":{"x":618.5,"y":919,"kind":"foot-bottom-center"}},
  sofa: {"file":"bulk-candidates/furniture/sofa.png","size":[1351,749],"surface":"floor","logicalEnvelope":[32,26],"footprintCells":[4,2],"anchor":{"x":675.5,"y":738,"kind":"foot-bottom-center"}},
  plant_fern: {"file":"bulk-candidates/furniture/plant_fern.png","size":[1238,1022],"surface":"floor","logicalEnvelope":[16,15],"footprintCells":[2,1],"anchor":{"x":619.0,"y":1011,"kind":"foot-bottom-center"}},
  plant_snake: {"file":"bulk-candidates/furniture/plant_snake.png","size":[688,1590],"surface":"floor","logicalEnvelope":[9,17],"footprintCells":[1,1],"anchor":{"x":344.0,"y":1579,"kind":"foot-bottom-center"}},
  plant_fig: {"file":"bulk-candidates/furniture/plant_fig.png","size":[939,1401],"surface":"floor","logicalEnvelope":[16,23],"footprintCells":[2,1],"anchor":{"x":469.5,"y":1390,"kind":"foot-bottom-center"}},
  plant_monstera: {"file":"bulk-candidates/furniture/plant_monstera.png","size":[1302,1092],"surface":"floor","logicalEnvelope":[22,19],"footprintCells":[3,1],"anchor":{"x":651.0,"y":1081,"kind":"foot-bottom-center"}},
  plant_lemon: {"file":"bulk-candidates/furniture/plant_lemon.png","size":[887,1148],"surface":"floor","logicalEnvelope":[21,22],"footprintCells":[3,1],"anchor":{"x":443.5,"y":1137,"kind":"foot-bottom-center"}},
  plant_lavender: {"file":"bulk-candidates/furniture/plant_lavender.png","size":[700,1555],"surface":"floor","logicalEnvelope":[14,25],"footprintCells":[2,1],"anchor":{"x":350.0,"y":1544,"kind":"foot-bottom-center"}},
  plant_succulent: {"file":"bulk-candidates/furniture/plant_succulent.png","size":[852,1238],"surface":"floor","logicalEnvelope":[8,13],"footprintCells":[1,1],"anchor":{"x":426.0,"y":1227,"kind":"foot-bottom-center"}},
  round_stool: {"file":"bulk-candidates/furniture/round_stool.png","size":[771,1015],"surface":"floor","logicalEnvelope":[14,18],"footprintCells":[2,1],"anchor":{"x":385.5,"y":1004,"kind":"foot-bottom-center"}},
  shelf: {"file":"bulk-candidates/furniture/shelf.png","size":[1488,695],"surface":"wall","logicalEnvelope":[32,16],"footprintCells":[4,2],"anchor":{"x":744.0,"y":684,"kind":"wall-bottom-center"}},
  garland: {"file":"bulk-candidates/furniture/garland.png","size":[2140,609],"surface":"wall","logicalEnvelope":[32,8],"footprintCells":[4,1],"anchor":{"x":1070.0,"y":598,"kind":"wall-bottom-center"}},
  wall_pennants: {"file":"bulk-candidates/furniture/wall_pennants.png","size":[2150,410],"surface":"wall","logicalEnvelope":[32,8],"footprintCells":[4,1],"anchor":{"x":1075.0,"y":399,"kind":"wall-bottom-center"}},
  wreath_season: {"file":"bulk-candidates/furniture/wreath_season.png","size":[1119,1163],"surface":"wall","logicalEnvelope":[22,22],"footprintCells":[3,3],"anchor":{"x":559.5,"y":1152,"kind":"wall-bottom-center"}},
  poster_coffee: {"file":"bulk-candidates/furniture/poster_coffee.png","size":[980,888],"surface":"wall","logicalEnvelope":[22,22],"footprintCells":[3,3],"anchor":{"x":490.0,"y":877,"kind":"wall-bottom-center"}},
  poster_bakery: {"file":"bulk-candidates/furniture/poster_bakery.png","size":[973,841],"surface":"wall","logicalEnvelope":[22,22],"footprintCells":[3,3],"anchor":{"x":486.5,"y":830,"kind":"wall-bottom-center"}},
  art_landscape: {"file":"bulk-candidates/furniture/art_landscape.png","size":[1137,775],"surface":"wall","logicalEnvelope":[26,22],"footprintCells":[4,3],"anchor":{"x":568.5,"y":764,"kind":"wall-bottom-center"}},
  art_cat: {"file":"bulk-candidates/furniture/art_cat.png","size":[1108,893],"surface":"wall","logicalEnvelope":[26,22],"footprintCells":[4,3],"anchor":{"x":554.0,"y":882,"kind":"wall-bottom-center"}},
  art_bean: {"file":"bulk-candidates/furniture/art_bean.png","size":[1167,891],"surface":"wall","logicalEnvelope":[26,22],"footprintCells":[4,3],"anchor":{"x":583.5,"y":880,"kind":"wall-bottom-center"}},
  art_starry: {"file":"bulk-candidates/furniture/art_starry.png","size":[1206,721],"surface":"wall","logicalEnvelope":[26,22],"footprintCells":[4,3],"anchor":{"x":603.0,"y":710,"kind":"wall-bottom-center"}},
  lantern: {"file":"bulk-candidates/furniture/lantern.png","size":[663,1442],"surface":"floor","logicalEnvelope":[12,24],"footprintCells":[2,1],"anchor":{"x":331.5,"y":1431,"kind":"foot-bottom-center"},"overlayPoints":{"wick":{"x":328,"y":957}}},
  bean_display: {"file":"bulk-candidates/furniture/bean_display.png","size":[1157,929],"surface":"floor","logicalEnvelope":[22,24],"footprintCells":[3,1],"anchor":{"x":578.5,"y":918,"kind":"foot-bottom-center"}},
  sideboard: {"file":"bulk-candidates/furniture/sideboard.png","size":[1226,914],"surface":"floor","logicalEnvelope":[30,26],"footprintCells":[4,2],"anchor":{"x":613.0,"y":903,"kind":"foot-bottom-center"}},
  display_cabinet: {"file":"bulk-candidates/furniture/display_cabinet.png","size":[904,1412],"surface":"floor","logicalEnvelope":[24,36],"footprintCells":[3,2],"anchor":{"x":452.0,"y":1401,"kind":"foot-bottom-center"}},
  magazine_rack: {"file":"bulk-candidates/furniture/magazine_rack.png","size":[797,1240],"surface":"floor","logicalEnvelope":[16,24],"footprintCells":[2,1],"anchor":{"x":398.5,"y":1229,"kind":"foot-bottom-center"}},
  coffee_cart: {"file":"bulk-candidates/furniture/coffee_cart.png","size":[1212,890],"surface":"floor","logicalEnvelope":[30,28],"footprintCells":[4,2],"anchor":{"x":606.0,"y":879,"kind":"foot-bottom-center"}},
  sconce: {"file":"wall-v1/brass-wall-lamp.png","size":[206,294],"surface":"wall","logicalEnvelope":[8,16],"footprintCells":[1,2],"anchor":{"x":103.0,"y":147.0,"kind":"wall-center"}},
  vase_daisies: {"file":"main-v2/flower-vase.png","size":[264,281],"surface":"floor","logicalEnvelope":[14,25],"footprintCells":[2,1],"anchor":{"x":132.0,"y":268,"kind":"floor-foot"}},
  hanging_ivy: {"file":"main-v1/vine.png","size":[388,453],"surface":"wall","logicalEnvelope":[14,24],"footprintCells":[2,3],"anchor":{"x":194.0,"y":225.5,"kind":"wall-center"},"overlayPoints":{"potRim":{"x":292,"y":108},"leftAttachment":{"x":240,"y":93},"rightAttachment":{"x":341,"y":97}}},
} as const;

export type GeneratedFurnitureId = keyof typeof GENERATED_FURNITURE_CATALOG;
export const GENERATED_FURNITURE_IDS = Object.freeze(Object.keys(GENERATED_FURNITURE_CATALOG) as GeneratedFurnitureId[]);
export const GENERATED_FURNITURE_ASSETS: Readonly<Record<GeneratedFurnitureId, string>> = Object.freeze(
  Object.fromEntries(GENERATED_FURNITURE_IDS.map(id => [id, `catalog-v1/furniture/${id}.png`])) as Record<GeneratedFurnitureId, string>);
export const generatedFurnitureKey = (id: GeneratedFurnitureId): `furniture-${GeneratedFurnitureId}` => `furniture-${id}`;
export const GENERATED_FURNITURE_DENSITY = 4;
export type GeneratedFurnitureSources = Readonly<Partial<Record<GeneratedFurnitureId, CanvasImageSource>>>;
type Point = Readonly<{ x: number; y: number }>;
export interface GeneratedFurnitureOverlay {
  /** Positions in the unchanged logical sprite envelope, after native-aspect fit. */
  readonly points: Readonly<Record<string, Point>>;
  readonly clock?: Readonly<{ dial: Point; minute: number; hour: number }>;
}
export interface GeneratedFurnitureAdapter {
  readonly ready: boolean;
  readonly readyIds: readonly GeneratedFurnitureId[];
  /** Logical envelope with an associated 4× fineSpriteArt backing. Base only. */
  sprite(id: string): HTMLCanvasElement | undefined;
  /** Cached 28×24 shop thumbnail, using the same fitted source as world art. */
  icon(id: string): HTMLCanvasElement | undefined;
  overlay(id: string): GeneratedFurnitureOverlay | undefined;
  /** Clock hands are drawn fresh from now. Other lighting stays with the caller. */
  paintWall(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, now: Date): boolean;
  /** Caller retains its existing shadow/light layers. No flame or glow is baked. */
  paintFloor(ctx: CanvasRenderingContext2D, id: string, cx: number, footY: number): boolean;
  floorBounds(id: string, cx: number, footY: number): { x: number; y: number; w: number; h: number } | undefined;
}
export interface GeneratedFurnitureOptions {
  readonly createCanvas?: () => HTMLCanvasElement;
  /** Coordinates may stay in the original authoring image after uniform packing. */
  readonly catalog?: Readonly<Partial<Record<GeneratedFurnitureId, GeneratedFurnitureMeta>>>;
}
export interface GeneratedFurnitureMeta {
  readonly surface: 'wall' | 'floor';
  readonly size: readonly [number, number];
  readonly logicalEnvelope: readonly [number, number];
  readonly footprintCells: readonly [number, number];
  readonly anchor: Point & { readonly kind: string };
  readonly clock?: { readonly dial: Point; readonly minute: number; readonly hour: number };
  readonly overlayPoints?: Readonly<Record<string, Point>>;
}
interface Baked {
  readonly sprite: HTMLCanvasElement;
  readonly backing: HTMLCanvasElement;
  readonly icon: HTMLCanvasElement;
  readonly meta: GeneratedFurnitureMeta;
  readonly overlay: GeneratedFurnitureOverlay;
}

function sourceSize(source: CanvasImageSource): Point {
  const s = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  return { x: s.naturalWidth ?? s.videoWidth ?? s.displayWidth ?? s.width ?? 0,
    y: s.naturalHeight ?? s.videoHeight ?? s.displayHeight ?? s.height ?? 0 };
}

/** Draw only live clock hands over the generated blank dial, never a new face. */
export function paintGeneratedClockHands(ctx: CanvasRenderingContext2D, dial: Point, minuteLength: number,
  hourLength: number, now: Date): void {
  if (!Number.isFinite(now.getTime())) return;
  const minute = now.getMinutes() + now.getSeconds() / 60;
  const hour = now.getHours() % 12 + minute / 60;
  ctx.save();
  ctx.lineWidth = 0.65; ctx.lineCap = 'round'; ctx.strokeStyle = '#39281f';
  for (const [angle, length] of [[minute / 60 * Math.PI * 2, minuteLength], [hour / 12 * Math.PI * 2, hourLength]]) {
    ctx.beginPath(); ctx.moveTo(dial.x, dial.y);
    ctx.lineTo(dial.x + Math.sin(angle) * length, dial.y - Math.cos(angle) * length); ctx.stroke();
  }
  ctx.fillStyle = '#b55c40'; ctx.beginPath(); ctx.arc(dial.x, dial.y, 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Each source is fitted whole with one scale around its measured contact point.
 * Width, height, wall footprint and the h−1 floor foot stay exactly as before.
 * Bake at most four small canvases per identity, once per load. Missing, wrongly
 * sized or failed sources return undefined/false so callers keep legacy art.
 * No source images are retained after baking; no per-frame canvas allocation.
 */
export function createGeneratedFurnitureArt(sources: GeneratedFurnitureSources,
  options: GeneratedFurnitureOptions = {}): GeneratedFurnitureAdapter {
  const make = options.createCanvas ?? (() => document.createElement('canvas'));
  const canvas = (w: number, h: number) => {
    const c = make(); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Generated furniture art requires a 2D canvas.');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  };
  const logical = (backing: HTMLCanvasElement, w: number, h: number) => {
    const result = canvas(w, h); result.ctx.drawImage(backing, 0, 0, w, h);
    registerFineSpriteArt(result.canvas, backing, GENERATED_FURNITURE_DENSITY);
    return result.canvas;
  };
  const baked = new Map<GeneratedFurnitureId, Baked>();
  for (const id of GENERATED_FURNITURE_IDS) {
    const source = sources[id], meta: GeneratedFurnitureMeta = options.catalog?.[id] ?? GENERATED_FURNITURE_CATALOG[id];
    if (!source) continue;
    const size = sourceSize(source);
    if (![size.x, size.y, ...meta.size].every(n => Number.isFinite(n) && n > 0)) continue;
    // Runtime packing may round the shorter edge by a pixel. Transform every
    // authored point by the same ratio, then fit the actual packed PNG uniformly.
    const packedScale = Math.max(size.x, size.y) / Math.max(...meta.size);
    if (Math.abs(size.x - meta.size[0] * packedScale) > 1 || Math.abs(size.y - meta.size[1] * packedScale) > 1) continue;
    const anchor = { x: meta.anchor.x * packedScale, y: meta.anchor.y * packedScale };
    const [w, h] = meta.logicalEnvelope;
    const target = { x: w / 2, y: meta.anchor.kind === 'wall-center' ? h / 2 : h - 1 };
    const scale = Math.min(target.x / anchor.x, (w - target.x) / (size.x - anchor.x),
      target.y / anchor.y, (h - target.y) / (size.y - anchor.y));
    if (!Number.isFinite(scale) || scale <= 0) continue;
    const x = target.x - anchor.x * scale, y = target.y - anchor.y * scale;
    const point = (p: Point): Point => Object.freeze({ x: x + p.x * packedScale * scale, y: y + p.y * packedScale * scale });
    const overlay: GeneratedFurnitureOverlay = Object.freeze({
      points: Object.freeze(Object.fromEntries(Object.entries(meta.overlayPoints ?? {}).map(([name, p]) => [name, point(p)]))),
      ...(meta.clock ? { clock: Object.freeze({ dial: point(meta.clock.dial), minute: meta.clock.minute * packedScale * scale, hour: meta.clock.hour * packedScale * scale }) } : {}),
    });
    try {
      const d = GENERATED_FURNITURE_DENSITY;
      const backing = canvas(w * d, h * d);
      backing.ctx.drawImage(source, 0, 0, size.x, size.y, x * d, y * d, size.x * scale * d, size.y * scale * d);
      const sprite = logical(backing.canvas, w, h);
      const iconBacking = canvas(28 * d, 24 * d), k = Math.min(1, 28 / w, 24 / h);
      const ix = (28 - w * k) / 2, iy = 24 - h * k;
      iconBacking.ctx.drawImage(backing.canvas, ix * d, iy * d, w * k * d, h * k * d);
      if (overlay.clock) {
        iconBacking.ctx.save(); iconBacking.ctx.scale(d * k, d * k); iconBacking.ctx.translate(ix / k, iy / k);
        paintGeneratedClockHands(iconBacking.ctx, overlay.clock.dial, overlay.clock.minute, overlay.clock.hour, new Date(2000, 0, 1, 10, 10));
        iconBacking.ctx.restore();
      }
      const icon = logical(iconBacking.canvas, 28, 24);
      baked.set(id, Object.freeze({ sprite, backing: backing.canvas, icon, meta, overlay }));
    } catch {
      // Publish an identity atomically; a failed icon must not leave half a set.
    }
  }
  const get = (id: string) => baked.get(id as GeneratedFurnitureId);
  const paint = (ctx: CanvasRenderingContext2D, art: Baked, x: number, y: number) => {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art.backing, x, y, art.sprite.width, art.sprite.height); ctx.restore();
  };
  const readyIds = Object.freeze([...baked.keys()]);
  return Object.freeze({
    ready: readyIds.length > 0, readyIds,
    sprite(id: string) { return get(id)?.sprite; },
    icon(id: string) { return get(id)?.icon; },
    overlay(id: string) { return get(id)?.overlay; },
    paintWall(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, now: Date) {
      const art = get(id); if (!art || art.meta.surface !== 'wall') return false;
      const left = x + (art.meta.footprintCells[0] * 8 - art.sprite.width) / 2;
      const top = y + (art.meta.footprintCells[1] * 8 - art.sprite.height) / 2;
      paint(ctx, art, left, top);
      if (art.overlay.clock) {
        const { dial, minute, hour } = art.overlay.clock;
        paintGeneratedClockHands(ctx, { x: left + dial.x, y: top + dial.y }, minute, hour, now);
      }
      return true;
    },
    paintFloor(ctx: CanvasRenderingContext2D, id: string, cx: number, footY: number) {
      const art = get(id); if (!art || art.meta.surface !== 'floor') return false;
      paint(ctx, art, cx - art.sprite.width / 2, footY - art.sprite.height + 1); return true;
    },
    floorBounds(id: string, cx: number, footY: number) {
      const art = get(id); if (!art || art.meta.surface !== 'floor') return undefined;
      return { x: cx - art.sprite.width / 2, y: footY - art.sprite.height + 1, w: art.sprite.width, h: art.sprite.height };
    },
  });
}
