import type Phaser from 'phaser';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawText, FONT_CHARS, textWidth } from '../font';
import { addPixelFonts, PIXEL_FONT, PIXEL_FONT_HALO, PIXEL_FONT_VIP } from './pixel-font';

// Use the installed renderer, not a replacement that might accidentally honor
// tint. Phaser's Canvas BitmapText path samples atlas colors directly.
const require = createRequire(import.meta.url);
const renderBitmap = require(new URL('../../../node_modules/phaser/src/gameobjects/bitmaptext/static/BitmapTextCanvasRenderer.js', import.meta.url).pathname);
const Matrix = require(new URL('../../../node_modules/phaser/src/gameobjects/components/TransformMatrix.js', import.meta.url).pathname);

class RasterCanvas {
  width = 0;
  height = 0;
  pixels = new Map<string, string>();
  readonly context = new RasterContext(this);
  getContext() { return this.context; }
}

class RasterContext {
  fillStyle = '#000000';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  imageSmoothingEnabled = false;
  private matrix = [1, 0, 0, 1, 0, 0];
  private stack: { matrix: number[]; fill: string; alpha: number; composite: string }[] = [];
  constructor(private canvas: RasterCanvas) {}
  save() { this.stack.push({ matrix: [...this.matrix], fill: this.fillStyle, alpha: this.globalAlpha, composite: this.globalCompositeOperation }); }
  restore() { const s = this.stack.pop()!; this.matrix = s.matrix; this.fillStyle = s.fill; this.globalAlpha = s.alpha; this.globalCompositeOperation = s.composite; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.matrix = [a, b, c, d, e, f]; }
  translate(x: number, y: number) { const m = this.matrix; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x: number, y: number) { const m = this.matrix; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  private put(x: number, y: number, color: string) {
    const m = this.matrix;
    const px = Math.round(m[0] * x + m[2] * y + m[4]), py = Math.round(m[1] * x + m[3] * y + m[5]);
    if (this.globalAlpha > 0 && px >= 0 && py >= 0 && px < this.canvas.width && py < this.canvas.height) this.canvas.pixels.set(`${px},${py}`, color);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, this.fillStyle);
  }
  drawImage(source: RasterCanvas, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const color = source.pixels.get(`${Math.floor(sx + x * sw / dw)},${Math.floor(sy + y * sh / dh)}`);
      if (color) this.put(dx + x, dy + y, color);
    }
  }
}

type Font = { data: { size: number; lineHeight: number; chars: Record<number, object> }; texture: string };
function host() {
  const fonts = new Map<string, Font>(), textures = new Map<string, RasterCanvas>();
  const addCanvas = vi.fn((key: string, canvas: RasterCanvas) => textures.set(key, canvas));
  const scene = { cache: { bitmapFont: { exists: (key: string) => fonts.has(key), add: (key: string, font: Font) => fonts.set(key, font) } }, textures: { addCanvas } };
  return { scene: scene as unknown as Phaser.Scene, fonts, textures, addCanvas };
}

function bitmap(text: string, h: ReturnType<typeof host>, vip = false, whiteAtlas = false) {
  const canvas = Object.assign(new RasterCanvas(), { width: textWidth(text) + 2, height: 7 });
  const camera = { alpha: 1, roundPixels: true, scrollX: 0, scrollY: 0,
    matrix: new Matrix(), matrixCombined: new Matrix(), matrixExternal: new Matrix(), addToRenderList() {} };
  for (const name of [PIXEL_FONT_HALO, vip ? PIXEL_FONT_VIP : PIXEL_FONT]) {
    const font = h.fonts.get(name)!;
    const original = h.textures.get(font.texture)!;
    const atlas = whiteAtlas ? Object.assign(new RasterCanvas(), { width: original.width, height: original.height,
      pixels: new Map([...original.pixels.keys()].map(key => [key, '#ffffff'])) }) : original;
    const frame = { cutX: 0, cutY: 0, source: { image: atlas, scaleMode: 1 } };
    const src = { _text: text, _fontSize: 5, _letterSpacing: 0, _lineSpacing: 0, _align: 0, maxWidth: 0,
      fontData: font.data, fromAtlas: false, frame, texture: { frames: { __BASE: frame } },
      x: 1, y: 1, scaleX: 1, scaleY: 1, rotation: 0, scrollFactorX: 1, scrollFactorY: 1,
      displayOriginX: 0, displayOriginY: 0, alpha: 1, blendMode: 0,
      // Deliberately set intended tints: the real Canvas renderer ignores these.
      tintTopLeft: name === PIXEL_FONT_HALO ? 0x39281f : vip ? 0xff9fcb : 0xffd95a,
      _bounds: { lines: { longest: textWidth(text), lengths: [textWidth(text)] } }, getTextBounds: () => ({}) };
    renderBitmap({ currentContext: canvas.context, blendModes: ['source-over'], antialias: false }, src, camera);
  }
  return canvas;
}

const createCanvas = vi.fn(() => new RasterCanvas());
beforeEach(() => { createCanvas.mockClear(); vi.stubGlobal('document', { createElement: createCanvas }); });
afterEach(() => vi.unstubAllGlobals());

describe('sale floater atlas on the actual Phaser Canvas renderer', () => {
  it('reproduces the old opaque white halo despite requested brown and gold tints', () => {
    const h = host(); addPixelFonts(h.scene);
    const old = bitmap('+$12.00', h, false, true);
    expect(new Set(old.pixels.values())).toEqual(new Set(['#ffffff']));
    expect([...old.pixels.keys()].filter(key => key.endsWith(',4'))).toHaveLength(29);
  });

  it.each([false, true])('renders readable ink outlines and the correct baked foreground (VIP %s)', vip => {
    const h = host(); addPixelFonts(h.scene);
    for (const text of ['+$12.00', '+$0', '+$999.99', '+$1.2K', FONT_CHARS.join('')]) {
      const actual = bitmap(text, h, vip);
      const expected = Object.assign(new RasterCanvas(), { width: actual.width, height: actual.height });
      drawText(expected.context as unknown as CanvasRenderingContext2D, text, 1, 1, vip ? '#ff9fcb' : '#ffd95a', '#39281f');
      expect(actual.pixels).toEqual(expected.pixels);
      expect(new Set(actual.pixels.values())).toEqual(new Set(['#39281f', vip ? '#ff9fcb' : '#ffd95a']));
      expect(actual.pixels.size).toBeLessThan(actual.width * actual.height);
      if (text.startsWith('+')) expect(actual.pixels.has('0,0')).toBe(false);
    }
  });

  it('keeps one bounded atlas per texture manager, with identical advances and no repeat allocations', () => {
    const a = host(), b = host(); addPixelFonts(a.scene); addPixelFonts(b.scene);
    const before = createCanvas.mock.calls.length;
    for (let i = 0; i < 1000; i++) addPixelFonts(a.scene);
    expect(createCanvas.mock.calls.length).toBe(before);
    expect(a.addCanvas).toHaveBeenCalledTimes(1);
    expect(b.addCanvas).toHaveBeenCalledTimes(1);
    expect(a.textures.values().next().value).not.toBe(b.textures.values().next().value);
    const atlas = a.textures.values().next().value!;
    expect(atlas.height).toBe(19);
    expect(atlas.width * atlas.height * 4).toBeLessThan(32 * 1024);
    const normal = a.fonts.get(PIXEL_FONT)!.data.chars;
    for (const name of [PIXEL_FONT_HALO, PIXEL_FONT_VIP]) for (const [code, data] of Object.entries(a.fonts.get(name)!.data.chars)) {
      expect(data).toHaveProperty('xAdvance', (normal[Number(code)] as { xAdvance: number }).xAdvance);
    }
  });

  it('preserves glyph offsets and maps each color row to the correct WebGL UV rectangle', () => {
    const h = host(); addPixelFonts(h.scene);
    const atlas = h.textures.values().next().value!;
    for (const [name, y, height, offset] of [[PIXEL_FONT, 0, 5, 0], [PIXEL_FONT_HALO, 6, 7, -1], [PIXEL_FONT_VIP, 14, 5, 0]] as const) {
      const font = h.fonts.get(name)!;
      expect(font.data.size).toBe(5);
      expect(font.data.lineHeight).toBe(6);
      for (const entry of Object.values(font.data.chars)) {
        const g = entry as { x: number; y: number; width: number; height: number; xOffset: number; yOffset: number; u0: number; u1: number; v0: number; v1: number };
        expect(g).toMatchObject({ y, height, xOffset: offset, yOffset: offset });
        expect(g.u0).toBe(g.x / atlas.width);
        expect(g.u1).toBe((g.x + g.width) / atlas.width);
        expect(g.v0).toBe(1 - y / atlas.height);
        expect(g.v1).toBe(1 - (y + height) / atlas.height);
      }
    }
  });

  it('can export reproducible code-native before/after pixel evidence', () => {
    const h = host(); addPixelFonts(h.scene);
    const samples = [bitmap('+$12.00', h, false, true), bitmap('+$12.00', h), bitmap('+$12.00', h, true)];
    expect(samples.map(s => s.pixels.size)).toEqual([samples[0].pixels.size, samples[0].pixels.size, samples[0].pixels.size]);
    if (process.env.PIXEL_FONT_EVIDENCE) writeFileSync(process.env.PIXEL_FONT_EVIDENCE, JSON.stringify(samples.map(s => ({ width: s.width, height: s.height, pixels: [...s.pixels] }))));
  });
});
