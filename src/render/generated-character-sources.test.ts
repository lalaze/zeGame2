// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from '../game/customer-cast';
import type { Look } from '../game/state';
import { closeModal } from '../ui/modal';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedCatArt, generatedCatFrameIds, type GeneratedCatFrameId, type GeneratedCatManifest } from './generated-cat-art';
import catManifestJson from './generated-cat-manifest.json';
import { releaseGeneratedCharacterSources } from './generated-character-sources';
import { createGeneratedCustomerArt, generatedCustomerFrameIds, type GeneratedCustomerFrameId, type GeneratedCustomerManifest } from './generated-customer-art';
import customerManifestJson from './generated-customer-manifest.json';
import { clearGeneratedMainAssets, GENERATED_MAIN_ASSETS, generatedMainKey, generatedMainSource, getGeneratedCatAdapter, getGeneratedCustomerAdapter,
  getGeneratedStaffAdapter, installGeneratedMainAsset, setGeneratedCatAdapter, setGeneratedCustomerAdapter, setGeneratedStaffAdapter, type GeneratedMainId } from './generated-main-art';
import { createGeneratedStaffArt, GENERATED_STAFF_FRAME_IDS, type GeneratedStaffFrameId, type GeneratedStaffManifest } from './generated-staff-art';
import staffManifestJson from './generated-staff-manifest.json';
import { catFrames, character, toDataURL } from './sprites';

const GENERATED_CAT_FRAME_IDS = generatedCatFrameIds('siamese');
const GENERATED_CUSTOMER_FRAME_IDS = generatedCustomerFrameIds(0);

// Synthetic pixels are copied when drawn. The mock deliberately does not retain
// the source image: after baking we poison it to catch any later dependency.
type Bitmap = HTMLCanvasElement & { rgbaSample: number[] };
vi.mock('./sprites', () => ({
  catFrames: () => {
    const frame = (height = 14) => {
      const c = document.createElement('canvas') as Bitmap;
      c.width = 18; c.height = height; c.rgbaSample = [6, 5, 4, 255];
      return c;
    };
    return { idle: frame(), swish: frame(), blink: frame(), happy: frame(), walk: [frame(), frame()], sleep: frame(),
      groom: [frame(), frame()], stretch: frame(), watch: frame(), lookUp: frame(18), nuzzle: [frame(18), frame(18)] };
  },
  character: () => {
    const stand = document.createElement('canvas') as Bitmap;
    stand.width = 18; stand.height = 28; stand.rgbaSample = [9, 8, 7, 255];
    return { stand, down: [stand], up: [stand], left: [stand], right: [stand],
      sitLeft: stand, sitRight: stand, sitPetLeft: [stand, stand], sitPetRight: [stand, stand] };
  },
  toDataURL: vi.fn((canvas: Bitmap) => `data:image/png;base64,${btoa(canvas.rgbaSample.join(','))}`),
}));

const ownerLook: Look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 };
const customerIdentity = { role: 'customer' as const, appearanceId: 0, look: CUSTOMER_CAST[0].look };
const sample = (canvas: HTMLCanvasElement) => (canvas as Bitmap).rgbaSample;

beforeEach(() => {
  clearGeneratedMainAssets(); vi.clearAllMocks();
  document.body.innerHTML = '<main></main><div id="modal-root"></div>';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: Bitmap) {
    const target = this;
    return {
      imageSmoothingEnabled: false, translate() {}, scale() {},
      drawImage(source: Bitmap) { target.rgbaSample = [...source.rgbaSample]; },
    } as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => { closeModal(); clearGeneratedMainAssets(); vi.restoreAllMocks(); });

function fixture(missing?: GeneratedStaffFrameId | GeneratedCustomerFrameId | GeneratedCatFrameId) {
  const staffManifest = staffManifestJson as GeneratedStaffManifest;
  const customerManifest = customerManifestJson as GeneratedCustomerManifest;
  const catManifest = catManifestJson as GeneratedCatManifest;
  const staffSources: Partial<Record<GeneratedStaffFrameId, CanvasImageSource>> = {};
  const customerSources: Partial<Record<GeneratedCustomerFrameId, CanvasImageSource>> = {};
  const catSources: Partial<Record<GeneratedCatFrameId, CanvasImageSource>> = {};
  const originals: Bitmap[] = [];
  let marker = 20;
  const source = (width: number, height: number) => {
    const image = document.createElement('canvas') as Bitmap;
    image.width = width; image.height = height; image.rgbaSample = [marker++, 31, 53, 255]; originals.push(image);
    return image;
  };
  for (const id of Object.keys(GENERATED_MAIN_ASSETS) as GeneratedMainId[]) installGeneratedMainAsset(id, source(2, 2));
  for (const meta of staffManifest.frames) {
    const id = `barista-${meta.direction}-${meta.state}` as GeneratedStaffFrameId;
    const image = source(meta.bbox.x + meta.bbox.w + 12, meta.bbox.y + meta.bbox.h + 12);
    installGeneratedMainAsset(id, image);
    if (id !== missing) staffSources[id] = image;
  }
  for (const meta of customerManifest.frames) {
    const id = `mina-${meta.direction}-${meta.state}` as GeneratedCustomerFrameId;
    const image = source(meta.bbox.x + meta.bbox.w + 10, meta.bbox.y + meta.bbox.h + 10);
    installGeneratedMainAsset(id, image);
    if (id !== missing) customerSources[id] = image;
  }
  for (const meta of catManifest.frames) {
    const id = `siamese-${meta.state}` as GeneratedCatFrameId;
    const image = source(meta.size[0], meta.size[1]);
    installGeneratedMainAsset(id, image);
    if (id !== missing) catSources[id] = image;
  }
  const staff = createGeneratedStaffArt(staffManifest, staffSources);
  const customer = createGeneratedCustomerArt(customerManifest, customerSources);
  const cat = createGeneratedCatArt(catManifest, catSources);
  setGeneratedStaffAdapter(staff); setGeneratedCustomerAdapter(customer); setGeneratedCatAdapter(cat);
  const keys = new Set<string>(Object.keys(GENERATED_MAIN_ASSETS).map(id => generatedMainKey(id as GeneratedMainId)));
  keys.add('canvas-live-staff'); keys.add('canvas-live-customer'); keys.add('canvas-live-cat');
  const textures = { exists: (key: string) => keys.has(key), remove: vi.fn((key: string) => { keys.delete(key); }) };
  return { staff, customer, cat, keys, textures, originals };
}

describe('release baked character source packs', () => {
  it('releases only the ready shared staff pack and remains idempotent', () => {
    const { staff, customer, keys, textures } = fixture();
    expect(staff.ready).toBe(true); expect(customer.ready).toBe(true);
    const table = generatedMainSource('table');
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: staff }, textures)).toBe(9);
    expect(textures.remove.mock.calls.map(([key]) => key)).toEqual(GENERATED_STAFF_FRAME_IDS.map(generatedMainKey));
    for (const id of GENERATED_STAFF_FRAME_IDS) { expect(generatedMainSource(id)).toBeUndefined(); expect(keys.has(generatedMainKey(id))).toBe(false); }
    for (const id of GENERATED_CUSTOMER_FRAME_IDS) { expect(generatedMainSource(id)).toBeDefined(); expect(keys.has(generatedMainKey(id))).toBe(true); }
    expect(generatedMainSource('table')).toBe(table);
    expect(keys.has('canvas-live-staff')).toBe(true); expect(keys.has('canvas-live-customer')).toBe(true);
    expect(getGeneratedStaffAdapter()).toBe(staff);
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: staff }, textures)).toBe(0);
    expect(textures.remove).toHaveBeenCalledTimes(9);
  });

  it('releases all fifteen customer sources without dropping the complete adapter or props', () => {
    const { staff, customer, textures, keys } = fixture();
    expect(releaseGeneratedCharacterSources({ kind: 'customer', adapter: customer }, textures)).toBe(15);
    for (const id of GENERATED_CUSTOMER_FRAME_IDS) expect(generatedMainSource(id)).toBeUndefined();
    expect(getGeneratedCustomerAdapter()).toBe(customer); expect(getGeneratedStaffAdapter()).toBe(staff);
    expect(keys.has(generatedMainKey('plant'))).toBe(true);
    expect(keys.has(generatedMainKey('barista-down-stand'))).toBe(true);
    expect(customer.resolve(customerIdentity, character(CUSTOMER_CAST[0].look, 'customer', 0)).generated).toBe(true);
  });

  it('releases exactly fourteen Siamese originals, retaining other packs and the ready shared adapter', () => {
    const { staff, customer, cat, textures, keys } = fixture();
    expect(cat.ready).toBe(true);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: cat }, textures)).toBe(14);
    expect(textures.remove.mock.calls.map(([key]) => key)).toEqual(GENERATED_CAT_FRAME_IDS.map(generatedMainKey));
    for (const id of GENERATED_CAT_FRAME_IDS) {
      expect(generatedMainSource(id)).toBeUndefined(); expect(keys.has(generatedMainKey(id))).toBe(false);
    }
    for (const id of [...GENERATED_STAFF_FRAME_IDS, ...GENERATED_CUSTOMER_FRAME_IDS, 'table'] as const) {
      expect(generatedMainSource(id)).toBeDefined(); expect(keys.has(generatedMainKey(id))).toBe(true);
    }
    for (const key of ['canvas-live-staff', 'canvas-live-customer', 'canvas-live-cat']) expect(keys.has(key)).toBe(true);
    expect(getGeneratedCatAdapter()).toBe(cat);
    expect(getGeneratedStaffAdapter()).toBe(staff); expect(getGeneratedCustomerAdapter()).toBe(customer);
    expect(cat.resolve('siamese', catFrames('siamese')).generated).toBe(true);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: cat }, textures)).toBe(0);
    expect(textures.remove).toHaveBeenCalledTimes(14);
  });

  it.each(['staff', 'customer', 'cat'] as const)('retains every source when the %s pack is incomplete', kind => {
    const { staff, customer, cat, textures, keys } = fixture(kind === 'staff' ? 'barista-up-stepB' : kind === 'customer' ? 'mina-left-sitPetB' : 'siamese-nuzzleB');
    const before = keys.size;
    const released = kind === 'staff' ? releaseGeneratedCharacterSources({ kind, adapter: staff }, textures)
      : kind === 'customer' ? releaseGeneratedCharacterSources({ kind, adapter: customer }, textures)
        : releaseGeneratedCharacterSources({ kind, adapter: cat }, textures);
    expect(released).toBe(0); expect(keys.size).toBe(before); expect(textures.remove).not.toHaveBeenCalled();
    for (const id of [...GENERATED_STAFF_FRAME_IDS, ...GENERATED_CUSTOMER_FRAME_IDS, ...GENERATED_CAT_FRAME_IDS]) expect(generatedMainSource(id)).toBeDefined();
  });

  it('requires publication and rejects an older ready adapter after a clear/reload', () => {
    const old = fixture();
    setGeneratedStaffAdapter(null); setGeneratedCatAdapter(null);
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: old.staff }, old.textures)).toBe(0);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: old.cat }, old.textures)).toBe(0);
    expect(old.textures.remove).not.toHaveBeenCalled();
    clearGeneratedMainAssets();
    const current = fixture();
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: old.staff }, current.textures)).toBe(0);
    expect(releaseGeneratedCharacterSources({ kind: 'customer', adapter: old.customer }, current.textures)).toBe(0);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: old.cat }, current.textures)).toBe(0);
    expect(current.textures.remove).not.toHaveBeenCalled();
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: current.staff }, current.textures)).toBe(9);
    expect(releaseGeneratedCharacterSources({ kind: 'customer', adapter: current.customer }, current.textures)).toBe(15);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: current.cat }, current.textures)).toBe(14);
  });

  it('allows clear/preload to install fresh source packs after successful release', () => {
    const first = fixture();
    releaseGeneratedCharacterSources({ kind: 'staff', adapter: first.staff }, first.textures);
    releaseGeneratedCharacterSources({ kind: 'customer', adapter: first.customer }, first.textures);
    releaseGeneratedCharacterSources({ kind: 'cat', adapter: first.cat }, first.textures);
    clearGeneratedMainAssets();
    expect(getGeneratedStaffAdapter()).toBeNull(); expect(getGeneratedCustomerAdapter()).toBeNull();
    expect(getGeneratedCatAdapter()).toBeNull();
    const next = fixture();
    for (const id of [...GENERATED_STAFF_FRAME_IDS, ...GENERATED_CUSTOMER_FRAME_IDS, ...GENERATED_CAT_FRAME_IDS]) expect(generatedMainSource(id)).toBeDefined();
    expect(next.staff.ready).toBe(true); expect(next.customer.ready).toBe(true); expect(next.cat.ready).toBe(true);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: first.cat }, next.textures)).toBe(0);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: next.cat }, next.textures)).toBe(14);
  });

  // The owner preview and the journal portrait draw the cast from character() since b377687, so
  // neither reads these packs any more; their copied frames must still survive the release.
  it('keeps copied final pixels and resolved frames usable without original images', () => {
    const { staff, customer, textures, originals } = fixture();
    const owner = staff.resolve({ role: 'owner', look: ownerLook }, character(ownerLook, 'owner')).frames;
    const mina = customer.resolve(customerIdentity, character(CUSTOMER_CAST[0].look, 'customer', 0)).frames;
    const ownerBacking = fineSpriteArt(owner.stand).canvas, minaBacking = fineSpriteArt(mina.stand).canvas;
    const ownerPixels = [...sample(ownerBacking)], minaPixels = [...sample(minaBacking)];
    releaseGeneratedCharacterSources({ kind: 'staff', adapter: staff }, textures);
    releaseGeneratedCharacterSources({ kind: 'customer', adapter: customer }, textures);
    // Source storage is now inaccessible, not just absent from the registry.
    for (const original of originals) Object.defineProperty(original, 'rgbaSample', { get() { throw new Error('released original was read'); } });
    expect(sample(ownerBacking)).toEqual(ownerPixels); expect(sample(minaBacking)).toEqual(minaPixels);
    expect(customer.resolve(customerIdentity, character(CUSTOMER_CAST[0].look, 'customer', 0)).frames).toBe(mina);
    expect(sample(fineSpriteArt(mina.sitPetRight[1]).canvas)).toBeDefined();
  });

  it('does not drop registry ownership if GPU destruction fails, allowing a retry', () => {
    const { staff, textures } = fixture();
    const first = generatedMainSource(GENERATED_STAFF_FRAME_IDS[0]);
    textures.remove.mockImplementationOnce(() => { throw new Error('texture destruction failed'); });
    expect(() => releaseGeneratedCharacterSources({ kind: 'staff', adapter: staff }, textures)).toThrow('texture destruction failed');
    expect(generatedMainSource(GENERATED_STAFF_FRAME_IDS[0])).toBe(first);
    expect(releaseGeneratedCharacterSources({ kind: 'staff', adapter: staff }, textures)).toBe(9);
  });

  it('keeps all fourteen copied cat canvases and contact points usable when originals become unreadable', () => {
    const { cat, textures, originals } = fixture(), old = catFrames('siamese');
    const result = cat.resolve('siamese', old);
    const frames = Object.values(result.frames).flat() as HTMLCanvasElement[];
    const before = frames.map(frame => ({ logical: [...sample(frame)], fine: [...sample(fineSpriteArt(frame).canvas)] }));
    expect(frames).toHaveLength(14);
    expect(releaseGeneratedCharacterSources({ kind: 'cat', adapter: cat }, textures)).toBe(14);
    for (const image of originals) Object.defineProperty(image, 'rgbaSample', { get() { throw new Error('released cat original was read'); } });
    expect(getGeneratedCatAdapter()).toBe(cat);
    expect(cat.resolve('siamese', old)).toBe(result);
    expect(cat.resolve('ginger', old)).toEqual({ frames: old, generated: false });
    frames.forEach((frame, i) => {
      const art = fineSpriteArt(frame);
      expect(sample(frame)).toEqual(before[i].logical); expect(sample(art.canvas)).toEqual(before[i].fine);
      expect([art.canvas.width, art.canvas.height]).toEqual([96, 72]);
      expect(cat.drawOffset(frame)).toEqual({ x: -3, y: 0 });
      expect(cat.contactPoints(frame, true)!.foot).toEqual({ x: 12, y: 17 });
      // UI serializes this independently owned backing, never a source image.
      expect(toDataURL(art.canvas, 1)).toMatch(/^data:image\/png;base64,/);
    });
  });
});
