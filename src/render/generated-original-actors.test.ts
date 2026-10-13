import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import runtime from '../../assets/generated/runtime-catalog-v1/runtime.json';
import catalog from '../../assets/generated/runtime-catalog-v1/catalog.json';
import archive from '../../assets/generated/original-main-actors-v1/manifest.json';
import staffOriginal from './generated-staff-manifest.json';
import customerOriginal from './generated-customer-manifest.json';
import catOriginal from './generated-cat-manifest.json';
import { GENERATED_MAIN_ASSETS } from './generated-main-art';
import { createGeneratedStaffArt, type GeneratedStaffManifest } from './generated-staff-art';
import { createGeneratedCustomerArt, type GeneratedCustomerFrameMeta, type GeneratedCustomerManifest } from './generated-customer-art';
import { createGeneratedCatArt, type GeneratedCatManifest, type GeneratedCatState } from './generated-cat-art';
import { fineSpriteArt } from './fine-sprite-art';
import type { CatFrames, CharacterFrames } from './sprites';

type Point = { x: number; y: number };
type Frame = { direction?: string; state: string; size: number[]; bbox: Point & { w: number; h: number };
  foot: Point; sourceToWorldScale: number; seatContact?: Point; petContact?: Point; headContact?: Point;
  productionContentSize?: number[] };
const families = [
  { name: 'staff', original: staffOriginal, packed: runtime.staffManifest, frameId: (frame: Frame) => `barista-${frame.direction}-${frame.state}` },
  { name: 'customer', original: customerOriginal, packed: runtime.customerManifests.find(manifest => manifest.appearanceId === 0)!, frameId: (frame: Frame) => `mina-${frame.direction}-${frame.state}` },
  { name: 'cat', original: catOriginal, packed: runtime.catManifests.find(manifest => manifest.breed === 'siamese')!, frameId: (frame: Frame) => `siamese-${frame.state}` },
] as const;
const bytes = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url));
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const size = (value: Buffer) => [value.readUInt32BE(16), value.readUInt32BE(20)];
const fake = (width = 18, height = 28) => ({ width, height }) as HTMLCanvasElement;
const sourcesFor = (family: typeof families[number], original = false) => Object.fromEntries(family.original.frames.map(frame => {
  const id = family.frameId(frame), file = original ? archive.images.find(row => row.key === id)!.file :
    `public/art/generated/${GENERATED_MAIN_ASSETS[id as keyof typeof GENERATED_MAIN_ASSETS]}`;
  const [width, height] = size(bytes(file)); return [id, fake(width, height)];
}));
class RecordingCanvas {
  width = 0; height = 0;
  draws: { source: CanvasImageSource; args: number[]; smoothing: boolean }[] = [];
  context = { imageSmoothingEnabled: true, translate: vi.fn(), scale: vi.fn(),
    drawImage: (source: CanvasImageSource, ...args: number[]) => this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled }) };
  getContext() { return this.context; }
}
const makeCanvas = () => new RecordingCanvas() as unknown as HTMLCanvasElement;
const draw = (frame: HTMLCanvasElement) => (fineSpriteArt(frame).canvas as unknown as RecordingCanvas).draws[0];
const fallback = (): CharacterFrames => {
  const down = [fake(), fake(), fake()];
  return { down, up: down, right: down, left: down, stand: down[0], sitRight: fake(), sitLeft: fake(),
    sitPetRight: [fake(), fake()], sitPetLeft: [fake(), fake()] };
};
const catFallback = (): CatFrames => ({ idle: fake(), swish: fake(), blink: fake(), happy: fake(), walk: [fake(), fake()],
  sleep: fake(), groom: [fake(), fake()], stretch: fake(), watch: fake(), lookUp: fake(), nuzzle: [fake(), fake()] });
function sameDraw(before: HTMLCanvasElement, after: HTMLCanvasElement) {
  expect([after.width, after.height]).toEqual([before.width, before.height]);
  const a = draw(before), b = draw(after); expect(b.smoothing).toBe(false);
  for (let index = 4; index < 8; index++) expect(b.args[index]).toBeCloseTo(a.args[index], 10);
  expect(b.args[6] / b.args[2]).toBeCloseTo(b.args[7] / b.args[3], 12);
  // The 192px identity budget never enlarges its resampled content into the 4x backing.
  expect(b.args[6] / b.args[2]).toBeLessThanOrEqual(1);
  expect(b.args[7] / b.args[3]).toBeLessThanOrEqual(1);
}
function samePoint(before: Point, after: Point) {
  expect(after.x).toBeCloseTo(before.x, 12); expect(after.y).toBeCloseTo(before.y, 12);
}
function customerFrame(frames: CharacterFrames, meta: GeneratedCustomerFrameMeta) {
  if (meta.state === 'sit') return meta.direction === 'right' ? frames.sitRight : frames.sitLeft;
  if (meta.state === 'sitPetA' || meta.state === 'sitPetB') return (meta.direction === 'right' ? frames.sitPetRight : frames.sitPetLeft)[meta.state === 'sitPetA' ? 0 : 1];
  return frames[meta.direction][['stand', 'stepA', 'stepB'].indexOf(meta.state)];
}
function catFrame(frames: CatFrames, state: GeneratedCatState) {
  if (state === 'walkA' || state === 'walkB') return frames.walk[state === 'walkA' ? 0 : 1];
  if (state === 'groomA' || state === 'groomB') return frames.groom[state === 'groomA' ? 0 : 1];
  if (state === 'nuzzleA' || state === 'nuzzleB') return frames.nuzzle[state === 'nuzzleA' ? 0 : 1];
  return frames[state];
}

describe('archived original actors and 192px production metadata', () => {
  it('keeps all 38 original crop hashes and all authoring manifests unchanged, with unique packed URLs', () => {
    expect(archive.images).toHaveLength(38);
    expect(new Set(archive.images.map(row => row.key)).size).toBe(38);
    for (const row of archive.images) {
      const original = bytes(row.file); expect(hash(original)).toBe(row.sha256); expect(original.length).toBe(row.bytes);
      expect([...original.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); expect(original[25]).toBe(6);
      const exported = catalog.images.find(image => image.key === row.key)!;
      expect(exported.source).toBe(row.file); expect(exported.sourceSha256).toBe(row.sha256);
      expect(hash(bytes(exported.file))).toBe(exported.sha256);
      expect(`public/art/generated/${GENERATED_MAIN_ASSETS[row.key as keyof typeof GENERATED_MAIN_ASSETS]}`).toBe(exported.file);
      expect(exported.file).not.toBe(row.previousPublicFile);
    }
    for (const row of archive.manifests) expect(hash(bytes(row.file))).toBe(row.sha256);
    expect(runtime.customerManifests.filter(manifest => manifest.appearanceId === 0)).toHaveLength(1);
    expect(runtime.catManifests.filter(manifest => manifest.breed === 'siamese')).toHaveLength(1);
    expect(runtime.customerManifests).toHaveLength(30); expect(runtime.catManifests).toHaveLength(12);
  });

  it.each(families)('uses one uniform 192px export for every $name pose and inverse calibration', family => {
    const factor = 192 / Math.max(...family.original.frames.flatMap(frame => frame.size));
    const packedFrames = family.packed.frames as Frame[];
    expect(packedFrames).toHaveLength(family.original.frames.length);
    for (const original of family.original.frames as Frame[]) {
      const packed = packedFrames.find(frame => family.frameId(frame) === family.frameId(original))!;
      const id = family.frameId(original), row = catalog.images.find(image => image.key === id)!;
      expect(row.scale).toBe(factor); expect(packed.size).toEqual(original.size.map(n => Math.ceil(n * factor)));
      expect(size(bytes(row.file))).toEqual(packed.size);
      expect(packed.productionContentSize).toEqual(original.size.map(n => n * factor));
      expect(packed.sourceToWorldScale * factor).toBeCloseTo(original.sourceToWorldScale, 12);
      for (const field of ['bbox', 'foot', 'seatContact', 'petContact', 'headContact'] as const) {
        if (!original[field]) continue;
        for (const [key, value] of Object.entries(original[field]!))
          expect((packed[field] as unknown as Record<string, number>)[key]).toBeCloseTo(value * factor, 12);
      }
      for (let axis = 0; axis < 2; axis++) {
        expect(packed.size[axis] - packed.productionContentSize![axis]).toBeGreaterThanOrEqual(0);
        expect(packed.size[axis] - packed.productionContentSize![axis]).toBeLessThan(1);
      }
    }
  });

  it('preserves all owner pose destinations, fixed foot, mirrors and exact-look eligibility', () => {
    const family = families[0], old = createGeneratedStaffArt(staffOriginal as GeneratedStaffManifest, sourcesFor(family, true), { createCanvas: makeCanvas });
    const packed = createGeneratedStaffArt(runtime.staffManifest as GeneratedStaffManifest, sourcesFor(family), { createCanvas: makeCanvas });
    const identity = { role: 'owner' as const, look: staffOriginal.look };
    expect(old.ready && packed.ready).toBe(true);
    const a = old.resolve(identity, fallback()).frames, b = packed.resolve(identity, fallback()).frames;
    for (const facing of ['down', 'up', 'right'] as const) for (let pose = 0; pose < 3; pose++) {
      sameDraw(a[facing][pose], b[facing][pose]);
      const meta = runtime.staffManifest.frames.find(frame => frame.direction === facing && frame.state === ['stand', 'stepA', 'stepB'][pose])!;
      const d = draw(b[facing][pose]).args;
      expect(d[4] + (meta.foot.x - d[0]) * d[6] / d[2]).toBeCloseTo(36, 12);
      expect(d[5] + (meta.foot.y - d[1]) * d[7] / d[3]).toBeCloseTo(108, 12);
    }
    for (let pose = 0; pose < 3; pose++) expect(draw(b.left[pose]).source).toBe(fineSpriteArt(b.right[pose]).canvas);
    expect(packed.resolve({ ...identity, look: { ...identity.look, hair: 1 } }, fallback()).generated).toBe(false);
    expect(packed.resolve({ role: 'barista', look: identity.look }, fallback()).generated).toBe(false);
  });

  it('preserves all fifteen Mina walking/seated/petting destinations and contacts', () => {
    const family = families[1], original = customerOriginal as GeneratedCustomerManifest, metadata = family.packed as GeneratedCustomerManifest;
    const old = createGeneratedCustomerArt(original, sourcesFor(family, true), { createCanvas: makeCanvas });
    const packed = createGeneratedCustomerArt(metadata, sourcesFor(family), { createCanvas: makeCanvas });
    const identity = { role: 'customer' as const, appearanceId: 0, look: customerOriginal.look };
    expect(old.ready && packed.ready).toBe(true);
    const a = old.resolve(identity, fallback()).frames, b = packed.resolve(identity, fallback()).frames;
    for (const meta of original.frames) {
      const before = customerFrame(a, meta), after = customerFrame(b, meta); sameDraw(before, after);
      expect(packed.drawOffset(after)).toEqual(old.drawOffset(before));
      const p = old.contactPoints(before)!, q = packed.contactPoints(after)!;
      for (const field of ['foot', 'seatContact', 'petContact'] as const) if (p[field]) samePoint(p[field]!, q[field]!);
    }
    expect(packed.resolve({ ...identity, appearanceId: 1 }, fallback()).generated).toBe(false);
  });

  it('preserves every complete Siamese image, head contact and mirrored foot without ceil-padding growth', () => {
    const family = families[2], metadata = family.packed as GeneratedCatManifest;
    const old = createGeneratedCatArt(catOriginal as GeneratedCatManifest, sourcesFor(family, true), { createCanvas: makeCanvas });
    const packed = createGeneratedCatArt(metadata, sourcesFor(family), { createCanvas: makeCanvas });
    expect(packed.errors).toEqual([]); expect(packed.readyBreeds).toEqual(['siamese']);
    const a = old.resolve('siamese', catFallback()).frames, b = packed.resolve('siamese', catFallback()).frames;
    for (const meta of metadata.frames) {
      const before = catFrame(a, meta.state), after = catFrame(b, meta.state); sameDraw(before, after);
      expect(draw(after).args.slice(0, 4)).toEqual([0, 0, ...meta.productionContentSize!]);
      expect(packed.drawOffset(after)).toEqual(old.drawOffset(before));
      for (const flip of [false, true]) {
        const p = old.contactPoints(before, flip)!, q = packed.contactPoints(after, flip)!;
        samePoint(p.foot, q.foot); samePoint(p.headContact, q.headContact);
      }
    }
  });

  it.each(archive.images.map(row => row.key))('rejects the whole packed identity when %s is missing', missing => {
    const family = families.find(entry => entry.original.frames.some(frame => entry.frameId(frame) === missing))!;
    const sources = sourcesFor(family); delete sources[missing]; const createCanvas = vi.fn(makeCanvas);
    const adapter = family.name === 'staff' ? createGeneratedStaffArt(family.packed as GeneratedStaffManifest, sources, { createCanvas }) :
      family.name === 'customer' ? createGeneratedCustomerArt(family.packed as GeneratedCustomerManifest, sources, { createCanvas }) :
        createGeneratedCatArt(family.packed as GeneratedCatManifest, sources, { createCanvas });
    expect(adapter.ready).toBe(false); expect(createCanvas).not.toHaveBeenCalled();
  });
});

type NativeCanvas = { createCanvas(width: number, height: number): HTMLCanvasElement; loadImage(bytes: Buffer): Promise<HTMLImageElement> };
let native: NativeCanvas | undefined;
try { native = createRequire(import.meta.url)('@napi-rs/canvas') as NativeCanvas; } catch { /* Native authoring tool is optional in normal installs. */ }
describe.skipIf(!native)('original actors real-PNG export verification', () => {
  it('reproduces every complete PNG from its archived crop with the exact nearest Canvas transform', async () => {
    for (const entry of archive.images) {
      const row = catalog.images.find(image => image.key === entry.key)!;
      const source = await native!.loadImage(bytes(entry.file)), actual = await native!.loadImage(bytes(row.file));
      const expected = native!.createCanvas(row.size[0], row.size[1]), ctx = expected.getContext('2d')!;
      ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0, source.width * row.scale, source.height * row.scale);
      const decoded = native!.createCanvas(row.size[0], row.size[1]), out = decoded.getContext('2d')!; out.drawImage(actual, 0, 0);
      const a = ctx.getImageData(0, 0, expected.width, expected.height).data, b = out.getImageData(0, 0, decoded.width, decoded.height).data;
      expect(Buffer.from(b).equals(Buffer.from(a)), entry.key).toBe(true);
      let transparent = false, faint = false, visible = false;
      for (let index = 3; index < b.length; index += 4) { transparent ||= b[index] === 0; faint ||= b[index] > 0 && b[index] < 128; visible ||= b[index] > 128; }
      expect({ transparent, faint, visible }, entry.key).toEqual({ transparent: true, faint: true, visible: true });
    }
  });

  it('synchronously bakes all 38 real packed images into ready complete identities', async () => {
    for (const family of families) {
      const sources: Record<string, CanvasImageSource> = {};
      for (const frame of family.original.frames) {
        const id = family.frameId(frame); sources[id] = await native!.loadImage(bytes(catalog.images.find(image => image.key === id)!.file));
      }
      const createCanvas = () => native!.createCanvas(1, 1);
      const adapter = family.name === 'staff' ? createGeneratedStaffArt(family.packed as GeneratedStaffManifest, sources, { createCanvas }) :
        family.name === 'customer' ? createGeneratedCustomerArt(family.packed as GeneratedCustomerManifest, sources, { createCanvas }) :
          createGeneratedCatArt(family.packed as GeneratedCatManifest, sources, { createCanvas });
      expect(adapter.ready, family.name).toBe(true);
      expect(adapter).not.toBeInstanceOf(Promise);
    }
  });
});
