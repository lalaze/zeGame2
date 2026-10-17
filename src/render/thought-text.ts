import { pixelSignGlyph } from './sign-lettering';
import { artRamp } from './main-room-surfaces';

export const thoughtTextWidth = (text: string): number => Math.max(0, [...text].reduce((sum, ch) => sum + pixelSignGlyph(ch).width + 1, 0) - 1) / 2;

export function wrapThoughtText(text: string, chinese: boolean, width = 80): string[] {
  const units = chinese ? [...text] : text.split(' '), join = chinese ? '' : ' ';
  const lines: string[] = [];
  let line = '';
  for (const unit of units) {
    const next = line ? line + join + unit : unit;
    if (line && thoughtTextWidth(next) > width) { lines.push(line); line = unit; }
    else line = next;
    if (thoughtTextWidth(line) > width) {
      let part = '';
      for (const ch of line) {
        if (part && thoughtTextWidth(part + ch) > width) { lines.push(part); part = ''; }
        part += ch;
      }
      line = part;
    }
  }
  if (line) lines.push(line);
  return lines;
}

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
export function thoughtTextRaster(lines: readonly string[], _font: string, width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  // Generous transparent space accommodates ascenders/descenders in either font.
  canvas.height = lines.length * 24 + 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = artRamp('walnut')[0];
  lines.forEach((line, index) => {
    let left = Math.round(width - thoughtTextWidth(line));
    for (const ch of line) {
      const mask = pixelSignGlyph(ch);
      for (let row = 0; row < mask.height; row++) for (let col = 0; col < mask.width; col++) {
        if (mask.bits[row * mask.width + col]) ctx.fillRect(left + col, 24 + index * 24 + row, 1, 1);
      }
      left += mask.width + 1;
    }
  });
  const ink = alphaInkBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  // Translations are non-empty; a harmless transparent row also handles blank input.
  const centered = centerInk(ink ?? { top: 24, bottom: 24 }, lines.length * 24 + 12);
  return { canvas, height: centered.height / 2, sourceY: centered.sourceY, inkHeight: centered.inkHeight, textY: centered.textY / 2 };
}
