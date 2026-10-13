// Shared finishes for the café's hand-painted pixel materials. All marks stay
// on the art grid; deterministic patterns remain still when a room repaints.
import { mix } from './color';

type Ctx = CanvasRenderingContext2D;

/** Layered tree crowns beyond the windows, painted in stable pixel clusters. */
export function treeLine(ctx: Ctx, x: number, y: number, w: number, h: number, darkness: number): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // Darkness is continuous. A fixed per-paint palette avoids any time-key cache.
  const tint = darkness * 0.86;
  const colors: Record<string, string> = {
    '#a5b578': mix('#a5b578', '#263b37', tint),
    '#e1c99e': mix('#e1c99e', '#263b37', tint),
    '#b47e5c': mix('#b47e5c', '#263b37', tint),
    '#c58d65': mix('#c58d65', '#263b37', tint),
    '#ad7553': mix('#ad7553', '#263b37', tint),
    '#678477': mix('#678477', '#263b37', tint),
    '#eff0c9': mix('#eff0c9', '#263b37', tint),
    '#46653b': mix('#46653b', '#263b37', tint),
    '#718c46': mix('#718c46', '#263b37', tint),
    '#7c934b': mix('#7c934b', '#263b37', tint),
    '#a5b75c': mix('#a5b75c', '#263b37', tint),
    '#a3b45c': mix('#a3b45c', '#263b37', tint),
    '#c2cc76': mix('#c2cc76', '#263b37', tint),
    '#354c32': mix('#354c32', '#263b37', tint),
    '#58703c': mix('#58703c', '#263b37', tint),
  };
  const tone = (c: string) => colors[c];
  // Far hillside has an irregular silhouette, leaving sky between the roofs.
  for (let dx = 0; dx < w; dx++) {
    const top = Math.round(h * 0.37 + Math.sin(dx / 13) * 2 + Math.sin(dx / 5) * 1.5);
    pixel(ctx, x + dx, y + top, 1, h - top, tone('#a5b578'));
  }
  // Sunlit village facades and ochre chimneys are visible between tree crowns.
  for (let i = 0; i < w; i += 37) {
    const hx = x + i + 10, hy = y + Math.round(h * 0.34) + i % 3;
    pixel(ctx, hx, hy, 11, 9, tone('#e1c99e'));
    pixel(ctx, hx - 1, hy - 1, 13, 2, tone('#b47e5c'));
    pixel(ctx, hx + 1, hy - 3, 9, 2, tone('#c58d65'));
    pixel(ctx, hx + 8, hy - 5, 2, 3, tone('#ad7553'));
    for (const wx of [2, 7]) {
      pixel(ctx, hx + wx, hy + 2, 2, 3, tone('#678477'));
      pixel(ctx, hx + wx, hy + 2, 1, 1, tone('#eff0c9'));
    }
  }
  // Rounded stepped leaf clusters grow in overlapping lobes, not horizontal strips.
  for (let layer = 0; layer < 2; layer++) for (let i = -1; i * 15 < w + 15; i++) {
    const cx = x + i * 15 + layer * 8;
    const cy = y + Math.round(h * (layer ? 0.82 : 0.61)) + Math.round(Math.sin(i * 2.7) * 4);
    const radius = layer ? 5 : 6;
    for (let dy = -radius; dy <= radius; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - (dy / (radius + 0.2)) ** 2)) * (radius + 1));
      pixel(ctx, cx - half, cy + dy, half * 2 + 1, 1, tone(layer ? '#46653b' : '#718c46'));
    }
    for (const [dx, dy] of [[-3, -3], [1, -4], [-4, 0], [2, 0], [0, 3]]) {
      pixel(ctx, cx + dx, cy + dy, 3, 2, tone(layer ? '#7c934b' : '#a5b75c'));
      pixel(ctx, cx + dx, cy + dy, 2, 1, tone(layer ? '#a3b45c' : '#c2cc76'));
      pixel(ctx, cx + dx + 2, cy + dy + 2, 2, 1, tone(layer ? '#354c32' : '#58703c'));
    }
  }
  ctx.restore();
}

export function brushedMetal(ctx: Ctx, x: number, y: number, w: number, h: number, base: string): void {
  if (w < 4 || h < 4) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  const groove = mix(base, '#526578', 0.09), face = mix(base, '#f5f5e9', 0.08);
  for (let dy = 1; dy < h - 1; dy++) {
    ctx.fillStyle = dy % 3 === 0 ? groove : face;
    ctx.fillRect(x + 1, y + dy, w - 2, 1);
  }
  ctx.fillStyle = '#f5ffff'; ctx.globalAlpha = 0.28;
  ctx.fillRect(x + Math.floor(w * 0.22), y + 1, 2, h - 2);
  ctx.fillRect(x + Math.floor(w * 0.22) + 3, y + 1, 1, h - 2);
  ctx.restore();
}

export function glassReflection(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.18): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#f7ffff'; ctx.globalAlpha = alpha;
  // Stepped, diagonal reflections retain crisp edges at every pixel zoom.
  for (let dy = 0; dy < h; dy++) {
    const dx = Math.floor(w * 0.25 + dy * 0.55);
    ctx.fillRect(x + dx, y + dy, 3, 1);
    ctx.fillRect(x + dx + 5, y + dy, 1, 1);
  }
  ctx.restore();
}

export function roomDepth(ctx: Ctx, width: number, height: number, floor: number, outdoors = false): void {
  ctx.save();
  // Contact shade under the wall and along cutaway edges, without a dark
  // full-screen vignette that could hide guests or furniture.
  ctx.fillStyle = '#39281f';
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = (outdoors ? 0.045 : 0.075) * (1 - i / 7);
    ctx.fillRect(i, floor, 1, height - floor);
    ctx.fillRect(width - i - 1, floor, 1, height - floor);
    ctx.fillRect(0, floor + i, width, 1);
  }
  ctx.restore();
}

export function dustMotes(ctx: Ctx, x: number, y: number, w: number, h: number, time: number, strength: number): void {
  if (strength < 0.1) return;
  ctx.save(); ctx.fillStyle = '#fff5d6';
  for (let i = 0; i < 7; i++) {
    const phase = time * 0.15 + i * 2.4;
    ctx.globalAlpha = strength * (0.16 + 0.2 * (0.5 + Math.sin(phase) * 0.5));
    const px = x + ((i * 17 + Math.sin(phase) * 3 + w) % w);
    const py = y + ((i * 13 - time * 1.3) % h + h) % h;
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
  ctx.restore();
}

/** Direction A's material construction. Shapes, not a full-scene color filter. */
export const WARM_MATERIAL = Object.freeze({
  ink: '#39281f', cream: '#f4e6c7', wood: '#865332', light: '#c98c4d',
  shade: '#543425', leaf: '#627451', brass: '#c8a15e',
});

function pixel(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A mortised beam with a planed lit face, shadowed return and stable knots. */
export function timberBeam(ctx: Ctx, x: number, y: number, w: number, h: number, vertical = false, base: string = WARM_MATERIAL.wood): void {
  const p = (a: number, b: number, aw: number, bh: number, c: string) =>
    vertical ? pixel(ctx, x + b, y + a, bh, aw, c) : pixel(ctx, x + a, y + b, aw, bh, c);
  const long = vertical ? h : w, deep = vertical ? w : h;
  p(0, 0, long, deep, WARM_MATERIAL.ink);
  p(1, 1, long - 2, deep - 2, base);
  p(1, 1, long - 2, 1, mix(base, '#f3c57d', 0.58));
  p(1, 2, long - 2, 1, mix(base, '#d39a5a', 0.32));
  p(1, deep - 3, long - 2, 2, mix(base, WARM_MATERIAL.shade, 0.65));
  const grainLight = mix(base, '#d0a36b', 0.18);
  const grainShade = mix(base, WARM_MATERIAL.shade, 0.55);
  const grainSoft = mix(base, WARM_MATERIAL.shade, 0.3);
  for (let a = 4; a < long - 7; a += 13) {
    const b = 3 + (a * 7 % Math.max(1, deep - 6));
    p(a, b, Math.min(7, long - a - 2), 1, grainLight);
    if (deep > 6 && a % 3 === 1) {
      p(a + 2, b + 1, 3, 1, grainShade);
      p(a + 3, b, 2, 1, grainSoft);
    }
  }
  // End-grain joint and a sunk iron pin, rather than a flat boxed outline.
  if (long > 30 && deep > 5) for (const a of [3, long - 5]) {
    p(a, 2, 1, deep - 4, mix(base, WARM_MATERIAL.shade, 0.5));
    p(a + 1, 3, 1, 1, '#e0b36e');
    p(a + 1, deep - 3, 1, 1, WARM_MATERIAL.ink);
  }
}

/** Cabinet stile/rail construction and a recessed raised inner panel. */
export function cabinetPanel(ctx: Ctx, x: number, y: number, w: number, h: number, base: string = WARM_MATERIAL.wood, handle = false): void {
  const lo = mix(base, WARM_MATERIAL.shade, 0.7), hi = mix(base, '#dcaa66', 0.55);
  pixel(ctx, x, y, w, h, WARM_MATERIAL.ink);
  pixel(ctx, x + 1, y + 1, w - 2, h - 2, base);
  pixel(ctx, x + 1, y + 1, w - 2, 1, hi);
  pixel(ctx, x + 1, y + 1, 1, h - 2, hi);
  pixel(ctx, x + 3, y + 3, w - 6, h - 6, lo);
  pixel(ctx, x + 4, y + 4, w - 8, h - 8, mix(base, '#b8793f', 0.12));
  pixel(ctx, x + 4, y + h - 4, w - 8, 1, hi);
  pixel(ctx, x + w - 4, y + 4, 1, h - 8, hi);
  const grainColor = mix(base, lo, 0.28);
  for (let i = 6; i < w - 5; i += 5) pixel(ctx, x + i, y + 5 + i % 3, 1, Math.max(1, h - 12 - i % 3), grainColor);
  if (handle && w >= 12 && h >= 10) {
    const hx = x + w - 6, hy = y + Math.floor(h / 2) - 1;
    pixel(ctx, hx, hy, 2, 4, WARM_MATERIAL.ink);
    pixel(ctx, hx, hy, 1, 3, WARM_MATERIAL.brass);
    pixel(ctx, hx, hy, 1, 1, '#f3d796');
  }
}

/** Small overlapping leaf planes, with an upper-left vein and dark underside. */
export function leafySprig(ctx: Ctx, cx: number, cy: number, radius = 5, seed = 0): void {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + seed;
    const x = Math.round(cx + Math.cos(a) * radius * 0.7);
    const y = Math.round(cy + Math.sin(a) * radius * 0.5);
    pixel(ctx, x - 2, y, 5, 2, '#344832');
    pixel(ctx, x - 1, y - 2, 3, 4, '#52683c');
    pixel(ctx, x - 2, y - 1, 4, 2, '#73854a');
    pixel(ctx, x - 1, y - 2, 2, 1, '#a2aa59');
    pixel(ctx, x - 1, y - 1, 1, 2, '#bac774');
  }
}

/** Brass wall lantern, open glass with an ivory wick. No glow outside its bounds. */
export function wallLantern(ctx: Ctx, x: number, y: number): void {
  pixel(ctx, x + 3, y, 3, 3, WARM_MATERIAL.ink);
  pixel(ctx, x + 4, y + 1, 1, 2, WARM_MATERIAL.brass);
  pixel(ctx, x + 2, y + 3, 5, 2, WARM_MATERIAL.ink);
  pixel(ctx, x + 1, y + 5, 7, 9, WARM_MATERIAL.brass);
  pixel(ctx, x + 2, y + 6, 5, 6, '#f0c66d');
  pixel(ctx, x + 2, y + 6, 2, 5, '#fff3c4');
  pixel(ctx, x + 4, y + 7, 1, 5, '#fffbea');
  pixel(ctx, x + 1, y + 13, 7, 1, WARM_MATERIAL.ink);
  pixel(ctx, x + 2, y + 14, 5, 1, WARM_MATERIAL.shade);
}
