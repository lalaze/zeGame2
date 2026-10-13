import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { Look } from '../game/state';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedServerArt, generatedServerEligible, GENERATED_SERVER_DENSITY, GENERATED_SERVER_FOOT,
  GENERATED_SERVER_FRAME_IDS, type GeneratedServerFrameId, type GeneratedServerFrameMeta, type GeneratedServerIdentity,
  type GeneratedServerManifest, type GeneratedServerSources } from './generated-server-art';
import type { CharacterFrames } from './sprites';

const look: Look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
const server: GeneratedServerIdentity = { role: 'server', look };
const originalManifest = JSON.parse(readFileSync(new URL('../../assets/generated/server-canonical-v1/renderer-manifest.json', import.meta.url), 'utf8')) as GeneratedServerManifest;
const runtime = JSON.parse(readFileSync(new URL('../../assets/generated/runtime-catalog-v1/runtime.json', import.meta.url), 'utf8')) as {
  assets: Record<GeneratedServerFrameId, string>; serverManifest: GeneratedServerManifest;
};
type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean };
class RecordingCanvas {
  width = 0;
  height = 0;
  draws: Draw[] = [];
  context = {
    imageSmoothingEnabled: true,
    translate: vi.fn(), scale: vi.fn(),
    drawImage: (source: CanvasImageSource, ...args: number[]) => {
      this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled });
    },
  };
  getContext() { return this.context; }
}
const recorded = (canvas: HTMLCanvasElement) => canvas as unknown as RecordingCanvas;
const fake = (width = 18, height = 28) => ({ width, height }) as HTMLCanvasElement;
function fallback(): CharacterFrames {
  const down = [fake(), fake(), fake()];
  return { down, up: [fake(), fake(), fake()], left: [fake(), fake(), fake()], right: [fake(), fake(), fake()],
    stand: down[0], sitLeft: fake(18, 26), sitRight: fake(18, 26),
    sitPetLeft: [fake(18, 34), fake(18, 34)], sitPetRight: [fake(18, 34), fake(18, 34)] };
}
function fixture(manifest: GeneratedServerManifest = originalManifest) {
  const sources: Partial<Record<GeneratedServerFrameId, CanvasImageSource>> = {};
  for (const meta of manifest.frames) sources[`server-${meta.direction}-${meta.state}`] = fake(meta.size[0], meta.size[1]);
  const createCanvas = vi.fn(() => new RecordingCanvas() as unknown as HTMLCanvasElement);
  const create = (input: GeneratedServerSources = sources, metadata = manifest) => createGeneratedServerArt(metadata, input, { createCanvas });
  return { sources, manifest, createCanvas, create };
}
const replaceFirst = (manifest: GeneratedServerManifest, first: GeneratedServerFrameMeta): GeneratedServerManifest =>
  ({ ...manifest, frames: [first, ...manifest.frames.slice(1)] });

describe('generated exact all-zero server adapter', () => {
  it('keeps one isotropic family scale, 18×28 logical dimensions and the common (9,27) foot', () => {
    const { create, manifest, sources } = fixture();
    const adapter = create();
    expect(adapter.ready).toBe(true);
    expect(adapter.sourceFrameIds).toEqual(GENERATED_SERVER_FRAME_IDS);
    expect(adapter.sourceScale).toBeCloseTo(26 / 399, 12);
    const { frames, generated } = adapter.resolve(server, fallback());
    expect(generated).toBe(true);
    expect(frames.stand).toBe(frames.down[0]);
    for (const facing of ['down', 'up', 'right', 'left'] as const) for (const frame of frames[facing]) {
      expect([frame.width, frame.height]).toEqual([18, 28]);
      const art = fineSpriteArt(frame);
      expect(art.density).toBe(GENERATED_SERVER_DENSITY);
      expect([art.canvas.width, art.canvas.height]).toEqual([72, 112]);
      expect(recorded(frame).draws[0].source).toBe(art.canvas);
    }
    for (let i = 0; i < manifest.frames.length; i++) {
      const meta = manifest.frames[i], id = GENERATED_SERVER_FRAME_IDS[i];
      const draw = recorded(fineSpriteArt(frames[meta.direction][i % 3]).canvas).draws[0];
      const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.args;
      expect(draw.source).toBe(sources[id]);
      expect(draw.smoothing).toBe(false);
      // All RGBA pixels, including faint fringe outside the alpha>128 bbox.
      expect([sx, sy, sw, sh]).toEqual([0, 0, ...meta.size]);
      expect(sw).toBeGreaterThan(meta.bbox.w);
      expect(sh).toBeGreaterThan(meta.bbox.h);
      expect(dw / sw).toBeCloseTo(adapter.sourceScale! * 4, 12);
      expect(dh / sh).toBeCloseTo(adapter.sourceScale! * 4, 12);
      expect(dx + meta.foot.x * dw / sw).toBeCloseTo(GENERATED_SERVER_FOOT.x * 4, 12);
      expect(dy + meta.foot.y * dh / sh).toBeCloseTo(GENERATED_SERVER_FOOT.y * 4, 12);
      expect(dx).toBeGreaterThanOrEqual(-1e-9);
      expect(dy).toBeGreaterThanOrEqual(-1e-9);
      expect(dx + dw).toBeLessThanOrEqual(72 + 1e-9);
      expect(dy + dh).toBeLessThanOrEqual(112 + 1e-9);
    }
  });

  it('uses nine distinct sources and mirrors right poses to make the only left set', () => {
    const { create, sources } = fixture();
    const { frames } = create().resolve(server, fallback());
    for (const facing of ['down', 'up', 'right'] as const) {
      expect(new Set(frames[facing]).size).toBe(3);
      expect(frames[facing].map(frame => recorded(fineSpriteArt(frame).canvas).draws[0].source))
        .toEqual(['stand', 'stepA', 'stepB'].map(state => sources[`server-${facing}-${state}` as GeneratedServerFrameId]));
    }
    frames.left.forEach((frame, index) => {
      const art = recorded(fineSpriteArt(frame).canvas);
      expect(art.context.translate).toHaveBeenCalledWith(72, 0);
      expect(art.context.scale).toHaveBeenCalledWith(-1, 1);
      expect(art.draws[0].source).toBe(fineSpriteArt(frames.right[index]).canvas);
      expect(art.draws[0].smoothing).toBe(false);
    });
  });

  it('requires role server and exact equality on every Look axis', () => {
    const adapter = fixture().create(), old = fallback();
    expect(generatedServerEligible(server)).toBe(true);
    expect(adapter.resolve(server, old).generated).toBe(true);
    for (const role of ['owner', 'barista', 'customer', 'cook'] as const) {
      expect(generatedServerEligible({ role, look })).toBe(false);
      expect(adapter.resolve({ role, look }, old)).toEqual({ frames: old, generated: false });
      expect(adapter.resolve({ role, look }, old).frames).toBe(old);
    }
    for (const key of ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const) {
      for (const value of [1, -1, NaN, Infinity, undefined, '0']) {
        const identity = { role: 'server', look: { ...look, [key]: value } } as GeneratedServerIdentity;
        expect(generatedServerEligible(identity)).toBe(false);
        expect(adapter.resolve(identity, old).frames).toBe(old);
      }
    }
  });

  it('independently rejects foreign manifest identity, role and each nonzero manifest Look axis', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    for (const identity of ['barista-default', 'canonical-server', 'customer-cast-0-Mina']) {
      expect(create(sources, { ...manifest, identity }).ready).toBe(false);
    }
    for (const role of ['owner', 'barista', 'cook', 'customer']) expect(create(sources, { ...manifest, role }).ready).toBe(false);
    for (const key of ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const) {
      expect(create(sources, { ...manifest, look: { ...look, [key]: 1 } }).ready).toBe(false);
    }
    expect(create(sources, { ...manifest, exactLookOnly: false }).ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it.each(GENERATED_SERVER_FRAME_IDS)('retains the exact legacy set atomically when %s is missing', missing => {
    const { create, sources, createCanvas } = fixture();
    delete sources[missing];
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(false);
    expect(adapter.sourceScale).toBeNull();
    expect(adapter.sourceFrameIds).toEqual([]);
    expect(adapter.resolve(server, old)).toEqual({ frames: old, generated: false });
    expect(adapter.resolve(server, old).frames).toBe(old);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('keeps every legacy seated/petting field and leaves fallback walking arrays unchanged', () => {
    const old = fallback(), originalDown = [...old.down];
    const { frames } = fixture().create().resolve(server, old);
    for (const key of ['sitLeft', 'sitRight', 'sitPetLeft', 'sitPetRight'] as const) expect(frames[key]).toBe(old[key]);
    expect(old.down).toEqual(originalDown);
    expect(frames.down).not.toBe(old.down);
    expect(frames).not.toHaveProperty('tray');
    expect(frames).not.toHaveProperty('acknowledgement');
    expect(frames).not.toHaveProperty('plates');
  });

  it('bounds fallback assembly caching at two entries and never rebakes during resolve', () => {
    const { create, createCanvas } = fixture();
    const adapter = create(), first = fallback(), second = fallback();
    const a = adapter.resolve(server, first), b = adapter.resolve(server, second);
    expect(adapter.resolve(server, first)).toBe(a); // first becomes most recently used
    adapter.resolve(server, fallback());
    expect(adapter.resolve(server, first)).toBe(a);
    expect(adapter.resolve(server, second)).not.toBe(b);
    for (let i = 0; i < 30; i++) expect(adapter.resolve(server, fallback()).frames.down).toBe(a.frames.down);
    expect(adapter.resolve(server, first)).not.toBe(a);
    expect(createCanvas).toHaveBeenCalledTimes(24);
    expect(Object.isFrozen(a.frames)).toBe(true);
    expect(Object.isFrozen(a.frames.down)).toBe(true);
    expect(Object.isFrozen(adapter.sourceFrameIds)).toBe(true);
  });

  it('rejects duplicate/unknown poses, invalid geometry, mismatched decoded size and unloaded images', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const first = manifest.frames[0];
    const invalid = [manifest.frames[1], { ...first, direction: 'left' }, { ...first, state: 'sit' },
      { ...first, bbox: { ...first.bbox, x: -1 } }, { ...first, bbox: { ...first.bbox, w: 1000 } },
      { ...first, bbox: { ...first.bbox, h: 0 } }, { ...first, foot: { ...first.foot, x: 1000 } },
      { ...first, foot: { ...first.foot, y: first.bbox.y } }, { ...first, foot: { ...first.foot, y: NaN } },
      { ...first, size: [first.size[0] + 1, first.size[1]] }, { ...first, sourceToWorldScale: 0 },
      { ...first, sourceToWorldScale: first.sourceToWorldScale * 2 }];
    for (const meta of invalid) expect(create(sources, replaceFirst(manifest, meta as GeneratedServerFrameMeta)).ready).toBe(false);
    expect(create(sources, { ...manifest, frames: manifest.frames.slice(1) }).ready).toBe(false);
    sources['server-down-stand'] = { width: first.size[0], height: first.size[1], naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(create().ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('accepts one safe explicit scale, rejecting body or full-alpha fringe clipping', () => {
    const { manifest, sources, createCanvas } = fixture();
    const safe = createGeneratedServerArt(manifest, sources, { sourceScale: 0.06, createCanvas });
    expect(safe.ready).toBe(true);
    expect(safe.sourceScale).toBe(0.06);
    for (const sourceScale of [0, -1, NaN, Infinity, 0.07, manifest.frames[0].sourceToWorldScale]) {
      expect(createGeneratedServerArt(manifest, sources, { sourceScale, createCanvas }).ready).toBe(false);
    }
    // Bbox still fits, but extra full-source top fringe would extend past y=0.
    const roomy = { ...manifest, frames: manifest.frames.map(meta => ({ ...meta,
      bbox: { ...meta.bbox, y: 35, h: meta.bbox.h - 25 } })) };
    expect(createGeneratedServerArt(roomy, sources, { sourceScale: 0.067, createCanvas }).ready).toBe(false);
  });

  it('allows less-than-one-pixel ceil padding, rejecting body cropping and malformed extents', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const first = manifest.frames[0], [w, h] = first.size;
    const invalid: unknown[] = [null, [], new Array(2), [w], [w, h, 1], [0, h], [-1, h], [w, 0], [NaN, h],
      [w, Infinity], [w + 0.001, h], [w, h + 0.001], [w - 1, h], [w, h - 1], ['183', h]];
    for (const productionContentSize of invalid) {
      const changed = { ...first, productionContentSize } as GeneratedServerFrameMeta;
      const adapter = create(sources, replaceFirst(manifest, changed));
      expect(adapter.ready).toBe(false);
      expect(adapter.sourceFrameIds).toEqual([]);
    }
    const clipped = { ...first, productionContentSize: [w - 0.25, h - 0.25], bbox: { x: 0, y: 0, w, h } };
    expect(create(sources, replaceFirst(manifest, clipped)).ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
    expect(create(sources, replaceFirst(manifest, { ...first, productionContentSize: [w, h] })).ready).toBe(true);
    expect(create(sources, replaceFirst(manifest, { ...first, productionContentSize: [w - 0.999, h - 0.999] })).ready).toBe(true);
  });

  it('falls back as one whole identity for canvas allocation, unavailable contexts and mid-bake draw failures', () => {
    const { manifest, sources } = fixture(), old = fallback();
    let allocations = 0;
    const cases = [() => { throw new Error('unavailable'); }, () => ({ getContext: () => null } as unknown as HTMLCanvasElement),
      () => {
        const canvas = new RecordingCanvas();
        if (++allocations === 13) canvas.context.drawImage = () => { throw new Error('draw failed'); };
        return canvas as unknown as HTMLCanvasElement;
      }];
    for (const createCanvas of cases) {
      const adapter = createGeneratedServerArt(manifest, sources, { createCanvas });
      expect(adapter.ready).toBe(false);
      expect(adapter.sourceFrameIds).toEqual([]);
      expect(adapter.sourceScale).toBeNull();
      expect(adapter.resolve(server, old).frames).toBe(old);
    }
  });

  it('matches original full-RGBA geometry after the shipped common 144-max-edge production transform', () => {
    const originals = fixture().create(), packed = fixture(runtime.serverManifest);
    const ratios = new Set<number>();
    for (const meta of runtime.serverManifest.frames) {
      const id = `server-${meta.direction}-${meta.state}` as const;
      const png = readFileSync(new URL(`../../public/art/generated/${runtime.assets[id]}`, import.meta.url));
      const size = [png.readUInt32BE(16), png.readUInt32BE(20)];
      expect(size).toEqual(meta.size);
      expect(Math.max(...size)).toBeLessThanOrEqual(144);
      packed.sources[id] = fake(...size as [number, number]);
      const before = originalManifest.frames.find(frame => frame.direction === meta.direction && frame.state === meta.state)!;
      const content = meta.productionContentSize!;
      ratios.add(Number((content[0] / before.size[0]).toFixed(12)));
      ratios.add(Number((content[1] / before.size[1]).toFixed(12)));
    }
    expect(ratios.size).toBe(1);
    const adapter = packed.create();
    expect(adapter.ready).toBe(true);
    expect(adapter.sourceFrameIds).toEqual(GENERATED_SERVER_FRAME_IDS);
    const before = originals.resolve(server, fallback()).frames, after = adapter.resolve(server, fallback()).frames;
    for (let i = 0; i < runtime.serverManifest.frames.length; i++) {
      const meta = runtime.serverManifest.frames[i];
      const oldDraw = recorded(fineSpriteArt(before[meta.direction][i % 3]).canvas).draws[0].args;
      const draw = recorded(fineSpriteArt(after[meta.direction][i % 3]).canvas).draws[0].args;
      expect(draw.slice(0, 4)).toEqual([0, 0, ...meta.productionContentSize!]);
      for (let index = 4; index < 8; index++) expect(draw[index]).toBeCloseTo(oldDraw[index], 10);
      expect(draw[6] / draw[2]).toBeCloseTo(draw[7] / draw[3], 12);
      expect(draw[4] + meta.foot.x * draw[6] / draw[2]).toBeCloseTo(36, 12);
      expect(draw[5] + meta.foot.y * draw[7] / draw[3]).toBeCloseTo(108, 12);
    }
  });
});

// Optional authoring dependency, used when installed; normal npm test/build do not require it.
type NativeCanvas = {
  createCanvas(width: number, height: number): HTMLCanvasElement;
  loadImage(bytes: Buffer): Promise<HTMLImageElement>;
};
let nativeCanvas: NativeCanvas | undefined;
try { nativeCanvas = createRequire(import.meta.url)('@napi-rs/canvas') as NativeCanvas; } catch { /* Recording tests remain portable. */ }

describe.skipIf(!nativeCanvas)('generated server native-pixel integration', () => {
  it('bakes all nine shipped PNGs and mirrors every right-facing RGBA pixel exactly', async () => {
    const sources: Partial<Record<GeneratedServerFrameId, CanvasImageSource>> = {};
    for (const id of GENERATED_SERVER_FRAME_IDS) {
      sources[id] = await nativeCanvas!.loadImage(readFileSync(new URL(`../../public/art/generated/${runtime.assets[id]}`, import.meta.url)));
    }
    const adapter = createGeneratedServerArt(runtime.serverManifest, sources, { createCanvas: () => nativeCanvas!.createCanvas(1, 1) });
    expect(adapter.ready).toBe(true);
    expect(adapter.sourceFrameIds).toHaveLength(9);
    const { frames } = adapter.resolve(server, fallback());
    for (const facing of ['down', 'up', 'right', 'left'] as const) for (const frame of frames[facing]) {
      const art = fineSpriteArt(frame).canvas;
      const rgba = art.getContext('2d')!.getImageData(0, 0, 72, 112).data;
      expect(rgba.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
      expect(rgba.some((value, index) => index % 4 === 3 && value > 0 && value < 128)).toBe(true);
    }
    for (let pose = 0; pose < 3; pose++) {
      const pixels = (frame: HTMLCanvasElement) => fineSpriteArt(frame).canvas.getContext('2d')!.getImageData(0, 0, 72, 112).data;
      const left = pixels(frames.left[pose]), right = pixels(frames.right[pose]);
      for (let y = 0; y < 112; y++) for (let x = 0; x < 72; x++) {
        const l = (y * 72 + x) * 4, r = (y * 72 + 71 - x) * 4;
        expect(left.slice(l, l + 4)).toEqual(right.slice(r, r + 4));
      }
    }
  });

  it('retains faint authored alpha outside the measured body bbox', () => {
    const { manifest } = fixture();
    const source = nativeCanvas!.createCanvas(183, 407), ctx = source.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 0, 255, 0.25)'; ctx.fillRect(0, 0, 183, 407);
    const frames = manifest.frames.map(meta => ({ ...meta, size: [183, 407], bbox: { x: 30, y: 30, w: 123, h: 357 },
      foot: { x: 91.5, y: 386 } }));
    const sources = Object.fromEntries(GENERATED_SERVER_FRAME_IDS.map(id => [id, source])) as GeneratedServerSources;
    const adapter = createGeneratedServerArt({ ...manifest, frames }, sources, { createCanvas: () => nativeCanvas!.createCanvas(1, 1) });
    expect(adapter.ready).toBe(true);
    const art = fineSpriteArt(adapter.resolve(server, fallback()).frames.down[0]).canvas;
    const left = (9 - 91.5 * adapter.sourceScale!) * 4, top = (27 - 386 * adapter.sourceScale!) * 4;
    // A point inside the full image but outside the measured x=30/y=30 body.
    const x = Math.round(left + 15 * adapter.sourceScale! * 4), y = Math.round(top + 15 * adapter.sourceScale! * 4);
    expect(art.getContext('2d')!.getImageData(x, y, 1, 1).data[3]).toBeGreaterThan(0);
  });
});
