import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from '../../game/customer-cast';
import { MIN_SCENE_H, seatApproach, seatSpot, setSceneHeight } from '../../game/layout';
import type { LivingCatActor } from '../../game/living-cats';
import type { Customer } from '../../game/sim';
import { createInitialState } from '../../game/state';
import { fineSpriteArt } from '../fine-sprite-art';
import { createGeneratedCustomerArt, type GeneratedCustomerManifest } from '../generated-customer-art';
import manifestJson from '../generated-customer-manifest.json';
import { createGeneratedCatArt, type GeneratedCatManifest } from '../generated-cat-art';
import catManifestJson from '../generated-cat-manifest.json';
import { residentCatFlipX } from '../living-cat-pose';
import { projectMainWorld } from '../main-pixel-presentation';
import { catFrames } from '../sprites';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { CafeScene } from './cafe-scene';

class CanvasStub {
  width = 0; height = 0;
  context = { fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect() {}, drawImage() {}, translate() {}, scale() {}, save() {}, restore() {} };
  getContext() { return this.context; }
}
class ImageStub {
  key = ''; x = 0; y = 0; depth = 0; scaleX = 1; scaleY = 1;
  flipX = false; isCropped = false; crop: number[] | null = null;
  setTexture(value: string) { this.key = value; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setDepth(value: number) { this.depth = value; return this; }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setAlpha() { return this; }
  setFlipX(value: boolean) { this.flipX = value; return this; }
  setCrop(...args: number[]) { this.isCropped = args.length > 0; this.crop = args.length ? args : null; return this; }
}
type Pose = { sprite: HTMLCanvasElement; x: number; y: number };
type HarnessScene = {
  drawResidents(state: ReturnType<typeof createInitialState>): void;
  drawTable(index: number, time: number, depth: number): void;
  residentPaintPoint(cat: LivingCatActor, state: ReturnType<typeof createInitialState>): { x: number; y: number };
  seatedCustomerPose(index: number, side: 0 | 1, customer: Customer, time: number, pair?: LivingCatActor): Pose;
};

function harness(side: 0 | 1, elapsed = 0, quiet = false, paused = false, generatedCat = false) {
  const state = createInitialState(0);
  state.pets = [{ id: 'siamese', careSeconds: 100, autoRefill: true }];
  const customer = { id: 1, appearanceId: 0, look: { ...CUSTOMER_CAST[0].look }, seat: side,
    phase: 'sitting', ...seatSpot(0, side) } as Customer;
  const cat: LivingCatActor = { id: 'siamese', ...seatApproach(0, side), area: 'main', personality: 'affectionate',
    behavior: 'watch', remaining: 4, elapsed: 2, facing: side === 0 ? 1 : -1, stride: 40,
    affection: 2, route: [], targetKind: 'people', resting: false, interaction: { guestId: 1, phase: 'response', elapsed } };
  const manifest = manifestJson as GeneratedCustomerManifest;
  const sources = Object.fromEntries(manifest.frames.map(meta => {
    const id = `mina-${meta.direction}-${meta.state}`;
    const bytes = readFileSync(new URL(`../../../public/art/generated/customer-0-v1/${id}.png`, import.meta.url));
    return [id, { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } as HTMLCanvasElement];
  }));
  const adapter = createGeneratedCustomerArt(manifest, sources);
  expect(adapter.ready).toBe(true);
  const catManifest = catManifestJson as GeneratedCatManifest;
  const catSources = Object.fromEntries(catManifest.frames.map(meta => [`siamese-${meta.state}`,
    { width: meta.size[0], height: meta.size[1] } as HTMLCanvasElement]));
  const catAdapter = generatedCat ? createGeneratedCatArt(catManifest, catSources) : null;
  if (catAdapter) expect(catAdapter.ready).toBe(true);
  const uploaded = new Map<string, HTMLCanvasElement>();
  const images: ImageStub[] = [];
  const shadow = vi.fn();
  const scene = Object.assign(Object.create(CafeScene.prototype), {
    generatedCustomers: adapter, generatedCats: catAdapter, generatedPetOffsets: new WeakMap(),
    textures: { exists: (key: string) => uploaded.has(key), addCanvas: (key: string, source: HTMLCanvasElement) => uploaded.set(key, source) },
    images: { next: () => { const image = new ImageStub(); images.push(image); return image; } },
    sim: { customers: [customer], seats: side === 0 ? [1, null] : [null, 1] },
    view: { clearPresentedResidentCatPoints: vi.fn(), setPresentedResidentCatPoint: vi.fn(), livingCats: { actors: new Map([['siamese', cat]]) }, paused, overview: false, selectedCat: null, catSelectionSeconds: 0 },
    motionPreference: { matches: quiet }, getState: () => state, shadow, rect: vi.fn(),
  }) as HarnessScene;
  return { scene, state, customer, cat, adapter, catAdapter, images, uploaded, shadow };
}

beforeEach(() => { setSceneHeight(MIN_SCENE_H); vi.stubGlobal('document', { createElement: () => new CanvasStub() }); });
afterEach(() => { vi.unstubAllGlobals(); setSceneHeight(MIN_SCENE_H); });

describe('generated Mina hand and resident cat attachment', () => {
  for (const side of [0, 1] as const) for (const elapsed of [0, 0.65]) for (const mode of ['animated', 'reduced', 'paused'] as const) {
    it(`aligns seat ${side}, elapsed ${elapsed}, ${mode}, without moving simulation objects`, () => {
      const h = harness(side, elapsed, mode === 'reduced', mode === 'paused');
      const before = JSON.stringify({ state: h.state, customer: h.customer, cat: h.cat });
      const pose = h.scene.seatedCustomerPose(0, side, h.customer, 0);
      const contact = h.adapter.contactPoints(pose.sprite)!.petContact!;
      const hand = { x: Math.round(pose.x * 2) / 2 + contact.x, y: Math.round(pose.y * 2) / 2 + contact.y };
      h.scene.drawResidents(h.state);
      h.scene.drawTable(0, 0, 1174.1);
      const raised = catFrames('siamese').lookUp;
      const catImage = h.images.find(image => h.uploaded.get(image.key) === fineSpriteArt(raised).canvas)!;
      expect(catImage).toBeDefined();
      const crown = { x: catImage.x + (catImage.flipX ? raised.width - 6 : 6), y: catImage.y + 3 };
      expect(Math.abs(crown.x - hand.x)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(crown.y - hand.y)).toBeLessThanOrEqual(0.25);
      // The reached head stays inside CafeView's existing resident tap bounds;
      // this presentation-only attachment must not require new hit coordinates.
      const logicalPainted = projectMainWorld(h.cat);
      expect(Math.abs(crown.x - logicalPainted.x)).toBeLessThanOrEqual(12);
      expect(crown.y).toBeGreaterThanOrEqual(logicalPainted.y - 22);
      expect(crown.y).toBeLessThanOrEqual(logicalPainted.y + 5);
      const painted = h.scene.residentPaintPoint(h.cat, h.state);
      expect(h.shadow.mock.calls[0].slice(0, 3)).toEqual([painted.x, painted.y, 10]);
      const tag = h.images.find(image => image.key.startsWith('resident-tag-'))!;
      expect(tag.x).toBe(Math.round((painted.x + 7) * 2) / 2);
      const character = h.images.filter(image => h.uploaded.get(image.key) === fineSpriteArt(pose.sprite).canvas);
      expect(character).toHaveLength(3); // whole body, original upper-body crop, wrist-only patch
      const [whole, upper, wrist] = character;
      expect(upper.crop).toEqual([0, 0, 88, 80]);
      expect(whole.depth).toBeLessThan(catImage.depth);
      expect(wrist.depth).toBeGreaterThan(catImage.depth);
      expect([wrist.x, wrist.y]).toEqual([whole.x, whole.y]);
      expect(wrist.scaleX).toBe(0.25);
      const [x, y, width, height] = wrist.crop!.map(n => n / 4);
      expect(x).toBeLessThanOrEqual(contact.x); expect(x + width).toBeGreaterThan(contact.x);
      expect(y).toBeLessThanOrEqual(contact.y); expect(y + height).toBeGreaterThan(contact.y);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(width).toBeLessThanOrEqual(6); expect(height).toBeLessThanOrEqual(6);
      expect(JSON.stringify({ state: h.state, customer: h.customer, cat: h.cat })).toBe(before);
    });
  }

  it.each([0, 1] as const)('eases seat %i approach and retreat without phase-boundary jumps', side => {
    const h = harness(side), original = { x: h.cat.x, y: h.cat.y };
    h.cat.interaction!.phase = 'approach';
    h.cat.y += 24;
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(projectMainWorld(h.cat));
    h.cat.y = original.y;
    const arrival = h.scene.residentPaintPoint(h.cat, h.state);
    h.cat.interaction!.phase = 'nuzzle';
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(arrival);
    h.cat.interaction!.phase = 'response';
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(arrival);
    h.cat.interaction!.phase = 'leave';
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(arrival);
    h.cat.interaction!.elapsed = 0.25;
    const half = h.scene.residentPaintPoint(h.cat, h.state), base = projectMainWorld(h.cat);
    expect(half.x - base.x).toBeCloseTo((arrival.x - base.x) / 2);
    expect(half.y - base.y).toBeCloseTo((arrival.y - base.y) / 2);
    h.cat.interaction!.elapsed = 0.5;
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(base);
  });

  it('fades a cancelled response instead of snapping when a guest leaves early', () => {
    const h = harness(0), contact = h.scene.residentPaintPoint(h.cat, h.state);
    delete h.cat.interaction; h.cat.elapsed = 0;
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(contact);
    h.cat.elapsed = 0.5;
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(projectMainWorld(h.cat));
  });

  it.each(['other-cast', 'different-look', 'unpaired', 'not-seated', 'inactive-pet', 'missing-adapter'] as const)('keeps %s on the exact existing cat anchor', variant => {
    const h = harness(0);
    if (variant === 'other-cast') { h.customer.appearanceId = 1; h.customer.look = { ...CUSTOMER_CAST[1].look }; }
    if (variant === 'different-look') h.customer.look = { ...h.customer.look, hair: 2 };
    if (variant === 'unpaired') delete h.cat.interaction;
    if (variant === 'not-seated') h.customer.phase = 'exiting';
    if (variant === 'inactive-pet') h.state.pets[0].careSeconds = 0;
    if (variant === 'missing-adapter') Object.assign(h.scene, { generatedCustomers: null });
    expect(h.scene.residentPaintPoint(h.cat, h.state)).toEqual(projectMainWorld(h.cat));
    h.scene.drawResidents(h.state);
    h.scene.drawTable(0, 0, 1174.1);
    expect(h.images.some(image => image.crop && image.crop[1] >= 80)).toBe(false);
  });
});


describe('generated Siamese and Mina metadata contact', () => {
  for (const side of [0, 1] as const) for (const elapsed of [0, 0.65]) for (const quiet of [false, true]) {
    it(`aligns generated cat crown seat${side}, elapsed${elapsed}, reduced${quiet}`, () => {
      const h = harness(side, elapsed, quiet, false, true);
      const before = JSON.stringify({ state: h.state, customer: h.customer, cat: h.cat });
      const pose = h.scene.seatedCustomerPose(0, side, h.customer, 0);
      const hand = h.adapter.contactPoints(pose.sprite)!.petContact!;
      const raised = h.catAdapter!.resolve('siamese', catFrames('siamese')).frames.lookUp;
      h.scene.drawResidents(h.state);
      const image = h.images.find(image => h.uploaded.get(image.key) === fineSpriteArt(raised).canvas)!;
      expect(image).toBeDefined();
      expect(image.flipX).toBe(residentCatFlipX(false, h.cat.facing));
      expect(image.scaleX).toBe(0.25);
      const head = h.catAdapter!.contactPoints(raised, image.flipX)!.headContact;
      expect(Math.abs(image.x + head.x - (Math.round(pose.x * 2) / 2 + hand.x))).toBeLessThanOrEqual(0.25);
      expect(Math.abs(image.y + head.y - (Math.round(pose.y * 2) / 2 + hand.y))).toBeLessThanOrEqual(0.25);
      expect(JSON.stringify({ state: h.state, customer: h.customer, cat: h.cat })).toBe(before);
    });
  }
});
