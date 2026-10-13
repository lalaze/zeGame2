import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { CATS } from '../game/pets';
import { fineSpriteArt, logicalCrop } from './fine-sprite-art';
import { createGeneratedCatArt, GENERATED_CAT_FRAME_IDS, GENERATED_CAT_STATES,
  type GeneratedCatFrameId, type GeneratedCatFrameMeta, type GeneratedCatManifest, type GeneratedCatState } from './generated-cat-art';
import manifestJson from './generated-cat-manifest.json';
import { residentCatFlipX } from './living-cat-pose';
import type { CatFrames } from './sprites';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean };
class RecordingCanvas {
  width = 0;
  height = 0;
  draws: Draw[] = [];
  context = {
    imageSmoothingEnabled: true,
    drawImage: (source: CanvasImageSource, ...args: number[]) => {
      this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled });
    },
  };
  getContext() { return this.context; }
}
const recorded = (c: HTMLCanvasElement) => c as unknown as RecordingCanvas;
const fake = (width = 18, height = 14) => ({ width, height }) as HTMLCanvasElement;
function fallback(): CatFrames {
  return { idle: fake(), swish: fake(), blink: fake(), happy: fake(), walk: [fake(), fake()], sleep: fake(),
    groom: [fake(), fake()], stretch: fake(), watch: fake(), lookUp: fake(18, 18), nuzzle: [fake(18, 18), fake(18, 18)] };
}
function frameFor(frames: CatFrames, state: GeneratedCatState): HTMLCanvasElement {
  if (state === 'walkA' || state === 'walkB') return frames.walk[state === 'walkA' ? 0 : 1];
  if (state === 'groomA' || state === 'groomB') return frames.groom[state === 'groomA' ? 0 : 1];
  if (state === 'nuzzleA' || state === 'nuzzleB') return frames.nuzzle[state === 'nuzzleA' ? 0 : 1];
  return frames[state];
}
function fixture() {
  const manifest = structuredClone(manifestJson) as GeneratedCatManifest;
  const sources: Partial<Record<GeneratedCatFrameId, CanvasImageSource>> = {};
  for (const id of GENERATED_CAT_FRAME_IDS) {
    const png = readFileSync(new URL(`../../public/art/generated/cat-siamese-v1/${id}.png`, import.meta.url));
    sources[id] = fake(png.readUInt32BE(16), png.readUInt32BE(20));
  }
  const createCanvas = vi.fn(() => new RecordingCanvas() as unknown as HTMLCanvasElement);
  const create = (metadata = manifest) => createGeneratedCatArt(metadata, sources, { createCanvas });
  return { manifest, sources, createCanvas, create };
}

/** Decode the delivered non-interlaced RGBA PNGs without a new image dependency. */
function rgba(png: Buffer) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  expect(png[24]).toBe(8); expect(png[25]).toBe(6); expect(png[28]).toBe(0);
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8);
    if (kind === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4, pixels = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= 4 ? pixels[i - 4] : 0, up = y ? pixels[i - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      pixels[i] = raw[y * (stride + 1) + x + 1] + predictor;
    }
  }
  return { width, height, pixels };
}

describe('complete generated Siamese art', () => {
  it('validates actual PNG silhouettes and transparency against every source bbox', () => {
    const manifest = manifestJson as GeneratedCatManifest;
    for (const meta of manifest.frames) {
      const bytes = readFileSync(new URL(`../../public/art/generated/cat-siamese-v1/siamese-${meta.state}.png`, import.meta.url));
      const { width, height, pixels } = rgba(bytes);
      expect([width, height]).toEqual(meta.size);
      let left = width, top = height, right = 0, bottom = 0, transparent = 0, maxAlpha = 0, edgeAlpha = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const a = pixels[(y * width + x) * 4 + 3];
        if (!a) transparent++;
        maxAlpha = Math.max(maxAlpha, a);
        if (!x || !y || x === width - 1 || y === height - 1) edgeAlpha = Math.max(edgeAlpha, a);
        if (a > 128) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
      }
      expect({ x: left, y: top, w: right - left, h: bottom - top }).toEqual(meta.bbox);
      expect(Math.min(left, top, width - right, height - bottom)).toBeGreaterThanOrEqual(10);
      expect(transparent / (width * height)).toBeGreaterThan(0.2);
      expect(maxAlpha).toBe(254); // Preserve original alpha; do not impose opaque 255 or threshold it.
      expect(edgeAlpha).toBeLessThanOrEqual(1); // Only faint native fringe can meet the crop edge.
    }
  });

  it('bakes fourteen distinct poses at 4× with complete images inside a shared envelope', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const adapter = create(), result = adapter.resolve('siamese', fallback());
    expect(adapter.ready).toBe(true); expect(result.generated).toBe(true);
    expect(createCanvas).toHaveBeenCalledTimes(28);
    expect(new Set(GENERATED_CAT_STATES.map(state => frameFor(result.frames, state))).size).toBe(14);
    for (const meta of manifest.frames) {
      const frame = frameFor(result.frames, meta.state), art = fineSpriteArt(frame);
      expect([frame.width, frame.height]).toEqual([24, 18]);
      expect([art.canvas.width, art.canvas.height, art.density]).toEqual([96, 72, 4]);
      const draw = recorded(art.canvas).draws[0];
      expect(draw.source).toBe(sources[`siamese-${meta.state}`]); expect(draw.smoothing).toBe(false);
      const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.args;
      expect([sx, sy, sw, sh]).toEqual([0, 0, ...meta.size]);
      expect(dx).toBeGreaterThanOrEqual(0); expect(dy).toBeGreaterThanOrEqual(0);
      expect(dx + dw).toBeLessThanOrEqual(96); expect(dy + dh).toBeLessThanOrEqual(72);
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(recorded(frame).draws[0].source).toBe(art.canvas);
    }
  });

  it.each(GENERATED_CAT_FRAME_IDS)('keeps the entire fallback breed when %s is absent', missing => {
    const { create, sources, createCanvas } = fixture();
    delete sources[missing];
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(false); expect(adapter.scales).toBeNull();
    expect(adapter.resolve('siamese', old)).toEqual({ frames: old, generated: false });
    expect(adapter.contactPoints(old.lookUp)).toBeNull();
    expect(adapter.drawOffset(old.idle)).toEqual({ x: 0, y: 0 });
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('leaves the other eleven breed identities exactly untouched', () => {
    const { create } = fixture();
    const adapter = create(), old = fallback();
    for (const cat of CATS) if (cat.id !== 'siamese') {
      expect(adapter.resolve(cat.id, old)).toEqual({ frames: old, generated: false });
      expect(adapter.resolve(cat.id, old).frames).toBe(old);
    }
    expect(adapter.resolve('siamese', old).frames).not.toBe(old);
    expect(adapter.drawOffset(old.idle)).toEqual({ x: 0, y: 0 });
    expect(adapter.contactPoints(old.idle, true)).toBeNull();
  });

  it('shares calibrated scales across each sheet without normalizing individual poses', () => {
    const { create, manifest } = fixture();
    const adapter = create(), { frames } = adapter.resolve('siamese', fallback());
    expect(adapter.scales).toEqual({ 'core-source.png': 0.03275, 'behaviors-source.png': 0.02948,
      'interaction-source.png': 0.02721, 'nuzzle-raised-source.png': 0.0188 });
    const heights = new Set<number>();
    for (const meta of manifest.frames) {
      const [, , sw, sh, , , dw, dh] = recorded(fineSpriteArt(frameFor(frames, meta.state)).canvas).draws[0].args;
      expect(dw / sw).toBeCloseTo(meta.sourceToWorldScale * 4, 12);
      expect(dh / sh).toBeCloseTo(adapter.scales![meta.source] * 4, 12);
      heights.add(dh);
    }
    expect(heights.size).toBeGreaterThan(10);
    // Raised actions retain their taller chests; curled sleep remains genuinely lower.
    const height = (state: GeneratedCatState) => {
      const meta = manifest.frames.find(f => f.state === state)!;
      return meta.bbox.h * adapter.scales![meta.source];
    };
    expect(height('lookUp')).toBeGreaterThan(height('idle'));
    expect(height('nuzzleA')).toBeGreaterThan(height('idle'));
    expect(height('sleep')).toBeLessThan(height('idle') * 0.7);
  });

  it('keeps common world feet, mirrored contacts and the walking-specific facing convention', () => {
    const { create, manifest } = fixture();
    const adapter = create(), { frames } = adapter.resolve('siamese', fallback());
    for (const meta of manifest.frames) {
      const frame = frameFor(frames, meta.state), offset = adapter.drawOffset(frame);
      expect(offset).toEqual({ x: -3, y: 0 });
      for (const flipX of [false, true]) {
        const points = adapter.contactPoints(frame, flipX)!;
        expect(points.foot).toEqual({ x: 12, y: 17 });
        expect(-9 + offset.x + points.foot.x).toBe(0);
        expect(-frame.height + 2 + offset.y + points.foot.y).toBe(1);
        const headX = 12 + (meta.headContact.x - meta.foot.x) * meta.sourceToWorldScale;
        expect(points.headContact.x).toBeCloseTo(flipX ? 24 - headX : headX, 12);
        expect(points.headContact.y).toBeCloseTo(17 + (meta.headContact.y - meta.foot.y) * meta.sourceToWorldScale, 12);
      }
    }
    for (const frame of frames.walk) for (const facing of [-1, 1] as const) {
      const contact = adapter.contactPoints(frame, residentCatFlipX(true, facing))!;
      expect(Math.sign(contact.headContact.x - contact.foot.x)).toBe(facing);
    }
    expect(residentCatFlipX(false, 1)).toBe(false);
    expect(residentCatFlipX(false, -1)).toBe(true);
    expect(logicalCrop(frames.stretch, 0, 0, 24, 18)).toEqual({ x: 0, y: 0, width: 96, height: 72 });
  });

  it('rejects invalid breed, duplicate frames, per-pose scale drift and wrong sheet identity', () => {
    const { create, manifest, createCanvas } = fixture();
    const changed = (mutate: (f: GeneratedCatFrameMeta) => GeneratedCatFrameMeta) => ({ ...manifest,
      frames: manifest.frames.map((f, i) => i ? f : mutate(f)) });
    expect(create({ ...manifest, breed: 'ragdoll' }).ready).toBe(false);
    expect(create({ ...manifest, frames: [manifest.frames[1], ...manifest.frames.slice(1)] }).ready).toBe(false);
    expect(create(changed(f => ({ ...f, sourceToWorldScale: f.sourceToWorldScale * 0.99 }))).ready).toBe(false);
    expect(create(changed(f => ({ ...f, source: 'behaviors-source.png' }))).ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects invalid contacts, physical source crops, unloaded images and unsafe scales', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const changed = (mutate: (f: GeneratedCatFrameMeta) => GeneratedCatFrameMeta) => ({ ...manifest,
      frames: manifest.frames.map((f, i) => i ? f : mutate(f)) });
    expect(create(changed(f => ({ ...f, bbox: { ...f.bbox, w: 9999 } }))).ready).toBe(false);
    expect(create(changed(f => ({ ...f, foot: { x: -1, y: 8 } }))).ready).toBe(false);
    expect(create(changed(f => ({ ...f, headContact: f.foot }))).ready).toBe(false);
    expect(create(changed(f => ({ ...f, size: [f.size[0] - 1, f.size[1]] }))).ready).toBe(false);
    for (const scale of [0, -1, NaN, Infinity, 100]) expect(createGeneratedCatArt(manifest, sources, { createCanvas, scale }).ready).toBe(false);
    sources['siamese-idle'] = { width: 396, height: 418, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(create().ready).toBe(false); expect(createCanvas).not.toHaveBeenCalled();
  });

  it('fails atomically when a later canvas draw fails', () => {
    const { manifest, sources } = fixture();
    let count = 0;
    const createCanvas = () => {
      if (++count === 20) throw new Error('canvas allocation failed');
      return new RecordingCanvas() as unknown as HTMLCanvasElement;
    };
    const adapter = createGeneratedCatArt(manifest, sources, { createCanvas }), old = fallback();
    expect(adapter.ready).toBe(false);
    expect(adapter.resolve('siamese', old).frames).toBe(old);
    expect(adapter.scales).toBeNull();
  });

  it('keeps one complete result after sources are released, without allocating per resolve', () => {
    const { create, sources, createCanvas } = fixture();
    const adapter = create(), old = fallback(), result = adapter.resolve('siamese', old);
    for (const id of GENERATED_CAT_FRAME_IDS) {
      const image = sources[id]!;
      Object.defineProperty(image, 'width', { get() { throw new Error('released source was read'); } });
      delete sources[id];
    }
    for (let i = 0; i < 100; i++) expect(adapter.resolve('siamese', fallback())).toBe(result);
    expect(createCanvas).toHaveBeenCalledTimes(28);
    for (const state of GENERATED_CAT_STATES) {
      const frame = frameFor(result.frames, state);
      expect(fineSpriteArt(frame).canvas.width).toBe(96);
      expect(adapter.contactPoints(frame)).not.toBeNull();
      expect(adapter.drawOffset(frame)).toEqual({ x: -3, y: 0 });
    }
  });
});
