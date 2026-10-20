// After dark each room is multiplied by a light map: cool night shade that deepens
// toward the corners, warming to near white inside each lamp's pool. Multiplying
// (rather than adding light) keeps dark wood and outlines dark inside the pools.
import type { AreaId } from '../game/regions';

export interface LightPool {
  x: number;
  y: number;
  /** Reach of the pool, in room pixels. */
  pool: number;
  /** 0 to 1. */
  strength: number;
}

interface Shade { shade: string; corner: string }

/** Walled rooms keep more of their own light than the glasshouse and patio, which also take the sky's grade. */
const SHADES: Record<Exclude<AreaId, 'kitchen'>, Shade> = {
  main: { shade: '#7d8fd6', corner: '#4f5a99' },
  reading: { shade: '#7d8fd6', corner: '#4f5a99' },
  greenhouse: { shade: '#b4c0ea', corner: '#7480b8' },
  terrace: { shade: '#bcc6ec', corner: '#7c88bc' },
};
const WARM = '#ffebbf';

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** How far a pixel is into the darker corners: 0 across the middle, 1 at the very corner. */
export function cornerDepth(x: number, y: number, width: number, height: number): number {
  const d = Math.hypot(x / width - .5, (y / height - .45) * .9) * 2;
  return Math.min(1, Math.max(0, (d - .55) / .75)) ** 1.5;
}

/** Combined light from every pool at a point, 0 to 1; overlapping pools never exceed full light. */
export function poolLight(x: number, y: number, pools: readonly LightPool[]): number {
  let dark = 1;
  for (const p of pools) {
    const d = Math.hypot(x - p.x, y - p.y) / p.pool;
    if (d < 1) dark *= 1 - p.strength * (1 - d * d) ** 2;
  }
  return 1 - dark;
}

/** RGBA light map for a room, one pixel per room pixel. */
export function nightLightMap(area: Exclude<AreaId, 'kitchen'>, width: number, height: number, pools: readonly LightPool[]): Uint8ClampedArray {
  const { shade, corner } = SHADES[area];
  const [s, c, w] = [rgb(shade), rgb(corner), rgb(WARM)];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = cornerDepth(x + .5, y + .5, width, height), l = poolLight(x + .5, y + .5, pools), p = (y * width + x) * 4;
      for (let i = 0; i < 3; i++) data[p + i] = Math.round(s[i] + (c[i] - s[i]) * v + (w[i] - (s[i] + (c[i] - s[i]) * v)) * l);
      data[p + 3] = 255;
    }
  }
  return data;
}
