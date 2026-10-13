import { describe, expect, it, vi } from 'vitest';
import type { Look } from '../game/state';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedStaffArt, generatedStaffEligible, GENERATED_STAFF_DENSITY, GENERATED_STAFF_FOOT,
  GENERATED_STAFF_FRAME_IDS, type GeneratedStaffFrameId, type GeneratedStaffFrameMeta,
  type GeneratedStaffIdentity, type GeneratedStaffManifest, type GeneratedStaffSources } from './generated-staff-art';
import type { CharacterFrames } from './sprites';

const look: Look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
const owner: GeneratedStaffIdentity = { role: 'owner', look };
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

function fixture() {
  // Actual independent PNG body sizes from cafe-character-v1/renderer-manifest.
  const sizes = [[145, 378], [151, 383], [153, 378], [143, 361], [156, 370], [159, 361], [167, 378], [213, 372], [170, 378]];
  const sources: Partial<Record<GeneratedStaffFrameId, CanvasImageSource>> = {};
  const frames: GeneratedStaffFrameMeta[] = GENERATED_STAFF_FRAME_IDS.map((id, i) => {
    const [, direction, state] = id.split('-') as ['barista', GeneratedStaffFrameMeta['direction'], GeneratedStaffFrameMeta['state']];
    const [w, h] = sizes[i];
    sources[id] = fake(w + 24, h + 24);
    return { direction, state, bbox: { x: 12, y: 12, w, h }, foot: { x: (w + 24) / 2, y: h + 11 } };
  });
  const manifest: GeneratedStaffManifest = { identity: 'barista-default', frames };
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => {
    const canvas = new RecordingCanvas(); canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });
  const create = (input: GeneratedStaffSources = sources, metadata = manifest) => createGeneratedStaffArt(metadata, input, { createCanvas });
  return { sources, manifest, frames, canvases, createCanvas, create };
}

describe('generated default staff adapter', () => {
  it('builds a complete 18×28 set with 4× backing, shared scale and a fixed foot', () => {
    const { create, frames, sources } = fixture();
    const adapter = create();
    expect(adapter.ready).toBe(true);
    expect(adapter.sourceScale).toBeCloseTo(26 / 382, 12);
    const result = adapter.resolve(owner, fallback());
    expect(result.generated).toBe(true);
    expect(result.frames.stand).toBe(result.frames.down[0]);
    for (const facing of ['down', 'up', 'right', 'left'] as const) for (const frame of result.frames[facing]) {
      expect([frame.width, frame.height]).toEqual([18, 28]);
      const art = fineSpriteArt(frame);
      expect(art.density).toBe(GENERATED_STAFF_DENSITY);
      expect([art.canvas.width, art.canvas.height]).toEqual([72, 112]);
      expect(recorded(frame).draws[0].source).toBe(art.canvas);
    }
    for (let i = 0; i < frames.length; i++) {
      const meta = frames[i], id = GENERATED_STAFF_FRAME_IDS[i];
      const frame = result.frames[meta.direction][i % 3];
      const draw = recorded(fineSpriteArt(frame).canvas).draws[0];
      const [sx, sy, sw, sh, dx, dy, dw, dh] = draw.args;
      expect(draw.source).toBe(sources[id]);
      expect(draw.smoothing).toBe(false);
      expect([sx, sy, sw, sh]).toEqual([meta.bbox.x, meta.bbox.y, meta.bbox.w, meta.bbox.h]);
      expect(dw / sw).toBeCloseTo(adapter.sourceScale! * 4, 12);
      expect(dh / sh).toBeCloseTo(adapter.sourceScale! * 4, 12);
      expect(dx + (meta.foot.x - sx) * dw / sw).toBeCloseTo(GENERATED_STAFF_FOOT.x * 4, 12);
      expect(dy + (meta.foot.y - sy) * dh / sh).toBeCloseTo(GENERATED_STAFF_FOOT.y * 4, 12);
      expect(dx).toBeGreaterThanOrEqual(0);
      expect(dy).toBeGreaterThanOrEqual(0);
      expect(dx + dw).toBeLessThanOrEqual(72);
      expect(dy + dh).toBeLessThanOrEqual(112);
    }
  });

  it('uses distinct real gait sources and mirrors only the right-facing set', () => {
    const { create, sources } = fixture();
    const { frames } = create().resolve(owner, fallback());
    for (const facing of ['down', 'up', 'right'] as const) {
      expect(new Set(frames[facing]).size).toBe(3);
      expect(frames[facing].map(frame => recorded(fineSpriteArt(frame).canvas).draws[0].source))
        .toEqual(['stand', 'stepA', 'stepB'].map(state => sources[`barista-${facing}-${state}` as GeneratedStaffFrameId]));
    }
    frames.left.forEach((frame, i) => {
      const art = recorded(fineSpriteArt(frame).canvas);
      expect(art.context.translate).toHaveBeenCalledWith(72, 0);
      expect(art.context.scale).toHaveBeenCalledWith(-1, 1);
      expect(art.draws[0].source).toBe(fineSpriteArt(frames.right[i]).canvas);
      expect(art.draws[0].smoothing).toBe(false);
    });
  });

  it.each(GENERATED_STAFF_FRAME_IDS)('falls back as one whole set when %s is absent', missing => {
    const { create, sources, createCanvas } = fixture();
    delete sources[missing];
    const adapter = create(), old = fallback();
    expect(adapter.ready).toBe(false);
    expect(adapter.resolve(owner, old)).toEqual({ generated: false, frames: old });
    expect(adapter.resolve(owner, old).frames).toBe(old);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('requires all-zero owner or explicitly opted-in all-zero base barista', () => {
    const { create } = fixture();
    const adapter = create(), old = fallback();
    expect(adapter.resolve(owner, old).generated).toBe(true);
    expect(adapter.resolve({ role: 'barista', look, baseBarista: true }, old).generated).toBe(true);
    for (const role of ['barista', 'customer', 'server', 'cook'] as const) {
      expect(adapter.resolve({ role, look }, old).frames).toBe(old);
      if (role !== 'barista') expect(adapter.resolve({ role, look, baseBarista: true }, old).generated).toBe(false);
    }
    for (const key of ['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const) {
      const customized = { ...look, [key]: 1 };
      expect(adapter.resolve({ role: 'owner', look: customized }, old).frames).toBe(old);
      expect(adapter.resolve({ role: 'barista', look: customized, baseBarista: true }, old).frames).toBe(old);
    }
    expect(generatedStaffEligible({ role: 'owner', look: { ...look, hair: NaN } })).toBe(false);
  });

  it('preserves fallback seated/petting fields and never mutates old walking frames', () => {
    const { create } = fixture();
    const old = fallback(), originalDown = [...old.down];
    const { frames } = create().resolve(owner, old);
    for (const key of ['sitLeft', 'sitRight', 'sitPetLeft', 'sitPetRight'] as const) expect(frames[key]).toBe(old[key]);
    expect(old.down).toEqual(originalDown);
    expect(frames.down).not.toBe(old.down);
  });

  it('uses a bounded assembly cache and never rebakes on repeated resolve', () => {
    const { create, createCanvas } = fixture();
    const adapter = create(), first = fallback();
    const result = adapter.resolve(owner, first);
    expect(adapter.resolve(owner, first)).toBe(result);
    expect(createCanvas).toHaveBeenCalledTimes(24);
    for (let i = 0; i < 30; i++) expect(adapter.resolve(owner, fallback()).frames.down).toBe(result.frames.down);
    expect(createCanvas).toHaveBeenCalledTimes(24);
    const restored = adapter.resolve(owner, first);
    expect(restored).not.toBe(result); // original assembly was evicted
    expect(restored.frames.down).toBe(result.frames.down); // bitmaps remain shared
  });

  it('rejects duplicate metadata, foreign identity, unloaded images and out-of-bounds source geometry', () => {
    const { create, manifest, frames, sources, createCanvas } = fixture();
    const replaced = (first: GeneratedStaffFrameMeta) => ({ ...manifest, frames: [first, ...frames.slice(1)] });
    expect(create(sources, replaced(frames[1])).ready).toBe(false);
    expect(create(sources, { ...manifest, identity: 'customer-red-cardigan' }).ready).toBe(false);
    expect(create(sources, replaced({ ...frames[0], bbox: { ...frames[0].bbox, x: -1 } })).ready).toBe(false);
    expect(create(sources, replaced({ ...frames[0], foot: { x: 1000, y: 389 } })).ready).toBe(false);
    sources['barista-down-stand'] = { width: 169, height: 402, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(create().ready).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it('allows one explicit safe scale, rejecting scales that would clip a pose', () => {
    const { manifest, sources, createCanvas } = fixture();
    const safe = createGeneratedStaffArt(manifest, sources, { sourceScale: 0.06, createCanvas });
    expect(safe.ready).toBe(true);
    expect(safe.sourceScale).toBe(0.06);
    for (const sourceScale of [28 / 378, 1, 0, -1, NaN]) {
      expect(createGeneratedStaffArt(manifest, sources, { sourceScale, createCanvas }).ready).toBe(false);
    }
  });

  it('returns the exact old set if canvas creation fails', () => {
    const { manifest, sources } = fixture();
    const adapter = createGeneratedStaffArt(manifest, sources, { createCanvas: () => { throw new Error('unavailable'); } });
    const old = fallback();
    expect(adapter.ready).toBe(false);
    expect(adapter.resolve(owner, old).frames).toBe(old);
  });
});
