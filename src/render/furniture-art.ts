import { getGeneratedFurnitureAdapter } from './generated-main-art';
// Pixel art for placeable furniture. Wall pieces are drawn into their footprint;
// floor pieces stand on the floor, centered on their footprint, and may rise above it.
import { CELL, furnitureDef } from '../game/furniture';
import { collectionSprite } from './furnishing-collection';
import { mix, ramp } from './color';
import { grain, paintArt, plantSprite, shadow } from './decor-art';
// Reference A: one warm ink, crisp upper-left light, solid material clusters.
const OUTLINE = '#39281f';

type Ctx = CanvasRenderingContext2D;
type Fill = (x: number, y: number, w: number, h: number, color: string) => void;

const filler =
  (ctx: Ctx): Fill =>
  (x, y, w, h, color) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (w >= 6 && h >= 4 && (color === WOOD.base || color === LIGHT_WOOD.base)) {
      grain(ctx, Math.round(x + 1), Math.round(y + 1), Math.round(w - 2), Math.round(h - 2), ramp(color), w > h ? 'h' : 'v', Math.round(x + y));
    }
  };

const lazy = (make: () => HTMLCanvasElement) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= make());
};

/** Draws into a fresh canvas of the given size. */
function canvas(w: number, h: number, draw: (r: Fill, ctx: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(filler(ctx), ctx);
  return c;
}

const WOOD = { base: '#865332', hi: '#c98c4d', lo: '#543425', dark: '#39281f' };
const LIGHT_WOOD = { base: '#aa7241', hi: '#e4b777', lo: '#74462d', dark: '#543425' };
const CREAM = '#f4e6c7', BRASS = '#c8a15e', SAGE = '#627451';

/** Raised timber panel with a recessed field, mitres and an upper-left bevel. */
function panel(r: Fill, x: number, y: number, w: number, h: number): void {
  r(x, y, w, h, OUTLINE); r(x + 1, y + 1, w - 2, h - 2, WOOD.base);
  r(x + 1, y + 1, w - 2, 1, WOOD.hi); r(x + 1, y + 1, 1, h - 2, LIGHT_WOOD.base);
  if (w > 6 && h > 5) {
    r(x + 3, y + 3, w - 6, h - 6, WOOD.lo);
    r(x + 4, y + 4, w - 8, h - 7, LIGHT_WOOD.base);
  }
}

/** Leaf clusters keep negative space, broad leaves and sunlit tips readable. */
function leaves(r: Fill, x: number, y: number, w: number): void {
  r(x + 1, y, w - 2, 1, '#aab36b'); r(x, y + 1, w, 2, SAGE);
  r(x + 1, y + 3, w - 2, 1, '#3f5437'); r(x + 1, y + 1, 2, 1, '#91a35c');
}

/** Fiddle-leaf fig: forked branches, cupped leaves and a fluted terracotta pot. */
export const FIG = lazy(() => canvas(16, 23, (r) => {
  r(7, 7, 2, 10, OUTLINE); r(7, 8, 1, 9, WOOD.hi);
  r(3, 11, 5, 1, WOOD.base); r(9, 10, 4, 1, WOOD.base);
  // Dense overlapping crowns, each with a warm lit lobe and a dark lower cup.
  // The tiny fork of trunk remains visible under the canopy, never a bare stalk.
  for (const [x, y, w] of [[4, 0, 7], [9, 2, 6], [1, 3, 7], [5, 5, 7], [0, 8, 7], [9, 8, 7], [4, 10, 7]] as const) {
    r(x + 1, y, w - 2, 1, '#405137'); r(x, y + 1, w, 3, '#405137');
    r(x + 1, y + 4, w - 2, 1, '#405137'); r(x + 1, y + 1, w - 2, 3, SAGE);
    r(x + 1, y + 1, w - 3, 1, '#a5b177'); r(x + 1, y + 2, 2, 1, '#889e5c');
    r(x + 3, y + 2, 1, 2, '#778d51');
  }
  r(3, 6, 1, 1, '#c7cb87'); r(9, 2, 1, 1, '#c7cb87'); r(10, 10, 1, 1, '#a5b177');
  r(3, 16, 10, 2, OUTLINE); r(4, 16, 8, 1, '#ddb47a'); r(4, 18, 8, 4, OUTLINE);
  r(5, 18, 6, 4, '#b8653e'); r(5, 18, 1, 3, '#e6a569'); r(10, 18, 1, 3, '#85452f');
  r(6, 19, 1, 2, '#d88c56'); r(4, 22, 8, 1, WOOD.lo);
}));

// ---------------------------------------------------------------- floor pieces

const LAMP = lazy(() => canvas(13, 24, (r) => {
  // Scalloped linen shade, stitched ribs and turned brass stem.
  r(4, 0, 5, 1, OUTLINE); r(3, 1, 7, 1, OUTLINE); r(2, 2, 9, 2, OUTLINE);
  r(1, 4, 11, 3, OUTLINE); r(3, 2, 7, 2, CREAM); r(2, 4, 9, 2, '#d8bb82');
  r(4, 1, 4, 1, '#fff4d8'); r(3, 4, 1, 2, '#fff4d8'); r(6, 2, 1, 4, '#b98c50');
  r(9, 4, 1, 2, '#b98c50'); r(2, 6, 3, 1, BRASS); r(6, 6, 4, 1, BRASS);
  r(5, 7, 3, 2, OUTLINE); r(6, 7, 1, 2, '#e8c47e');
  r(5, 9, 3, 12, OUTLINE); r(5, 9, 1, 11, BRASS);
  r(4, 12, 1, 1, WOOD.hi); r(7, 8, 1, 4, BRASS); r(7, 11, 2, 1, OUTLINE);
  r(3, 20, 7, 2, OUTLINE); r(2, 22, 9, 2, OUTLINE); r(3, 22, 7, 1, BRASS);
}));

const SNAKE_PLANT = lazy(() => canvas(9, 17, (r) => {
  r(1, 2, 2, 8, OUTLINE); r(4, 0, 2, 10, OUTLINE); r(7, 3, 2, 7, OUTLINE);
  r(0, 6, 2, 4, SAGE); r(2, 3, 1, 7, '#91a35c'); r(4, 1, 1, 9, SAGE);
  r(5, 4, 1, 6, '#c4c789'); r(7, 4, 1, 6, '#879654');
  for (let y = 4; y < 10; y += 3) { r(2, y, 1, 1, '#d5d694'); r(4, y + 1, 1, 1, '#aab36b'); }
  r(0, 10, 9, 2, OUTLINE); r(1, 10, 7, 1, '#fff3d9');
  r(1, 12, 7, 4, OUTLINE); r(2, 12, 5, 4, CREAM); r(2, 12, 1, 3, '#fff5de');
  r(6, 12, 1, 4, '#c0ad87'); r(2, 14, 4, 1, '#d4bb8d'); r(2, 16, 5, 1, WOOD.lo);
}));

const COAT_RACK = lazy(() => canvas(10, 28, (r) => {
  r(4, 1, 2, 24, OUTLINE); r(4, 2, 1, 23, WOOD.hi); r(3, 0, 4, 2, OUTLINE);
  r(4, 0, 2, 1, BRASS); r(1, 4, 8, 2, OUTLINE); r(1, 3, 1, 1, BRASS); r(8, 3, 1, 1, BRASS);
  // A plaid scarf threaded through a hook; a felt hat with a stitched band.
  r(6, 6, 3, 11, '#aa5944'); r(6, 6, 1, 10, '#d38c66');
  for (let y = 8; y < 16; y += 3) r(6, y, 3, 1, CREAM);
  r(6, 17, 1, 2, '#aa5944'); r(8, 17, 1, 2, '#aa5944');
  r(1, 6, 3, 3, SAGE); r(0, 9, 5, 1, OUTLINE); r(1, 8, 3, 1, BRASS); r(1, 6, 2, 1, '#95a175');
  r(2, 24, 6, 2, OUTLINE); r(0, 26, 3, 2, OUTLINE); r(7, 26, 3, 2, OUTLINE);
  r(1, 26, 2, 1, WOOD.hi); r(7, 26, 2, 1, WOOD.base);
}));

const AFRAME = lazy(() => canvas(16, 19, (r) => {
  // Split rear leg and visibly tapering frame, with a chain across the opening.
  r(11, 3, 2, 13, WOOD.lo); r(13, 15, 2, 4, OUTLINE);
  for (let y = 0; y < 15; y++) {
    const inset = y < 4 ? 2 : y < 10 ? 1 : 0;
    r(inset, y, 15 - inset * 2, 1, OUTLINE);
    if (y > 0 && y < 14) r(inset + 1, y, 13 - inset * 2, 1, y < 2 ? WOOD.hi : WOOD.base);
    if (y > 2 && y < 12) r(inset + 2, y, 11 - inset * 2, 1, '#304535');
  }
  r(5, 4, 5, 3, CREAM); r(10, 5, 1, 1, CREAM); r(4, 7, 7, 1, '#b9c19a');
  r(6, 3, 1, 1, '#b9c19a'); r(3, 10, 8, 1, CREAM); r(5, 9, 5, 1, '#91a17a');
  r(2, 2, 1, 1, BRASS); r(11, 2, 1, 1, BRASS); r(1, 14, 13, 1, WOOD.hi);
  r(1, 15, 3, 4, OUTLINE); r(2, 15, 1, 3, WOOD.hi); r(4, 16, 9, 1, BRASS);
}));

const BENCH = lazy(() => canvas(32, 16, (r) => {
  r(1, 0, 3, 15, OUTLINE); r(28, 0, 3, 15, OUTLINE);
  r(2, 1, 1, 12, WOOD.hi); r(29, 1, 1, 12, WOOD.base);
  r(4, 0, 24, 2, OUTLINE); r(4, 0, 24, 1, WOOD.hi);
  // Individually shaped spindle back, rather than a flat rectangular rail.
  for (let x = 6; x < 28; x += 5) { r(x, 2, 2, 5, WOOD.lo); r(x, 2, 1, 4, WOOD.hi); }
  r(0, 7, 32, 4, OUTLINE); r(1, 8, 30, 2, WOOD.base);
  r(3, 5, 26, 3, OUTLINE); r(4, 5, 24, 2, SAGE); r(5, 5, 22, 1, '#a4ad7a');
  r(9, 6, 1, 1, '#3f5437'); r(21, 6, 1, 1, '#3f5437');
  r(2, 11, 3, 5, OUTLINE); r(27, 11, 3, 5, OUTLINE); r(3, 11, 1, 4, WOOD.hi);
  r(5, 12, 22, 2, WOOD.lo); r(5, 12, 22, 1, WOOD.base); r(28, 11, 1, 4, WOOD.base);
  r(2, 2, 1, 1, BRASS); r(29, 2, 1, 1, BRASS);
}));

const CAT_BED = lazy(() => canvas(18, 11, (r) => {
  r(3, 2, 12, 1, OUTLINE); r(1, 3, 16, 6, OUTLINE); r(3, 9, 12, 2, OUTLINE);
  r(2, 3, 14, 5, '#a56f42'); r(3, 8, 12, 2, '#865332');
  for (let x = 3; x < 15; x += 3) { r(x, 3, 1, 2, '#d8ae6e'); r(x + 1, 8, 1, 2, '#d8ae6e'); }
  r(4, 4, 10, 4, CREAM); r(3, 5, 12, 2, '#ead4ad');
  // Curled ginger cat: joined tail, cream muzzle, separate ears and closed eyes.
  r(6, 3, 7, 4, '#c98545'); r(8, 2, 4, 2, '#d99c54'); r(12, 4, 3, 3, '#b66b36');
  r(4, 3, 5, 4, '#d99c54'); r(4, 2, 2, 2, '#c98545'); r(7, 2, 2, 2, '#c98545');
  r(4, 5, 3, 2, CREAM); r(5, 4, 2, 1, OUTLINE); r(10, 6, 4, 1, '#edbb73');
  r(9, 3, 1, 2, '#aa6035'); r(11, 3, 1, 2, '#aa6035');
}));

const BOOKSHELF = lazy(() => canvas(32, 34, (r) => {
  panel(r, 1, 5, 30, 28); r(0, 3, 32, 3, OUTLINE); r(1, 3, 30, 1, WOOD.hi);
  r(2, 4, 28, 1, LIGHT_WOOD.base);
  const books = ['#aa5944', '#627451', '#c8a15e', '#708d8e', '#a48071', '#e4c495', '#f4e6c7'];
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 7 + shelf * 8; r(4, y, 24, 7, WOOD.dark);
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 4, h = 4 + ((i + shelf) % 3), color = books[(i + shelf * 2) % books.length];
      r(x, y + 7 - h, 3, h, color); r(x, y + 7 - h, 1, h, mix(color, CREAM, 0.3));
      r(x + 1, y + 8 - h, 2, 1, BRASS); r(x + 1, y + 5, 2, 1, '#543425');
    }
    r(3, y + 7, 26, 1, WOOD.hi);
  }
  r(3, 32, 4, 2, OUTLINE); r(25, 32, 4, 2, OUTLINE);
  r(6, 1, 9, 2, '#aa5944'); r(7, 1, 7, 1, CREAM); r(22, 1, 6, 3, '#ad683f');
  leaves(r, 20, 0, 6); r(24, 0, 4, 2, SAGE);
}));

const ARMCHAIR = lazy(() => canvas(24, 22, (r) => {
  // Carved timber wings frame a tailored terracotta back and loose seat cushion.
  r(4, 0, 16, 1, OUTLINE); r(2, 1, 20, 11, OUTLINE); r(3, 2, 18, 10, WOOD.base);
  r(4, 2, 16, 10, '#ad6045'); r(5, 2, 14, 1, '#dda077'); r(5, 3, 1, 7, '#c8815d');
  r(18, 3, 1, 8, '#784333'); r(7, 5, 1, 1, '#784333'); r(15, 5, 1, 1, '#784333');
  r(0, 9, 5, 10, OUTLINE); r(19, 9, 5, 10, OUTLINE);
  r(1, 10, 3, 7, '#ad6045'); r(20, 10, 3, 7, '#8d4939');
  r(1, 10, 3, 2, '#dda077'); r(20, 10, 3, 1, '#c8815d');
  r(5, 12, 14, 6, OUTLINE); r(5, 12, 13, 2, '#dda077'); r(6, 14, 12, 3, '#b66b4d');
  r(6, 16, 12, 1, '#8d4939'); r(1, 18, 22, 1, WOOD.hi);
  r(2, 19, 3, 3, OUTLINE); r(19, 19, 3, 3, OUTLINE); r(3, 19, 1, 2, WOOD.base);
  // Cream knitted throw over the left arm, with a fringe.
  r(2, 12, 4, 6, CREAM); r(3, 13, 1, 4, '#c4af86'); r(2, 18, 1, 1, CREAM); r(5, 18, 1, 1, CREAM);
}));

const GRAMOPHONE = lazy(() => canvas(18, 22, (r) => {
  // Wide scalloped bell with a dark throat, curving neck and brass ridges.
  r(1, 0, 8, 1, OUTLINE); r(0, 1, 10, 5, OUTLINE); r(1, 1, 8, 4, BRASS);
  r(1, 2, 5, 2, '#543425'); r(2, 1, 5, 1, '#edd394'); r(6, 4, 5, 3, '#b48849');
  r(8, 6, 4, 3, OUTLINE); r(9, 6, 2, 3, BRASS); r(10, 8, 3, 4, OUTLINE); r(10, 8, 1, 4, '#e4b777');
  r(2, 11, 14, 3, OUTLINE); r(4, 11, 10, 1, '#675541'); r(3, 12, 12, 1, '#251f19');
  r(7, 12, 4, 1, '#b76b46'); r(12, 10, 3, 1, BRASS); r(14, 10, 1, 3, BRASS);
  panel(r, 1, 14, 16, 8); r(4, 17, 9, 3, WOOD.lo);
  for (let x = 5; x < 13; x += 2) r(x, 17, 1, 3, BRASS);
  r(16, 15, 2, 2, OUTLINE); r(17, 15, 1, 1, BRASS); r(2, 14, 14, 1, LIGHT_WOOD.hi);
}));

const PIANO = lazy(() => canvas(40, 30, (r) => {
  r(1, 1, 38, 24, OUTLINE); r(0, 0, 40, 3, OUTLINE); r(1, 0, 38, 1, WOOD.hi);
  panel(r, 2, 3, 36, 10); r(4, 4, 7, 7, WOOD.lo); r(29, 4, 7, 7, WOOD.lo);
  r(5, 5, 5, 5, WOOD.base); r(30, 5, 5, 5, WOOD.base);
  // Open two-page score with fold, staves and notes.
  r(13, 3, 14, 8, OUTLINE); r(14, 4, 12, 6, CREAM); r(20, 4, 1, 6, '#b79e77');
  for (const y of [5, 7, 9]) { r(15, y, 4, 1, '#b79e77'); r(22, y, 3, 1, '#b79e77'); }
  r(17, 5, 1, 2, OUTLINE); r(23, 7, 1, 2, OUTLINE);
  r(0, 12, 40, 7, OUTLINE); r(1, 12, 38, 1, BRASS); r(2, 14, 36, 4, CREAM);
  for (let x = 4; x < 37; x += 3) { r(x, 14, 1, 4, '#c5b18c'); if (x % 7 !== 0) r(x, 14, 2, 2, OUTLINE); }
  panel(r, 2, 19, 36, 7); r(4, 21, 32, 2, WOOD.lo);
  r(3, 26, 3, 4, OUTLINE); r(34, 26, 3, 4, OUTLINE); r(3, 26, 1, 3, WOOD.hi);
  r(17, 26, 2, 2, BRASS); r(21, 26, 2, 2, BRASS); r(34, 26, 1, 3, WOOD.base);
}));

// ---------------------------------------------------------------- wall pieces

const MUG_RACK = lazy(() => canvas(32, 16, (r) => {
  panel(r, 0, 0, 32, 5); r(3, 2, 1, 1, BRASS); r(28, 2, 1, 1, BRASS);
  const colors = ['#aa5944', '#627451', '#c8a15e'];
  for (let i = 0; i < 3; i++) {
    const mx = 3 + i * 10, c = colors[i];
    r(mx + 2, 4, 1, 3, BRASS); r(mx, 7, 7, 6, OUTLINE); r(mx + 1, 13, 5, 1, OUTLINE);
    r(mx + 1, 8, 5, 5, c); r(mx + 1, 8, 1, 4, mix(c, CREAM, 0.45));
    r(mx + 1, 7, 5, 1, CREAM); r(mx + 7, 8, 2, 4, OUTLINE); r(mx + 7, 9, 1, 2, c);
    r(mx + 2, 11, 3, 1, mix(c, CREAM, 0.2));
  }
}));

const SCONCE = lazy(() => canvas(8, 16, (r) => {
  r(2, 0, 4, 1, OUTLINE); r(1, 1, 6, 1, BRASS); r(0, 2, 8, 6, OUTLINE);
  r(1, 2, 6, 5, '#e8c47e'); r(2, 2, 3, 5, '#fff2c8'); r(5, 3, 1, 4, '#bb8c4d');
  r(1, 8, 6, 1, BRASS); r(3, 9, 2, 3, OUTLINE); r(3, 9, 1, 2, BRASS);
  r(2, 11, 4, 5, OUTLINE); r(3, 12, 2, 3, WOOD.base); r(3, 12, 1, 1, BRASS);
}));

const GARLAND = lazy(() => canvas(32, 8, (r) => {
  const colors = ['#aa5944', '#c8a15e', '#627451', '#708d8e', '#b98470'];
  for (let x = 0; x < 32; x++) r(x, x < 5 || x > 26 ? 0 : x < 11 || x > 20 ? 1 : 2, 1, 1, WOOD.lo);
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 6, y = i === 0 || i === 4 ? 1 : 2;
    r(x, y, 5, 3, colors[i]); r(x + 1, y + 3, 3, 1, colors[i]); r(x + 2, y + 4, 1, 1, colors[i]);
    r(x, y, 5, 1, mix(colors[i], CREAM, 0.4)); r(x + 1, y + 1, 1, 2, CREAM);
    r(x + 3, y + 1, 1, 1, mix(colors[i], WOOD.lo, 0.3));
  }
}));

const SHELF = lazy(() => canvas(32, 16, (r) => {
  r(0, 11, 32, 3, OUTLINE); r(1, 11, 30, 1, LIGHT_WOOD.hi); r(1, 12, 30, 1, WOOD.base);
  r(3, 14, 3, 2, OUTLINE); r(26, 14, 3, 2, OUTLINE); r(4, 14, 1, 1, BRASS); r(27, 14, 1, 1, BRASS);
  r(3, 6, 7, 5, OUTLINE); r(4, 7, 5, 4, '#ad683f'); r(4, 7, 1, 3, '#e0aa70');
  leaves(r, 2, 2, 6); leaves(r, 7, 4, 5); r(1, 6, 1, 6, SAGE); r(0, 9, 3, 2, SAGE);
  const colors = ['#708d8e', '#aa5944', '#c8a15e'];
  for (let i = 0; i < 3; i++) { const x = 13 + i * 3, y = 2 + i % 2; r(x, y, 3, 9 - y, OUTLINE); r(x, y + 1, 2, 9 - y, colors[i]); r(x, y + 2, 2, 1, CREAM); }
  r(24, 3, 5, 2, BRASS); r(23, 5, 7, 6, OUTLINE); r(24, 5, 5, 6, '#b2bca0');
  r(24, 8, 5, 3, '#6d472f'); r(25, 6, 1, 4, CREAM); r(26, 8, 2, 2, '#ddc695');
}));

const SPRITES: Record<string, () => HTMLCanvasElement> = {
  plant_fig: FIG,
  plant_snake: SNAKE_PLANT,
  coatrack: COAT_RACK,
  lamp: LAMP,
  aframe: AFRAME,
  bench: BENCH,
  catbed: CAT_BED,
  bookshelf: BOOKSHELF,
  armchair: ARMCHAIR,
  gramophone: GRAMOPHONE,
  piano: PIANO,
  mugrack: MUG_RACK,
  sconce: SCONCE,
  garland: GARLAND,
  shelf: SHELF,
};

function spriteFor(id: string): HTMLCanvasElement | undefined {
  return SPRITES[id]?.() ?? plantSprite(id) ?? collectionSprite(id);
}

/** An analog clock face showing `now`, centered on (cx, cy). */
export function paintClock(ctx: Ctx, cx: number, cy: number, now: Date): void {
  const r = filler(ctx);
  const ring = WOOD;
  const disc = (radius: number, color: (dy: number) => string) => {
    for (let dy = -radius; dy <= radius; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      r(cx - half, cy + dy, half * 2 + 1, 1, color(dy));
    }
  };
  disc(10, () => OUTLINE);
  disc(9, (dy) => (dy < -4 ? ring.hi : dy > 5 ? ring.lo : ring.base));
  disc(8, () => BRASS); disc(7, () => '#f4e6c7');
  r(cx - 3, cy - 6, 5, 1, '#fff4d8'); r(cx + 5, cy - 3, 1, 6, '#d3bd94');
  r(cx - 1, cy - 10, 3, 1, '#e4b777');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    r(cx + Math.round(Math.sin(a) * 6), cy - Math.round(Math.cos(a) * 6), 1, 1, i % 3 === 0 ? '#6e4128' : '#c9a882');
  }
  const hand = (angle: number, len: number, color: string) => {
    for (let i = 0; i <= len; i += 0.5) r(cx + Math.round(Math.sin(angle) * i), cy - Math.round(Math.cos(angle) * i), 1, 1, color);
  };
  const min = now.getMinutes() + now.getSeconds() / 60;
  const hr = (now.getHours() % 12) + min / 60;
  hand((min / 60) * Math.PI * 2, 5, '#6e4128');
  hand((hr / 12) * Math.PI * 2, 3.5, OUTLINE);
  r(cx, cy, 1, 1, '#d9574a');
}

/** Warm light around a lamp, under the night tint so it reads as a glow. */
function glow(ctx: Ctx, cx: number, cy: number, radius: number): void {
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(cx, cy, (radius * i) / 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws a wall piece filling its footprint, whose top-left corner is (x, y).
 * `now` drives the clock.
 */
export function paintWallFurniture(ctx: Ctx, id: string, x: number, y: number, t: number, now: Date): void {
  if (getGeneratedFurnitureAdapter()?.paintWall(ctx, id, x, y, now)) {
    if (id === 'sconce') { const def = furnitureDef(id)!; glow(ctx, x + def.w * CELL / 2, y + 4, 12); }
    if (id === 'hanging_ivy') {
      const adapter = getGeneratedFurnitureAdapter()!, sprite = adapter.sprite(id)!, def = furnitureDef(id)!;
      const left = Math.round(x + (def.w * CELL - sprite.width) / 2), top = Math.round(y + (def.h * CELL - sprite.height) / 2);
      const points = adapter.overlay(id)?.points;
      ctx.save(); ctx.strokeStyle = '#846347'; ctx.lineWidth = 0.5;
      for (const point of [points?.leftAttachment, points?.rightAttachment]) if (point) {
        ctx.beginPath(); ctx.moveTo(x + def.w * CELL / 2, y); ctx.lineTo(left + point.x, top + point.y); ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  const def = furnitureDef(id);
  if (!def) return;
  const w = def.w * CELL;
  const h = def.h * CELL;
  if (id === 'clock') return paintClock(ctx, x + w / 2, y + h / 2, now);
  if (id.startsWith('art_')) return paintArt(ctx, id, x + 3, y + 1, t);
  const sprite = spriteFor(id);
  if (!sprite) return;
  ctx.drawImage(sprite, Math.round(x + (w - sprite.width) / 2), Math.round(y + (h - sprite.height) / 2));
  if (id === 'sconce') glow(ctx, x + w / 2, y + 4, 12);
}

/** Draws a floor piece standing centered at cx with its feet on footY. */
export function paintFloorFurniture(ctx: Ctx, id: string, cx: number, footY: number): void {
  const generated = getGeneratedFurnitureAdapter(), bitmap = generated?.sprite(id);
  if (bitmap) {
    shadow(ctx, cx, footY, Math.max(10, bitmap.width * 0.8));
    if (generated!.paintFloor(ctx, id, cx, footY)) {
      if (id === 'lamp' || id === 'lantern') {
        const wick = generated!.overlay(id)?.points.wick;
        glow(ctx, wick ? cx - bitmap.width / 2 + wick.x : cx, footY - bitmap.height + (wick ? 1 + wick.y : 4), 18);
      }
      return;
    }
  }
  const sprite = spriteFor(id);
  if (!sprite) return;
  shadow(ctx, cx, footY, Math.max(10, sprite.width * 0.8));
  const x = Math.round(cx - sprite.width / 2);
  ctx.drawImage(sprite, x, footY - sprite.height + 1);
  if (id === 'lamp' || id === 'lantern') glow(ctx, cx, footY - sprite.height + 4, 18);
}

/** The drawn bounds of a floor piece, for tapping it. */
export function floorFurnitureBounds(id: string, cx: number, footY: number): { x: number; y: number; w: number; h: number } {
  const generated = getGeneratedFurnitureAdapter()?.floorBounds(id, cx, footY);
  if (generated) return generated;
  const sprite = spriteFor(id);
  const w = sprite?.width ?? CELL;
  const h = sprite?.height ?? CELL;
  return { x: cx - w / 2, y: footY - h + 1, w, h };
}

// ---------------------------------------------------------------- shop thumbnails

const ICON_W = 28;
const ICON_H = 24;
const iconCache = new Map<string, HTMLCanvasElement>();

export function furnitureIcon(id: string): HTMLCanvasElement {
  const generated = getGeneratedFurnitureAdapter()?.icon(id);
  if (generated) return generated;
  let c = iconCache.get(id);
  if (c) return c;
  c = canvas(ICON_W, ICON_H, (_, ctx) => {
    if (id === 'clock') return paintClock(ctx, ICON_W / 2, ICON_H / 2, new Date(2000, 0, 1, 10, 10));
    let art: HTMLCanvasElement | undefined;
    if (id.startsWith('art_')) art = canvas(26, 22, (__, a) => paintArt(a, id, 0, 0));
    else art = spriteFor(id);
    if (!art) return;
    const k = Math.min(1, ICON_W / art.width, ICON_H / art.height);
    const w = Math.round(art.width * k);
    const h = Math.round(art.height * k);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, Math.round((ICON_W - w) / 2), ICON_H - h, w, h);
  });
  iconCache.set(id, c);
  return c;
}

/** Tint for the cells a piece would cover while it's being placed. */
export const GHOST_OK = mix('#7fe36a', '#ffffff', 0.2);
export const GHOST_BAD = '#e2434b';
