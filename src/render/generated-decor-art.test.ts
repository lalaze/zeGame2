import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { DECOR } from '../game/decor';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedDecorArt, GENERATED_COUNTER_BANDS, GENERATED_DECOR_ASSETS, GENERATED_DECOR_CATALOG, GENERATED_DECOR_IDS,
  GENERATED_DECOR_SOURCE_IDS, generatedDecorKey, type GeneratedDecorSourceId, type GeneratedDecorSources } from './generated-decor-art';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean };
class RecordingCanvas {
  width = 0; height = 0; draws: Draw[] = []; stack: boolean[] = [];
  context = {
    imageSmoothingEnabled: true,
    save: () => { this.stack.push(this.context.imageSmoothingEnabled); },
    restore: () => { this.context.imageSmoothingEnabled = this.stack.pop()!; },
    scale() {},
    drawImage: (source: CanvasImageSource, ...args: number[]) => { this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled }); },
  };
  getContext() { return this.context; }
}
const ctx = (c: RecordingCanvas) => c.context as unknown as CanvasRenderingContext2D;
const source = (w: number, h: number) => ({ width: w, height: h }) as HTMLCanvasElement;
function fixture(packed = false) {
  const sources = Object.fromEntries(GENERATED_DECOR_SOURCE_IDS.map(key => {
    const [w, h] = GENERATED_DECOR_CATALOG[key].size, k = packed ? Math.min(1, 256 / Math.max(w, h)) : 1;
    return [key, source(Math.round(w * k), Math.round(h * k))];
  })) as Record<GeneratedDecorSourceId, CanvasImageSource>;
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => { const c = new RecordingCanvas(); canvases.push(c); return c as unknown as HTMLCanvasElement; });
  const create = (input: GeneratedDecorSources = sources) => createGeneratedDecorArt(input, { createCanvas });
  return { sources, canvases, createCanvas, create };
}

/** Independent RGBA decoder verifies real source alpha, not only draw mocks. */
function pngPixels(path: string) {
  const bytes = readFileSync(path), w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20), chunks: Buffer[] = [];
  expect([bytes[24], bytes[25], bytes[28]]).toEqual([8, 6, 0]);
  for (let p = 8; p < bytes.length;) {
    const n = bytes.readUInt32BE(p);
    if (bytes.toString('ascii', p + 4, p + 8) === 'IDAT') chunks.push(bytes.subarray(p + 8, p + 8 + n));
    p += n + 12;
  }
  const packed = inflateSync(Buffer.concat(chunks)), stride = w * 4, pixels = new Uint8Array(stride * h);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < stride; x++) {
    const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
    const filter = packed[y * (stride + 1)];
    pixels[i] = (packed[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
  }
  return { w, h, pixels };
}

describe('generated decor materials and props adapter', () => {
  // Decor added later has its own painters: textiles in textile-styles.ts and centerpieces in
  // table-centerpiece-art.ts (4fe9fb3), counters in main-room-surfaces.ts (55646f5). A new decor id
  // must join either this generated pack or that list.
  const OWN_PAINTERS = [
    'tablecloth_classic', 'tablecloth_mint', 'tablecloth_rose', 'tablecloth_blue', 'tablecloth_lavender', 'tablecloth_linen',
    'centerpiece_flowers', 'centerpiece_succulent', 'centerpiece_candle',
    'curtain_classic', 'curtain_sage', 'curtain_rose', 'curtain_blue', 'curtain_linen',
    'counter_sage', 'counter_blush',
  ];
  it('covers 31 actual decor IDs with 36 genuine source bitmaps and excludes all four explicit none options', () => {
    expect(GENERATED_DECOR_IDS).toHaveLength(31);
    expect([...GENERATED_DECOR_IDS].sort()).toEqual(DECOR.filter(d => !d.id.endsWith('_none') && !OWN_PAINTERS.includes(d.id)).map(d => d.id).sort());
    for (const id of OWN_PAINTERS) expect(DECOR.some(d => d.id === id), id).toBe(true);
    expect(GENERATED_DECOR_SOURCE_IDS).toHaveLength(36);
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/decor-materials/renderer-manifest.json', 'utf8'));
    for (const entry of [...manifest.assets, ...manifest.aliases]) {
      const key = `${entry.id}-${entry.state}` as GeneratedDecorSourceId, meta = GENERATED_DECOR_CATALOG[key];
      const bytes = readFileSync(resolve('assets/generated/bulk-candidates/decor-materials', entry.file));
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(meta.size);
      expect(meta.anchor).toEqual(entry.anchor);
      expect(GENERATED_DECOR_ASSETS[key]).toBe(`catalog-v1/decor/${key}.png`);
      expect(generatedDecorKey(key)).toBe(`decor-${key}`);
    }
  });

  for (const packed of [false, true]) it(`fits every full source isotropically and preserves measured prop contact points (${packed ? 'packed' : 'native'})`, () => {
    const f = fixture(packed), adapter = f.create();
    expect(adapter.ready).toBe(true); expect(adapter.readyIds).toEqual(GENERATED_DECOR_IDS);
    for (const key of GENERATED_DECOR_SOURCE_IDS) {
      const input = f.sources[key] as HTMLCanvasElement;
      const sourceDraw = f.canvases.flatMap(c => c.draws).find(d => d.source === input)!;
      expect(sourceDraw).toBeDefined(); expect(sourceDraw.smoothing).toBe(false);
      expect(sourceDraw.args.slice(0, 4)).toEqual([0, 0, input.width, input.height]);
      const [, , sw, sh, , , dw, dh] = sourceDraw.args;
      expect(dw / sw).toBeCloseTo(dh / sh, 10);
      const meta = GENERATED_DECOR_CATALOG[key];
      if (meta.kind !== 'sprite') continue;
      const [w, h] = meta.logicalEnvelope, sprite = adapter.sprite(meta.id)!;
      expect([sprite.width, sprite.height]).toEqual([w, h]);
      const backing = fineSpriteArt(sprite).canvas, anchor = adapter.anchor(meta.id)!;
      expect([backing.width, backing.height]).toEqual([w * 4, h * 4]);
      const [, , , , x, y] = sourceDraw.args;
      expect(x).toBeGreaterThanOrEqual(-1e-10); expect(y).toBeGreaterThanOrEqual(-1e-10);
      expect(x + dw).toBeLessThanOrEqual(w * 4 + 1e-10); expect(y + dh).toBeLessThanOrEqual(h * 4 + 1e-10);
      const packedScale = Math.max(sw, sh) / Math.max(...meta.size);
      expect(x + meta.anchor.x * packedScale * dw / sw).toBeCloseTo(anchor.x * 4, 10);
      expect(y + meta.anchor.y * packedScale * dh / sh).toBeCloseTo(anchor.y * 4, 10);
      const c = new RecordingCanvas(); expect(adapter.paintSprite(ctx(c), meta.id, 70, 20)).toBe(true);
      expect(c.draws[0].args.slice(4)).toEqual([70 - anchor.x, 20 - anchor.y, w, h]);
      expect(c.stack).toEqual([]); expect(c.context.imageSmoothingEnabled).toBe(true);
    }
  });

  it('tiles native-aspect source pixels with exact edge cropping and stable phase across adjacent rectangles', () => {
    const adapter = fixture(true).create();
    for (const id of GENERATED_DECOR_IDS.filter(id => id.startsWith('wall_') || id.startsWith('floor_'))) {
      const c = new RecordingCanvas(); expect(adapter.paintTile(ctx(c), id, -8, 13, 79, 41)).toBe(true);
      let area = 0;
      for (const { args, smoothing } of c.draws) {
        const [, , sw, sh, x, y, w, h] = args;
        expect(w / sw).toBeCloseTo(h / sh, 10); expect(smoothing).toBe(false);
        expect(x).toBeGreaterThanOrEqual(-8 - 1e-10); expect(y).toBeGreaterThanOrEqual(13 - 1e-10);
        expect(x + w).toBeLessThanOrEqual(71 + 1e-10); expect(y + h).toBeLessThanOrEqual(54 + 1e-10);
        area += w * h;
      }
      expect(area).toBeCloseTo(79 * 41, 8);
      expect(c.context.imageSmoothingEnabled).toBe(true); expect(c.stack).toEqual([]);
    }
    const whole = new RecordingCanvas(), left = new RecordingCanvas(), right = new RecordingCanvas();
    adapter.paintTile(ctx(whole), 'wall_mint', 0, 0, 80, 20);
    adapter.paintTile(ctx(left), 'wall_mint', 0, 0, 30, 20);
    adapter.paintTile(ctx(right), 'wall_mint', 30, 0, 50, 20);
    const origins = (c: RecordingCanvas) => c.draws.map(({ args }) => args[4] - args[0] * args[6] / args[2]);
    for (const origin of [...origins(left), ...origins(right)]) {
      expect(origins(whole).some(candidate => Math.abs(candidate - origin) < 1e-8)).toBe(true);
    }
  });

  it('repeats both counter parts independently without stretching and publishes no half-counter', () => {
    const f = fixture(true), adapter = f.create();
    for (const id of GENERATED_DECOR_IDS.filter(id => id.startsWith('counter_'))) {
      const c = new RecordingCanvas(); expect(adapter.paintCounter(ctx(c), id, 12, 30, 250, 8, 22)).toBe(true);
      expect(c.draws.length).toBeGreaterThan(2);
      for (const { args, smoothing } of c.draws) {
        const [, , sw, sh, x, y, w, h] = args;
        expect(w / sw).toBeCloseTo(h / sh, 10); expect(smoothing).toBe(false);
        expect(x).toBeGreaterThanOrEqual(12); expect(x + w).toBeLessThanOrEqual(262 + 1e-10);
        expect([30, 38]).toContain(y);
      }
      expect(c.stack).toEqual([]); expect(c.context.imageSmoothingEnabled).toBe(true);
    }
    delete (f.sources as Partial<typeof f.sources>)['counter_walnut-front'];
    const partial = f.create();
    expect(partial.readyIds).not.toContain('counter_walnut'); expect(partial.icon('counter_walnut')).toBeUndefined();
    expect(partial.paintCounter(ctx(new RecordingCanvas()), 'counter_walnut', 0, 0, 40, 4, 8)).toBe(false);
    expect(partial.readyIds).toHaveLength(30);
  });

  it('draws each sloped endcap only at its external end and covers every interior span with uniform source slices', () => {
    const adapter = fixture(true).create();
    for (const id of GENERATED_DECOR_IDS.filter(id => id.startsWith('counter_'))) for (const w of [14, 30, 250]) {
      const c = new RecordingCanvas(); expect(adapter.paintCounter(ctx(c), id, 12, 30, w, 8, 22)).toBe(true);
      for (const [y, h, state] of [[30, 8, 'top'], [38, 22, 'front']] as const) {
        const draws = c.draws.filter(d => d.args[5] === y), key = `${id}-${state}` as GeneratedDecorSourceId;
        const authored = GENERATED_COUNTER_BANDS[key]!;
        let right = 12;
        for (const { args } of draws) {
          const [, , sw, sh, x, dy, dw, dh] = args;
          expect(x).toBeCloseTo(right, 10); expect(dy).toBe(y); expect(dh).toBe(h);
          expect(dw / sw).toBeCloseTo(dh / sh, 10); right = x + dw;
        }
        expect(right).toBeCloseTo(12 + w, 10);
        if (state === 'top' && authored.repeatW < authored.w) {
          expect(draws.length).toBeGreaterThanOrEqual(3);
          const left = draws[0].args, right = draws.at(-1)!.args, interior = draws.slice(1, -1);
          expect(left[4]).toBe(12); expect(right[4] + right[6]).toBeCloseTo(12 + w, 10);
          const repeatX = left[0] + left[2], repeatRight = right[0];
          for (const { args } of interior) {
            expect(args[0]).toBe(repeatX); expect(args[0] + args[2]).toBeLessThanOrEqual(repeatRight + 1e-10);
          }
          // Caps never become internal repeated pieces, even on a partial slab.
          expect(draws.filter(d => d.args[0] < repeatX)).toHaveLength(1);
          expect(draws.filter(d => d.args[0] >= repeatRight)).toHaveLength(1);
        }
      }
    }
  });

  it('uses repeat rectangles without transparent pixels in original and actual packed counter PNGs', () => {
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/decor-materials/renderer-manifest.json', 'utf8'));
    for (const entry of [...manifest.assets, ...manifest.aliases].filter(entry => entry.slot === 'counter')) {
      const key = `${entry.id}-${entry.state}` as GeneratedDecorSourceId, crop = GENERATED_COUNTER_BANDS[key]!;
      for (const path of [resolve('assets/generated/bulk-candidates/decor-materials', entry.file),
        resolve('public/art/generated', GENERATED_DECOR_ASSETS[key])]) {
        const image = pngPixels(path), meta = GENERATED_DECOR_CATALOG[key];
        const sx = Math.max(image.w, image.h) / Math.max(...meta.size), sy = sx;
        const left = Math.ceil(crop.repeatX * sx), right = Math.floor((crop.repeatX + crop.repeatW) * sx);
        const top = Math.ceil(crop.y * sy), bottom = Math.floor((crop.y + crop.h) * sy);
        let minAlpha = 255;
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) minAlpha = Math.min(minAlpha, image.pixels[(y * image.w + x) * 4 + 3]);
        expect(minAlpha, `${key} repeat crop in ${path}`).toBeGreaterThan(128);
      }
    }
  });

  it('rejects impossible narrow caps or invalid crop metadata before painting either counter part', () => {
    const f = fixture(true), adapter = f.create(), c = new RecordingCanvas();
    expect(adapter.paintCounter(ctx(c), 'counter_walnut', 0, 0, 1, 8, 22)).toBe(false);
    expect(c.draws).toEqual([]); expect(c.stack).toEqual([]);
    expect(adapter.paintCounter(ctx(c), 'counter_walnut', 0, 0, 40, 8, 22)).toBe(true);
    const invalid = createGeneratedDecorArt(f.sources, { createCanvas: f.createCanvas, catalog: {
      'counter_walnut-top': { ...GENERATED_DECOR_CATALOG['counter_walnut-top'],
        counterBand: { x: 0, y: 0, w: 1522, h: 172, repeatX: -10, repeatW: 1200 } },
    } });
    expect(invalid.readyIds).not.toContain('counter_walnut');
    const output = new RecordingCanvas();
    expect(invalid.paintCounter(ctx(output), 'counter_walnut', 0, 0, 100, 8, 22)).toBe(false);
    expect(output.draws).toEqual([]); expect(invalid.icon('counter_walnut')).toBeUndefined();
  });

  it('fits rugs uniformly and keeps unlit ceiling/neon bodies free of baked replacement overlays', () => {
    const adapter = fixture().create();
    for (const id of ['rug_red', 'rug_blue', 'rug_round']) {
      const c = new RecordingCanvas(); expect(adapter.paintFitted(ctx(c), id, 10, 20, 80, 18)).toBe(true);
      const [, , sw, sh, x, y, w, h] = c.draws[0].args;
      expect(w / sw).toBeCloseTo(h / sh, 10); expect(x * 2 + w).toBeCloseTo(100, 10); expect(y * 2 + h).toBeCloseTo(58, 10);
    }
    // The recording context intentionally supplies no fill, text, glow or path
    // API. Every prop still bakes and paints: only the genuine bitmap is used.
    for (const id of ['ceiling_lights', 'ceiling_pendants', 'ceiling_chandelier', 'neon_cafe', 'neon_heart', 'neon_cup']) {
      const c = new RecordingCanvas(); expect(adapter.paintSprite(ctx(c), id, 20, 30)).toBe(true);
      expect(c.draws).toHaveLength(1);
    }
  });

  it('rejects missing, unloaded, wrong-aspect and failed sources without poisoning subsequent adapter loads', () => {
    const f = fixture();
    expect(f.create({}).ready).toBe(false);
    expect(f.create({ 'wall_cream-tile': source(0, 0), 'rug_red-default': source(100, 100), 'neon_cafe-unlit': source(Infinity, 20) }).ready).toBe(false);
    expect(f.create({ 'wall_cream-tile': { width: 627, height: 1044, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement }).ready).toBe(false);
    expect(f.createCanvas).not.toHaveBeenCalled();
    expect(f.create({ 'sill_cactus-default': f.sources['sill_cactus-default'] }).readyIds).toEqual(['sill_cactus']);
    const allocation = vi.fn(() => { if (allocation.mock.calls.length === 37) throw new Error('failed prop bake'); return f.createCanvas(); });
    const partial = createGeneratedDecorArt(f.sources, { createCanvas: allocation });
    expect(partial.readyIds.length).toBeLessThan(31); expect(partial.readyIds.length).toBeGreaterThan(0);
    expect(createGeneratedDecorArt(f.sources, { createCanvas: () => { throw new Error('no canvas'); } }).ready).toBe(false);
    expect(f.create().readyIds).toHaveLength(31);
  });

  it('caps all caches at 111 canvases and bounds pathological paint loops with ordinary fallback', () => {
    const f = fixture(true), adapter = f.create(), c = new RecordingCanvas();
    expect(f.createCanvas).toHaveBeenCalledTimes(111);
    expect(f.canvases.every(canvas => canvas.width <= 256 && canvas.height <= 256)).toBe(true);
    const icons = GENERATED_DECOR_IDS.map(id => adapter.icon(id));
    for (let n = 0; n < 20; n++) for (const [i, id] of GENERATED_DECOR_IDS.entries()) {
      expect(adapter.icon(id)).toBe(icons[i]); adapter.sprite(id); adapter.anchor(id);
      adapter.paintSprite(ctx(c), id, 10, 20); adapter.paintTile(ctx(c), id, 0, 0, 50, 25);
      adapter.paintCounter(ctx(c), id, 0, 0, 60, 4, 12); adapter.paintFitted(ctx(c), id, 0, 0, 30, 20);
    }
    expect(f.createCanvas).toHaveBeenCalledTimes(111);
    for (const id of ['missing', 'rug_none', 'neon_none', 'sill_none', 'ceiling_none']) {
      expect(adapter.icon(id)).toBeUndefined(); expect(adapter.sprite(id)).toBeUndefined();
      expect(adapter.paintSprite(ctx(c), id, 0, 0)).toBe(false);
      expect(adapter.paintTile(ctx(c), id, 0, 0, 20, 20)).toBe(false);
    }
    expect(adapter.paintTile(ctx(c), 'wall_cream', 0, 0, 1e9, 1e9)).toBe(false);
    expect(adapter.paintTile(ctx(c), 'wall_cream', NaN, 0, 10, 20)).toBe(false);
    expect(adapter.paintTile(ctx(c), 'wall_cream', 0, 0, -10, 20)).toBe(false);
    expect(adapter.paintCounter(ctx(c), 'counter_oak', 0, 0, 1e9, 1, 1)).toBe(false);
    expect(adapter.paintSprite(ctx(c), 'sill_cactus', 0, 0, 0)).toBe(false);
    expect(adapter.paintFitted(ctx(c), 'rug_red', 0, 0, Infinity, 1)).toBe(false);
  });
});
