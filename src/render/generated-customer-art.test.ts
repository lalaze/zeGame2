import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LEGACY_GENERATED_CUSTOMER_CAST as CUSTOMER_CAST } from './generated-customer-art';
import { fineSpriteArt, logicalCrop } from './fine-sprite-art';
import { createGeneratedCustomerArt, GENERATED_CUSTOMER_FRAME_IDS, generatedCustomerEligible, generatedCustomerFrameIds, generatedCustomerFrameId,
  type GeneratedCustomerFrameId, type GeneratedCustomerFrameMeta, type GeneratedCustomerIdentity,
  type GeneratedCustomerManifest } from './generated-customer-art';
import manifestJson from './generated-customer-manifest.json';
import type { CharacterFrames } from './sprites';

const identity: GeneratedCustomerIdentity = { role: 'customer', appearanceId: 0, look: CUSTOMER_CAST[0].look };
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
function frameFor(frames: CharacterFrames, meta: GeneratedCustomerFrameMeta): HTMLCanvasElement {
  if (meta.state === 'sit') return meta.direction === 'right' ? frames.sitRight : frames.sitLeft;
  if (meta.state === 'sitPetA' || meta.state === 'sitPetB') return (meta.direction === 'right' ? frames.sitPetRight : frames.sitPetLeft)[meta.state === 'sitPetA' ? 0 : 1];
  return frames[meta.direction][['stand', 'stepA', 'stepB'].indexOf(meta.state)];
}
function fixture() {
  const manifest = structuredClone(manifestJson) as GeneratedCustomerManifest;
  const sources: Partial<Record<GeneratedCustomerFrameId, CanvasImageSource>> = {};
  for (const id of generatedCustomerFrameIds(0)) {
    const bytes = readFileSync(new URL(`../../assets/generated/original-main-actors-v1/customer-0-v1/${id}.png`, import.meta.url));
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    sources[id] = fake(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => {
    const canvas = new RecordingCanvas(); canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });
  const create = (metadata = manifest) => createGeneratedCustomerArt(metadata, sources, { createCanvas });
  return { manifest, sources, canvases, createCanvas, create };
}

describe('atomic generated Mina identity', () => {
  it('loads all fifteen current PNGs into one complete identity with bounded 4× backing', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(true);
    const result = adapter.resolve(identity, old);
    expect(result.generated).toBe(true);
    expect(result.frames.stand).toBe(result.frames.down[0]);
    expect(createCanvas).toHaveBeenCalledTimes(36); // 15 authored + 3 mirrors, logical/backing pairs
    for (const meta of manifest.frames) {
      const frame = frameFor(result.frames, meta), art = fineSpriteArt(frame);
      const dimensions = meta.group === 'walk' ? [18, 28] : meta.state === 'sit' ? [18, 29] : [22, 34];
      expect([frame.width, frame.height]).toEqual(dimensions);
      expect(art.density).toBe(4);
      expect([art.canvas.width, art.canvas.height]).toEqual(dimensions.map(value => value * 4));
      const draw = recorded(art.canvas).draws[0];
      expect(draw.source).toBe(sources[`mina-${meta.direction}-${meta.state}` as GeneratedCustomerFrameId]);
      expect(draw.smoothing).toBe(false);
      const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.args;
      expect([sx, sy, sw, sh]).toEqual([meta.bbox.x, meta.bbox.y, meta.bbox.w, meta.bbox.h]);
      expect(dx).toBeGreaterThanOrEqual(0); expect(dy).toBeGreaterThanOrEqual(0);
      expect(dx + dw).toBeLessThanOrEqual(frame.width * 4);
      expect(dy + dh).toBeLessThanOrEqual(frame.height * 4);
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(recorded(frame).draws[0].source).toBe(art.canvas);
    }
  });

  it.each(generatedCustomerFrameIds(0))('keeps every legacy action when %s is missing', missing => {
    const { create, sources, createCanvas } = fixture();
    delete sources[missing];
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(false);
    expect(adapter.scales).toBeNull();
    expect(adapter.resolve(identity, old)).toEqual({ frames: old, generated: false });
    expect(adapter.resolve(identity, old).frames).toBe(old);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('requires exact saved look, cast id and customer role without mutating them', () => {
    const { create } = fixture();
    const adapter = create(), old = fallback();
    const before = structuredClone(identity);
    for (const appearanceId of [undefined, -1, 1, 29, 0.5, NaN]) {
      expect(adapter.resolve({ ...identity, appearanceId }, old).frames).toBe(old);
    }
    for (const role of ['owner', 'barista', 'server', 'cook'] as const) expect(adapter.resolve({ ...identity, role }, old).frames).toBe(old);
    for (const key of ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const) {
      const custom = { ...identity, look: { ...identity.look, [key]: identity.look[key] + 1 } };
      expect(generatedCustomerEligible(custom)).toBe(false);
      expect(adapter.resolve(custom, old).frames).toBe(old);
    }
    expect(adapter.resolve(identity, old).generated).toBe(true);
    expect(identity).toEqual(before);
  });

  it('keeps one scale per sheet and applies the shared head-size calibration between sheets', () => {
    const { create, manifest } = fixture();
    const adapter = create(), { frames } = adapter.resolve(identity, fallback());
    const reference = manifest.frames.find(frame => frame.direction === 'down' && frame.state === 'stand')!;
    const seatReference = manifest.frames.find(frame => frame.group === 'seated')!;
    expect(adapter.scales!.seated / adapter.scales!.walking).toBeCloseTo(seatReference.sourceToWorldScale / reference.sourceToWorldScale, 12);
    const heights: number[] = [];
    for (const meta of manifest.frames) {
      const draw = recorded(fineSpriteArt(frameFor(frames, meta)).canvas).draws[0];
      const [, , sw, sh, , , dw, dh] = draw.args;
      const scale = meta.group === 'walk' ? adapter.scales!.walking : adapter.scales!.seated;
      expect(dw / sw).toBeCloseTo(scale * 4, 12); expect(dh / sh).toBeCloseTo(scale * 4, 12);
      if (meta.group === 'seated') heights.push(dh);
    }
    expect(new Set(heights).size).toBeGreaterThan(1); // leaning is not resized to a uniform body height
  });

  it('mirrors right walking poses but uses the six independent seated source poses', () => {
    const { create, sources } = fixture();
    const adapter = create(), { frames } = adapter.resolve(identity, fallback());
    for (const direction of ['down', 'up', 'left', 'right'] as const) expect(new Set(frames[direction]).size).toBe(3);
    frames.left.forEach((frame, i) => {
      const art = recorded(fineSpriteArt(frame).canvas);
      expect(art.context.translate).toHaveBeenCalledWith(72, 0);
      expect(art.context.scale).toHaveBeenCalledWith(-1, 1);
      expect(art.draws[0].source).toBe(fineSpriteArt(frames.right[i]).canvas);
      expect(adapter.contactPoints(frame)!.foot).toEqual({ x: 9, y: 27 });
    });
    expect(recorded(fineSpriteArt(frames.sitLeft).canvas).draws[0].source).toBe(sources['mina-left-sit']);
    expect(recorded(fineSpriteArt(frames.sitPetLeft[1]).canvas).draws[0].source).toBe(sources['mina-left-sitPetB']);
  });

  it('preserves foot/hip world registration and pet fingertip metadata through the larger envelope', () => {
    const { create, manifest } = fixture();
    const adapter = create(), { frames } = adapter.resolve(identity, fallback());
    for (const meta of manifest.frames) {
      const frame = frameFor(frames, meta), points = adapter.contactPoints(frame)!, offset = adapter.drawOffset(frame);
      if (meta.group === 'walk') {
        expect(points.foot).toEqual({ x: 9, y: 27 }); expect(offset).toEqual({ x: 0, y: 0 });
        continue;
      }
      const hip = points.seatContact!;
      const x = meta.direction === 'right' ? 7 : 11;
      expect(hip.x + offset.x).toBeCloseTo(x, 12);
      expect(hip.y + offset.y).toBe(22);
      // Scene still draws at seat.x-9, seat.y-33 plus this explicit offset.
      expect(-9 + offset.x + hip.x).toBeCloseTo(meta.direction === 'right' ? -2 : 2, 12);
      expect(-33 + offset.y + hip.y).toBe(-11);
      for (const key of ['foot', 'petContact'] as const) {
        if (!meta[key]) continue;
        const actual = points[key]!;
        expect(actual.x + offset.x).toBeCloseTo(x + (meta[key]!.x - meta.seatContact!.x) * adapter.scales!.seated, 12);
        expect(actual.y).toBeCloseTo(22 + (meta[key]!.y - meta.seatContact!.y) * adapter.scales!.seated, 12);
      }
      expect(offset).toEqual(meta.state === 'sit' ? { x: 0, y: 0 } : { x: -2, y: 0 });
    }
    for (const side of ['Right', 'Left'] as const) {
      const idle = adapter.contactPoints(frames[`sit${side}`])!;
      for (const pet of frames[`sitPet${side}`]) expect(adapter.contactPoints(pet)!.foot.y).toBeCloseTo(idle.foot.y, 12);
    }
  });

  it('converts the complete padded seated upper-body crop to physical texture pixels', () => {
    const { create } = fixture();
    const adapter = create(), { frames } = adapter.resolve(identity, fallback());
    expect(logicalCrop(frames.sitRight, 0, 0, frames.sitRight.width, 20)).toEqual({ x: 0, y: 0, width: 72, height: 80 });
    for (const frame of [...frames.sitPetRight, ...frames.sitPetLeft]) {
      expect(logicalCrop(frame, 0, 0, frame.width, 20)).toEqual({ x: 0, y: 0, width: 88, height: 80 });
      expect(logicalCrop(frame, 0, 0, frame.width, frame.height)).toEqual({ x: 0, y: 0, width: 88, height: 136 });
      expect(adapter.drawOffset(frame)).toEqual({ x: -2, y: 0 });
    }
  });

  it('has one cached complete result without retaining or mutating arbitrary fallback sets', () => {
    const { create, createCanvas } = fixture();
    const adapter = create(), old = fallback(), oldRight = old.sitRight;
    const result = adapter.resolve(identity, old);
    for (let i = 0; i < 100; i++) expect(adapter.resolve(identity, fallback())).toBe(result);
    expect(createCanvas).toHaveBeenCalledTimes(36);
    expect(old.sitRight).toBe(oldRight);
    expect(result.frames.sitRight).not.toBe(oldRight);
    expect(adapter.drawOffset(oldRight)).toEqual({ x: 0, y: 0 });
    expect(adapter.contactPoints(oldRight)).toBeNull();
  });

  it('rejects wrong manifest identity, duplicate poses, missing contacts and per-pose calibration drift', () => {
    const { create, manifest, createCanvas } = fixture();
    const changed = (id: string, mutate: (frame: GeneratedCustomerFrameMeta) => GeneratedCustomerFrameMeta) => ({ ...manifest,
      frames: manifest.frames.map(frame => `mina-${frame.direction}-${frame.state}` === id ? mutate(frame) : frame) });
    expect(create({ ...manifest, identity: 'someone-else' }).ready).toBe(false);
    expect(create({ ...manifest, appearanceId: 1 }).ready).toBe(false);
    expect(create({ ...manifest, look: { ...manifest.look, shirt: 1 } }).ready).toBe(false);
    expect(create({ ...manifest, frames: [manifest.frames[1], ...manifest.frames.slice(1)] }).ready).toBe(false);
    expect(create(changed('mina-right-sit', frame => ({ ...frame, seatContact: undefined }))).ready).toBe(false);
    expect(create(changed('mina-left-sitPetB', frame => ({ ...frame, petContact: undefined }))).ready).toBe(false);
    expect(create(changed('mina-left-sitPetA', frame => ({ ...frame, sourceToWorldScale: frame.sourceToWorldScale * 0.9 }))).ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('rejects unloaded sources, source overflow and unsafe envelope scales instead of clipping', () => {
    const { create, manifest, sources, createCanvas } = fixture();
    const overflow = { ...manifest, frames: manifest.frames.map((frame, i) => i ? frame : { ...frame, bbox: { ...frame.bbox, w: 9999 } }) };
    expect(create(overflow).ready).toBe(false);
    expect(createGeneratedCustomerArt(manifest, sources, { createCanvas, walkingScale: 1 }).ready).toBe(false);
    expect(createGeneratedCustomerArt(manifest, sources, { createCanvas, seatedScale: 1 }).ready).toBe(false);
    sources['mina-down-stand'] = { width: 500, height: 500, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(create().ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('atomically falls back after a canvas failure partway through the complete set', () => {
    const { manifest, sources, createCanvas } = fixture();
    const create = vi.fn(() => {
      if (create.mock.calls.length === 12) throw new Error('canvas allocation failed');
      return createCanvas();
    });
    const adapter = createGeneratedCustomerArt(manifest, sources, { createCanvas: create }), old = fallback();
    expect(createCanvas).toHaveBeenCalledTimes(11);
    expect(adapter.ready).toBe(false);
    expect(adapter.resolve(identity, old).frames).toBe(old);
  });
});

// Read the authored source dimensions, rather than inventing a uniform frame
// size. Runtime packaging may resize each complete sheet family uniformly.
const castPacks = CUSTOMER_CAST.map(design => {
  const directory = design.id === 0 ? '../../assets/generated/original-main-actors-v1/customer-0-v1/'
    : `../../assets/generated/bulk-candidates/customers/cast-${String(design.id).padStart(2, '0')}/`;
  const manifest = (design.id === 0 ? structuredClone(manifestJson)
    : JSON.parse(readFileSync(new URL(`${directory}renderer-manifest.json`, import.meta.url), 'utf8'))) as GeneratedCustomerManifest;
  const sources: Partial<Record<GeneratedCustomerFrameId, CanvasImageSource>> = {};
  for (const id of generatedCustomerFrameIds(design.id)) {
    const bytes = readFileSync(new URL(`${directory}${id}.png`, import.meta.url));
    sources[id] = fake(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  return { manifest, sources };
});
const allManifests = castPacks.map(pack => pack.manifest);
const allSources = Object.assign({}, ...castPacks.map(pack => pack.sources)) as Partial<Record<GeneratedCustomerFrameId, CanvasImageSource>>;
const identityFor = (appearanceId: number): GeneratedCustomerIdentity => ({ role: 'customer', appearanceId, look: CUSTOMER_CAST[appearanceId].look });
function castFixture(manifests: readonly GeneratedCustomerManifest[] = allManifests,
  sources = allSources) {
  const createCanvas = vi.fn(() => new RecordingCanvas() as unknown as HTMLCanvasElement);
  const adapter = createGeneratedCustomerArt(manifests, sources, { createCanvas });
  return { adapter, createCanvas };
}

describe('all thirty fixed generated customer identities', () => {
  it('exports immutable, unique source mappings for every cast and only valid authored poses', () => {
    expect(CUSTOMER_CAST).toHaveLength(30);
    expect(GENERATED_CUSTOMER_FRAME_IDS).toHaveLength(450);
    expect(new Set(GENERATED_CUSTOMER_FRAME_IDS).size).toBe(450);
    expect(Object.isFrozen(GENERATED_CUSTOMER_FRAME_IDS)).toBe(true);
    for (const design of CUSTOMER_CAST) {
      const ids = generatedCustomerFrameIds(design.id);
      expect(ids).toHaveLength(15); expect(Object.isFrozen(ids)).toBe(true);
      for (const meta of castPacks[design.id].manifest.frames) {
        expect(ids).toContain(generatedCustomerFrameId(design.id, meta.direction, meta.state));
      }
      expect(generatedCustomerFrameId(design.id, 'left', 'stand')).toBeNull();
      expect(generatedCustomerFrameId(design.id, 'up', 'sit')).toBeNull();
    }
    expect(generatedCustomerFrameId(0, 'down', 'stand')).toBe('mina-down-stand');
    expect(generatedCustomerFrameId(29, 'left', 'sitPetB')).toBe('customer-29-left-sitPetB');
    for (const id of [-1, 30, 999, NaN, Infinity, 0.5]) {
      expect(generatedCustomerFrameIds(id)).toEqual([]);
      expect(generatedCustomerFrameId(id, 'down', 'stand')).toBeNull();
    }
  });

  it.each(CUSTOMER_CAST.map(design => design.id))('bakes cast %i from its own fifteen sources at one scale per sheet', appearanceId => {
    const pack = castPacks[appearanceId];
    const { adapter, createCanvas } = castFixture([pack.manifest], pack.sources);
    expect(adapter.ready).toBe(true);
    expect(adapter.readyAppearanceIds).toEqual([appearanceId]);
    expect(adapter.sourceFrameIds).toEqual(generatedCustomerFrameIds(appearanceId));
    const { frames, generated } = adapter.resolve(identityFor(appearanceId), fallback());
    expect(generated).toBe(true); expect(createCanvas).toHaveBeenCalledTimes(36);
    const scales = adapter.scalesFor(appearanceId)!;
    expect(scales).toBe(adapter.scales);
    for (const meta of pack.manifest.frames) {
      const frame = frameFor(frames, meta), art = fineSpriteArt(frame);
      const draw = recorded(art.canvas).draws[0];
      const id = generatedCustomerFrameId(appearanceId, meta.direction, meta.state)!;
      expect(draw.source).toBe(pack.sources[id]);
      expect(art.density).toBe(4);
      const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.args;
      expect([sx, sy, sw, sh]).toEqual([meta.bbox.x, meta.bbox.y, meta.bbox.w, meta.bbox.h]);
      const scale = meta.group === 'walk' ? scales.walking : scales.seated;
      expect(dw / sw).toBeCloseTo(scale * 4, 12); expect(dh / sh).toBeCloseTo(scale * 4, 12);
      expect(dx).toBeGreaterThanOrEqual(-1e-9); expect(dy).toBeGreaterThanOrEqual(-1e-9);
      expect(dx + dw).toBeLessThanOrEqual(frame.width * 4 + 1e-9);
      expect(dy + dh).toBeLessThanOrEqual(frame.height * 4 + 1e-9);
      const points = adapter.contactPoints(frame)!, offset = adapter.drawOffset(frame);
      if (meta.group === 'walk') {
        expect(points.foot).toEqual({ x: 9, y: 27 });
        expect(offset).toEqual({ x: 0, y: 0 });
      } else {
        const seatX = meta.direction === 'right' ? 7 : 11;
        expect(points.seatContact!.x + offset.x).toBeCloseTo(seatX, 12);
        expect(points.seatContact!.y + offset.y).toBeCloseTo(22, 12);
        // This validates exact contact transforms, not accuracy of estimated
        // source fingertips or a completed in-game visual/contact review.
        for (const key of ['foot', 'petContact'] as const) {
          if (!meta[key]) continue;
          expect(points[key]!.x + offset.x).toBeCloseTo(seatX + (meta[key]!.x - meta.seatContact!.x) * scale, 12);
          expect(points[key]!.y + offset.y).toBeCloseTo(22 + (meta[key]!.y - meta.seatContact!.y) * scale, 12);
        }
      }
      expect(Object.isFrozen(points)).toBe(true); expect(Object.isFrozen(points.foot)).toBe(true);
    }
    frames.left.forEach((frame, index) => {
      expect(recorded(fineSpriteArt(frame).canvas).draws[0].source).toBe(fineSpriteArt(frames.right[index]).canvas);
      expect(adapter.contactPoints(frame)!.foot).toEqual({ x: 9, y: 27 });
    });
  });

  it('keeps all results distinct, exact-Look eligible, immutable and bounded across repeated callers', () => {
    const { adapter, createCanvas } = castFixture();
    expect(adapter.readyAppearanceIds).toEqual(CUSTOMER_CAST.map(design => design.id));
    expect(adapter.sourceFrameIds).toEqual(GENERATED_CUSTOMER_FRAME_IDS);
    expect(createCanvas).toHaveBeenCalledTimes(30 * 36);
    const results = CUSTOMER_CAST.map(design => adapter.resolve(identityFor(design.id), fallback()));
    expect(new Set(results.map(result => result.frames.stand)).size).toBe(30);
    for (const design of CUSTOMER_CAST) {
      const identity = identityFor(design.id), old = fallback(), result = results[design.id];
      expect(generatedCustomerEligible(identity)).toBe(true);
      expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.frames)).toBe(true);
      for (const field of ['down', 'up', 'right', 'left', 'sitPetRight', 'sitPetLeft'] as const) expect(Object.isFrozen(result.frames[field])).toBe(true);
      for (let count = 0; count < 50; count++) expect(adapter.resolve(identity, fallback())).toBe(result);
      for (const key of ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const) {
        const custom = { ...identity, look: { ...identity.look, [key]: identity.look[key] + 1 } };
        expect(generatedCustomerEligible(custom)).toBe(false);
        expect(adapter.resolve(custom, old)).toEqual({ frames: old, generated: false });
      }
      for (const role of ['owner', 'barista', 'server', 'cook'] as const) {
        expect(generatedCustomerEligible({ ...identity, role })).toBe(false);
        expect(adapter.resolve({ ...identity, role }, old).frames).toBe(old);
      }
      const different = (design.id + 1) % CUSTOMER_CAST.length;
      expect(adapter.resolve({ ...identity, look: CUSTOMER_CAST[different].look }, old).frames).toBe(old);
    }
    for (const appearanceId of [undefined, -1, 30, 900, NaN, Infinity, 1.1]) {
      const old = fallback(), identity = { ...identityFor(0), appearanceId };
      expect(generatedCustomerEligible(identity)).toBe(false);
      expect(adapter.resolve(identity, old).frames).toBe(old);
      if (appearanceId !== undefined) expect(adapter.scalesFor(appearanceId)).toBeNull();
    }
    expect(createCanvas).toHaveBeenCalledTimes(30 * 36);
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.readyAppearanceIds)).toBe(true);
    expect(Object.isFrozen(adapter.sourceFrameIds)).toBe(true);
  });

  it.each(GENERATED_CUSTOMER_FRAME_IDS)('falls back for the entire identity when source %s is missing', missing => {
    const appearanceId = missing.startsWith('mina-') ? 0 : Number(missing.split('-')[1]);
    const pack = castPacks[appearanceId], sources = { ...pack.sources };
    delete sources[missing];
    const { adapter, createCanvas } = castFixture([pack.manifest], sources);
    const old = fallback();
    expect(adapter.ready).toBe(false); expect(adapter.readyAppearanceIds).toEqual([]);
    expect(adapter.sourceFrameIds).toEqual([]); expect(adapter.scalesFor(appearanceId)).toBeNull();
    expect(adapter.resolve(identityFor(appearanceId), old).frames).toBe(old);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('isolates an incomplete cast pack, keeps every other identity and exposes only baked sources for release', () => {
    const sources = { ...allSources };
    delete sources['customer-7-left-sitPetB'];
    const { adapter, createCanvas } = castFixture(allManifests, sources);
    expect(adapter.ready).toBe(true); expect(adapter.readyAppearanceIds).toHaveLength(29);
    expect(adapter.readyAppearanceIds).not.toContain(7);
    expect(adapter.sourceFrameIds).toHaveLength(29 * 15);
    expect(adapter.sourceFrameIds.some(id => id.startsWith('customer-7-'))).toBe(false);
    expect(createCanvas).toHaveBeenCalledTimes(29 * 36);
    for (const design of CUSTOMER_CAST) {
      const old = fallback(), result = adapter.resolve(identityFor(design.id), old);
      expect(result.generated).toBe(design.id !== 7);
      if (design.id === 7) expect(result.frames).toBe(old);
    }
  });

  it('rejects mismatched fixed-cast metadata and never substitutes a valid identity for a different ID', () => {
    const original = castPacks[12];
    const mutations: GeneratedCustomerManifest[] = [
      { ...original.manifest, identity: castPacks[13].manifest.identity },
      { ...original.manifest, appearanceId: 13 },
      { ...original.manifest, look: CUSTOMER_CAST[13].look },
      { ...original.manifest, hairstyle: 3 },
      { ...original.manifest, hairstyle: undefined },
      { ...original.manifest, outfit: 'hoodie' },
      { ...original.manifest, accessory: 'none' },
      { ...original.manifest, accent: '#000000' },
      { ...original.manifest, frames: original.manifest.frames.slice(1) },
      { ...original.manifest, frames: [original.manifest.frames[1], ...original.manifest.frames.slice(1)] },
    ];
    for (const manifest of mutations) {
      const { adapter, createCanvas } = castFixture([manifest], allSources), old = fallback();
      expect(adapter.ready).toBe(false); expect(createCanvas).not.toHaveBeenCalled();
      for (const appearanceId of [12, 13]) expect(adapter.resolve(identityFor(appearanceId), old).frames).toBe(old);
    }
  });

  it('rejects duplicate input packs only for that identity and ignores unrecognized IDs', () => {
    const bad = { ...castPacks[2].manifest, appearanceId: 99 };
    const { adapter, createCanvas } = castFixture([castPacks[0].manifest, castPacks[2].manifest, castPacks[2].manifest, bad]);
    expect(adapter.readyAppearanceIds).toEqual([0]);
    expect(adapter.sourceFrameIds).toEqual(generatedCustomerFrameIds(0));
    expect(createCanvas).toHaveBeenCalledTimes(36);
    expect(adapter.resolve(identityFor(2), fallback()).generated).toBe(false);
  });

  it('keeps world contacts and dimensions invariant under uniform source and metadata resampling', () => {
    const appearanceId = 21, original = castPacks[appearanceId];
    const factor = 0.25;
    const point = (value: { x: number; y: number }) => ({ x: value.x * factor, y: value.y * factor });
    const manifest: GeneratedCustomerManifest = { ...original.manifest, frames: original.manifest.frames.map(meta => ({ ...meta,
      bbox: { ...point(meta.bbox), w: meta.bbox.w * factor, h: meta.bbox.h * factor }, foot: point(meta.foot),
      ...(meta.seatContact ? { seatContact: point(meta.seatContact) } : {}),
      ...(meta.petContact ? { petContact: point(meta.petContact) } : {}), sourceToWorldScale: meta.sourceToWorldScale / factor,
    })) };
    const sources = Object.fromEntries(Object.entries(original.sources).map(([id, source]) => [id,
      fake((source as HTMLCanvasElement).width * factor, (source as HTMLCanvasElement).height * factor)]));
    const first = castFixture([original.manifest], original.sources).adapter;
    const second = castFixture([manifest], sources).adapter;
    const framesA = first.resolve(identityFor(appearanceId), fallback()).frames;
    const framesB = second.resolve(identityFor(appearanceId), fallback()).frames;
    expect(second.ready).toBe(true);
    expect(second.scales!.walking * factor).toBeCloseTo(first.scales!.walking, 12);
    expect(second.scales!.seated * factor).toBeCloseTo(first.scales!.seated, 12);
    for (const meta of original.manifest.frames) {
      const a = frameFor(framesA, meta), b = frameFor(framesB, meta);
      expect([b.width, b.height]).toEqual([a.width, a.height]);
      expect(second.contactPoints(b)).toEqual(first.contactPoints(a));
      expect(second.drawOffset(b)).toEqual(first.drawOffset(a));
    }
  });
});

describe('customer cache construction isolation', () => {
  it('does not publish partial contacts or retain another identity after a canvas failure', () => {
    const allocated: HTMLCanvasElement[] = [];
    let attempts = 0;
    const createCanvas = () => {
      attempts++;
      if (attempts === 12) throw new Error('source decode interrupted');
      const canvas = new RecordingCanvas() as unknown as HTMLCanvasElement;
      allocated.push(canvas);
      return canvas;
    };
    const adapter = createGeneratedCustomerArt([allManifests[0], allManifests[1]], allSources, { createCanvas });
    expect(adapter.readyAppearanceIds).toEqual([1]);
    const old = fallback();
    expect(adapter.resolve(identityFor(0), old).frames).toBe(old);
    expect(adapter.resolve(identityFor(1), old).generated).toBe(true);
    for (const partial of allocated.slice(0, 11)) {
      expect(adapter.contactPoints(partial)).toBeNull();
      expect(adapter.drawOffset(partial)).toEqual({ x: 0, y: 0 });
    }
    expect(adapter.sourceFrameIds).toEqual(generatedCustomerFrameIds(1));
  });

  it('bakes independent copies and does not retain mutable manifest or source-map state', () => {
    const manifest = structuredClone(allManifests[14]);
    const sources = { ...castPacks[14].sources };
    const { adapter } = castFixture([manifest], sources);
    const result = adapter.resolve(identityFor(14), fallback());
    const before = adapter.contactPoints(result.frames.sitPetRight[0]);
    const scale = adapter.scalesFor(14);
    Object.assign(manifest, { appearanceId: 3, identity: 'changed', look: CUSTOMER_CAST[3].look });
    Object.assign(manifest.frames[10].petContact!, { x: NaN, y: NaN });
    for (const id of generatedCustomerFrameIds(14)) delete sources[id];
    expect(adapter.resolve(identityFor(14), fallback())).toBe(result);
    expect(adapter.contactPoints(result.frames.sitPetRight[0])).toBe(before);
    expect(adapter.scalesFor(14)).toBe(scale);
    expect(adapter.resolve(identityFor(3), fallback()).generated).toBe(false);
  });

  it('isolates structurally malformed metadata without hiding a complete neighboring pack', () => {
    const malformed = { ...allManifests[1], frames: null } as unknown as GeneratedCustomerManifest;
    const { adapter } = castFixture([allManifests[0], malformed, allManifests[2]]);
    expect(adapter.readyAppearanceIds).toEqual([0, 2]);
    expect(adapter.resolve(identityFor(1), fallback()).generated).toBe(false);
  });
});
