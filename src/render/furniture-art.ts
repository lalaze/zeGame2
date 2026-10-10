// Pixel art for placeable furniture. Wall pieces are drawn into their footprint;
// floor pieces stand on the floor, centered on their footprint, and may rise above it.
import { CELL, furnitureDef } from '../game/furniture';
import { mix, ramp } from './color';
import { paintArt, plantSprite, shadow } from './decor-art';
import { OUTLINE, pixelSprite } from './sprites';

type Ctx = CanvasRenderingContext2D;
type Fill = (x: number, y: number, w: number, h: number, color: string) => void;

const filler =
  (ctx: Ctx): Fill =>
  (x, y, w, h, color) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
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

const WOOD = ramp('#8a5a3c');
const LIGHT_WOOD = ramp('#b07a4a');

/** A tall fiddle-leaf fig in a terracotta pot. Also stands by the front door. */
export const FIG = lazy(() =>
  pixelSprite(
    [
      '.....lg.......', '...lgGg..lg....', '..gGGg..gGgl...', '..gGg.lgGGg....', '...g.gGGgg.lg..',
      '.lgg..gGg..gGg.', 'gGGgl..b.lgGGg.', '.gGGg..b.gGGg..', '..gg..lbgg.g...', '..lgg.gb.......',
      '.gGGgggb.lgg...', '.gGGg..bgGGGg..', '..gg...bgGGg...', '.......b.gg....', '.......b.......',
      '....qqqqqq.....', '...rrrrrrrr....', '...rRrrrrRr....', '...rRrrrrRr....', '....rrrrrr.....',
      '....RRRRRR.....',
    ],
    { g: '#6fb26a', G: '#4e8a4f', l: '#9fd47e', b: '#6b4630', r: '#d2774f', R: '#a8553a', q: '#e8936a' },
  ),
);

// ---------------------------------------------------------------- floor pieces

const LAMP = lazy(() =>
  pixelSprite(
    [
      '...sssss...', '..sSSSSSs..', '.sSSSSSSSs.', 'sSSSSSSSSSs', 'kkkkkkkkkkk', '.....l.....',
      '.....p.....', '.....p.....', '.....p.....', '.....p.....', '.....p.....', '.....p.....',
      '.....p.....', '.....p.....', '.....p.....', '.....p.....', '.....p.....', '.....p.....',
      '.....p.....', '.....p.....', '....ppp....', '..PPPPPPP..',
    ],
    { s: '#e8b45a', S: '#f6d58a', k: '#c0843a', l: '#fff6c8', p: '#4a3a36', P: '#2e2422' },
  ),
);

const SNAKE_PLANT = lazy(() =>
  pixelSprite(
    [
      '.l..g..', '.g..gl.', 'lg.lGg.', 'gG.gGg.', 'gGlgGgl', 'gGgGgGg', 'gGgGgGg', '.gGgGg.', '.gGgGg.',
      'qqqqqqq', 'rrrrrrr', 'rRrrrRr', 'rRrrrRr', '.rrrrr.', '.RRRRR.',
    ],
    { g: '#5f9a5a', G: '#3f6f42', l: '#c9d97e', r: '#e8e0d0', R: '#b9ad98', q: '#f4efe4' },
  ),
);

const COAT_RACK = lazy(() =>
  canvas(10, 28, (r) => {
    r(4, 3, 2, 22, OUTLINE);
    r(4, 3, 1, 22, WOOD.base);
    // Hooks, a scarf and a hat.
    r(1, 4, 8, 1, OUTLINE);
    r(0, 3, 2, 1, OUTLINE);
    r(8, 3, 2, 1, OUTLINE);
    r(3, 0, 4, 3, OUTLINE);
    r(4, 1, 2, 1, WOOD.hi);
    r(6, 5, 3, 9, '#d9574a');
    r(6, 5, 1, 9, '#f08a7a');
    r(6, 13, 3, 1, '#fdf6ec');
    r(0, 5, 4, 3, '#3f5f93');
    r(1, 4, 2, 1, '#3f5f93');
    // Splayed feet.
    r(1, 25, 8, 1, OUTLINE);
    r(0, 26, 3, 2, OUTLINE);
    r(7, 26, 3, 2, OUTLINE);
  }),
);

const AFRAME = lazy(() =>
  canvas(16, 19, (r) => {
    for (let y = 0; y < 15; y++) {
      const inset = Math.round(((14 - y) * 2) / 14);
      r(inset, y, 16 - inset * 2, 1, OUTLINE);
      if (y > 0 && y < 14) {
        r(inset + 1, y, 14 - inset * 2, 1, WOOD.base);
        if (y > 1 && y < 13) r(inset + 2, y, 12 - inset * 2, 1, '#2d4a3a');
      }
    }
    r(5, 0, 6, 1, WOOD.hi);
    // Chalk: a cup and a couple of lines of writing.
    r(6, 3, 4, 3, '#f5efe0');
    r(10, 4, 1, 1, '#f5efe0');
    r(7, 2, 1, 1, '#c9d8cc');
    r(4, 8, 8, 1, '#f5efe0');
    r(5, 10, 6, 1, '#c9d8cc');
    r(1, 15, 3, 4, OUTLINE);
    r(12, 15, 3, 4, OUTLINE);
    r(2, 15, 1, 3, WOOD.lo);
    r(13, 15, 1, 3, WOOD.lo);
  }),
);

const BENCH = lazy(() =>
  canvas(32, 16, (r) => {
    // Backrest: two rails between end posts.
    r(1, 0, 4, 12, OUTLINE);
    r(27, 0, 4, 12, OUTLINE);
    r(2, 1, 2, 11, WOOD.base);
    r(28, 1, 2, 11, WOOD.base);
    for (const y of [1, 4]) {
      r(4, y - 1, 24, 3, OUTLINE);
      r(4, y, 24, 1, LIGHT_WOOD.base);
    }
    // Seat with a mint cushion, apron and legs.
    r(0, 6, 32, 5, OUTLINE);
    r(1, 7, 30, 2, LIGHT_WOOD.hi);
    r(1, 9, 30, 1, LIGHT_WOOD.lo);
    r(3, 5, 26, 3, OUTLINE);
    r(4, 5, 24, 2, '#a6cfae');
    r(4, 5, 24, 1, '#c8e6cd');
    r(2, 11, 3, 5, OUTLINE);
    r(27, 11, 3, 5, OUTLINE);
    r(3, 11, 1, 4, WOOD.lo);
    r(28, 11, 1, 4, WOOD.lo);
  }),
);

const CAT_BED = lazy(() =>
  canvas(18, 11, (r) => {
    const rim = ramp('#c0443c');
    for (let y = 0; y < 9; y++) {
      const half = Math.round(Math.sqrt(1 - ((y - 4.5) / 5) ** 2) * 9);
      r(9 - half, y + 2, half * 2, 1, OUTLINE);
      if (half > 1) r(10 - half, y + 2, half * 2 - 2, 1, y < 2 || y > 6 ? rim.base : '#f2d9b8');
    }
    // A curled-up ginger cat, asleep.
    r(5, 4, 9, 4, '#e8914a');
    r(4, 5, 11, 2, '#e8914a');
    r(6, 4, 6, 1, '#f2b57a');
    r(4, 3, 2, 2, '#e8914a');
    r(7, 3, 2, 1, '#e8914a');
    r(5, 5, 2, 1, OUTLINE);
    r(11, 7, 4, 1, '#c86f36');
    r(9, 6, 1, 1, '#c86f36');
  }),
);

const BOOKSHELF = lazy(() =>
  canvas(32, 34, (r) => {
    r(0, 4, 32, 30, OUTLINE);
    r(1, 5, 30, 28, WOOD.base);
    r(1, 5, 30, 1, WOOD.hi);
    const books = ['#d9574a', '#5f9479', '#f2c14e', '#7d9ac4', '#9f78d2', '#e8936a', '#fdf6ec'];
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 7 + shelf * 9;
      r(3, y, 26, 7, WOOD.dark);
      let x = 3;
      for (let i = 0; x < 27; i++) {
        const w = Math.min(2 + ((i * 7 + shelf * 3) % 3), 29 - x);
        const h = 5 + ((i + shelf) % 3);
        const c = books[(i * 3 + shelf * 2) % books.length];
        if ((i + shelf) % 5 !== 4) {
          r(x, y + 7 - h, w, h, c);
          r(x, y + 7 - h, 1, h, ramp(c).hi);
        }
        x += w + (i % 4 === 3 ? 2 : 0);
      }
      r(1, y + 7, 30, 2, WOOD.lo);
      r(1, y + 7, 30, 1, WOOD.hi);
    }
    // A little plant on top.
    r(23, 2, 6, 3, '#d2774f');
    r(22, 0, 2, 3, '#6fb26a');
    r(24, 0, 3, 2, '#4e8a4f');
    r(27, 1, 2, 1, '#9fd47e');
  }),
);

const ARMCHAIR = lazy(() =>
  canvas(24, 22, (r) => {
    const v = ramp('#c0674a');
    // Rounded back.
    r(3, 0, 18, 13, OUTLINE);
    r(2, 1, 20, 12, OUTLINE);
    r(4, 1, 16, 11, v.base);
    r(3, 2, 18, 10, v.base);
    r(5, 2, 6, 1, v.hi);
    for (const bx of [8, 15]) r(bx, 5, 1, 1, v.lo);
    // Arms, seat cushion, skirt and legs.
    r(0, 9, 6, 9, OUTLINE);
    r(18, 9, 6, 9, OUTLINE);
    r(1, 10, 4, 7, v.base);
    r(19, 10, 4, 7, v.lo);
    r(1, 10, 4, 1, v.hi);
    r(19, 10, 4, 1, v.hi);
    r(5, 12, 14, 6, OUTLINE);
    r(6, 12, 12, 2, v.hi);
    r(6, 14, 12, 3, v.base);
    r(1, 17, 22, 2, v.lo);
    r(0, 17, 24, 1, OUTLINE);
    r(2, 19, 2, 3, OUTLINE);
    r(20, 19, 2, 3, OUTLINE);
  }),
);

const GRAMOPHONE = lazy(() =>
  canvas(18, 22, (r) => {
    const brass = ramp('#d9a441');
    // The horn flares up and to the left.
    for (let i = 0; i < 9; i++) {
      const half = 1 + Math.floor(i * 0.7);
      r(9 - i - half, 1 + i, half * 2 + 2, 1, OUTLINE);
      r(10 - i - half, 1 + i, half * 2, 1, i < 2 ? brass.hi : i > 6 ? brass.lo : brass.base);
    }
    r(1, 2, 4, 1, '#3a2418');
    r(9, 9, 3, 4, OUTLINE);
    r(10, 9, 1, 4, brass.base);
    // Record and box.
    r(2, 12, 14, 2, OUTLINE);
    r(3, 12, 12, 1, '#2a2a30');
    r(8, 12, 2, 1, '#d9574a');
    r(1, 14, 16, 8, OUTLINE);
    r(2, 15, 14, 6, WOOD.base);
    r(2, 15, 14, 1, WOOD.hi);
    r(4, 17, 10, 2, WOOD.lo);
    r(15, 16, 2, 2, brass.base);
  }),
);

const PIANO = lazy(() =>
  canvas(40, 30, (r) => {
    const body = ramp('#3d2a2a');
    r(0, 0, 40, 26, OUTLINE);
    r(1, 1, 38, 12, body.base);
    r(1, 1, 38, 2, body.hi);
    r(4, 5, 32, 6, body.lo);
    // Sheet music on the stand.
    r(14, 3, 12, 7, OUTLINE);
    r(15, 4, 10, 5, '#fdf6ec');
    for (const y of [5, 7]) r(16, y, 8, 1, '#9a8f86');
    // Keys.
    r(1, 13, 38, 1, body.dark);
    r(2, 14, 36, 4, '#fdf6ec');
    for (let x = 4; x < 37; x += 3) if (x % 7 !== 0) r(x, 14, 2, 2, OUTLINE);
    r(1, 18, 38, 8, body.base);
    r(1, 18, 38, 1, body.hi);
    r(6, 20, 28, 4, body.lo);
    r(3, 26, 3, 4, OUTLINE);
    r(34, 26, 3, 4, OUTLINE);
    r(18, 26, 4, 2, '#d9a441');
  }),
);

// ---------------------------------------------------------------- wall pieces

const MUG_RACK = lazy(() =>
  canvas(32, 16, (r) => {
    const wood = ramp('#9a6740');
    r(0, 0, 32, 5, OUTLINE);
    r(1, 1, 30, 3, wood.base);
    r(1, 1, 30, 1, wood.hi);
    ['#d9574a', '#5f9479', '#f2c14e'].forEach((c, i) => {
      const mx = 4 + i * 10;
      const mug = ramp(c);
      r(mx + 2, 4, 1, 2, OUTLINE);
      r(mx - 1, 6, 8, 7, OUTLINE);
      r(mx + 7, 7, 2, 4, OUTLINE);
      r(mx, 7, 6, 5, mug.base);
      r(mx, 7, 1, 5, mug.hi);
      r(mx + 5, 7, 1, 5, mug.lo);
      r(mx + 7, 8, 1, 2, mug.lo);
    });
  }),
);

const SCONCE = lazy(() =>
  canvas(8, 16, (r) => {
    const brass = ramp('#d9a441');
    r(2, 9, 4, 6, OUTLINE);
    r(3, 10, 2, 4, brass.base);
    r(3, 6, 2, 4, OUTLINE);
    r(0, 0, 8, 7, OUTLINE);
    r(1, 1, 6, 5, '#f6d58a');
    r(1, 1, 6, 1, '#fff3c4');
    r(1, 5, 6, 1, '#e8b45a');
  }),
);

const GARLAND = lazy(() =>
  canvas(32, 8, (r) => {
    const colors = ['#d9574a', '#f2c14e', '#5f9479', '#7d9ac4', '#ef8fa8'];
    const sag = (x: number) => Math.round(Math.sin((x / 31) * Math.PI) * 2);
    for (let x = 0; x < 32; x++) r(x, sag(x), 1, 1, '#4a2e1e');
    for (let i = 0; i < 5; i++) {
      const x = 2 + i * 6;
      const y = sag(x + 2) + 1;
      for (let row = 0; row < 5; row++) r(x + Math.floor(row / 2), y + row, 5 - Math.floor(row / 2) * 2, 1, colors[i]);
      r(x, y, 5, 1, ramp(colors[i]).hi);
    }
  }),
);

const SHELF = lazy(() =>
  canvas(32, 16, (r) => {
    const wood = ramp('#9a6740');
    // Bracket shelf with a pot of ivy, books and a jar on it.
    r(0, 11, 32, 4, OUTLINE);
    r(1, 12, 30, 2, wood.base);
    r(1, 12, 30, 1, wood.hi);
    for (const bx of [4, 26]) {
      r(bx, 15, 2, 1, OUTLINE);
      r(bx + 1, 15, 1, 1, OUTLINE);
    }
    r(3, 6, 7, 6, OUTLINE);
    r(4, 7, 5, 4, '#d2774f');
    r(2, 3, 3, 4, '#6fb26a');
    r(5, 2, 3, 4, '#4e8a4f');
    r(8, 4, 3, 3, '#9fd47e');
    r(1, 7, 2, 5, '#6fb26a');
    ['#7d9ac4', '#d9574a', '#f2c14e'].forEach((c, i) => {
      r(13 + i * 3, 3 + (i % 2), 3, 8 - (i % 2), OUTLINE);
      r(13 + i * 3, 4 + (i % 2), 2, 7 - (i % 2), c);
    });
    r(23, 5, 6, 6, OUTLINE);
    r(24, 6, 4, 5, '#d6ecf2');
    r(24, 8, 4, 3, '#6e3f24');
    r(23, 4, 6, 1, '#c97d34');
  }),
);

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
  return SPRITES[id]?.() ?? plantSprite(id);
}

/** An analog clock face showing `now`, centered on (cx, cy). */
export function paintClock(ctx: Ctx, cx: number, cy: number, now: Date): void {
  const r = filler(ctx);
  const ring = ramp('#9a6740');
  const disc = (radius: number, color: (dy: number) => string) => {
    for (let dy = -radius; dy <= radius; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      r(cx - half, cy + dy, half * 2 + 1, 1, color(dy));
    }
  };
  disc(10, () => OUTLINE);
  disc(9, (dy) => (dy < -4 ? ring.hi : ring.base));
  disc(7, () => '#fbf3e4');
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
  const sprite = spriteFor(id);
  if (!sprite) return;
  shadow(ctx, cx, footY, Math.max(10, sprite.width * 0.8));
  const x = Math.round(cx - sprite.width / 2);
  ctx.drawImage(sprite, x, footY - sprite.height + 1);
  if (id === 'lamp') glow(ctx, cx, footY - sprite.height + 4, 18);
}

/** The drawn bounds of a floor piece, for tapping it. */
export function floorFurnitureBounds(id: string, cx: number, footY: number): { x: number; y: number; w: number; h: number } {
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
