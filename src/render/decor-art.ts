// Pixel art for every decor item, in a shaded Stardew-like style. Each painter
// draws into a region so the same code renders both the café scene and the
// small thumbnails in the shop.
import { decorDef } from '../game/decor';
import { mix, ramp, type Ramp } from './color';
import { drawText, textWidth } from './font';
import { OUTLINE, pixelSprite } from './sprites';

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Cheap deterministic noise so textured patterns don't shimmer between frames. */
export const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Wood grain: short streaks of the ramp's light and dark tones running along
 * the boards ('h' horizontal, 'v' vertical), plus the odd knot.
 */
export function grain(ctx: Ctx, x0: number, y0: number, w: number, h: number, wood: Ramp, dir: 'h' | 'v', seed = 0): void {
  const lo = mix(wood.base, wood.lo, 0.7);
  const hi = mix(wood.base, wood.hi, 0.6);
  const along = dir === 'h' ? w : h;
  const across = dir === 'h' ? h : w;
  for (let a = 0; a < across; a++) {
    const len = 3 + Math.floor(hash(a, seed) * 5);
    const shift = Math.floor(hash(seed, a) * 9);
    for (let b = 0; b < along; b++) {
      const v = hash(Math.floor((b + shift) / len) + seed * 31, a + seed);
      const c = v < 0.16 ? lo : v > 0.95 ? hi : null;
      if (!c) continue;
      if (dir === 'h') rect(ctx, x0 + b, y0 + a, 1, 1, c);
      else rect(ctx, x0 + a, y0 + b, 1, 1, c);
    }
  }
}

// ---------------------------------------------------------------- walls

interface WallStyle {
  base: string;
  accent: string;
  pattern: 'stripes' | 'flowers' | 'brick' | 'panels' | 'stars';
  wainscot: string;
}

const WALLS: Record<string, WallStyle> = {
  wall_cream: { base: '#f2d9ae', accent: '#e8c891', pattern: 'stripes', wainscot: '#a8693d' },
  wall_mint: { base: '#cfe8d3', accent: '#b6dbbf', pattern: 'stripes', wainscot: '#5f9479' },
  wall_rose: { base: '#f6d6d6', accent: '#ecbcc0', pattern: 'stripes', wainscot: '#b9707d' },
  wall_dots: { base: '#d5e6f4', accent: '#f4f8fb', pattern: 'flowers', wainscot: '#5d7fa8' },
  wall_brick: { base: '#b9634a', accent: '#d9a58b', pattern: 'brick', wainscot: '#5a3a28' },
  wall_walnut: { base: '#7a4e33', accent: '#5f3a25', pattern: 'panels', wainscot: '#4a2e1e' },
  wall_stars: { base: '#2c3263', accent: '#fff3c4', pattern: 'stars', wainscot: '#3b2a58' },
};

const wallStyle = (id: string) => WALLS[id] ?? WALLS.wall_cream;

export function paintWall(ctx: Ctx, id: string, x0: number, y0: number, w: number, h: number, t = 0): void {
  const s = wallStyle(id);
  const r = ramp(s.base);
  rect(ctx, x0, y0, w, h, s.base);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0;
      const ly = y - y0;
      let c: string | null = null;
      switch (s.pattern) {
        case 'stripes': {
          const m = lx % 16;
          if (m >= 8) c = s.accent;
          if (m === 8) c = ramp(s.accent).lo;
          if (m >= 9 && m <= 14 && ly % 12 === 6 && m % 2 === 1) c = r.hi;
          break;
        }
        case 'flowers': {
          const cx = (lx + (Math.floor(ly / 12) % 2) * 8) % 16;
          const cy = ly % 12;
          if ((cx === 7 && (cy === 5 || cy === 7)) || (cy === 6 && (cx === 6 || cx === 8))) c = s.accent;
          else if (cx === 7 && cy === 6) c = '#f2c14e';
          else if (cx === 9 && cy === 8) c = r.lo;
          break;
        }
        case 'brick': {
          const row = Math.floor(ly / 8);
          const bx = (lx + (row % 2) * 8) % 16;
          const by = ly % 8;
          if (by === 7 || bx === 15) c = s.accent;
          else if (by === 0) c = r.hi;
          else if (by === 6) c = r.lo;
          else if (hash(Math.floor((lx + (row % 2) * 8) / 16), row) < 0.3) c = ramp(s.base).lo;
          break;
        }
        case 'panels': {
          const m = lx % 10;
          if (m === 0) c = ramp(s.base).dark;
          else if (m === 1) c = r.hi;
          else if (hash(lx, Math.floor(ly / 3)) < 0.08) c = s.accent;
          break;
        }
        case 'stars': {
          const v = hash(lx, ly);
          if (v < 0.006 && (Math.floor(t * 1.5) + lx) % 5 !== 0) c = s.accent;
          else if (v > 0.9985) c = '#8fa3e8';
          break;
        }
      }
      if (c) rect(ctx, x, y, 1, 1, c);
    }
  }
  // Soft shadow under the ceiling.
  ctx.save();
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 0.16 - i * 0.04;
    rect(ctx, x0, y0 + i, w, 1, '#2a1410');
  }
  ctx.restore();
}

export function paintWainscot(ctx: Ctx, id: string, x0: number, y0: number, w: number, h: number): void {
  const wood = ramp(wallStyle(id).wainscot);
  rect(ctx, x0, y0, w, h, wood.base);
  // Vertical boards with grain, a dark gap and a bright bevel on each.
  for (let bx = x0, i = 0; bx < x0 + w; bx += 8, i++) {
    const bw = Math.min(8, x0 + w - bx);
    const tone = hash(i, 7) < 0.3 ? ramp(mix(wood.base, wood.lo, 0.35)) : wood;
    rect(ctx, bx, y0, bw, h, tone.base);
    grain(ctx, bx + 1, y0 + 1, bw - 2, h - 2, tone, 'v', i);
    rect(ctx, bx, y0, 1, h, wood.dark);
    rect(ctx, bx + 1, y0, 1, h, tone.hi);
  }
  // Chair rail on top, shadow at the bottom.
  rect(ctx, x0, y0 - 3, w, 1, wood.hi);
  rect(ctx, x0, y0 - 2, w, 2, wood.base);
  rect(ctx, x0, y0, w, 1, wood.dark);
  rect(ctx, x0, y0 + h - 1, w, 1, wood.lo);
}

export const wainscotColor = (id: string) => wallStyle(id).wainscot;

// ---------------------------------------------------------------- floors

export function paintFloor(ctx: Ctx, id: string, x0: number, y0: number, w: number, h: number): void {
  // Beveled tiles in the Stardew manner: bright top-left edge, shaded
  // bottom-right edge, a dark grout line and a little speckle.
  const tiles = (a: string, b: string, size: number, speckle = 0.02) => {
    for (let y = y0, ty = 0; y < y0 + h; y += size, ty++) {
      for (let x = x0, tx = 0; x < x0 + w; x += size, tx++) {
        const c = (tx + ty) % 2 ? b : a;
        const r = ramp(c);
        const tw = Math.min(size, x0 + w - x);
        const th = Math.min(size, y0 + h - y);
        rect(ctx, x, y, tw, th, c);
        rect(ctx, x + 1, y + 1, tw - 2, 1, r.hi);
        rect(ctx, x + 1, y + 1, 1, th - 2, r.hi);
        rect(ctx, x + 1, y + th - 2, tw - 2, 1, r.lo);
        rect(ctx, x + tw - 2, y + 1, 1, th - 2, r.lo);
        const grout = mix(c, '#5a3a2a', 0.4);
        rect(ctx, x, y + th - 1, tw, 1, grout);
        rect(ctx, x + tw - 1, y, 1, th, grout);
        for (let sy = y + 2; sy < y + th - 2; sy++) {
          for (let sx = x + 2; sx < x + tw - 2; sx++) {
            const v = hash(sx, sy);
            if (v < speckle) rect(ctx, sx, sy, 1, 1, v < speckle / 3 ? r.hi : mix(c, r.lo, 0.6));
          }
        }
      }
    }
  };
  switch (id) {
    case 'floor_planks': {
      const tones = ['#c9894f', '#bd7d45', '#d29558'];
      for (let y = y0, row = 0; y < y0 + h; y += 8, row++) {
        const offset = (row * 23) % 48;
        for (let x = x0 - offset, i = 0; x < x0 + w; x += 48, i++) {
          const c = tones[Math.floor(hash(i, row) * tones.length)];
          const bx = Math.max(x, x0);
          const bw = Math.min(x + 48, x0 + w) - bx;
          rect(ctx, bx, y, bw, 8, c);
          rect(ctx, bx, y, bw, 1, ramp(c).hi);
          rect(ctx, bx, y + 7, bw, 1, '#6e4128');
          if (x >= x0) rect(ctx, x, y, 1, 7, '#6e4128');
          // Grain and the odd knot.
          grain(ctx, bx + 1, y + 1, bw - 1, 6, ramp(c), 'h', i * 13 + row);
          if (bw > 24 && hash(i * 7, row) < 0.25) {
            rect(ctx, bx + 20, y + 3, 3, 2, ramp(c).lo);
            rect(ctx, bx + 21, y + 3, 1, 1, ramp(c).dark);
          }
        }
      }
      return;
    }
    case 'floor_mint':
      return tiles('#dff2e4', '#c3e3cf', 16);
    case 'floor_terrazzo': {
      tiles('#ece5d8', '#e6ddcd', 32, 0);
      const chips = ['#d98c7a', '#7fb2a0', '#e8c06a', '#9a8f86', '#ffffff'];
      for (let y = y0; y < y0 + h; y += 2) {
        for (let x = x0; x < x0 + w; x += 2) {
          const v = hash(x, y);
          if (v < 0.07) rect(ctx, x, y, v < 0.02 ? 2 : 1, 1, chips[Math.floor(v * 1000) % chips.length]);
        }
      }
      return;
    }
    case 'floor_herringbone': {
      const a = ramp('#c38450');
      const b = ramp('#a96c3c');
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const lx = x - x0;
          const v = lx % 16 < 8 ? lx % 8 : 7 - (lx % 8);
          const k = (y - y0 + v) % 8;
          const tone = Math.floor((y - y0 + v) / 8) % 2 ? b : a;
          rect(ctx, x, y, 1, 1, k === 0 ? tone.hi : k === 7 ? tone.dark : tone.base);
        }
      }
      return;
    }
    case 'floor_marble': {
      tiles('#f4f0ea', '#ebe4da', 32, 0);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          if ((x + 2 * y) % 53 === 0 || (x * 3 - y) % 89 === 0) rect(ctx, x, y, 1, 1, '#cfc6b8');
        }
      }
      return;
    }
    default:
      return tiles('#f2e0c2', '#e4c9a0', 16, 0.012);
  }
}

// ---------------------------------------------------------------- counters

interface CounterStyle {
  top: string;
  front: string;
  veins?: string;
  trim?: string;
}

const COUNTERS: Record<string, CounterStyle> = {
  counter_oak: { top: '#d49a5e', front: '#a46a3c' },
  counter_walnut: { top: '#8c5a3b', front: '#5e3a26' },
  counter_marble: { top: '#f3efe8', front: '#e2dace', veins: '#c9c0b2' },
  counter_pink: { top: '#f7c3cf', front: '#e98fa6' },
  counter_gold: { top: '#f3dfa6', front: '#363c5c', trim: '#e7b84a' },
};

/** The top and front colors of a counter style, for furniture that should match it. */
export function counterColors(id: string): { top: string; front: string; trim?: string } {
  return COUNTERS[id] ?? COUNTERS.counter_oak;
}

/** Draws a counter in 3/4 view: a top surface of height topH, then the front face. */
export function paintCounter(ctx: Ctx, id: string, x: number, y: number, w: number, topH: number, frontH: number): void {
  const s = COUNTERS[id] ?? COUNTERS.counter_oak;
  const top = ramp(s.top);
  const front = ramp(s.front);
  const wooden = !s.veins && !s.trim;
  // Top surface: long boards, darker toward the back, bright lip at the front edge.
  rect(ctx, x, y, w, topH, top.base);
  if (wooden) {
    for (let by = y + 1; by < y + topH - 2; by += 4) {
      grain(ctx, x, by, w, 3, top, 'h', by);
      rect(ctx, x, by + 3, w, 1, top.lo);
    }
  }
  rect(ctx, x, y, w, 1, top.lo);
  rect(ctx, x, y + topH - 3, w, 1, top.hi);
  rect(ctx, x, y + topH - 2, w, 1, top.base);
  rect(ctx, x, y + topH - 1, w, 1, s.trim ?? top.dark);
  if (s.veins) {
    for (let vy = y; vy < y + topH + frontH; vy++) {
      for (let vx = x; vx < x + w; vx++) if ((vx * 2 + vy * 3) % 37 === 0) rect(ctx, vx, vy, 1, 1, s.veins);
    }
  }
  // Front face: vertical boards, or raised panels for the fancy counters.
  const fy = y + topH;
  rect(ctx, x, fy, w, frontH, front.base);
  if (wooden) {
    for (let bx = x, i = 0; bx < x + w; bx += 7, i++) {
      const bw = Math.min(7, x + w - bx);
      grain(ctx, bx + 1, fy + 1, bw - 1, frontH - 4, front, 'v', i + 3);
      rect(ctx, bx, fy, 1, frontH, front.dark);
      rect(ctx, bx + 1, fy + 1, 1, frontH - 4, front.hi);
    }
  } else {
    const panelW = Math.min(30, w - 6);
    for (let px = x + 4; px + panelW <= x + w - 3; px += panelW + 5) {
      rect(ctx, px, fy + 4, panelW, frontH - 9, front.lo);
      rect(ctx, px + 1, fy + 5, panelW - 2, frontH - 11, front.base);
      rect(ctx, px + 1, fy + 5, panelW - 2, 1, front.hi);
      if (s.trim) rect(ctx, px, fy + 4, panelW, 1, s.trim);
    }
    if (s.veins) for (let vx = x + 2; vx < x + w; vx += 13) rect(ctx, vx, fy + 3 + (vx % 5), 3, 1, s.veins);
  }
  // Shadow under the lip and a dark kick plate.
  rect(ctx, x, fy, w, 1, front.dark);
  rect(ctx, x, fy + 1, w, 1, front.lo);
  rect(ctx, x, fy + frontH - 3, w, 3, front.dark);
  rect(ctx, x, fy + frontH - 3, w, 1, front.lo);
  // Outline.
  rect(ctx, x - 1, y, 1, topH + frontH, OUTLINE);
  rect(ctx, x + w, y, 1, topH + frontH, OUTLINE);
  rect(ctx, x, y - 1, w, 1, OUTLINE);
}

// ---------------------------------------------------------------- wall art (26x22)

export function paintArt(ctx: Ctx, id: string, x: number, y: number, t = 0): void {
  if (id === 'art_none') return;
  const frameColor = id === 'art_bean' ? '#3e2618' : id === 'art_cat' ? '#8a5a3c' : '#d9a441';
  const frame = ramp(frameColor);
  rect(ctx, x, y, 26, 22, OUTLINE);
  rect(ctx, x + 1, y + 1, 24, 20, frame.base);
  rect(ctx, x + 1, y + 1, 24, 1, frame.hi);
  rect(ctx, x + 1, y + 20, 24, 1, frame.lo);
  const ix = x + 3;
  const iy = y + 3;
  const iw = 20;
  const ih = 16;
  switch (id) {
    case 'art_landscape':
      rect(ctx, ix, iy, iw, ih, '#9fd3ee');
      rect(ctx, ix, iy, iw, 4, '#c3e5f5');
      rect(ctx, ix + 14, iy + 2, 3, 3, '#fff3a0');
      rect(ctx, ix + 3, iy + 7, 8, 3, '#8fbf6a');
      rect(ctx, ix + 1, iy + 9, 12, 3, '#8fbf6a');
      rect(ctx, ix + 8, iy + 8, 12, 4, '#6fa255');
      rect(ctx, ix, iy + 11, iw, 5, '#5e9248');
      rect(ctx, ix + 4, iy + 12, 6, 1, '#7fb55e');
      return;
    case 'art_cat':
      rect(ctx, ix, iy, iw, ih, '#f6c5d1');
      rect(ctx, ix, iy + 12, iw, 4, '#e8a9b9');
      rect(ctx, ix + 5, iy + 5, 10, 9, '#ef9f4c');
      rect(ctx, ix + 5, iy + 2, 3, 3, '#ef9f4c');
      rect(ctx, ix + 12, iy + 2, 3, 3, '#ef9f4c');
      rect(ctx, ix + 6, iy + 3, 1, 1, '#f08f8f');
      rect(ctx, ix + 13, iy + 3, 1, 1, '#f08f8f');
      rect(ctx, ix + 7, iy + 8, 1, 2, OUTLINE);
      rect(ctx, ix + 12, iy + 8, 1, 2, OUTLINE);
      rect(ctx, ix + 9, iy + 10, 2, 1, '#f08f8f');
      rect(ctx, ix + 8, iy + 11, 4, 2, '#fdf1e0');
      return;
    case 'art_bean': {
      rect(ctx, ix, iy, iw, ih, '#fbf1e0');
      const bean = ramp('#6e3f24');
      for (let row = 0; row < 12; row++) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - ((row - 5.5) / 6.2) ** 2)) * 6);
        rect(ctx, ix + 10 - half, iy + 2 + row, half * 2, 1, row < 4 ? bean.hi : row > 8 ? bean.lo : bean.base);
      }
      for (let i = 0; i < 10; i++) rect(ctx, ix + 9 + (i % 3 === 1 ? 1 : 0), iy + 3 + i, 1, 1, '#c48a55');
      return;
    }
    case 'art_starry': {
      rect(ctx, ix, iy, iw, ih, '#283a7a');
      rect(ctx, ix, iy + 11, iw, 5, '#1f2b55');
      const twinkle = Math.floor(t * 2);
      for (const [sx, sy] of [[2, 2], [6, 1], [11, 4], [16, 2], [8, 6], [14, 7]]) {
        if ((twinkle + sx) % 4 !== 0) rect(ctx, ix + sx, iy + sy, 1, 1, '#ffd95a');
      }
      for (let i = 0; i < 12; i++) rect(ctx, ix + 3 + i, iy + 4 + Math.round(Math.sin(i / 2) * 1.5), 1, 1, '#6d8fd8');
      rect(ctx, ix + 15, iy + 1, 3, 3, '#fff3a0');
      rect(ctx, ix + 2, iy + 5, 3, 11, '#1a2a1d');
      rect(ctx, ix + 3, iy + 3, 1, 2, '#1a2a1d');
      rect(ctx, ix + 8, iy + 12, 10, 2, '#3a4f8a');
      return;
    }
  }
}

// ---------------------------------------------------------------- sprites

const LEAF = {
  g: '#6fb26a', G: '#4e8a4f', l: '#9fd47e', r: '#d2774f', R: '#a8553a', q: '#e8936a',
  y: '#f2d14e', Y: '#d9a72b', p: '#ef5d7a', P: '#c23d5a', b: '#7a4a2a', w: '#fdf6ec',
};

const lazy = (make: () => HTMLCanvasElement) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= make());
};

const PLANTS: Record<string, () => HTMLCanvasElement> = {
  plant_fern: lazy(() =>
    pixelSprite(
      [
        '...l....l.....', '..lg...gl...g.', '.lgg..ggl..gl.', 'gGgg.gGgg.gGg.', '.gGggGgGggGg..',
        '..gGgGgGgGg...', '.gGgGgGgGgGg..', '...gGgGgGg....', '...qqqqqqq....', '...rrrrrrr....',
        '...rRrrrRr....', '....rrrrr.....', '....RRRRR.....',
      ],
      LEAF,
    ),
  ),
  plant_monstera: lazy(() =>
    pixelSprite(
      [
        '.....lgg..ggl.......', '...lggGg..gGggl.....', '..lgg.Gg.gG.ggg.lg..', '.lgGg.gGgGg.gGgggg..',
        '.ggGgggGgGgggGg.gG..', 'gGg.gGgGgGgGg.gGgg..', 'gG..ggGgGgGgg..gGg..', '.g.lggGgGgGggl..g...',
        '..lgGg.gGg.gGgl.....', '..gGg..gGg..gGg.....', '.......gGg..........', '......qqqqqq........',
        '.....rrrrrrrr.......', '.....rRrrrrRr.......', '.....rRrrrrRr.......', '......rrrrrr........',
        '......RRRRRR........',
      ],
      LEAF,
    ),
  ),
  plant_lemon: lazy(() =>
    pixelSprite(
      [
        '.....lgggl........', '...lggGyggGgl.....', '..lgGgggGgYgGl....', '.lgGyGgGgGggGgl...',
        '.gGgGgGyGgGyGgg...', 'lgGgYgGgGgGgGgGl..', 'gGgGgGgGyGgGgYgg..', '.gGyGgGgGgGgGgg...',
        '..gGgGgYgGgGgg....', '...ggGgGgGgg......', '......bbb.........', '......bbB.........',
        '......bBb.........', '......bbB.........', '.....qqqqqqq.......', '....rrrrrrrrr......',
        '....rRrrrrrRr......', '....rRrrrrrRr......', '.....rrrrrrr.......', '.....RRRRRRR.......',
      ],
      { ...LEAF, B: '#5a3420' },
    ),
  ),
};

const SILLS: Record<string, () => HTMLCanvasElement> = {
  sill_cactus: lazy(() =>
    pixelSprite(['..g...', '.gl.g.', '.gGgG.', 'ggGgG.', '.gGgg.', '..gG..', 'qqqqq.', 'rrrrr.', '.rRr..'], {
      ...LEAF,
      g: '#5fa86a',
      G: '#3f7f4f',
      l: '#a6dd96',
    }),
  ),
  sill_tulips: lazy(() =>
    pixelSprite(['.p..y..p.', 'pPp.yYpPp', 'pPp.Yy.p.', '.g..g..g.', '.gG.g.Gg.', '..gGgGg..', '.qqqqqqq.', '.rrrrrrr.', '..rRrRr..'], LEAF),
  ),
  sill_bonsai: lazy(() =>
    pixelSprite(
      ['..lggl.lgl..', '.lgGgGggGgl.', 'gGgGg.gGgGg.', '.gg..b..ggg.', '.....bb.....', '....bb......', 'qqqqqqqqqqq.', 'rrrrrrrrrrr.', '.RRRRRRRRR..'],
      { ...LEAF, b: '#6b4630' },
    ),
  ),
};

const HANGING_PLANT = lazy(() =>
  pixelSprite(
    ['....b.b....', '...b...b...', '..rrrrrrr..', '..rRrrrRr..', '.lgGgGgGgl.', 'lgGgg.gGgGl', 'gG.g...g.Gg', 'g..g...g..g', 'G..l...G..G', '...G.......'],
    LEAF,
  ),
);

/** Soft oval shadow on the floor. */
export function shadow(ctx: Ctx, cx: number, y: number, w: number, alpha = 0.22): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const half = Math.round(w / 2);
  rect(ctx, cx - half + 2, y - 2, half * 2 - 4, 1, '#2a1410');
  rect(ctx, cx - half, y - 1, half * 2, 2, '#2a1410');
  rect(ctx, cx - half + 2, y + 1, half * 2 - 4, 1, '#2a1410');
  ctx.restore();
}

/** A potted plant's sprite, if `id` is one. */
export const plantSprite = (id: string): HTMLCanvasElement | undefined => PLANTS[id]?.();

/** Floor plant standing with its pot bottom at (cx, footY). */
export function paintPlant(ctx: Ctx, id: string, cx: number, footY: number): void {
  const s = PLANTS[id]?.();
  if (!s) return;
  shadow(ctx, cx, footY, s.width * 0.7);
  ctx.drawImage(s, Math.round(cx - s.width / 2), footY - s.height);
}

/** Small pot sitting on a windowsill whose top is at y. */
export function paintSill(ctx: Ctx, id: string, cx: number, y: number): void {
  const s = SILLS[id]?.();
  if (s) ctx.drawImage(s, Math.round(cx - s.width / 2), y - s.height + 1);
}

// ---------------------------------------------------------------- ceiling

export function paintStringLights(ctx: Ctx, x0: number, w: number, t: number, y = 8): void {
  const colors = ['#ffd95a', '#f49ac1', '#8fd3f4', '#a8e07a'];
  const sag = (x: number) => y + Math.round(Math.abs(Math.sin((x - x0) / 26)) * 4);
  for (let x = x0; x < x0 + w; x++) rect(ctx, x, sag(x), 1, 1, '#4a2e1e');
  for (let i = 0, x = x0 + 8; x < x0 + w; x += 16, i++) {
    const on = (Math.floor(t * 2) + i) % 6 !== 0;
    const c = on ? colors[i % colors.length] : '#9c8a70';
    const by = sag(x) + 1;
    if (on) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      rect(ctx, x - 2, by - 1, 6, 6, c);
      ctx.restore();
    }
    rect(ctx, x, by, 2, 1, '#4a2e1e');
    rect(ctx, x, by + 1, 2, 3, c);
    rect(ctx, x, by + 1, 1, 1, '#ffffff');
  }
}

function pendant(ctx: Ctx, x: number, cord: number, lit: boolean): void {
  rect(ctx, x, 0, 1, cord, '#2e1c16');
  rect(ctx, x - 2, cord, 5, 1, '#2f5a4a');
  rect(ctx, x - 4, cord + 1, 9, 2, '#3f7a64');
  rect(ctx, x - 5, cord + 3, 11, 1, '#2f5a4a');
  rect(ctx, x - 1, cord + 4, 3, 1, lit ? '#fff3a0' : '#e8c06a');
  if (lit) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.moveTo(x - 5, cord + 4);
    ctx.lineTo(x + 6, cord + 4);
    ctx.lineTo(x + 14, cord + 34);
    ctx.lineTo(x - 13, cord + 34);
    ctx.fill();
    ctx.restore();
  }
}

function chandelier(ctx: Ctx, cx: number, t: number): void {
  const gold = ramp('#e7b84a');
  rect(ctx, cx, 0, 1, 4, gold.lo);
  rect(ctx, cx - 2, 4, 5, 2, gold.base);
  rect(ctx, cx - 11, 7, 23, 2, gold.base);
  rect(ctx, cx - 11, 7, 23, 1, gold.hi);
  rect(ctx, cx - 7, 9, 15, 1, gold.lo);
  rect(ctx, cx - 1, 9, 3, 4, gold.base);
  for (const dx of [-11, -6, 0, 6, 11]) {
    const flicker = (Math.floor(t * 5) + dx) % 3 === 0;
    rect(ctx, cx + dx, 4, 1, 3, '#fdf6ec');
    rect(ctx, cx + dx, 2, 1, 2, flicker ? '#ffd95a' : '#ff9f43');
  }
  for (const dx of [-8, -3, 3, 8]) rect(ctx, cx + dx, 10, 1, 2, '#cfe8f0');
  ctx.save();
  ctx.globalAlpha = 0.12;
  rect(ctx, cx - 16, 1, 33, 14, '#fff3a0');
  ctx.restore();
}

export function paintCeiling(ctx: Ctx, id: string, sceneW: number, t: number): void {
  switch (id) {
    case 'ceiling_lights':
      return paintStringLights(ctx, 0, sceneW, t);
    case 'ceiling_vines': {
      for (let x = 0; x < sceneW; x += 3) {
        const drop = Math.round(Math.abs(Math.sin(x * 0.37)) * 5);
        rect(ctx, x, 6, 2, 2 + drop, (x / 3) % 2 ? '#6fb26a' : '#4e8a4f');
        if (drop > 3) rect(ctx, x, 8 + drop, 2, 1, '#9fd47e');
      }
      const sway = Math.round(Math.sin(t * 1.2));
      for (const hx of [70, 250]) {
        rect(ctx, hx, 6, 1, 6, '#4a2e1e');
        ctx.drawImage(HANGING_PLANT(), hx - 6 + sway, 10);
      }
      return;
    }
    case 'ceiling_pendants':
      for (const x of [36, 132, 188, 284]) pendant(ctx, x, 7, Math.floor(t * 0.5 + x) % 9 !== 0);
      return;
    case 'ceiling_chandelier':
      return chandelier(ctx, sceneW / 2, t);
  }
}

// ---------------------------------------------------------------- rugs

/**
 * A woven jute runner, laid either down the room ('v') or across it ('h'), so the
 * entrance runner and the corridors between rooms are one continuous carpet.
 */
export function paintRunner(ctx: Ctx, x: number, y: number, w: number, h: number, dir: 'h' | 'v', base = '#d6b382'): void {
  const along = dir === 'v' ? h : w;
  const across = dir === 'v' ? w : h;
  // Paint in runner-local coordinates: a runs along the carpet, b across it.
  const at = (a: number, b: number, la: number, lb: number, color: string) =>
    dir === 'v' ? rect(ctx, x + b, y + a, lb, la, color) : rect(ctx, x + a, y + b, la, lb, color);
  const field = ramp(base);
  const trim = '#9a6a45';
  at(0, 0, along, across, field.lo);
  at(0, 1, along, across - 2, field.base);
  at(0, 3, along, 1, trim);
  at(0, across - 4, along, 1, trim);
  const weave = mix(field.base, field.lo, 0.45);
  for (let a = 1; a < along; a += 2) {
    for (let b = 5 + (a % 4 === 1 ? 2 : 0); b < across - 5; b += 4) at(a, b, 1, 1, weave);
  }
  // Diamonds down the middle.
  const mid = Math.floor(across / 2);
  for (let c = 10; c < along - 4; c += 20) {
    for (let i = -2; i <= 2; i++) {
      const half = 2 - Math.abs(i);
      at(c + i, mid - half, 1, half * 2 + 1, i === 0 ? '#b5453a' : field.lo);
    }
  }
}

export function paintRug(ctx: Ctx, id: string, x: number, y: number, w: number, h: number): void {
  if (id === 'rug_round') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let yy = y; yy < y + h; yy++) {
      const dy = (yy + 0.5 - cy) / (h / 2);
      const half = Math.sqrt(Math.max(0, 1 - dy * dy)) * (w / 2);
      if (half < 1) continue;
      const ring = Math.abs(dy);
      const color = ring > 0.88 ? '#3f8a6c' : ring > 0.6 ? '#7fc4a8' : ring > 0.5 ? '#f4e6c8' : '#a8dcc4';
      rect(ctx, cx - half, yy, Math.round(half * 2), 1, color);
      if (half > 4) {
        rect(ctx, cx - half, yy, 2, 1, '#3f8a6c');
        rect(ctx, cx + half - 2, yy, 2, 1, '#3f8a6c');
      }
    }
    return;
  }
  const [border, inner, motif] = id === 'rug_blue' ? ['#3f5f93', '#6f93c9', '#e6eef8'] : ['#9c3f36', '#cf5f4f', '#f3c7a0'];
  rect(ctx, x, y, w, h, border);
  rect(ctx, x + 3, y + 3, w - 6, h - 6, inner);
  // Woven texture and a thin inner border.
  const weave = mix(inner, ramp(inner).lo, 0.5);
  for (let yy = y + 4; yy < y + h - 4; yy += 2) {
    for (let xx = x + 4 + ((yy - y) % 4 === 0 ? 0 : 2); xx < x + w - 4; xx += 4) rect(ctx, xx, yy, 1, 1, weave);
  }
  rect(ctx, x + 5, y + 5, w - 10, 1, motif);
  rect(ctx, x + 5, y + h - 6, w - 10, 1, motif);
  rect(ctx, x + 5, y + 5, 1, h - 10, motif);
  rect(ctx, x + w - 6, y + 5, 1, h - 10, motif);
  rect(ctx, x + 3, y + 3, w - 6, 1, ramp(inner).hi);
  rect(ctx, x, y + h - 1, w, 1, ramp(border).lo);
  // Small motifs along the border, a diamond in the middle, and fringe at the ends.
  for (let dx = x + 6; dx < x + w - 6; dx += 8) {
    rect(ctx, dx, y + 1, 2, 1, motif);
    rect(ctx, dx, y + h - 2, 2, 1, motif);
  }
  for (let dy = y + 6; dy < y + h - 6; dy += 8) {
    rect(ctx, x + 1, dy, 1, 2, motif);
    rect(ctx, x + w - 2, dy, 1, 2, motif);
  }
  const mid = y + Math.floor(h / 2);
  for (let i = -3; i <= 3; i++) {
    const half = (3 - Math.abs(i)) * 2;
    rect(ctx, x + w / 2 - half, mid + i, half * 2 + 1, 1, motif);
  }
  for (let fx = x + 2; fx < x + w - 2; fx += 3) {
    rect(ctx, fx, y - 2, 1, 2, '#f4e6c8');
    rect(ctx, fx, y + h, 1, 2, '#f4e6c8');
  }
}

// ---------------------------------------------------------------- neon

const NEON_HEART = ['.pp...pp.', 'p..p.p..p', 'p...p...p', 'p.......p', '.p.....p.', '..p...p..', '...p.p...', '....p....'];
const NEON_CUP = ['..c..c....', '.c..c.....', '..c..c....', '..........', 'cccccccc..', 'c......ccc', 'c......c.c', 'c......ccc', '.c....c...', '..cccc....'];

export function paintNeon(ctx: Ctx, id: string, cx: number, y: number, t: number): void {
  if (id === 'neon_none') return;
  ctx.save();
  ctx.globalAlpha = 0.8 + Math.sin(t * 3) * 0.2;
  if (id === 'neon_cafe') {
    // Doubled bitmap text so the sign reads at this scale.
    const tmp = document.createElement('canvas');
    tmp.width = textWidth('CAFE') + 2;
    tmp.height = 7;
    drawText(tmp.getContext('2d')!, 'CAFE', 1, 1, '#ff8fc7', '#8a2a5a');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, Math.round(cx - tmp.width), y, tmp.width * 2, tmp.height * 2);
  } else {
    const [rows, color, glow] = id === 'neon_heart' ? [NEON_HEART, '#ff6b9a', '#8a2a5a'] : [NEON_CUP, '#7fe3f0', '#1f5560'];
    const w = Math.max(...rows.map((r) => r.length));
    const x0 = Math.round(cx - w / 2);
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        rect(ctx, x0 + rx - 1, y + ry, 3, 1, glow);
        rect(ctx, x0 + rx, y + ry - 1, 1, 3, glow);
      }),
    );
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && rect(ctx, x0 + rx, y + ry, 1, 1, color)));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shop thumbnails

const ICON_W = 28;
const ICON_H = 24;
const iconCache = new Map<string, HTMLCanvasElement>();

export function decorIcon(id: string): HTMLCanvasElement {
  let c = iconCache.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = ICON_W;
  c.height = ICON_H;
  const ctx = c.getContext('2d')!;
  const slot = decorDef(id)?.slot;
  if (id.endsWith('_none')) {
    for (let i = 0; i < ICON_W; i += 2) {
      rect(ctx, i, 0, 1, 1, '#c4ad92');
      rect(ctx, i, ICON_H - 1, 1, 1, '#c4ad92');
    }
    for (let i = 0; i < ICON_H; i += 2) {
      rect(ctx, 0, i, 1, 1, '#c4ad92');
      rect(ctx, ICON_W - 1, i, 1, 1, '#c4ad92');
    }
  } else if (slot === 'wallpaper') {
    paintWall(ctx, id, 0, 0, ICON_W, 16, 0.4);
    paintWainscot(ctx, id, 0, 17, ICON_W, 7);
  } else if (slot === 'floor') {
    paintFloor(ctx, id, 0, 0, ICON_W, ICON_H);
  } else if (slot === 'counter') {
    paintCounter(ctx, id, 1, 3, ICON_W - 2, 6, 15);
  } else if (slot === 'sill') {
    rect(ctx, 2, 18, 24, 3, '#a46a3c');
    rect(ctx, 2, 18, 24, 1, '#c98f5e');
    paintSill(ctx, id, ICON_W / 2, 17);
  } else if (slot === 'ceiling') {
    if (id === 'ceiling_lights') paintStringLights(ctx, -4, ICON_W + 4, 0, 4);
    else if (id === 'ceiling_vines') ctx.drawImage(HANGING_PLANT(), 8, 4);
    else if (id === 'ceiling_pendants') pendant(ctx, 14, 8, true);
    else chandelier(ctx, 14, 0);
  } else if (slot === 'rug') {
    paintRug(ctx, id, 1, 4, ICON_W - 2, 16);
  } else if (slot === 'neon') {
    rect(ctx, 0, 0, ICON_W, ICON_H, '#2b1a12');
    paintNeon(ctx, id, ICON_W / 2, id === 'neon_cafe' ? 5 : 7, Math.PI / 6);
  }
  iconCache.set(id, c);
  return c;
}
