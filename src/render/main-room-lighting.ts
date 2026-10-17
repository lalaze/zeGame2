import type { Lighting, Sun } from './lighting';
import { registerFineSpriteArt } from './fine-sprite-art';
import { worldSpriteArt } from './world-art-grid';

export const MAIN_KEY_SLOPE = .38;
export const mainCastVector = (reach: number) => ({ x: reach * MAIN_KEY_SLOPE, y: reach });

/** Art-directed key light matches the baked upper-left highlights. The outdoor
 * sun still travels normally; main-room key direction never flips at noon. */
export function mainKeyLight(sun: Sun) {
  const low = 1 - Math.max(0, Math.min(1, sun.elevation));
  const length = 116 + low * 58;
  return { lean: length * MAIN_KEY_SLOPE, length,
    strength: sun.elevation > 0 ? sun.strength : 0 };
}

/** Bounded buckets keep shadow textures reusable across clock minutes. */
export function mainShadowState(light: Lighting) {
  const key = mainKeyLight(light.sun);
  return { strength: Math.round(key.strength * 4) / 4,
    reach: 12 + Math.round((1 - light.sun.elevation) * 3) * 3 };
}

/** Softness is a few pixel steps, with a compact dark contact core. */
export function paintContactShade(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, opacity: number) {
  ctx.save(); ctx.fillStyle = '#42251a';
  const rx = width / 2, ry = width >= 30 ? 5 : 2.5;
  for (let row = -ry; row <= ry; row += .5) {
    const edge = Math.sqrt(Math.max(0, 1 - (row / ry) ** 2));
    ctx.globalAlpha = Math.min(1, opacity * (1.1 + .5 * edge));
    ctx.fillRect(Math.round((x - rx * edge) * 2) / 2, y + row, Math.round(width * edge * 2) / 2, .5);
  }
  ctx.globalAlpha = Math.min(1, opacity * 1.8);
  ctx.fillRect(Math.round((x - width * .23) * 2) / 2, y - .5, Math.round(width * .46 * 2) / 2, 1);
  ctx.restore();
}

/** A restrained, tapered floor projection. Separate from contact AO so the
 * whole cast pass can sort BELOW every actor/chair, not over its neighbours. */
export function paintCastShade(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, reach: number, strength: number) {
  if (strength <= 0) return;
  ctx.save(); ctx.fillStyle = '#55301f';
  const ry = width >= 30 ? 5 : 3, vector = mainCastVector(reach);
  for (let row = -ry; row <= vector.y + ry; row += .5) {
    const t = Math.max(0, Math.min(1, row / vector.y));
    const taper = 1 - t * .22;
    const cap = row < 0 ? Math.sqrt(Math.max(0, 1 - (row / ry) ** 2))
      : row > vector.y ? Math.sqrt(Math.max(0, 1 - ((row - vector.y) / ry) ** 2)) : 1;
    const half = width * .43 * taper * cap;
    ctx.globalAlpha = strength * (.14 - .05 * t) * Math.min(1, cap + .15);
    ctx.fillRect(Math.round((x + vector.x * t - half) * 2) / 2, y + row, Math.round(half * 4) / 2, .5);
  }
  ctx.restore();
}

/** Golden window footprints: two separated panes, fixed upper-left key, with
 * a small feather at the far edge. Half-pixel scanlines avoid vector AA. */
export function paintWindowBounce(ctx: CanvasRenderingContext2D, x: number, width: number, floorY: number, sun: Sun) {
  const key = mainKeyLight(sun);
  if (!key.strength) return;
  const reach = key.length;
  ctx.save(); ctx.fillStyle = '#fee8ac';
  for (let row = 0; row < reach; row += .5) {
    const t = row / reach, feather = Math.min(1, (1 - t) * 12);
    const left = x + row * MAIN_KEY_SLOPE;
    // The crossbar cuts a quiet shadow through the projected panes.
    if (t > .36 && t < .40) continue;
    ctx.globalAlpha = key.strength * .48 * feather;
    for (let pane = 0; pane < 2; pane++) {
      const px = Math.round((left + pane * width / 2) * 2) / 2;
      ctx.fillRect(px, floorY + row, Math.round((width / 2 - 2) * 2) / 2, .5);
      ctx.globalAlpha = key.strength * .12 * feather;
      ctx.fillRect(px - 1, floorY + row, 1, .5);
      ctx.globalAlpha = key.strength * .48 * feather;
    }
  }
  ctx.restore();
}

/** Soft object exposure follows the same diagonal and reach as the floor panes. */
export function mainSurfaceLight(x: number, y: number, light: Lighting, openings: readonly {x: number; w: number}[]) {
  const key = mainKeyLight(light.sun);
  if (key.strength === 0) return 0;
  const reach = key.length;
  const row = Math.max(0, y - 80), t = row / reach;
  if (t >= 1) return 0;
  let coverage = 0;
  for (const opening of openings) {
    const center = opening.x + opening.w / 2 + row * MAIN_KEY_SLOPE;
    const radius = opening.w / 2 + 6;
    coverage = Math.max(coverage, Math.max(0, 1 - Math.abs(x - center) / radius));
  }
  return coverage * key.strength * (1 - t * .35) * Math.min(1, (1 - t) * 12);
}

const lit = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>();
/** Source-atop preserves alpha, contours, pose contacts and physical crop
 * density in both Canvas and WebGL. Four variants maximum per source pose. */
export function mainLitSprite(source: HTMLCanvasElement, exposure: number): HTMLCanvasElement {
  const level = Math.max(0, Math.min(3, Math.round(exposure * 3)));
  if (!level) return source;
  let variants = lit.get(source);
  if (!variants) { variants = new Map(); lit.set(source, variants); }
  const old = variants.get(level); if (old) return old;
  const art = worldSpriteArt(source), canvas = document.createElement('canvas');
  canvas.width = art.canvas.width; canvas.height = art.canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(art.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  for (let y = 0; y < canvas.height; y += art.density) {
    const upper = 1 - y / canvas.height;
    ctx.fillStyle = '#ffe2a4'; ctx.globalAlpha = level * (.012 + upper * .027);
    ctx.fillRect(0, y, canvas.width, art.density);
  }
  ctx.globalAlpha = .035 * level; ctx.fillStyle = '#725039';
  ctx.fillRect(canvas.width * .66, canvas.height * .55, canvas.width * .34, canvas.height * .45);
  const logical = document.createElement('canvas');
  logical.width = source.width; logical.height = source.height;
  registerFineSpriteArt(logical, canvas, art.density);
  variants.set(level, logical); return logical;
}
