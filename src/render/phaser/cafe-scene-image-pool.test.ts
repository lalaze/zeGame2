import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_SCENE_H, seatSpot, setSceneHeight, tablePos } from '../../game/layout';
import { projectMainWorld } from '../main-pixel-presentation';
import { fineSpriteArt, registerFineSpriteArt } from '../fine-sprite-art';
import { character, CHAR_H } from '../sprites';

// The renderer is outside this unit boundary. Keep the actual CafeScene.image,
// texture registration, fine-art metadata and seated drawTable path in use.
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { CafeScene } from './cafe-scene';

class CanvasStub {
  width = 0;
  height = 0;
  private context = {
    fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect() {}, drawImage() {}, translate() {}, scale() {}, save() {}, restore() {},
  };
  getContext() { return this.context; }
}

const canvas = (width: number, height: number): HTMLCanvasElement =>
  Object.assign(new CanvasStub(), { width, height }) as unknown as HTMLCanvasElement;

function manager() {
  const uploaded = new Map<string, HTMLCanvasElement>();
  const addCanvas = vi.fn((key: string, source: HTMLCanvasElement) => uploaded.set(key, source));
  return { uploaded, addCanvas, exists: (key: string) => uploaded.has(key) };
}
type TextureManagerStub = ReturnType<typeof manager>;
type Crop = { x: number; y: number; width: number; height: number };

/** Setters deliberately retain unrelated state, so reuse must reset it explicitly. */
class ImageStub {
  key = '';
  scaleX = 1;
  scaleY = 1;
  x = 0;
  y = 0;
  depth = 0;
  alpha = 1;
  flipX = false;
  isCropped = false;
  crop: Crop | undefined;

  constructor(private textures: TextureManagerStub) {}
  setTexture(key: string) {
    if (!this.textures.exists(key)) throw new Error(`Texture missing from this manager: ${key}`);
    this.key = key;
    return this;
  }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setDepth(depth: number) { this.depth = depth; return this; }
  setAlpha(alpha: number) { this.alpha = alpha; return this; }
  setFlipX(flipX: boolean) { this.flipX = flipX; return this; }
  setCrop = vi.fn((x?: number, y?: number, width?: number, height?: number) => {
    this.isCropped = x !== undefined;
    this.crop = x === undefined ? undefined : { x, y: y!, width: width!, height: height! };
    return this;
  });
  get displayWidth() { return this.textures.uploaded.get(this.key)!.width * this.scaleX; }
  get displayHeight() { return this.textures.uploaded.get(this.key)!.height * this.scaleY; }
}

interface SceneHarness {
  image(source: HTMLCanvasElement | string, x: number, y: number, depth: number): ImageStub;
  drawTable(index: number, time: number, depth: number): void;
  sim: { customers: object[]; seats: (number | null)[] };
}

function harness(reuseOneImage = true) {
  const textures = manager();
  const images: ImageStub[] = [];
  const next = vi.fn(() => {
    if (reuseOneImage && images.length) return images[0];
    const image = new ImageStub(textures);
    images.push(image);
    return image;
  });
  // Avoid create()/browser boot, but do not replace image() or drawTable().
  const scene = Object.create(CafeScene.prototype) as SceneHarness;
  Object.assign(scene, {
    textures, images: { next },
    view: { paused: true, livingCats: { actors: new Map() } },
    motionPreference: { matches: true },
    sim: { customers: [], seats: [] },
    shadow: vi.fn(),
  });
  return { scene, textures, images, next };
}

beforeEach(() => {
  setSceneHeight(MIN_SCENE_H);
  vi.stubGlobal('document', { createElement: () => new CanvasStub() });
});
afterEach(() => { vi.unstubAllGlobals(); setSceneHeight(MIN_SCENE_H); });

describe('actual CafeScene image dispatch with pooled image objects', () => {
  it('resets scale, flip, alpha and crop across fine, ordinary and named textures', () => {
    const { scene, textures, images, next } = harness();
    const original = canvas(18, 26), fine = canvas(36, 52), ordinary = canvas(12, 10);
    registerFineSpriteArt(original, fine);
    textures.uploaded.set('named-effect', canvas(7, 7));
    let reused: ImageStub | undefined;
    for (const [source, density, width, height] of [
      [original, 2, 18, 26], [ordinary, 1, 12, 10], ['named-effect', 1, 7, 7], [original, 2, 18, 26],
    ] as const) {
      if (reused) reused.setScale(3, 4).setFlipX(true).setAlpha(0.2).setCrop(1, 2, 3, 4);
      const image = scene.image(source, 10.26, 20.24, 1234);
      if (reused) expect(image).toBe(reused);
      expect(image).toMatchObject({ scaleX: 1 / density, scaleY: 1 / density,
        x: 10.5, y: 20, depth: 1234, alpha: 1, flipX: false, isCropped: false });
      expect(image.crop).toBeUndefined();
      expect([image.displayWidth, image.displayHeight]).toEqual([width, height]);
      reused = image;
    }
    expect(images).toHaveLength(1);
    expect(next).toHaveBeenCalledTimes(4);
    expect(reused!.setCrop.mock.calls.filter(args => args.length === 0)).toHaveLength(3);
    expect(textures.addCanvas).toHaveBeenCalledTimes(2);
    expect([...textures.uploaded.values()]).toContain(fine);
    expect([...textures.uploaded.values()]).not.toContain(original);
  });

  it('reuses the fine backing texture within a scene and uploads it independently in another', () => {
    const original = canvas(18, 28), backing = canvas(36, 56);
    registerFineSpriteArt(original, backing);
    const a = harness(), b = harness();
    const keyA = a.scene.image(original, 0, 0, 1).key;
    const keyB = b.scene.image(original, 0, 0, 1).key;
    expect(keyA).not.toBe(keyB);
    for (const [h, key] of [[a, keyA], [b, keyB]] as const) {
      for (let frame = 0; frame < 30; frame++) {
        const image = h.scene.image(original, frame, frame, 1);
        expect(image.key).toBe(key);
        expect(image.scaleX).toBe(0.5);
      }
      expect(h.textures.addCanvas).toHaveBeenCalledExactlyOnceWith(key, backing);
      expect(h.textures.uploaded.get(key)).toBe(backing);
    }
    expect(a.textures.exists(keyB)).toBe(false);
    expect(b.textures.exists(keyA)).toBe(false);
  });

  it('re-registers a removed fine texture without changing the source or its logical size', () => {
    const { scene, textures } = harness();
    const original = canvas(18, 26), backing = canvas(36, 52);
    registerFineSpriteArt(original, backing);
    const oldKey = scene.image(original, 0, 0, 1).key;
    textures.uploaded.delete(oldKey);
    const image = scene.image(original, 0, 0, 1);
    expect(image.key).not.toBe(oldKey);
    expect(textures.uploaded.get(image.key)).toBe(backing);
    expect(textures.addCanvas).toHaveBeenCalledTimes(2);
    expect([image.displayWidth, image.displayHeight]).toEqual([18, 26]);
    expect([original.width, original.height]).toEqual([18, 26]);
  });

  it.each([0, 1] as const)('draws seated side %i with a physical-pixel crop at the same foot anchor', side => {
    const { scene, images, textures } = harness(false);
    const look = { skin: 0, hair: 1, hairStyle: 0, shirt: 0, pants: 0 };
    const customer = { id: 7, seat: side, phase: 'sitting', look, ...seatSpot(0, side) };
    scene.sim.customers = [customer];
    scene.sim.seats = side === 0 ? [7, null] : [null, 7];
    scene.drawTable(0, 0, 1174);

    const frames = character(look, 'customer');
    const original = side === 0 ? frames.sitRight : frames.sitLeft;
    const art = fineSpriteArt(original);
    const layers = images.filter(image => textures.uploaded.get(image.key) === art.canvas);
    expect(layers).toHaveLength(2);
    const [whole, cropped] = layers;
    expect(whole.isCropped).toBe(false);
    expect(cropped.setCrop).toHaveBeenCalledExactlyOnceWith(0, 0, 36, (CHAR_H - 8) * 2);
    expect(cropped.crop).toEqual({ x: 0, y: 0, width: 36, height: 40 });
    expect(cropped.scaleX).toBe(0.5);
    expect(cropped.scaleY).toBe(0.5);
    expect([cropped.x, cropped.y]).toEqual([whole.x, whole.y]);
    const table = tablePos(0), paintedTable = projectMainWorld(table);
    expect(cropped.x).toBe(Math.round((paintedTable.x + (side === 0 ? -15 : 15) - 9) * 2) / 2);
    expect(cropped.y).toBe(customer.y - (CHAR_H + 5));
    expect([original.width, original.height]).toEqual([18, 26]);
  });
});
