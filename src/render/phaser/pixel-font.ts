import type Phaser from 'phaser';
import { FONT_CHARS, glyph } from '../font';

/** The 3x5 sale font, with color baked for both Canvas and WebGL renderers. */
export const PIXEL_FONT = 'pixel';
/** VIP sale lettering shares all normal glyph metrics. */
export const PIXEL_FONT_VIP = 'pixel-vip';
/** The same glyphs grown by a pixel all round, drawn under the text as its outline. */
export const PIXEL_FONT_HALO = 'pixel-halo';

const GLYPH_H = 5;

/**
 * Builds the sale fonts from render/font.ts into one fixed-size color atlas:
 * gold glyphs on top, ink halos below, and pink VIP glyphs on the last row.
 * Canvas BitmapText ignores tint, so white halo glyphs would obscure the text.
 * Haloed glyphs are 2px bigger and shifted back by 1px; every font advances
 * identically and lines up when stacked. No amount-specific textures are made.
 */
export function addPixelFonts(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const chars = FONT_CHARS.map((ch) => ({ ch, ...glyph(ch) }));
  const width = chars.reduce((sum, c) => sum + c.w + 3, 0);
  const haloY = GLYPH_H + 1;
  const vipY = haloY + GLYPH_H + 2 + 1;
  const height = vipY + GLYPH_H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Phaser's typings leave out xAdvance, which BitmapText reads to space letters.
  type CharData = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };
  const plain: Record<number, CharData> = {};
  const halo: Record<number, CharData> = {};
  const vip: Record<number, CharData> = {};
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
      ctx.fillStyle = '#ffd95a';
      ctx.fillRect(x + gx, gy, 1, 1);
      ctx.fillStyle = '#39281f';
      ctx.fillRect(x + gx, haloY + gy, 3, 3);
      ctx.fillStyle = '#ff9fcb';
      ctx.fillRect(x + gx, vipY + gy, 1, 1);
    }
    const codes = new Set([ch.charCodeAt(0), ch.toLowerCase().charCodeAt(0)]);
    for (const code of codes) {
      plain[code] = entry(x, 0, w, GLYPH_H, 0, w + 1);
      halo[code] = entry(x, haloY, w + 2, GLYPH_H + 2, -1, w + 1);
      vip[code] = entry(x, vipY, w, GLYPH_H, 0, w + 1);
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
  scene.cache.bitmapFont.add(PIXEL_FONT_VIP, font(PIXEL_FONT_VIP, vip));
}
