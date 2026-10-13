import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fineSpriteArt } from './fine-sprite-art';
import {
  createGeneratedTablewareArt, GENERATED_TABLEWARE_ASSETS, GENERATED_TABLEWARE_CATALOG,
  GENERATED_TABLEWARE_DENSITY, GENERATED_TABLEWARE_ENVELOPES, GENERATED_TABLEWARE_IDS,
  generatedTablewareKey, type GeneratedTablewareId, type GeneratedTablewareSources,
} from './generated-tableware-art';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean; operation: string };
class RecordingCanvas {
  width = 0; height = 0;
  draws: Draw[] = [];
  fills: number[][] = [];
  context = {
    imageSmoothingEnabled: true, globalCompositeOperation: 'source-over',
    save: vi.fn(), restore: vi.fn(),
    drawImage: (source: CanvasImageSource, ...args: number[]) => {
      this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled, operation: this.context.globalCompositeOperation });
    },
    fillRect: (...args: number[]) => { this.fills.push(args); },
  };
  getContext() { return this.context; }
}
const recorded = (canvas: HTMLCanvasElement) => canvas as unknown as RecordingCanvas;
const source = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;
function fixture() {
  const sources = Object.fromEntries(GENERATED_TABLEWARE_IDS.map(id => [id, source(...GENERATED_TABLEWARE_CATALOG[id].size)])) as Record<GeneratedTablewareId, CanvasImageSource>;
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => { const c = new RecordingCanvas(); canvases.push(c); return c as unknown as HTMLCanvasElement; });
  const create = (input: GeneratedTablewareSources = sources) => createGeneratedTablewareArt(input, { createCanvas });
  return { sources, createCanvas, canvases, create };
}

interface ManifestAsset {
  domain: string; id: string; file: string; size: [number, number]; sha256: string;
  anchor: { x: number; y: number }; bbox: { x: number; y: number; w: number; h: number };
  supportContact?: { x: number; y: number };
}
const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/ui/manifest.json', 'utf8')) as { assets: ManifestAsset[] };
const shallowManifest = JSON.parse(readFileSync('assets/generated/shallow-tableware-v1/manifest.json', 'utf8')) as {
  assets: (ManifestAsset & { foot: { x: number; y: number } })[];
};
const archivedAssets = [...manifest.assets, ...shallowManifest.assets.map(asset => ({ ...asset, anchor: asset.foot }))];

/** Independently inspect archived 8-bit, noninterlaced RGBA pixels, not canvas mocks. */
function pngPixels(bytes: Buffer) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  expect([bytes[24], bytes[25], bytes[28]]).toEqual([8, 6, 0]);
  const chunks: Buffer[] = [];
  for (let i = 8; i < bytes.length;) {
    const length = bytes.readUInt32BE(i), type = bytes.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(i + 8, i + 8 + length));
    i += length + 12;
  }
  const packed = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  const pixels = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0;
      const c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictors = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)];
      pixels[i] = (packed[y * (stride + 1) + 1 + x] + predictors[filter]) & 255;
    }
  }
  return { width, height, pixels };
}

describe('generated main-scene tableware and effects', () => {
  it('selects five frozen misc IDs and two shallow serviceware IDs at exact manifest coordinates', () => {
    expect(GENERATED_TABLEWARE_IDS).toEqual(['empty-cup-saucer', 'empty-plate', 'heart', 'drop', 'crown', 'shallow-plate', 'shallow-tray']);
    for (const id of GENERATED_TABLEWARE_IDS) {
      const asset = archivedAssets.find(asset => asset.id === id)!;
      expect(asset).toBeDefined();
      const folder = id.startsWith('shallow-') ? 'shallow-tableware-v1' : 'bulk-candidates/ui';
      expect(GENERATED_TABLEWARE_CATALOG[id]).toEqual({ file: `${folder}/${asset.file}`, size: asset.size, anchor: asset.anchor,
        ...(asset.supportContact ? { support: asset.supportContact } : {}) });
      expect(generatedTablewareKey(id)).toBe(`tableware-${id}`);
      expect(GENERATED_TABLEWARE_ASSETS[id]).toBe(`catalog-v1/tableware/${id}.png`);
    }
    expect(Object.isFrozen(GENERATED_TABLEWARE_IDS)).toBe(true);
    expect(Object.isFrozen(GENERATED_TABLEWARE_CATALOG['empty-cup-saucer'].anchor)).toBe(true);
    expect(manifest.assets.some(asset => /logo/.test(asset.id))).toBe(false);
    expect(readFileSync('src/ui/onboarding.ts', 'utf8')).toContain('src="./icon.svg"');
  });

  it('retains named logical envelopes and registers native-aspect whole-PNG 4× backings', () => {
    const { create, sources, canvases } = fixture(), adapter = create();
    expect(GENERATED_TABLEWARE_ENVELOPES).toEqual({
      'empty-cup-saucer': [7, 7], 'empty-plate': [12, 12], heart: [9, 8], drop: [7, 7], crown: [9, 6],
      'shallow-plate': [12, 2], 'shallow-tray': [22, 3],
    });
    expect(adapter.ready).toBe(true); expect(adapter.readyIds).toEqual(GENERATED_TABLEWARE_IDS);
    for (const id of GENERATED_TABLEWARE_IDS) {
      const sprite = adapter.sprite(id)!, [w, h] = GENERATED_TABLEWARE_ENVELOPES[id];
      expect([sprite.width, sprite.height]).toEqual([w, h]);
      const fine = fineSpriteArt(sprite);
      expect(fine).toMatchObject({ density: GENERATED_TABLEWARE_DENSITY, logicalWidth: w, logicalHeight: h });
      expect([fine.canvas.width, fine.canvas.height]).toEqual([w * 4, h * 4]);
      const draws = recorded(fine.canvas).draws;
      expect(draws).toHaveLength(1);
      const draw = draws[0], size = sources[id] as HTMLCanvasElement;
      expect(draw.source).toBe(sources[id]);
      expect(draw.args.slice(0, 4)).toEqual([0, 0, size.width, size.height]);
      const [, , sw, sh, x, y, dw, dh] = draw.args;
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(x).toBeGreaterThanOrEqual(-1e-10); expect(y).toBeGreaterThanOrEqual(-1e-10);
      expect(x + dw).toBeLessThanOrEqual(w * 4 + 1e-10); expect(y + dh).toBeLessThanOrEqual(h * 4 + 1e-10);
      expect(x * 2 + dw).toBeCloseTo(w * 4, 12); expect(y * 2 + dh).toBeCloseTo(h * 4, 12);
      expect(draw.smoothing).toBe(false); expect(draw.operation).toBe('source-over');
      expect(recorded(sprite).draws).toEqual([{ source: fine.canvas, args: [0, 0, w, h], smoothing: false, operation: 'source-over' }]);
    }
    // No background, alpha masking, threshold cropping, recoloring or added contour.
    expect(canvases.every(canvas => canvas.fills.length === 0)).toBe(true);
  });

  it('keeps archived transparent edges and faint alpha inside the complete source rectangle', () => {
    const adapter = fixture().create();
    for (const id of GENERATED_TABLEWARE_IDS) {
      const asset = archivedAssets.find(asset => asset.id === id)!;
      const bytes = readFileSync(`assets/generated/${GENERATED_TABLEWARE_CATALOG[id].file}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      const { width, height, pixels } = pngPixels(bytes);
      expect([width, height]).toEqual(asset.size);
      let transparent = 0, faint = 0, outsideMeasuredBox = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        if (!alpha) transparent++;
        if (alpha > 0 && alpha <= 128) faint++;
        if (alpha && (x < asset.bbox.x || y < asset.bbox.y || x >= asset.bbox.x + asset.bbox.w || y >= asset.bbox.y + asset.bbox.h)) outsideMeasuredBox++;
      }
      expect(transparent).toBeGreaterThan(0); expect(faint).toBeGreaterThan(0);
      expect(outsideMeasuredBox).toBeGreaterThan(0);
      // Alpha>128 bounds really would discard authored data; they are not the draw crop.
      expect(recorded(fineSpriteArt(adapter.sprite(id)!).canvas).draws[0].args.slice(0, 4)).toEqual([0, 0, width, height]);
      if (!id.startsWith('shallow-')) {
        expect([pixels[3], pixels[width * 4 - 1], pixels[(height - 1) * width * 4 + 3], pixels[pixels.length - 1]]).toEqual([0, 0, 0, 0]);
      }
    }
  });

  it('transforms measured contact points with the exact native-aspect fit', () => {
    const adapter = fixture().create();
    for (const id of GENERATED_TABLEWARE_IDS) {
      const metadata = GENERATED_TABLEWARE_CATALOG[id], anchor = adapter.anchor(id)!;
      const [, , sw, , x, y, dw] = recorded(fineSpriteArt(adapter.sprite(id)!).canvas).draws[0].args;
      expect(anchor.x).toBeCloseTo((x + metadata.anchor.x * dw / sw) / 4, 12);
      expect(anchor.y).toBeCloseTo((y + metadata.anchor.y * dw / sw) / 4, 12);
      expect(Object.isFrozen(anchor)).toBe(true);
    }
    expect(adapter.plate()!.height).toBe(12);
    expect(adapter.anchor('empty-plate')!.y).toBeGreaterThan(10);
  });

  it('provides separate interior support contacts without substituting the lower foot edge', () => {
    const adapter = fixture().create();
    for (const id of ['shallow-plate', 'shallow-tray'] as const) {
      const metadata = GENERATED_TABLEWARE_CATALOG[id], support = adapter.support(id)!;
      const [, , sw, , x, y, dw] = recorded(fineSpriteArt(adapter.sprite(id)!).canvas).draws[0].args;
      expect(support.x).toBeCloseTo((x + metadata.support!.x * dw / sw) / 4, 12);
      expect(support.y).toBeCloseTo((y + metadata.support!.y * dw / sw) / 4, 12);
      expect(support.y).toBeLessThan(adapter.anchor(id)!.y);
      expect(support.x).toBeCloseTo(adapter.sprite(id)!.width / 2, 12);
      expect(Object.isFrozen(support)).toBe(true);
      expect(adapter.support(id)).toBe(support);
    }
    for (const id of ['empty-cup-saucer', 'empty-plate', 'heart', 'drop', 'crown']) {
      expect(adapter.support(id)).toBeUndefined();
    }
    expect(adapter.support('shallow-plate')!.y).toBeCloseTo(0.9556650246305418, 12);
    expect(adapter.support('shallow-tray')!.y).toBeCloseTo(1.2475247524752475, 12);
  });

  it('matches real original and ceil-packed PNG transforms, preserving source aspect, alpha and contacts', () => {
    const runtime = JSON.parse(readFileSync('assets/generated/runtime-catalog-v1/catalog.json', 'utf8')) as {
      images: { key: string; file: string; originalSize: [number, number]; size: [number, number]; scale: number; sha256: string }[];
    };
    const { create } = fixture(), original = create();
    const sources: Partial<Record<GeneratedTablewareId, CanvasImageSource>> = {};
    for (const id of GENERATED_TABLEWARE_IDS) {
      const row = runtime.images.find(row => row.key === generatedTablewareKey(id))!;
      expect(row).toBeDefined();
      expect(row.originalSize).toEqual(GENERATED_TABLEWARE_CATALOG[id].size);
      const bytes = readFileSync(row.file), { width, height, pixels } = pngPixels(bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);
      expect([width, height]).toEqual(row.size);
      expect(Math.max(width, height)).toBe(128);
      const alpha = pixels.filter((_, i) => i % 4 === 3);
      expect(alpha.some(a => a === 0)).toBe(true); expect(alpha.some(a => a > 0 && a < 255)).toBe(true);
      expect(alpha.some(a => a > 128)).toBe(true);
      sources[id] = source(width, height);
    }
    const packed = create(sources);
    expect(packed.readyIds).toEqual(GENERATED_TABLEWARE_IDS);
    for (const id of GENERATED_TABLEWARE_IDS) {
      const row = runtime.images.find(row => row.key === generatedTablewareKey(id))!;
      const draw = recorded(fineSpriteArt(packed.sprite(id)!).canvas).draws[0];
      const nativeDraw = recorded(fineSpriteArt(original.sprite(id)!).canvas).draws[0];
      const content = row.originalSize.map(n => n * row.scale);
      expect(draw.source).toBe(sources[id]);
      expect(draw.args.slice(0, 4)).toEqual([0, 0, ...content]);
      for (const [index, dimension] of content.entries()) {
        expect(dimension).toBeLessThanOrEqual(row.size[index] + 1e-10);
        expect(row.size[index] - dimension).toBeLessThan(1);
      }
      // Same authored rectangle in world space. Ceil padding must never change
      // height, squeeze one axis, move a foot or alter the interior food plane.
      draw.args.slice(4).forEach((value, i) => expect(value).toBeCloseTo(nativeDraw.args[i + 4], 12));
      expect(draw.args[6] / draw.args[7]).toBeCloseTo(row.originalSize[0] / row.originalSize[1], 12);
      expect(draw.args[6] / draw.args[2]).toBeCloseTo(draw.args[7] / draw.args[3], 12);
      expect(packed.anchor(id)!.x).toBeCloseTo(original.anchor(id)!.x, 12);
      expect(packed.anchor(id)!.y).toBeCloseTo(original.anchor(id)!.y, 12);
      if (original.support(id)) {
        expect(packed.support(id)!.x).toBeCloseTo(original.support(id)!.x, 12);
        expect(packed.support(id)!.y).toBeCloseTo(original.support(id)!.y, 12);
      }
    }
  });

  it('keeps empty shallow dishes independently cached and never composites a menu item into them', () => {
    const { create, sources, canvases, createCanvas } = fixture();
    const plate = sources['shallow-plate'], tray = sources['shallow-tray'];
    const adapter = create({ 'shallow-plate': plate, 'shallow-tray': tray, espresso: source(400, 400) } as GeneratedTablewareSources);
    expect(adapter.readyIds).toEqual(['shallow-plate', 'shallow-tray']);
    expect(createCanvas).toHaveBeenCalledTimes(4);
    expect(adapter.passPlate()).not.toBe(adapter.tray());
    expect(adapter.plate()).toBeUndefined(); expect(adapter.sprite('espresso')).toBeUndefined();
    expect(recorded(fineSpriteArt(adapter.passPlate()!).canvas).draws.map(draw => draw.source)).toEqual([plate]);
    expect(recorded(fineSpriteArt(adapter.tray()!).canvas).draws.map(draw => draw.source)).toEqual([tray]);
    expect(canvases.every(canvas => canvas.draws.length === 1 && canvas.fills.length === 0)).toBe(true);
    const missing = create({ 'shallow-tray': tray });
    expect(missing.readyIds).toEqual(['shallow-tray']);
    expect(missing.passPlate()).toBeUndefined(); expect(missing.support('shallow-plate')).toBeUndefined();
  });

  it('rejects clipped or extra-padded production rasters without affecting the other shallow dish', () => {
    const { create, sources } = fixture();
    for (const invalid of [source(128, 18), source(128, 20), source(128, 128)]) {
      const adapter = create({ 'shallow-plate': invalid, 'shallow-tray': sources['shallow-tray'] });
      expect(adapter.readyIds).toEqual(['shallow-tray']);
      expect(adapter.passPlate()).toBeUndefined(); expect(adapter.anchor('shallow-plate')).toBeUndefined();
      expect(adapter.support('shallow-plate')).toBeUndefined();
    }
    for (const invalid of [source(128, 17), source(128, 19), source(128, 128)]) {
      const adapter = create({ 'shallow-plate': sources['shallow-plate'], 'shallow-tray': invalid });
      expect(adapter.readyIds).toEqual(['shallow-plate']); expect(adapter.tray()).toBeUndefined();
      expect(adapter.support('shallow-tray')).toBeUndefined();
    }
  });

  it('accepts uniformly packed sources and intrinsic dimensions instead of CSS display size', () => {
    const { create } = fixture();
    const packed = Object.fromEntries(GENERATED_TABLEWARE_IDS.map(id => {
      const [w, h] = GENERATED_TABLEWARE_CATALOG[id].size, scale = 128 / Math.max(w, h);
      return [id, { width: 999, height: 999, naturalWidth: Math.ceil(w * scale), naturalHeight: Math.ceil(h * scale), complete: true }];
    })) as unknown as GeneratedTablewareSources;
    const adapter = create(packed);
    expect(adapter.readyIds).toEqual(GENERATED_TABLEWARE_IDS);
    for (const id of GENERATED_TABLEWARE_IDS) {
      const image = packed[id] as HTMLImageElement;
      const draw = recorded(fineSpriteArt(adapter.sprite(id)!).canvas).draws[0];
      const native = GENERATED_TABLEWARE_CATALOG[id].size, scale = Math.max(image.naturalWidth, image.naturalHeight) / Math.max(...native);
      expect(draw.args.slice(0, 4)).toEqual([0, 0, native[0] * scale, native[1] * scale]);
      expect(draw.args[6] / draw.args[2]).toBeCloseTo(draw.args[7] / draw.args[3], 12);
      expect(draw.args[6] / draw.args[7]).toBeCloseTo(native[0] / native[1], 12);
    }
  });

  it('reports readiness per identity and never replaces a missing candidate with another identity', () => {
    const { sources, create } = fixture();
    delete (sources as Partial<typeof sources>)['empty-cup-saucer'];
    const adapter = create();
    expect(adapter.ready).toBe(true);
    expect(adapter.readyIds).toEqual(GENERATED_TABLEWARE_IDS.filter(id => id !== 'empty-cup-saucer'));
    expect(adapter.cup()).toBeUndefined(); expect(adapter.anchor('empty-cup-saucer')).toBeUndefined();
    expect(adapter.plate()).toBe(adapter.sprite('empty-plate'));
    expect(adapter.effect('heart')).toBe(adapter.sprite('heart'));
    const empty = create({});
    expect(empty.ready).toBe(false); expect(empty.readyIds).toEqual([]);
    expect(Object.isFrozen(adapter)).toBe(true); expect(Object.isFrozen(adapter.readyIds)).toBe(true);
  });

  it('rejects failed, undecoded, incomplete and distorted sources before allocating', () => {
    for (const invalid of [
      { width: 0, height: 367 }, { width: 378, height: -1 }, { width: NaN, height: 367 },
      { width: Infinity, height: 367 }, { width: 378, height: 367, complete: false },
      { width: 378, height: 367, naturalWidth: 0, naturalHeight: 0 },
      { width: 378, height: 367, naturalWidth: 378 }, { width: 378, height: 367, videoHeight: 367 },
      { width: 378, height: 367, displayWidth: 378 }, { width: 378, height: 100 },
    ]) {
      const { create, createCanvas } = fixture();
      const adapter = create({ 'empty-cup-saucer': invalid as CanvasImageSource });
      expect(adapter.ready).toBe(false); expect(adapter.cup()).toBeUndefined();
      expect(createCanvas).not.toHaveBeenCalled();
    }
  });

  it('isolates context or draw failures without publishing half-baked identities', () => {
    for (const failure of ['context', 'draw'] as const) {
      const { sources } = fixture();
      let count = 0;
      const adapter = createGeneratedTablewareArt(sources, { createCanvas: () => {
        const canvas = new RecordingCanvas(); count++;
        if (count === 2 && failure === 'context') return { getContext: () => null } as unknown as HTMLCanvasElement;
        if (count === 2 && failure === 'draw') canvas.context.drawImage = () => { throw new Error('draw failed'); };
        return canvas as unknown as HTMLCanvasElement;
      } });
      expect(adapter.readyIds).toEqual(GENERATED_TABLEWARE_IDS.filter(id => id !== 'empty-cup-saucer'));
      expect(adapter.cup()).toBeUndefined(); expect(adapter.anchor('empty-cup-saucer')).toBeUndefined();
    }
  });

  it('allocates only two canvases per identity and performs no source access after baking', () => {
    const { sources, createCanvas } = fixture();
    let closed = false;
    const input = new Proxy(sources, { get(target, key, receiver) {
      if (closed) throw new Error('source access after bake');
      return Reflect.get(target, key, receiver);
    } });
    const adapter = createGeneratedTablewareArt(input, { createCanvas }); closed = true;
    expect(createCanvas).toHaveBeenCalledTimes(GENERATED_TABLEWARE_IDS.length * 2);
    const outputs = GENERATED_TABLEWARE_IDS.map(id => adapter.sprite(id));
    expect(new Set(outputs).size).toBe(GENERATED_TABLEWARE_IDS.length);
    const target = new RecordingCanvas();
    for (let i = 0; i < 10; i++) for (const [index, id] of GENERATED_TABLEWARE_IDS.entries()) {
      expect(adapter.sprite(id)).toBe(outputs[index]);
      expect(adapter.anchor(id)).toBe(adapter.anchor(id));
      expect(adapter.support(id)).toBe(adapter.support(id));
      expect(adapter.paint(target.context as unknown as CanvasRenderingContext2D, id, 10, 20)).toBe(true);
      expect(target.draws.at(-1)).toMatchObject({ source: fineSpriteArt(outputs[index]!).canvas,
        args: [10, 20, ...GENERATED_TABLEWARE_ENVELOPES[id]], smoothing: false });
    }
    expect(adapter.cup()).toBe(outputs[0]); expect(adapter.plate()).toBe(outputs[1]);
    expect(adapter.effect('heart')).toBe(outputs[2]);
    expect(adapter.passPlate()).toBe(outputs[5]); expect(adapter.tray()).toBe(outputs[6]);
    expect(createCanvas).toHaveBeenCalledTimes(GENERATED_TABLEWARE_IDS.length * 2);
    expect(target.context.save).toHaveBeenCalledTimes(70); expect(target.context.restore).toHaveBeenCalledTimes(70);
  });

  it('ignores unreviewed tray, logo, other UI IDs, namespaced keys and prototype names', () => {
    const { create, createCanvas } = fixture();
    const adapter = create({ 'empty-tray': source(390, 340), logo: source(100, 100), 'tableware-heart': source(310, 304) } as GeneratedTablewareSources);
    const target = new RecordingCanvas();
    for (const id of ['empty-tray', 'logo', 'map-location', 'arrow-right', 'coin-star', 'tableware-heart', '__proto__', 'constructor']) {
      expect(adapter.sprite(id)).toBeUndefined(); expect(adapter.anchor(id)).toBeUndefined();
      expect(adapter.support(id)).toBeUndefined();
      expect(adapter.paint(target.context as unknown as CanvasRenderingContext2D, id, 0, 0)).toBe(false);
    }
    expect(adapter.ready).toBe(false); expect(adapter.readyIds).toEqual([]);
    expect(createCanvas).not.toHaveBeenCalled(); expect(target.draws).toEqual([]);
  });
});
