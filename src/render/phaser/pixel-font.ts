import type Phaser from 'phaser';
import { FONT_CHARS, glyph } from '../font';

/** The 3x5 scene font as a Phaser bitmap font, in white for tinting. */
export const PIXEL_FONT = 'pixel';
/** The same glyphs grown by a pixel all round, drawn under the text as its outline. */
export const PIXEL_FONT_HALO = 'pixel-halo';

const GLYPH_H = 5;

/**
 * Builds both fonts from render/font.ts into one atlas: plain glyphs on the top row,
 * haloed ones below. Haloed glyphs are 2px bigger and shifted back by 1px, so the
 * two fonts advance identically and line up when stacked.
 */
export function addPixelFonts(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const chars = FONT_CHARS.map((ch) => ({ ch, ...glyph(ch) }));
  const width = chars.reduce((sum, c) => sum + c.w + 3, 0);
  const height = GLYPH_H + 1 + GLYPH_H + 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';

  // Phaser's typings leave out xAdvance, which BitmapText reads to space letters.
  type CharData = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };
  const plain: Record<number, CharData> = {};
  const halo: Record<number, CharData> = {};
  const entry = (x: number, y: number, w: number, h: number, offset: number, advance: number): CharData => ({
    x,
    y,
    width: w,
    height: h,
    centerX: Math.floor(w / 2),
    centerY: Math.floor(h / 2),
    xOffset: offset,
    yOffset: offset,
    xAdvance: advance,
    data: {},
    kerning: {},
    // Phaser 4 samples textures GL-style, with v = 0 at the bottom.
    u0: x / width,
    v0: 1 - y / height,
    u1: (x + w) / width,
    v1: 1 - (y + h) / height,
  });

  let x = 0;
  for (const { ch, bits, w } of chars) {
    for (let p = 0; p < bits.length; p++) {
      if (bits[p] !== '1') continue;
      const gx = p % w;
      const gy = Math.floor(p / w);
      ctx.fillRect(x + gx, gy, 1, 1);
      ctx.fillRect(x + gx, GLYPH_H + 1 + gy, 3, 3);
    }
    const codes = new Set([ch.charCodeAt(0), ch.toLowerCase().charCodeAt(0)]);
    for (const code of codes) {
      plain[code] = entry(x, 0, w, GLYPH_H, 0, w + 1);
      halo[code] = entry(x, GLYPH_H + 1, w + 2, GLYPH_H + 2, -1, w + 1);
    }
    x += w + 3;
  }

  const key = 'pixel-font-atlas';
  scene.textures.addCanvas(key, canvas);
  const font = (name: string, set: Record<number, CharData>) => ({
    data: { font: name, size: GLYPH_H, lineHeight: GLYPH_H + 1, chars: set } as unknown as Phaser.Types.GameObjects.BitmapText.BitmapFontData,
    texture: key,
    frame: null,
  });
  scene.cache.bitmapFont.add(PIXEL_FONT, font(PIXEL_FONT, plain));
  scene.cache.bitmapFont.add(PIXEL_FONT_HALO, font(PIXEL_FONT_HALO, halo));
}
