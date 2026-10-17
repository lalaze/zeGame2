import { generatedRasterGeometry } from './generated-raster-geometry';

/** Recolour fabric pigment only; preserve the source silhouette, folds and timber. */
export const TEXTILE_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  tablecloth_rose: [204, 139, 158], curtain_rose: [204, 139, 158],
  tablecloth_mint: [105, 151, 113], tablecloth_blue: [90, 132, 174],
  tablecloth_lavender: [156, 116, 169], tablecloth_linen: [235, 220, 187],
  curtain_sage: [105, 151, 113], curtain_blue: [90, 132, 174], curtain_linen: [235, 220, 187],
};

export function remapTextile(pixels: Uint8ClampedArray, width: number, height: number, id: string, table = false): void {
  const color = TEXTILE_COLORS[id];
  if (!color) return;
  for (let y = 0; y < height * (table ? .76 : 1); y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const [r, g, b, a] = pixels.subarray(offset, offset + 4);
    // Orange timber and green leaves stay untouched, including the table pedestal.
    if (!a || r - g < 24 || g > r * .76 || b < g * (table ? .75 : .48)) continue;
    const shade = Math.max(.25, Math.min(1.25, r / 205));
    for (let c = 0; c < 3; c++) pixels[offset + c] = Math.min(255, Math.round(color[c] * shade));
  }
}

const windows = new WeakMap<object, Map<string, HTMLCanvasElement>>();
export function curtainSource(source: CanvasImageSource, id: string) {
  if (!TEXTILE_COLORS[id]) return source;
  const variants = windows.get(source) ?? new Map<string, HTMLCanvasElement>();
  const cached = variants.get(id); if (cached) return cached;
  const geometry = generatedRasterGeometry(source); if (!geometry) return source;
  const canvas = document.createElement('canvas'); canvas.width = geometry.width; canvas.height = geometry.height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  remapTextile(pixels.data, canvas.width, canvas.height, id);
  ctx.putImageData(pixels, 0, 0); variants.set(id, canvas); windows.set(source, variants);
  return canvas;
}

export function textileSwatch(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number): void {
  const rgb = TEXTILE_COLORS[id] ?? [195, 74, 57];
  const ink = `rgb(${rgb.join(',')})`;
  ctx.fillStyle = '#faecd3'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ink;
  ctx.globalAlpha = id.endsWith('_linen') ? .24 : .65;
  for (let col = 0; col < w; col += 6) ctx.fillRect(x + col, y, Math.min(3, w - col), h);
  for (let row = 0; row < h; row += 6) ctx.fillRect(x, y + row, w, Math.min(3, h - row));
  ctx.globalAlpha = 1;
}
