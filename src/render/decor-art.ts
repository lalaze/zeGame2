import { paintSignText, paintPixelSignText } from './sign-lettering';
import { getGeneratedDecorAdapter } from './generated-main-art';
// Pixel art for every decor item, in a shaded Stardew-like style. Each painter
// draws into a region so the same code renders both the café scene and the
// small thumbnails in the shop.
import { decorDef } from '../game/decor';
import { mix, ramp, type Ramp } from './color';
import { drawText, textWidth } from './font';
import { OUTLINE, pixelSprite } from './sprites';
import { cabinetPanel, leafySprig, timberBeam, WARM_MATERIAL } from './materials';

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
  const lo = mix(wood.base, wood.lo, 0.42);
  const hi = mix(wood.base, wood.hi, 0.48);
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
  wall_cream: { base: '#f4e6c7', accent: '#ead8b3', pattern: 'stripes', wainscot: '#865332' },
  wall_mint: { base: '#dce4c9', accent: '#c4d0ab', pattern: 'stripes', wainscot: '#627451' },
  wall_rose: { base: '#f0d8c2', accent: '#dfbaa5', pattern: 'stripes', wainscot: '#9b6750' },
  wall_dots: { base: '#d5e6f4', accent: '#f4f8fb', pattern: 'flowers', wainscot: '#5d7fa8' },
  wall_brick: { base: '#b9634a', accent: '#d9a58b', pattern: 'brick', wainscot: '#5a3a28' },
  wall_walnut: { base: '#7a4e33', accent: '#5f3a25', pattern: 'panels', wainscot: '#4a2e1e' },
  wall_stars: { base: '#2c3263', accent: '#fff3c4', pattern: 'stars', wainscot: '#3b2a58' },
};

const wallStyle = (id: string) => WALLS[id] ?? WALLS.wall_cream;

export function paintWall(ctx: Ctx, id: string, x0: number, y0: number, w: number, h: number, t = 0): void {
  if (getGeneratedDecorAdapter()?.paintTile(ctx, id, x0, y0, w, h)) return;
  const s = wallStyle(id);
  const r = ramp(s.base);
  // One small palette per repaint; never parse the same hex in the pixel loop.
  const seam = mix(s.accent, '#b89a6c', 0.25);
  const stripeLight = mix(s.base, '#fff8e4', 0.65);
  const budColor = mix(s.accent, '#be9860', 0.3);
  const stem = mix(s.accent, '#63775e', 0.4);
  const trellis = mix(s.base, '#f4e6c7', 0.3);
  const brickEdge = mix(s.base, '#efa77c', 0.32);
  const brickChip = mix(s.base, '#edb48b', 0.26);
  const brickShade = mix(s.base, '#87452e', 0.2);
  const twinkle = Math.floor(t * 1.5);
  rect(ctx, x0, y0, w, h, s.base);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0;
      const ly = y - y0;
      let c: string | null = null;
      switch (s.pattern) {
        case 'stripes': {
          const m = lx % 20;
          // Woven wallpaper: broad quiet cream panels, fine seam, paired flower buds.
          if (m === 0) c = seam;
          if (m === 1 || m === 18) c = stripeLight;
          if (m >= 14 && m <= 17) c = s.accent;
          const bud = ly % 15;
          if ((m === 8 && (bud === 4 || bud === 6)) || (bud === 5 && (m === 7 || m === 9))) c = budColor;
          if (m === 8 && bud === 5) c = '#fff4d4';
          break;
        }
        case 'flowers': {
          const cx = (lx + (Math.floor(ly / 12) % 2) * 8) % 16;
          const cy = ly % 12;
          if ((cx === 7 && (cy === 5 || cy === 7)) || (cy === 6 && (cx === 6 || cx === 8))) c = s.accent;
          else if (cx === 7 && cy === 6) c = '#f2c14e';
          else if ((cx === 9 && cy === 8) || (cx === 5 && cy === 4)) c = '#9fac92';
          else if (cx === 7 && cy >= 8 && cy <= 10) c = stem;
          else if ((cx + cy) % 12 === 0) c = trellis;
          break;
        }
        case 'brick': {
          const row = Math.floor(ly / 8);
          const bx = (lx + (row % 2) * 8) % 16;
          const by = ly % 8;
          if (by === 7 || bx === 15) c = s.accent;
          else if (by === 0) c = r.hi;
          else if (by === 6) c = r.lo;
          else if (bx === 0) c = brickEdge;
          else if ((bx === 4 || bx === 10) && by === 2) c = brickChip;
          else if (hash(Math.floor((lx + (row % 2) * 8) / 16), row) < 0.3) c = brickShade;
          break;
        }
        case 'panels': {
          const m = lx % 24, py = ly % 26;
          if (m === 0 || py === 0) c = '#39281f';
          else if (m === 1 || py === 1) c = '#b88650';
          else if ((m === 4 || m === 19) && py > 3 && py < 23) c = m === 4 ? '#4e3122' : '#98643e';
          else if ((py === 4 || py === 22) && m > 3 && m < 20) c = py === 4 ? '#4e3122' : '#98643e';
          else if (hash(lx, Math.floor(ly / 5)) < 0.06) c = s.accent;
          break;
        }
        case 'stars': {
          const v = hash(lx, ly);
          if (v < 0.006 && (twinkle + lx) % 5 !== 0) c = s.accent;
          else if (v > 0.9985) c = '#bcc39d';
          else if ((lx % 31 === 12 && ly % 23 >= 5 && ly % 23 <= 7) || (ly % 23 === 6 && lx % 31 >= 11 && lx % 31 <= 13)) c = '#d8bb76';
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
  const base = wallStyle(id).wainscot;
  rect(ctx, x0, y0, w, h, WARM_MATERIAL.shade);
  // Recessed cabinet-like panels and square stiles match the timber room frame.
  for (let bx = x0; bx < x0 + w; bx += 21) {
    const bw = Math.min(21, x0 + w - bx);
    cabinetPanel(ctx, bx, y0, bw, h, base);
  }
  timberBeam(ctx, x0, y0 - 3, w, 4, false, base);
  rect(ctx, x0, y0 + h - 2, w, 2, WARM_MATERIAL.shade);
  rect(ctx, x0, y0 + h - 2, w, 1, mix(base, '#c98c4d', 0.5));
}

export const wainscotColor = (id: string) => wallStyle(id).wainscot;

// ---------------------------------------------------------------- floors

export function paintFloor(ctx: Ctx, id: string, x0: number, y0: number, w: number, h: number): void {
  if (getGeneratedDecorAdapter()?.paintTile(ctx, id, x0, y0, w, h)) return;
  // Beveled tiles in the Stardew manner: bright top-left edge, shaded
  // bottom-right edge, a dark grout line and a little speckle.
  const tiles = (a: string, b: string, size: number, speckle = 0.02) => {
    for (let y = y0, ty = 0; y < y0 + h; y += size, ty++) {
      for (let x = x0, tx = 0; x < x0 + w; x += size, tx++) {
        const c = mix((tx + ty) % 2 ? b : a, '#e0cda9', hash(tx + 3, ty) * 0.1);
        const r = ramp(c);
        const tw = Math.min(size, x0 + w - x);
        const th = Math.min(size, y0 + h - y);
        const tileLight = mix(c, '#fff9e8', 0.5);
        const mineralShade = mix(c, r.lo, 0.6);
        rect(ctx, x, y, tw, th, c);
        rect(ctx, x + 1, y + 1, tw - 2, 1, r.hi);
        rect(ctx, x + 1, y + 1, 1, th - 2, r.hi);
        rect(ctx, x + 1, y + th - 2, tw - 2, 1, r.lo);
        rect(ctx, x + tw - 2, y + 1, 1, th - 2, mix(c, '#9c8061', 0.34));
        rect(ctx, x + 2, y + 2, tw - 5, 1, mix(c, '#fff9e8', 0.45));
        rect(ctx, x + 2, y + 3, 1, Math.max(1, th - 7), mix(c, '#fff9e8', 0.35));
        if (tw > 9 && th > 9) {
          rect(ctx, x + 4 + tx % 3, y + th - 5, 3, 1, tileLight);
          rect(ctx, x + tw - 5, y + 5 + ty % 3, 1, 2, mix(c, '#c4ad82', 0.24));
        }
        const grout = mix(c, '#6c645b', 0.3);
        rect(ctx, x, y + th - 1, tw, 1, grout);
        rect(ctx, x + tw - 1, y, 1, th, grout);
        for (let sy = y + 2; sy < y + th - 2; sy++) {
          for (let sx = x + 2; sx < x + tw - 2; sx++) {
            const v = hash(sx, sy);
            if (v < speckle) rect(ctx, sx, sy, 1, 1, v < speckle / 3 ? r.hi : mineralShade);
          }
        }
      }
    }
  };
  switch (id) {
    case 'floor_planks': {
      const tones = ['#b98c62', '#ad805a', '#c49a70'];
      for (let y = y0, row = 0; y < y0 + h; y += 8, row++) {
        const offset = (row * 23) % 48;
        for (let x = x0 - offset, i = 0; x < x0 + w; x += 48, i++) {
          const c = tones[Math.floor(hash(i, row) * tones.length)];
          const bx = Math.max(x, x0);
          const bw = Math.min(x + 48, x0 + w) - bx;
          rect(ctx, bx, y, bw, 8, c);
          rect(ctx, bx, y, bw, 1, ramp(c).hi);
          rect(ctx, bx, y + 7, bw, 1, '#6e4128');
          if (x >= x0) {
            rect(ctx, x, y, 1, 7, '#6e4128');
            rect(ctx, x + 2, y + 2, 1, 1, '#795b40');
            rect(ctx, x + 2, y + 5, 1, 1, '#795b40');
          }
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
      return tiles('#e5e8d2', '#c8d4b5', 16, 0.025);
    case 'floor_terrazzo': {
      tiles('#ece5d8', '#e6ddcd', 32, 0);
      const chips = ['#b8856b', '#8f9b73', '#d6b573', '#a59980', '#faf0d7'];
      for (let y = y0; y < y0 + h; y += 2) {
        for (let x = x0; x < x0 + w; x += 2) {
          const v = hash(x, y);
          if (v < 0.035) {
            rect(ctx, x, y, v < 0.008 ? 2 : 1, 1, chips[Math.floor(v * 1000) % chips.length]);
            if (v < 0.006 && y + 1 < y0 + h) rect(ctx, x + 1, y + 1, 1, 1, chips[Math.floor(v * 1000) % chips.length]);
          }
        }
      }
      return;
    }
    case 'floor_herringbone': {
      const a = ramp('#b88d63');
      const b = ramp('#b28a60');
      const speckleA = mix(a.base, '#d6b18a', 0.25);
      const speckleB = mix(b.base, '#d6b18a', 0.25);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const lx = x - x0;
          const v = lx % 16 < 8 ? lx % 8 : 7 - (lx % 8);
          const k = (y - y0 + v) % 8;
          const tone = Math.floor((y - y0 + v) / 8) % 2 ? b : a;
          const joint = (Math.floor(lx / 8) + Math.floor((y - y0 + v) / 8)) % 4 === 0 && lx % 8 === 7;
          rect(ctx, x, y, 1, 1, joint ? '#a17b56' : k === 0 ? '#c6a078' : k === 7 ? '#a8815a' : hash(Math.floor(lx / 3), y) < 0.055 ? (tone === a ? speckleA : speckleB) : tone.base);
        }
      }
      return;
    }
    case 'floor_marble': {
      tiles('#f4f0ea', '#ebe4da', 32, 0);
      for (let y = y0; y < y0 + h; y++) {
        const curve = Math.floor(Math.sin(y / 7) * 3);
        for (let x = x0; x < x0 + w; x++) {
          const vein = x + 2 * y + curve;
          if (vein % 53 === 0 || (x * 3 - y) % 89 === 0) rect(ctx, x, y, 1, 1, '#b8ac95');
          else if (vein % 53 === 1) rect(ctx, x, y, 1, 1, '#e0d3b8');
        }
      }
      return;
    }
    default:
      return tiles('#f1e5ca', '#e4d5b6', 16, 0.025);
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
  counter_oak: { top: '#c98c4d', front: '#865332' },
  counter_walnut: { top: '#98643e', front: '#543425' },
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
  if (getGeneratedDecorAdapter()?.paintCounter(ctx, id, x, y, w, topH, frontH)) return;
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
  const panelW = Math.min(26, w - 4);
  if (panelW > 7) for (let px = x + 2; px < x + w - 3; px += panelW + 2) {
    const pw = Math.min(panelW, x + w - 2 - px);
    if (pw < 8) continue;
    cabinetPanel(ctx, px, fy + 2, pw, frontH - 5, front.base);
    if (s.trim) {
      rect(ctx, px + 2, fy + 4, pw - 4, 1, s.trim);
      rect(ctx, px + 2, fy + 4, 1, frontH - 10, s.trim);
    }
    if (s.veins) for (let vx = px + 5; vx < px + pw - 3; vx += 7) rect(ctx, vx, fy + 5 + vx % 4, 2, 1, s.veins);
  }
  // Hand-planed end boards and a dimensional bullnose on every worktop.
  rect(ctx, x, y + topH - 4, w, 1, mix(top.base, '#ffdc97', 0.6));
  rect(ctx, x + 1, y + topH - 3, w - 2, 1, mix(top.base, '#f3c986', 0.38));
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
  // A little hanging wire and a recessed, mitered gilded/timber frame.
  const frameColor = id === 'art_bean' ? '#3e2618' : id === 'art_cat' ? '#8a5a3c' : '#d9a441';
  const frame = ramp(frameColor);
  rect(ctx, x, y, 26, 22, OUTLINE);
  rect(ctx, x + 1, y + 1, 24, 20, frame.base);
  rect(ctx, x + 1, y + 1, 24, 1, frame.hi);
  rect(ctx, x + 1, y + 20, 24, 1, frame.lo);
  rect(ctx, x + 2, y + 2, 22, 1, '#f0cc87');
  rect(ctx, x + 23, y + 3, 1, 17, '#66482e');
  rect(ctx, x + 2, y + 19, 22, 1, '#66482e');
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
      rect(ctx, ix + 11, iy + 8, 6, 5, '#dcc49a');
      rect(ctx, ix + 10, iy + 7, 8, 2, '#ad7250');
      rect(ctx, ix + 12, iy + 10, 2, 3, '#665642');
      rect(ctx, ix + 3, iy + 8, 2, 5, '#4c673d');
      rect(ctx, ix + 2, iy + 7, 4, 2, '#789050');
      for (let dy = 0; dy < 3; dy++) rect(ctx, ix + 13 - dy, iy + 13 + dy, 3 + dy * 2, 1, '#e0c994');
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
      rect(ctx, ix + 5, iy + 6, 2, 1, '#b2753e');
      rect(ctx, ix + 12, iy + 6, 2, 1, '#b2753e');
      rect(ctx, ix + 9, iy + 5, 1, 2, '#b2753e');
      rect(ctx, ix + 3, iy + 10, 3, 1, '#f4e6c7');
      rect(ctx, ix + 14, iy + 10, 3, 1, '#f4e6c7');
      rect(ctx, ix + 6, iy + 13, 9, 2, '#c69358');
      return;
    case 'art_bean': {
      rect(ctx, ix, iy, iw, ih, '#fbf1e0');
      const bean = ramp('#6e3f24');
      for (let row = 0; row < 12; row++) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - ((row - 5.5) / 6.2) ** 2)) * 6);
        rect(ctx, ix + 10 - half, iy + 2 + row, half * 2, 1, row < 4 ? bean.hi : row > 8 ? bean.lo : bean.base);
      }
      for (let i = 0; i < 10; i++) rect(ctx, ix + 9 + (i % 3 === 1 ? 1 : 0), iy + 3 + i, 1, 1, '#c48a55');
      for (let i = 0; i < 4; i++) {
        rect(ctx, ix + 2 + i, iy + 11 - i * 2, 1, 2, '#7b8a55');
        rect(ctx, ix + 1 + i, iy + 11 - i * 2, 2, 1, '#a3aa6d');
      }
      rect(ctx, ix + 15, iy + 12, 3, 2, '#be7650');
      rect(ctx, ix + 17, iy + 10, 2, 2, '#c79564');
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
      for (let i = 0; i < 4; i++) {
        rect(ctx, ix + 6 + i * 3, iy + 12 - i % 2, 2, 4 + i % 2, '#4d5e72');
        rect(ctx, ix + 6 + i * 3, iy + 13 - i % 2, 1, 1, '#e3c585');
      }
      return;
    }
  }
}

// ---------------------------------------------------------------- sprites

const LEAF = {
  g: '#627451', G: '#374d32', l: '#a4b45f', r: '#bc7149', R: '#81482f', q: '#e6a268',
  y: '#edc858', Y: '#b88932', p: '#d87769', P: '#a14442', b: '#74502e', w: '#f4e6c7',
};

const lazy = (make: () => HTMLCanvasElement) => {
  let c: HTMLCanvasElement | null = null;
  return () => (c ??= make());
};

function botanical(w: number, h: number, type: 'fern' | 'monstera' | 'lemon'): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const cx = Math.floor(w / 2), potY = h - 6;
  // Terracotta lip, visible soil, tapered body and a reflected warm lower edge.
  rect(ctx, cx - 4, potY, 8, 2, '#543425');
  rect(ctx, cx - 4, potY, 8, 1, '#e6a268');
  rect(ctx, cx - 3, potY + 1, 6, 1, '#624529');
  rect(ctx, cx - 3, potY + 2, 6, 3, '#ba7147');
  rect(ctx, cx - 3, potY + 2, 1, 2, '#e7a369');
  rect(ctx, cx + 2, potY + 2, 1, 3, '#814b31');
  rect(ctx, cx - 2, potY + 5, 4, 1, '#68442c');
  if (type === 'fern') {
    for (let stem = -3; stem <= 3; stem++) for (let i = 0; i < 7 - Math.abs(stem); i++) {
      const x = cx + Math.round(stem * i / 3), y = potY - i;
      rect(ctx, x, y, 1, 1, '#485e34');
      rect(ctx, x - 1, y - 1, 2, 1, i % 2 ? '#a0ae5b' : '#72884b');
      rect(ctx, x + 1, y, 1, 1, '#354c31');
    }
  } else if (type === 'monstera') {
    rect(ctx, cx, 3, 1, potY - 2, '#6e7540');
    for (const [dx, dy] of [[-4, 3], [3, 2], [-5, 7], [5, 6], [0, 5]]) {
      const x = cx + dx, y = dy;
      rect(ctx, x - 2, y - 1, 5, 3, '#374d32');
      rect(ctx, x - 1, y - 2, 3, 4, '#627451');
      rect(ctx, x - 2, y - 1, 3, 1, '#a0ae5b');
      rect(ctx, x, y - 1, 1, 3, '#8e9a4e');
      rect(ctx, x + 2, y, 1, 1, '#a4b45f');
    }
  } else {
    rect(ctx, cx - 1, 5, 2, potY - 4, '#735032');
    rect(ctx, cx - 1, 7, 1, potY - 6, '#b28b4e');
    leafySprig(ctx, cx, 5, 5, 2);
    leafySprig(ctx, cx - 2, 7, 4, 5);
    for (const [dx, dy] of [[-4, 4], [3, 3], [1, 8], [-3, 8]]) {
      rect(ctx, cx + dx, dy, 2, 2, '#c9952e');
      rect(ctx, cx + dx, dy, 1, 1, '#f8d66a');
    }
  }
  return c;
}

const PLANTS: Record<string, () => HTMLCanvasElement> = {
  plant_fern: lazy(() => botanical(16, 15, 'fern')),
  plant_monstera: lazy(() => botanical(22, 19, 'monstera')),
  plant_lemon: lazy(() => botanical(21, 22, 'lemon')),
};

const SILLS: Record<string, () => HTMLCanvasElement> = {
  sill_cactus: lazy(() => pixelSprite([
    '..lg..', '.lgG.g', '.gGGgl', 'lgGGgG', '.gGGgG', '..gG..',
    '.qqqqq', '.rbbrR', '..rrR.',
  ], LEAF)),
  sill_tulips: lazy(() => pixelSprite([
    '.pp..yy..', '.pPp.yY..', '..P..y..p', '.g..g..pP', '.gl.g.gl.', '..gGgGg..',
    '.qqqqqqq.', '.rbbbbbR.', '..rrrRR..',
  ], LEAF)),
  sill_bonsai: lazy(() => pixelSprite([
    '...llgg.....', '..lgGGglgl..', '.lgGGgGgGGl.', '..gGGbGggG..', '.....bB.....',
    '....bB......', '.qqqqqqqqqq.', '.rbbbbbbbRr.', '..RRRRRRRR..',
  ], { ...LEAF, B: '#a8884e' })),
};

const HANGING_PLANT = lazy(() => pixelSprite([
  '....b.b....', '...b...b...', '..qqqqqqq..', '..rbbbRrr..', '.llgGgGggl.',
  'lgGGglgGGGl', 'gG.gl.gG.Gg', 'G..gg.Gl..G', 'l..Gl..g..l', '...G...l...',
], LEAF));

/** Soft oval shadow on the floor. */
export function shadow(ctx: Ctx, cx: number, y: number, w: number, alpha = 0.22): void {
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  const half = Math.round(w / 2);
  rect(ctx, cx - half + 2, y - 2, half * 2 - 4, 1, '#2a1410');
  rect(ctx, cx - half, y - 1, half * 2, 2, '#2a1410');
  rect(ctx, cx - half + 2, y + 1, half * 2 - 4, 1, '#2a1410');
  ctx.globalAlpha = alpha * 0.65;
  rect(ctx, cx - half + 3, y - 1, half * 2 - 6, 2, '#493625');
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
  if (getGeneratedDecorAdapter()?.paintSprite(ctx, id, cx, y + 1)) return;
  const s = SILLS[id]?.();
  if (s) ctx.drawImage(s, Math.round(cx - s.width / 2), y - s.height + 1);
}

// ---------------------------------------------------------------- ceiling

export function paintStringLights(ctx: Ctx, x0: number, w: number, t: number, y = 8): void {
  const colors = ['#f5d58c', '#e6ba79', '#fff0ba', '#d8c993'];
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
    rect(ctx, x - 1, by + 2, 4, 2, '#9a7948');
    rect(ctx, x, by + 1, 2, 4, c);
    rect(ctx, x - 1, by + 2, 3, 2, c);
    rect(ctx, x, by + 5, 2, 1, '#b59358');
    rect(ctx, x, by + 1, 1, 1, '#ffffff');
  }
}

function pendant(ctx: Ctx, x: number, cord: number, lit: boolean): void {
  rect(ctx, x, 0, 1, cord, '#2e1c16');
  rect(ctx, x - 1, cord - 1, 3, 2, '#c8a15e');
  rect(ctx, x - 2, cord + 1, 5, 1, '#39281f');
  rect(ctx, x - 3, cord + 2, 7, 4, '#aa8b51');
  rect(ctx, x - 2, cord + 2, 5, 4, lit ? '#f1d59c' : '#d0bd92');
  rect(ctx, x - 2, cord + 2, 1, 3, '#fff4d2');
  rect(ctx, x, cord + 3, 1, 3, lit ? '#fff5d5' : '#e4d6b5');
  rect(ctx, x - 4, cord + 6, 9, 2, '#543425');
  rect(ctx, x - 3, cord + 6, 7, 1, '#d1ac66');
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
  for (const dx of [-8, -3, 3, 8]) {
    rect(ctx, cx + dx, 10, 1, 2, '#c8a15e');
    rect(ctx, cx + dx - 1, 12, 3, 2, '#b7cdbb');
    rect(ctx, cx + dx, 12, 1, 3, '#f4e6c7');
  }
  for (const dx of [-10, 10]) {
    rect(ctx, cx + dx, 5, 1, 2, '#c8a15e');
    rect(ctx, cx + dx - 1, 5, 3, 1, '#f1d087');
  }
  ctx.save();
  ctx.globalAlpha = 0.12;
  rect(ctx, cx - 16, 1, 33, 14, '#fff3a0');
  ctx.restore();
}

export function paintCeiling(ctx: Ctx, id: string, sceneW: number, t: number): void {
  const generated = getGeneratedDecorAdapter();
  if (generated?.sprite(id)) {
    if (id === 'ceiling_lights' || id === 'ceiling_vines') {
      const width = generated.sprite(id)!.width;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sceneW, 40); ctx.clip();
      for (let x = 0; x < sceneW; x += width) generated.paintSprite(ctx, id, x + width / 2, 6 + (id === 'ceiling_vines' ? Math.sin(t * 1.2) * 0.35 : 0));
      ctx.restore();
    } else if (id === 'ceiling_pendants') {
      for (const x of [36, 132, 188, 284]) generated.paintSprite(ctx, id, x, 7);
    } else generated.paintSprite(ctx, id, sceneW / 2, 3);
    return;
  }
  switch (id) {
    case 'ceiling_lights':
      return paintStringLights(ctx, 0, sceneW, t);
    case 'ceiling_vines': {
      for (let x = 4; x < sceneW - 4; x += 9) {
        const drop = Math.round(Math.abs(Math.sin(x * 0.37)) * 5);
        rect(ctx, x, 6, 1, 3 + drop, '#485b36');
        leafySprig(ctx, x, 8 + drop, 3, x);
        if (drop > 3) rect(ctx, x - 1, 11 + drop, 1, 3, '#627451');
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

/** Oatmeal flatweave: restrained linen binding and fine, low-contrast yarn.
 * World-aligned weave keeps the entry and cross-aisle one continuous textile.
 */
export const RUNNER_BASE = '#c6b091';
export const RUNNER_EDGE = '#aa9275';
export const RUNNER_BINDING = '#e3d4ba';
function runnerWeave(ctx: Ctx, x: number, y: number, w: number, h: number, base: string): void {
  rect(ctx, x, y, w, h, base);
  const yarn = mix(base, '#f3e7cf', 0.23);
  const shadow = mix(base, '#8f785e', 0.13);
  // Fine staggered yarns, not large motifs or a second competing check pattern.
  for (let yy = Math.ceil(y * 2) / 2; yy < y + h; yy += 1.5) {
    ctx.fillStyle = shadow; ctx.fillRect(x, yy, w, Math.min(.25, y + h - yy));
    for (let xx = Math.ceil(x / 3) * 3; xx < x + w; xx += 3) {
      ctx.fillStyle = yarn;
      ctx.fillRect(xx, yy + .25, Math.min(1.5, x + w - xx), Math.min(.25, y + h - yy - .25));
    }
  }
}
export function paintRunner(ctx: Ctx, x: number, y: number, w: number, h: number, dir: 'h' | 'v', base = RUNNER_BASE): void {
  runnerWeave(ctx, x, y, w, h, base);
  // A soft cloth-bound edge. Keep the exact walkable footprint.
  const at = (a: number, b: number, la: number, lb: number, color: string) => {
    ctx.fillStyle = color;
    if (dir === 'v') ctx.fillRect(x + b, y + a, lb, la);
    else ctx.fillRect(x + a, y + b, la, lb);
  };
  const along = dir === 'v' ? h : w, across = dir === 'v' ? w : h;
  for (const b of [0, across - .5]) at(0, b, along, .5, RUNNER_EDGE);
  for (const b of [1, across - 2]) at(0, b, along, 1, RUNNER_BINDING);
  for (let a = 1; a < along - 1; a += 3) {
    for (const b of [1.25, across - 1.75]) at(a, b, 1, .25, RUNNER_EDGE);
  }
}

/** Unbroken T junction: binding turns into the stem instead of crossing it. */
export function paintRunnerJoin(ctx: Ctx, x: number, y: number, w: number, h: number, base = RUNNER_BASE): void {
  runnerWeave(ctx, x, y, w, h, base);
  const line = (xx: number, yy: number, ww: number, hh: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(xx, yy, ww, hh);
  };
  line(x, y, w, .5, RUNNER_EDGE);
  line(x, y + 1, w, 1, RUNNER_BINDING);
  for (const xx of [x, x + w - 2]) {
    line(xx, y + h - 2, 2, 1, RUNNER_BINDING);
  }
  for (const xx of [x, x + w - .5]) line(xx, y + h - .5, .5, .5, RUNNER_EDGE);
}

export function paintRug(ctx: Ctx, id: string, x: number, y: number, w: number, h: number): void {
  if (getGeneratedDecorAdapter()?.paintFitted(ctx, id, x, y, w, h)) return;
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
    for (let dy = -4; dy <= 4; dy++) {
      const half = 4 - Math.abs(dy);
      rect(ctx, cx - half, cy + dy, half * 2 + 1, 1, '#ead9ac');
      if (half > 1) rect(ctx, cx - half + 1, cy + dy, half * 2 - 1, 1, '#627451');
    }
    return;
  }
  const [border, inner, motif] = id === 'rug_blue' ? ['#495f68', '#7e9694', '#efe4bf'] : ['#814337', '#bd7760', '#f3d7a4'];
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
  // Four woven botanical corner motifs and interrupted selvedge stitching.
  for (const [cx, cy] of [[x + 9, y + 9], [x + w - 10, y + 9], [x + 9, y + h - 10], [x + w - 10, y + h - 10]]) {
    rect(ctx, cx, cy - 2, 1, 5, motif);
    rect(ctx, cx - 2, cy, 5, 1, motif);
    rect(ctx, cx - 1, cy - 1, 3, 3, border);
    rect(ctx, cx, cy, 1, 1, motif);
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

const NEON_HEART = ['..pp.pp..', '.p..p..p.', 'p.......p', 'p.......p', '.p.....p.', '..p...p..', '...p.p...', '....p....'];
const NEON_CUP = ['...c.c....', '..c...c...', '...c.c....', '..........', '.ccccccc..', '.c.....ccc', '.c.....c.c', '..c...cccc', '..ccccc...', '.ccccccc..'];
const neonHeading = lazy(() => {
  const c = document.createElement('canvas'); c.width = textWidth('CAFE') + 2; c.height = 7;
  drawText(c.getContext('2d')!, 'CAFE', 1, 1, '#efbc89', '#71432d');
  return c;
});

export function paintNeon(ctx: Ctx, id: string, cx: number, y: number, t: number, label?: string, pixelLettering = false): void {
  const generated = getGeneratedDecorAdapter(), body = generated?.sprite(id);
  if (body) {
    ctx.save(); ctx.globalAlpha *= 0.85 + Math.sin(t * 3) * 0.15;
    generated!.paintSprite(ctx, id, cx, y + body.height / 2);
    if (id === 'neon_cafe') {
      if (label) { (pixelLettering ? paintPixelSignText : paintSignText)(ctx, label, cx, y + 2, body.width - 4, body.height - 4, '#efbc89'); ctx.restore(); return; }
      const heading = neonHeading();
      const scale = Math.min((body.width - 4) / heading.width, (body.height - 4) / heading.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(heading, cx - heading.width * scale / 2, y + (body.height - heading.height * scale) / 2, heading.width * scale, heading.height * scale);
    }
    ctx.restore(); return;
  }
  if (id === 'neon_none') return;
  ctx.save();
  ctx.globalAlpha = 0.8 + Math.sin(t * 3) * 0.2;
  if (id === 'neon_cafe') {
    if (label) { (pixelLettering ? paintPixelSignText : paintSignText)(ctx, label, cx, y, 68, 14, '#efbc89'); ctx.restore(); return; }
    // Doubled bitmap text so the sign reads at this scale.
    const tmp = neonHeading();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, Math.round(cx - tmp.width), y, tmp.width * 2, tmp.height * 2);
  } else {
    const [rows, color, glow] = id === 'neon_heart' ? [NEON_HEART, '#efb0a0', '#884b42'] : [NEON_CUP, '#d0e3c3', '#4d6347'];
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
  const generated = getGeneratedDecorAdapter()?.icon(id);
  if (generated) return generated;
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
