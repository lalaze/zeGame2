import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { CATS, type CatId } from '../game/pets';
import { fineSpriteArt, logicalCrop } from './fine-sprite-art';
import { createGeneratedCatArt, generatedCatFrameIds, GENERATED_CAT_BREEDS, GENERATED_CAT_ENVELOPE, GENERATED_CAT_FRAME_IDS, GENERATED_CAT_STATES,
  type GeneratedCatFrameId, type GeneratedCatFrameMeta, type GeneratedCatManifest, type GeneratedCatState, type GeneratedCatSources } from './generated-cat-art';
import manifestJson from './generated-cat-manifest.json';
import { residentCatFlipX } from './living-cat-pose';
import type { CatFrames } from './sprites';

const SIAMESE_FRAME_IDS = generatedCatFrameIds('siamese');

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
  for (const id of SIAMESE_FRAME_IDS) {
    const png = readFileSync(new URL(`../../assets/generated/original-main-actors-v1/cat-siamese-v1/${id}.png`, import.meta.url));
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
      const bytes = readFileSync(new URL(`../../assets/generated/original-main-actors-v1/cat-siamese-v1/siamese-${meta.state}.png`, import.meta.url));
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

  it.each(SIAMESE_FRAME_IDS)('keeps the entire fallback breed when %s is absent', missing => {
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
    for (const id of SIAMESE_FRAME_IDS) {
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

function allBreedFixture() {
  const manifests = GENERATED_CAT_BREEDS.map(breed => breed === 'siamese'
    ? structuredClone(manifestJson) as GeneratedCatManifest
    : JSON.parse(readFileSync(new URL(`../../assets/generated/bulk-candidates/cats/${breed}/renderer-manifest.json`, import.meta.url), 'utf8')) as GeneratedCatManifest);
  const sources: Partial<Record<GeneratedCatFrameId, CanvasImageSource>> = {};
  for (const manifest of manifests) for (const meta of manifest.frames) {
    const id = `${manifest.breed}-${meta.state}` as GeneratedCatFrameId;
    const path = manifest.breed === 'siamese' ? `assets/generated/original-main-actors-v1/cat-siamese-v1/${id}.png`
      : `assets/generated/bulk-candidates/cats/${manifest.breed}/${id}.png`;
    const png = readFileSync(new URL(`../../${path}`, import.meta.url));
    sources[id] = fake(png.readUInt32BE(16), png.readUInt32BE(20));
  }
  const createCanvas = vi.fn(() => new RecordingCanvas() as unknown as HTMLCanvasElement);
  const create = (metadata: GeneratedCatManifest | readonly GeneratedCatManifest[] = manifests,
    images: GeneratedCatSources = sources) => createGeneratedCatArt(metadata, images, { createCanvas });
  return { manifests, sources, createCanvas, create };
}

describe('complete generated packs for all twelve cat identities', () => {
  it('bakes the actual twelve manifest/PNG dimensions into 168 distinct poses without clipping or identity remapping', () => {
    const { manifests, sources, create, createCanvas } = allBreedFixture();
    const adapter = create([...manifests].reverse());
    expect(adapter.ready).toBe(true);
    expect(adapter.readyBreeds).toEqual(CATS.map(cat => cat.id));
    expect(adapter.sourceFrameIds).toEqual(GENERATED_CAT_FRAME_IDS);
    expect(adapter.errors).toEqual([]);
    expect(createCanvas).toHaveBeenCalledTimes(12 * 14 * 2);
    const outputs = new Set<HTMLCanvasElement>();
    for (const manifest of manifests) {
      const { frames, generated } = adapter.resolve(manifest.breed as CatId, fallback());
      expect(generated).toBe(true);
      for (const meta of manifest.frames) {
        const frame = frameFor(frames, meta.state), art = fineSpriteArt(frame);
        outputs.add(frame);
        expect([frame.width, frame.height]).toEqual([24, 18]);
        expect([art.canvas.width, art.canvas.height, art.density]).toEqual([96, 72, 4]);
        const draw = recorded(art.canvas).draws[0];
        expect(draw.source).toBe(sources[`${manifest.breed as CatId}-${meta.state}`]);
        expect(draw.smoothing).toBe(false);
        const [sx, sy, sw, sh, x, y, w, h] = draw.args;
        expect([sx, sy, sw, sh]).toEqual([0, 0, ...meta.size]);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(96); expect(y + h).toBeLessThanOrEqual(72);
        expect(w / sw).toBeCloseTo(meta.sourceToWorldScale * 4, 12);
        expect(h / sh).toBeCloseTo(meta.sourceToWorldScale * 4, 12);
        expect(adapter.scalesByBreed[manifest.breed as CatId]![meta.source]).toBe(meta.sourceToWorldScale);
      }
    }
    expect(outputs.size).toBe(168);
    expect(Object.isFrozen(adapter.readyBreeds)).toBe(true);
    expect(Object.isFrozen(adapter.sourceFrameIds)).toBe(true);
  });

  it.each(GENERATED_CAT_BREEDS)('replaces %s identically from one manifest or an array', breed => {
    const { create, manifests } = allBreedFixture();
    const manifest = manifests.find(pack => pack.breed === breed)!;
    for (const input of [manifest, [manifest]]) {
      const adapter = create(input), old = fallback();
      expect(adapter.readyBreeds).toEqual([breed]);
      expect(adapter.sourceFrameIds).toEqual(GENERATED_CAT_STATES.map(state => `${breed}-${state}`));
      expect(adapter.resolve(breed, old).generated).toBe(true);
      for (const other of GENERATED_CAT_BREEDS.filter(id => id !== breed)) {
        expect(adapter.resolve(other, old)).toEqual({ frames: old, generated: false });
      }
    }
  });

  it.each(GENERATED_CAT_BREEDS)('falls back only the complete %s pack when one source is missing', breed => {
    const { sources, create, createCanvas } = allBreedFixture();
    delete sources[`${breed}-nuzzleB`];
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(true);
    expect(adapter.readyBreeds).toEqual(GENERATED_CAT_BREEDS.filter(id => id !== breed));
    expect(adapter.resolve(breed, old)).toEqual({ frames: old, generated: false });
    expect(adapter.sourceFrameIds).toHaveLength(11 * 14);
    expect(adapter.sourceFrameIds.some(id => id.startsWith(`${breed}-`))).toBe(false);
    expect(adapter.scalesByBreed[breed]).toBeUndefined();
    expect(adapter.errors).toContainEqual(expect.objectContaining({ breed, frameId: `${breed}-nuzzleB`, code: 'missing-source' }));
    expect(createCanvas).toHaveBeenCalledTimes(11 * 14 * 2);
  });

  it('preserves world feet and metadata head contacts for every pose and Scene mirror', () => {
    const { manifests, create } = allBreedFixture(), adapter = create();
    for (const manifest of manifests) {
      const { frames } = adapter.resolve(manifest.breed as CatId, fallback());
      for (const meta of manifest.frames) {
        const frame = frameFor(frames, meta.state), offset = adapter.drawOffset(frame);
        expect(offset).toEqual({ x: -3, y: 0 });
        for (const flip of [false, true]) {
          const points = adapter.contactPoints(frame, flip)!;
          expect(points.foot).toEqual(GENERATED_CAT_ENVELOPE.foot);
          expect(-9 + offset.x + points.foot.x).toBe(0);
          expect(-frame.height + 2 + offset.y + points.foot.y).toBe(1);
          const x = 12 + (meta.headContact.x - meta.foot.x) * meta.sourceToWorldScale;
          const y = 17 + (meta.headContact.y - meta.foot.y) * meta.sourceToWorldScale;
          expect(points.headContact.x).toBeCloseTo(flip ? 24 - x : x, 12);
          expect(points.headContact.y).toBeCloseTo(y, 12);
        }
      }
      for (const frame of frames.walk) for (const facing of [-1, 1] as const) {
        const points = adapter.contactPoints(frame, residentCatFlipX(true, facing))!;
        expect(Math.sign(points.headContact.x - points.foot.x)).toBe(facing);
      }
    }
  });

  it('preserves isotropic world calibration for downscaled PNGs with equally scaled source metadata', () => {
    const { manifests, sources, create } = allBreedFixture();
    const original = create(), ratio = 0.5;
    const reduced = manifests.map(pack => ({ ...pack, frames: pack.frames.map(meta => ({ ...meta,
      size: meta.size.map(value => Math.ceil(value * ratio)),
      bbox: { x: meta.bbox.x * ratio, y: meta.bbox.y * ratio, w: meta.bbox.w * ratio, h: meta.bbox.h * ratio },
      foot: { x: meta.foot.x * ratio, y: meta.foot.y * ratio },
      headContact: { x: meta.headContact.x * ratio, y: meta.headContact.y * ratio },
      sourceToWorldScale: meta.sourceToWorldScale / ratio,
    })) }));
    for (const pack of reduced) for (const meta of pack.frames) sources[`${pack.breed as CatId}-${meta.state}`] = fake(meta.size[0], meta.size[1]);
    const adapter = create(reduced);
    expect(adapter.errors).toEqual([]); expect(adapter.readyBreeds).toHaveLength(12);
    for (const pack of reduced) {
      const before = original.resolve(pack.breed as CatId, fallback()).frames;
      const after = adapter.resolve(pack.breed as CatId, fallback()).frames;
      for (const meta of pack.frames) {
        const oldFrame = frameFor(before, meta.state), frame = frameFor(after, meta.state);
        expect(adapter.contactPoints(frame)).toEqual(original.contactPoints(oldFrame));
        expect(adapter.contactPoints(frame, true)).toEqual(original.contactPoints(oldFrame, true));
        const [, , sw, sh, , , dw, dh] = recorded(fineSpriteArt(frame).canvas).draws[0].args;
        expect(dw / sw).toBeCloseTo(dh / sh, 12);
        expect(dw / sw).toBeCloseTo(meta.sourceToWorldScale * 4, 12);
      }
    }
  });

  it('inverse-maps the fractional production extent instead of enlarging cats by ceil-rounded PNG padding', () => {
    const { sources, create } = allBreedFixture();
    const originals = create();
    const runtime = JSON.parse(readFileSync(new URL('../../assets/generated/runtime-catalog-v1/catalog.json', import.meta.url), 'utf8')) as {
      assets: Record<GeneratedCatFrameId, string>; catManifests: GeneratedCatManifest[];
    };
    const packed = runtime.catManifests;
    for (const pack of runtime.catManifests) for (const meta of pack.frames) {
      const id = `${pack.breed as CatId}-${meta.state}` as const;
      const png = readFileSync(new URL(`../../public/art/generated/${runtime.assets[id]}`, import.meta.url));
      sources[id] = fake(png.readUInt32BE(16), png.readUInt32BE(20));
    }
    const adapter = create(packed);
    expect(adapter.errors).toEqual([]);
    expect(adapter.readyBreeds).toEqual(GENERATED_CAT_BREEDS);
    expect(adapter.sourceFrameIds).toEqual(GENERATED_CAT_FRAME_IDS);
    let paddedFrames = 0;
    for (const pack of packed) {
      const before = originals.resolve(pack.breed as CatId, fallback()).frames;
      const after = adapter.resolve(pack.breed as CatId, fallback()).frames;
      for (const meta of pack.frames) {
        const oldFrame = frameFor(before, meta.state), frame = frameFor(after, meta.state);
        const oldDraw = recorded(fineSpriteArt(oldFrame).canvas).draws[0].args;
        const draw = recorded(fineSpriteArt(frame).canvas).draws[0].args;
        const content = meta.productionContentSize ?? meta.size;
        expect(draw.slice(0, 4)).toEqual([0, 0, ...content]);
        for (let index = 4; index < 8; index++) expect(draw[index]).toBeCloseTo(oldDraw[index], 10);
        expect(draw[6] / draw[2]).toBeCloseTo(draw[7] / draw[3], 12);
        for (const flip of [false, true]) {
          const oldPoints = originals.contactPoints(oldFrame, flip)!, points = adapter.contactPoints(frame, flip)!;
          expect(points.foot).toEqual(oldPoints.foot);
          expect(points.headContact.x).toBeCloseTo(oldPoints.headContact.x, 12);
          expect(points.headContact.y).toBeCloseTo(oldPoints.headContact.y, 12);
        }
        if (content.some((value, index) => value < meta.size[index])) paddedFrames++;
      }
    }
    expect(paddedFrames).toBeGreaterThan(100);
    // Omitting the production extent used to incorrectly reject otherwise fitting packs.
    const uncorrected = create(packed.map(pack => ({ ...pack,
      frames: pack.frames.map(meta => ({ ...meta, productionContentSize: undefined })),
    })));
    expect(uncorrected.errors.some(error => error.code === 'envelope-overflow')).toBe(true);
    expect(uncorrected.readyBreeds.length).toBeLessThan(12);
  });

  it('accepts exact production dimensions but rejects malformed or non-subpixel crop ranges before allocating', () => {
    const { manifest, sources, createCanvas } = fixture();
    const meta = manifest.frames[0], [width, height] = meta.size;
    const changed = (productionContentSize: unknown) => ({ ...manifest,
      frames: manifest.frames.map((frame, index) => index ? frame : { ...frame, productionContentSize }),
    }) as GeneratedCatManifest;
    const invalid: unknown[] = [null, [], new Array(2), [width], [width, height, 1], [0, height], [-1, height], [width, 0],
      [NaN, height], [width, Infinity], [width + 0.001, height], [width, height + 0.001], [width - 1, height],
      [width, height - 1], [width - 2, height], ['396', height]];
    for (const content of invalid) {
      const adapter = createGeneratedCatArt(changed(content), sources, { createCanvas });
      expect(adapter.ready).toBe(false);
      expect(adapter.sourceFrameIds).toEqual([]);
      expect(adapter.errors).toContainEqual(expect.objectContaining({ code: 'invalid-content-size', frameId: 'siamese-idle' }));
    }
    expect(createCanvas).not.toHaveBeenCalled();
    const full = createGeneratedCatArt(changed([width, height]), sources, { createCanvas });
    expect(full.ready).toBe(true); expect(full.errors).toEqual([]);
    const fractional = createGeneratedCatArt(changed([width - 0.999, height - 0.999]), sources, { createCanvas });
    expect(fractional.ready).toBe(true); expect(fractional.errors).toEqual([]);
    expect(createCanvas).toHaveBeenCalledTimes(56);
  });

  it('does not permit production padding metadata to crop the authored silhouette', () => {
    const { manifest, sources, createCanvas } = fixture();
    const changed = { ...manifest, frames: manifest.frames.map((meta, index) => index ? meta : { ...meta,
      bbox: { x: 0, y: 0, w: meta.size[0], h: meta.size[1] },
      productionContentSize: [meta.size[0] - 0.25, meta.size[1] - 0.25],
    }) };
    const adapter = createGeneratedCatArt(changed, sources, { createCanvas });
    expect(adapter.ready).toBe(false);
    expect(adapter.errors).toContainEqual(expect.objectContaining({ code: 'invalid-metadata', frameId: 'siamese-idle' }));
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects unknown and duplicated identities before allocation without poisoning valid neighbors', () => {
    const { create, manifests, createCanvas } = allBreedFixture();
    const adapter = create([...manifests, manifests[0], { ...manifests[1], breed: 'unknown-cat' }]);
    expect(adapter.readyBreeds).toEqual(GENERATED_CAT_BREEDS.filter(id => id !== manifests[0].breed));
    expect(adapter.errors.map(error => error.code)).toEqual(['duplicate-breed', 'unknown-breed']);
    expect(createCanvas).toHaveBeenCalledTimes(11 * 28);
    const old = fallback();
    expect(adapter.resolve('unknown-cat' as CatId, old)).toEqual({ frames: old, generated: false });
    expect(adapter.drawOffset(old.idle)).toEqual({ x: 0, y: 0 });
    expect(adapter.contactPoints(old.idle)).toBeNull();
    expect(create(manifests.flatMap(pack => [pack, pack])).ready).toBe(false);
    expect(createCanvas).toHaveBeenCalledTimes(11 * 28);
  });

  it('fails each malformed pack independently and explains overflow instead of clipping or fitting it', () => {
    const { manifests, create, createCanvas } = allBreedFixture();
    const changed = manifests.map(pack => pack.breed === 'mainecoon' ? { ...pack, frames: pack.frames.map(meta => ({ ...meta,
      sourceToWorldScale: meta.sourceToWorldScale * 1.1 })) } : pack.breed === 'ginger' ? { ...pack,
      frames: pack.frames.map((meta, index) => index === 0 ? { ...meta, sourceToWorldScale: meta.sourceToWorldScale * 0.99 } : meta) } : pack);
    const adapter = create(changed);
    expect(adapter.readyBreeds).toHaveLength(10);
    expect(adapter.resolve('mainecoon', fallback()).generated).toBe(false);
    expect(adapter.resolve('ginger', fallback()).generated).toBe(false);
    const overflow = adapter.errors.find(error => error.code === 'envelope-overflow' && error.bounds!.top < 0)!;
    expect(overflow.breed).toBe('mainecoon'); expect(overflow.bounds!.top).toBeLessThan(0);
    expect(overflow.message).toContain('adapt the shared envelope and offsets');
    expect(adapter.errors.some(error => error.breed === 'ginger' && error.code === 'inconsistent-sheet-scale')).toBe(true);
    expect(adapter.sourceFrameIds).toHaveLength(10 * 14);
    expect(createCanvas).toHaveBeenCalledTimes(10 * 28);
  });

  it('isolates a late allocation failure to its breed and never publishes failed-frame contacts or source release IDs', () => {
    const { manifests, sources } = allBreedFixture();
    const allocated: HTMLCanvasElement[] = [];
    let calls = 0;
    const createCanvas = () => {
      if (++calls === 20) throw new Error('canvas allocation failed');
      const canvas = new RecordingCanvas() as unknown as HTMLCanvasElement;
      allocated.push(canvas); return canvas;
    };
    const adapter = createGeneratedCatArt(manifests, sources, { createCanvas });
    expect(adapter.readyBreeds).toEqual(GENERATED_CAT_BREEDS.filter(breed => breed !== 'ginger'));
    expect(adapter.sourceFrameIds).toHaveLength(11 * 14);
    expect(adapter.errors).toEqual([{ breed: 'ginger', code: 'bake-failed',
      message: 'Canvas allocation or drawing failed for ginger; the whole breed remains fallback.' }]);
    for (const failed of allocated.slice(0, 19)) {
      expect(adapter.drawOffset(failed)).toEqual({ x: 0, y: 0 });
      expect(adapter.contactPoints(failed)).toBeNull();
    }
    expect(calls).toBe(20 + 11 * 28);
  });

  it('isolates an image decoding/drawing failure and keeps valid neighboring packs ready', () => {
    const { manifests, sources } = allBreedFixture();
    let calls = 0;
    const createCanvas = () => {
      const canvas = new RecordingCanvas();
      if (++calls === 25) canvas.context.drawImage = () => { throw new Error('decoded bitmap is unavailable'); };
      return canvas as unknown as HTMLCanvasElement;
    };
    const adapter = createGeneratedCatArt(manifests, sources, { createCanvas });
    expect(adapter.readyBreeds).toHaveLength(11);
    expect(adapter.resolve('ginger', fallback()).generated).toBe(false);
    expect(adapter.resolve('siamese', fallback()).generated).toBe(true);
    expect(adapter.sourceFrameIds).not.toContain('ginger-idle');
    expect(adapter.sourceFrameIds).toContain('siamese-idle');
    expect(adapter.errors.map(error => error.code)).toEqual(['bake-failed']);
    expect(calls).toBe(25 + 11 * 28);
  });

  it('rejects malformed frame lists, duplicate states and invalid contacts only for the affected identity', () => {
    const { manifests, create, createCanvas } = allBreedFixture();
    const changed = manifests.map(pack => pack.breed === 'ginger' ? { ...pack, frames: pack.frames.slice(1) }
      : pack.breed === 'tuxedo' ? { ...pack, frames: [pack.frames[1], ...pack.frames.slice(1)] }
      : pack.breed === 'calico' ? { ...pack, frames: pack.frames.map((meta, index) => index === 0 ? { ...meta, headContact: meta.foot } : meta) }
      : pack);
    const adapter = create(changed);
    expect(adapter.readyBreeds).toHaveLength(9);
    expect(adapter.errors.map(error => [error.breed, error.code])).toEqual([
      ['ginger', 'invalid-manifest'], ['tuxedo', 'invalid-frame'], ['calico', 'invalid-metadata'],
    ]);
    expect(createCanvas).toHaveBeenCalledTimes(9 * 28);
    expect(create([]).ready).toBe(false);
    expect(createCanvas).toHaveBeenCalledTimes(9 * 28);
  });

  it('does not allocate or reread source images when resolving any successful breed after source release', () => {
    const { create, createCanvas, sources } = allBreedFixture(), adapter = create();
    const results = new Map(GENERATED_CAT_BREEDS.map(breed => [breed, adapter.resolve(breed, fallback())]));
    for (const id of adapter.sourceFrameIds) {
      Object.defineProperty(sources[id]!, 'width', { get() { throw new Error('released source was read'); } });
      delete sources[id];
    }
    for (let i = 0; i < 100; i++) for (const breed of GENERATED_CAT_BREEDS) {
      expect(adapter.resolve(breed, fallback())).toBe(results.get(breed));
      expect(adapter.contactPoints(results.get(breed)!.frames.idle)).not.toBeNull();
    }
    expect(createCanvas).toHaveBeenCalledTimes(336);
  });
});
