import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { fineSpriteArt, logicalCrop } from './fine-sprite-art';
import { createGeneratedCustomerArt, GENERATED_CUSTOMER_FRAME_IDS, generatedCustomerEligible,
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
  for (const id of GENERATED_CUSTOMER_FRAME_IDS) {
    const bytes = readFileSync(new URL(`../../public/art/generated/customer-0-v1/${id}.png`, import.meta.url));
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

  it.each(GENERATED_CUSTOMER_FRAME_IDS)('keeps every legacy action when %s is missing', missing => {
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
