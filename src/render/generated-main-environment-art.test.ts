import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createGeneratedMainEnvironmentArt, GENERATED_MAIN_ENVIRONMENT_CATALOG,
  GENERATED_MAIN_ENVIRONMENT_DENSITY, GENERATED_MAIN_ENVIRONMENT_IDS, generatedMainEnvironmentKey,
  type GeneratedMainEnvironmentAlignment, type GeneratedMainEnvironmentId, type GeneratedMainEnvironmentSources,
} from './generated-main-environment-art';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean; alpha: number; clipped: boolean };
type State = { imageSmoothingEnabled: boolean; globalAlpha: number; fillStyle: string; clipped: boolean };
class RecordingCanvas {
  width = 0; height = 0;
  draws: Draw[] = [];
  fills: { args: number[]; color: string; clipped: boolean }[] = [];
  rects: number[][] = [];
  stack: State[] = [];
  context = {
    imageSmoothingEnabled: true, globalAlpha: 1, fillStyle: '#123456', clipped: false,
    save: vi.fn(() => { const { imageSmoothingEnabled, globalAlpha, fillStyle, clipped } = this.context;
      this.stack.push({ imageSmoothingEnabled, globalAlpha, fillStyle, clipped }); }),
    restore: vi.fn(() => { Object.assign(this.context, this.stack.pop()!); }),
    beginPath: vi.fn(),
    rect: vi.fn((...args: number[]) => { this.rects.push(args); }),
    clip: vi.fn(() => { this.context.clipped = true; }),
    drawImage: vi.fn((source: CanvasImageSource, ...args: number[]) => {
      this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled,
        alpha: this.context.globalAlpha, clipped: this.context.clipped });
    }),
    fillRect: vi.fn((...args: number[]) => { this.fills.push({ args, color: this.context.fillStyle, clipped: this.context.clipped }); }),
    getImageData: vi.fn(() => { throw new Error('Pixel reads are forbidden'); }),
    putImageData: vi.fn(() => { throw new Error('Pixel writes are forbidden'); }),
  };
  getContext() { return this.context; }
}
const source = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;
const ctx = (c: RecordingCanvas) => c.context as unknown as CanvasRenderingContext2D;
const recording = (c: HTMLCanvasElement) => c as unknown as RecordingCanvas;

function fixture(packed = false) {
  const sources = Object.fromEntries(GENERATED_MAIN_ENVIRONMENT_IDS.map(id => {
    const [w, h] = GENERATED_MAIN_ENVIRONMENT_CATALOG[id].size;
    const scale = packed ? Math.min(1, 256 / Math.max(w, h)) : 1;
    return [id, source(Math.ceil(w * scale), Math.ceil(h * scale))];
  })) as Record<GeneratedMainEnvironmentId, HTMLCanvasElement>;
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => { const c = new RecordingCanvas(); canvases.push(c); return c as unknown as HTMLCanvasElement; });
  const create = (input: GeneratedMainEnvironmentSources = sources) => createGeneratedMainEnvironmentArt(input, { createCanvas });
  return { sources, canvases, createCanvas, create };
}

function unchanged(c: RecordingCanvas, alpha = 1) {
  expect(c.context).toMatchObject({ imageSmoothingEnabled: true, globalAlpha: alpha, fillStyle: '#123456', clipped: false });
  expect(c.context.save).toHaveBeenCalledTimes(c.context.restore.mock.calls.length);
  expect(c.stack).toEqual([]);
}

function uniform(d: Draw) {
  expect(d.args).toHaveLength(8);
  const [sx, sy, sw, sh, , , dw, dh] = d.args;
  expect([sx, sy]).toEqual([0, 0]);
  expect(dw / sw).toBeCloseTo(dh / sh, 12);
  expect(d.smoothing).toBe(false);
}

describe('generated main environment bitmap adapter', () => {
  it('selects only the six requested modules and preserves their immutable manifest and PNG hashes', () => {
    expect(GENERATED_MAIN_ENVIRONMENT_IDS).toEqual(['main-horizontal-beam', 'main-corner-post',
      'foreground-threshold', 'outdoor-tree-line', 'village-roof-cluster', 'cloud']);
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/environments/manifest.json', 'utf8'));
    for (const id of GENERATED_MAIN_ENVIRONMENT_IDS) {
      const entry = manifest.assets.find((asset: { id: string }) => asset.id === id);
      const meta = GENERATED_MAIN_ENVIRONMENT_CATALOG[id];
      const bytes = readFileSync(`assets/generated/bulk-candidates/environments/${entry.file}`);
      expect(meta.size).toEqual(entry.size); expect(meta.bbox).toEqual(entry.bbox);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(meta.size);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      expect(generatedMainEnvironmentKey(id)).toBe(`environment-${id}`);
    }
  });

  for (const packed of [false, true]) it(`bakes whole ${packed ? 'packed' : 'original'} sources uniformly with full alpha and bounded 4× caches`, () => {
    const f = fixture(packed), adapter = f.create();
    expect(adapter.ready).toBe(true); expect(adapter.readyIds).toEqual(GENERATED_MAIN_ENVIRONMENT_IDS);
    expect(f.createCanvas).toHaveBeenCalledTimes(6);
    for (const id of GENERATED_MAIN_ENVIRONMENT_IDS) {
      const canvas = adapter.artwork(id)!, meta = GENERATED_MAIN_ENVIRONMENT_CATALOG[id];
      const cached = recording(canvas), input = f.sources[id], d = cached.draws[0];
      expect(canvas).not.toBe(input); expect(cached.draws).toHaveLength(1);
      expect(d.source).toBe(input); expect(d.args.slice(0, 4)).toEqual([0, 0, input.width, input.height]);
      uniform(d); expect(d.alpha).toBe(1); expect(d.clipped).toBe(false);
      expect(d.args.slice(4, 6)).toEqual([0, 0]);
      expect(canvas.width).toBeLessThanOrEqual(meta.cacheEnvelope[0] * GENERATED_MAIN_ENVIRONMENT_DENSITY);
      expect(canvas.height).toBeLessThanOrEqual(meta.cacheEnvelope[1] * GENERATED_MAIN_ENVIRONMENT_DENSITY);
      expect(canvas.width - d.args[6]).toBeGreaterThanOrEqual(-1e-10);
      expect(canvas.width - d.args[6]).toBeLessThan(1);
      expect(canvas.height - d.args[7]).toBeGreaterThanOrEqual(-1e-10);
      expect(canvas.height - d.args[7]).toBeLessThan(1);
      expect(cached.fills).toEqual([]); expect(cached.context.clip).not.toHaveBeenCalled();
      expect(cached.context.getImageData).not.toHaveBeenCalled(); expect(cached.context.putImageData).not.toHaveBeenCalled();
    }
  });

  for (const packed of [false, true]) it(`repeats native beam modules with only a destination clip (${packed ? 'packed' : 'original'})`, () => {
    const f = fixture(packed), adapter = f.create(), c = new RecordingCanvas();
    c.context.globalAlpha = .63;
    const [x, y, w, h] = [2.25, -1.5, 174, 7.5], meta = GENERATED_MAIN_ENVIRONMENT_CATALOG['main-horizontal-beam'];
    expect(adapter.paintBeam(ctx(c), x, y, w, h)).toBe(true);
    expect(c.rects).toEqual([[x, y, w, h]]); expect(c.context.clip).toHaveBeenCalledTimes(1);
    const step = meta.bbox.w / meta.bbox.h * h;
    expect(c.draws).toHaveLength(Math.ceil(w / step));
    c.draws.forEach((d, index) => {
      uniform(d); expect(d.source).toBe(adapter.artwork('main-horizontal-beam'));
      expect(d.args[4]).toBeCloseTo(x + index * step - meta.bbox.x / meta.bbox.h * h, 10);
      expect(d.args[5]).toBeCloseTo(y - meta.bbox.y / meta.bbox.h * h, 10);
      expect(d.args.slice(0, 4)).toEqual(c.draws[0].args.slice(0, 4));
      expect(d.args.slice(6)).toEqual(c.draws[0].args.slice(6));
      expect(d.clipped).toBe(true); expect(d.alpha).toBe(.63);
    });
    const last = c.draws.at(-1)!.args;
    expect(last[4] + last[6]).toBeGreaterThan(x + w);
    unchanged(c, .63);
    for (const [width, count] of [[step * 2, 2], [3, 1]]) {
      const exact = new RecordingCanvas(); adapter.paintBeam(ctx(exact), 0, 0, width, h);
      expect(exact.draws).toHaveLength(count);
      expect(exact.draws[0].args.slice(6)).toEqual(c.draws[0].args.slice(6));
    }
  });

  it('contains posts without stretching the 108:503 body into the old narrow column, with explicit horizontal alignment', () => {
    const f = fixture(), adapter = f.create();
    for (const [w, h] of [[14, 65], [17, 79], [30, 40]]) for (const align of ['left', 'center', 'right'] as const) {
      const c = new RecordingCanvas(), x = -3.5, y = 2.25;
      expect(adapter.paintPost(ctx(c), x, y, w, h, align)).toBe(true);
      expect(c.draws).toHaveLength(1); uniform(c.draws[0]);
      const [, , , , dx, dy, dw, dh] = c.draws[0].args;
      expect(dw / dh).toBeCloseTo(147 / 540, 12);
      expect(dx).toBeCloseTo(x + (w - dw) * ({ left: 0, center: .5, right: 1 }[align]), 12);
      expect(dy + dh).toBeCloseTo(y + h, 12);
      expect(dx).toBeGreaterThanOrEqual(x - 1e-10); expect(dy).toBeGreaterThanOrEqual(y - 1e-10);
      expect(dx + dw).toBeLessThanOrEqual(x + w + 1e-10); expect(dh).toBeLessThanOrEqual(h + 1e-10);
      expect(c.context.clip).not.toHaveBeenCalled(); unchanged(c);
    }
    const defaultAlign = new RecordingCanvas(), center = new RecordingCanvas();
    adapter.paintPost(ctx(defaultAlign), 0, 0, 30, 40);
    adapter.paintPost(ctx(center), 0, 0, 30, 40, 'center');
    expect(defaultAlign.draws).toEqual(center.draws);
  });

  it('contains the complete threshold centered on the door and bottom aligned', () => {
    const f = fixture(), adapter = f.create(), c = new RecordingCanvas();
    expect(adapter.paintThreshold(ctx(c), 102, 145, 24, 4)).toBe(true);
    expect(c.draws).toHaveLength(1); uniform(c.draws[0]);
    const [, , , , x, y, w, h] = c.draws[0].args;
    expect(w / h).toBeCloseTo(619 / 122, 12);
    expect(x + w / 2).toBeCloseTo(114, 12); expect(y + h).toBeCloseTo(149, 12);
    expect(w).toBeLessThanOrEqual(24); expect(h).toBeLessThanOrEqual(4);
    expect(c.context.clip).not.toHaveBeenCalled(); unchanged(c);
  });

  it('layers distinct whole cloud/tree/roof bitmaps inside the original glass clip without repainting their pixels', () => {
    const f = fixture(true), adapter = f.create(), c = new RecordingCanvas();
    c.context.globalAlpha = .63;
    expect(adapter.paintWindowScenery(ctx(c), 7.5, 12.25, 46, 38, .2, 17)).toBe(true);
    expect(c.rects).toEqual([[7.5, 12.25, 46, 38]]);
    expect(c.draws.map(d => d.source)).toEqual(['cloud', 'outdoor-tree-line', 'village-roof-cluster'].map(id => adapter.artwork(id)));
    for (const [index, d] of c.draws.entries()) {
      uniform(d); expect(d.clipped).toBe(true); expect(d.alpha).toBe(.63);
      // The only omitted pixels are the cache's added transparent ceil padding.
      const baked = recording(d.source as HTMLCanvasElement).draws[0];
      expect(d.args.slice(0, 4)).toEqual([0, 0, baked.args[6], baked.args[7]]);
      const id = (['cloud', 'outdoor-tree-line', 'village-roof-cluster'] as const)[index];
      const meta = GENERATED_MAIN_ENVIRONMENT_CATALOG[id], input = f.sources[id];
      const packedScale = Math.max(input.width, input.height) / Math.max(...meta.size);
      const scale = packedScale * baked.args[6] / input.width * d.args[6] / d.args[2];
      const planned = [
        [7.5 + 46 * (.08 + Math.sin(17 * .05) * .12), 12.25 + 38 * .32, 46 * .67, 38 * .28],
        [7.5 - 46 * .12, 12.25 + 38 * 1.06, 46 * .76, 38 * .72],
        [7.5 + 46 * .30, 12.25 + 38 * 1.02, 46 * .72, 38 * .62],
      ][index];
      expect(d.args[4] + meta.bbox.x * scale).toBeCloseTo(planned[0], 10);
      expect(d.args[5] + (meta.bbox.y + meta.bbox.h) * scale).toBeCloseTo(planned[1], 10);
      expect(meta.bbox.w * scale).toBeLessThanOrEqual(planned[2] + 1e-10);
      expect(meta.bbox.h * scale).toBeLessThanOrEqual(planned[3] + 1e-10);
    }
    expect(c.fills).toHaveLength(2); expect(c.fills.every(fill => fill.clipped)).toBe(true);
    expect(c.fills[0].args).toEqual([7.5, 12.25, 46, 38]);
    expect(c.context.getImageData).not.toHaveBeenCalled(); expect(c.context.putImageData).not.toHaveBeenCalled();
    unchanged(c, .63);
  });

  it('preserves the caller sky/astronomy when requested, animates only clouds, and hides clouds at night', () => {
    const adapter = fixture().create(), day = new RecordingCanvas(), later = new RecordingCanvas(), night = new RecordingCanvas();
    adapter.paintWindowScenery(ctx(day), 0, 0, 46, 38, 0, 0, false);
    adapter.paintWindowScenery(ctx(later), 0, 0, 46, 38, 0, 20, false);
    adapter.paintWindowScenery(ctx(night), 0, 0, 46, 38, 1, 20, false);
    expect(day.fills).toEqual([]); expect(later.fills).toEqual([]); expect(night.fills).toEqual([]);
    expect(day.draws[0].args[4]).not.toBe(later.draws[0].args[4]);
    expect(day.draws.slice(1)).toEqual(later.draws.slice(1));
    expect(night.draws).toEqual(day.draws.slice(1));
    unchanged(day); unchanged(later); unchanged(night);
    const daySky = new RecordingCanvas(), nightSky = new RecordingCanvas();
    adapter.paintWindowScenery(ctx(daySky), 0, 0, 46, 38, NaN, NaN);
    adapter.paintWindowScenery(ctx(nightSky), 0, 0, 46, 38, 100, Infinity);
    expect(daySky.fills[0].color).toBe('#cce5e5'); expect(nightSky.fills[0].color).toBe('#15283d');
    expect(daySky.draws).toEqual(day.draws);
  });

  it('keeps each missing or failed identity local and leaves the context untouched when a paint cannot be handled', () => {
    const f = fixture();
    for (const missing of GENERATED_MAIN_ENVIRONMENT_IDS) {
      const input: Partial<typeof f.sources> = { ...f.sources }; delete input[missing];
      const adapter = f.create(input), c = new RecordingCanvas();
      expect(adapter.readyIds).toEqual(GENERATED_MAIN_ENVIRONMENT_IDS.filter(id => id !== missing));
      expect(adapter.artwork(missing)).toBeUndefined();
      if (missing === 'main-horizontal-beam') expect(adapter.paintBeam(ctx(c), 0, 0, 100, 8)).toBe(false);
      else if (missing === 'main-corner-post') expect(adapter.paintPost(ctx(c), 0, 0, 14, 65)).toBe(false);
      else if (missing === 'foreground-threshold') expect(adapter.paintThreshold(ctx(c), 0, 0, 24, 4)).toBe(false);
      else {
        expect(adapter.paintWindowScenery(ctx(c), 0, 0, 46, 38, 0, 0)).toBe(true);
        expect(c.draws).toHaveLength(2);
      }
      unchanged(c);
    }
    for (const id of ['outdoor-tree-line', 'village-roof-cluster', 'cloud'] as const) {
      const adapter = f.create({ [id]: f.sources[id] }), c = new RecordingCanvas();
      expect(adapter.paintWindowScenery(ctx(c), 0, 0, 46, 38, 0, 0)).toBe(true);
      expect(c.draws).toHaveLength(1); expect(c.draws[0].source).toBe(adapter.artwork(id));
    }
    const empty = f.create({}), c = new RecordingCanvas();
    expect(empty.ready).toBe(false); expect(empty.readyIds).toEqual([]);
    expect(empty.paintBeam(ctx(c), 0, 0, 100, 8)).toBe(false);
    expect(empty.paintPost(ctx(c), 0, 0, 14, 65)).toBe(false);
    expect(empty.paintThreshold(ctx(c), 0, 0, 24, 4)).toBe(false);
    expect(empty.paintWindowScenery(ctx(c), 0, 0, 46, 38, 0, 0)).toBe(false);
    expect(c.context.save).not.toHaveBeenCalled(); expect(c.draws).toEqual([]); expect(c.fills).toEqual([]);
    // Isolate an actual draw failure for one source, not just a missing texture.
    const partiallyFailed = createGeneratedMainEnvironmentArt(f.sources, { createCanvas: () => {
      const canvas = f.createCanvas();
      recording(canvas).context.drawImage = vi.fn((input: CanvasImageSource) => {
        if (input === f.sources['main-corner-post']) throw new Error('decode failed');
      });
      return canvas;
    } });
    expect(partiallyFailed.readyIds).toEqual(GENERATED_MAIN_ENVIRONMENT_IDS.filter(id => id !== 'main-corner-post'));
    expect(createGeneratedMainEnvironmentArt(f.sources, { createCanvas: () => { throw new Error('no canvas'); } }).ready).toBe(false);
    expect(createGeneratedMainEnvironmentArt(f.sources, { createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement }).ready).toBe(false);
  });

  it('rejects unloaded, zero, nonfinite and wrong-aspect textures before allocating; uses intrinsic size instead of CSS size', () => {
    const f = fixture();
    const invalid = [source(0, 0), source(NaN, 540), source(147, Infinity), source(540, 147),
      { width: 147, height: 540, complete: false }, { width: 147, height: 540, naturalWidth: 0, naturalHeight: 0 },
      { width: 147, height: 540, naturalWidth: 147 }];
    for (const input of invalid) expect(f.create({ 'main-corner-post': input as unknown as HTMLImageElement }).ready).toBe(false);
    expect(f.createCanvas).not.toHaveBeenCalled();
    const intrinsic = { width: 10, height: 10, naturalWidth: 147, naturalHeight: 540 } as HTMLImageElement;
    expect(f.create({ 'main-corner-post': intrinsic }).readyIds).toEqual(['main-corner-post']);
    expect(f.canvases[0].draws[0].args.slice(0, 4)).toEqual([0, 0, 147, 540]);
  });

  it('rejects invalid destinations without modifying context and bounds pathological repetition', () => {
    const adapter = fixture().create(), c = new RecordingCanvas();
    for (const [x, y, w, h] of [[NaN, 0, 1, 1], [0, Infinity, 1, 1], [0, 0, 0, 1], [0, 0, 1, -1], [0, 0, 1, Infinity]]) {
      expect(adapter.paintBeam(ctx(c), x, y, w, h)).toBe(false);
      expect(adapter.paintPost(ctx(c), x, y, w, h)).toBe(false);
      expect(adapter.paintThreshold(ctx(c), x, y, w, h)).toBe(false);
      expect(adapter.paintWindowScenery(ctx(c), x, y, w, h, 0, 0)).toBe(false);
    }
    expect(adapter.paintBeam(ctx(c), 0, 0, 1e20, 1)).toBe(false);
    expect(c.context.save).not.toHaveBeenCalled(); expect(c.draws).toEqual([]); expect(c.fills).toEqual([]);
  });

  it('restores clipping and context state even when a target canvas rejects a draw', () => {
    const adapter = fixture().create();
    for (const paint of [
      (c: RecordingCanvas) => adapter.paintBeam(ctx(c), 0, 0, 100, 8),
      (c: RecordingCanvas) => adapter.paintPost(ctx(c), 0, 0, 14, 65),
      (c: RecordingCanvas) => adapter.paintThreshold(ctx(c), 0, 0, 24, 4),
      (c: RecordingCanvas) => adapter.paintWindowScenery(ctx(c), 0, 0, 46, 38, 0, 0),
    ]) {
      const c = new RecordingCanvas(); c.context.globalAlpha = .4;
      c.context.drawImage.mockImplementation(() => { throw new Error('target failed'); });
      expect(() => paint(c)).toThrow('target failed'); unchanged(c, .4);
    }
  });

  it('uses six fixed caches across repeated paints and stays usable after decoded source references are released', () => {
    const f = fixture(true), adapter = f.create(), c = new RecordingCanvas();
    const identities = GENERATED_MAIN_ENVIRONMENT_IDS.map(id => adapter.artwork(id));
    for (const id of GENERATED_MAIN_ENVIRONMENT_IDS) delete (f.sources as Partial<typeof f.sources>)[id];
    for (let i = 0; i < 20; i++) {
      expect(adapter.paintBeam(ctx(c), 0, 0, 230, 8)).toBe(true);
      expect(adapter.paintPost(ctx(c), 0, 0, 17, 79, (['left', 'right'] as GeneratedMainEnvironmentAlignment[])[i % 2])).toBe(true);
      expect(adapter.paintThreshold(ctx(c), 0, 0, 24, 4)).toBe(true);
      expect(adapter.paintWindowScenery(ctx(c), 0, 0, 46, 38, i % 2, i)).toBe(true);
      expect(GENERATED_MAIN_ENVIRONMENT_IDS.map(id => adapter.artwork(id))).toEqual(identities);
    }
    expect(f.createCanvas).toHaveBeenCalledTimes(6); expect(adapter.artwork('unknown')).toBeUndefined();
    expect(adapter.artwork('toString')).toBeUndefined(); unchanged(c);
  });
});
