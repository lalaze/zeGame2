import { UI_ART } from './ui-art';

/** Inclusive vertical bounds of the actual painted glyph pixels, not font em boxes. */
export interface InkBounds { top: number; bottom: number }

export function alphaInkBounds(rgba: ArrayLike<number>, width: number, height: number): InkBounds | null {
  let top = height, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 0) {
        top = Math.min(top, y); bottom = y; break;
      }
    }
  }
  return bottom < 0 ? null : { top, bottom };
}

/** Keep whole-pixel glyphs, with exactly equal visible padding above and below. */
export function centerInk(ink: InkBounds, minimumHeight: number) {
  const inkHeight = ink.bottom - ink.top + 1;
  let height = Math.max(minimumHeight, inkHeight + 8);
  // A one-pixel taller cloud avoids rounding an odd remainder into uneven margins.
  if ((height - inkHeight) % 2) height++;
  const padding = (height - inkHeight) / 2;
  return { height, sourceY: ink.top, inkHeight, textY: padding, paddingTop: padding, paddingBottom: padding };
}

/** Called only when a localized texture is first baked, after fonts are loaded. */
export function thoughtTextRaster(lines: readonly string[], font: string, width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  // Generous transparent space accommodates ascenders/descenders in either font.
  canvas.height = lines.length * 12 + 48;
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_ART.ink;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, 24 + i * 12));
  const ink = alphaInkBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  // Translations are non-empty; a harmless transparent row also handles blank input.
  return { canvas, ...centerInk(ink ?? { top: 24, bottom: 24 }, lines.length * 12 + 6) };
}
