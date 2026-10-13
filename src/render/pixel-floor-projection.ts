import { projectPoint, type PixelProjectionOptions } from './pixel-projection';

/** Finite visual light levels let an eased door settle the expensive floor cache. */
export function pixelFloorDoorLight(open: number): number {
  if (!Number.isFinite(open) || open <= 0.05) return 0;
  return Math.round(Math.min(1, open) * 8) / 8;
}

/** Rasterize only the flat ground layer. Upright architecture and sprites never pass here. */
export function projectFloorLayer(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, options: PixelProjectionOptions, density = 2): void {
  const w = source.width / density;
  const finite = (v: number | undefined, fallback: number) => v !== undefined && Number.isFinite(v) ? v : fallback;
  const identity = Math.max(w * 0.005, Math.min(w * 0.2, finite(options.doorIdentityWidth, 16)));
  const blend = Math.max(identity + w * 0.005, Math.min(w * 0.4, finite(options.doorBlendWidth, 40)));
  const columns = [0, identity, blend, w / 2, w - blend, w - identity, w];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < source.height; row++) {
    const y = row / density;
    for (let i = 0; i < columns.length - 1; i++) {
      const a = columns[i], b = columns[i + 1];
      const left = Math.round(projectPoint({ x: a, y }, options).x * density) / density;
      const right = Math.round(projectPoint({ x: b, y }, options).x * density) / density;
      if (right <= left) continue;
      ctx.drawImage(source, a * density, row, (b - a) * density, 1, left, y, right - left, 1 / density);
    }
  }
  ctx.restore();
}
