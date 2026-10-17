import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import runtimeCatalog from '../../../assets/generated/runtime-catalog-v1/catalog.json';
import { CELL, furnitureDef } from '../../game/furniture';
import { CAT_SPOTS, MIN_SCENE_H, PASS_SLOT_W, passSlot, setSceneHeight } from '../../game/layout';
import type { Plate, Server } from '../../game/sim';
import { createInitialState, type GameState } from '../../game/state';
import { CafeView, cellRect, floorAnchor, type Ghost } from '../cafe-view';
import { fineSpriteArt } from '../fine-sprite-art';
import { WORLD_ART_DENSITY, worldSpriteArt } from '../world-art-grid';
import { floorFurnitureBounds } from '../furniture-art';
import { createGeneratedCatArt, type GeneratedCatAdapter, type GeneratedCatManifest } from '../generated-cat-art';
import { createGeneratedFurnitureArt, GENERATED_FURNITURE_CATALOG, type GeneratedFurnitureId } from '../generated-furniture-art';
import { createGeneratedFoodArt } from '../generated-food-art';
import { clearGeneratedMainAssets, getGeneratedTablewareAdapter, setGeneratedFoodAdapter,
  setGeneratedFurnitureAdapter, setGeneratedTablewareAdapter } from '../generated-main-art';
import { createGeneratedServerArt, type GeneratedServerAdapter, type GeneratedServerManifest } from '../generated-server-art';
import { createGeneratedTablewareArt, GENERATED_TABLEWARE_ASSETS, GENERATED_TABLEWARE_CATALOG,
  type GeneratedTablewareId } from '../generated-tableware-art';
import { MAIN_COUNTER_PLANE, MAIN_WALL_PLANE, projectMainCellOutline, projectMainPlaneWorld, projectMainWorld } from '../main-pixel-presentation';
import { catFrames, character, CHAR_H, itemIcon } from '../sprites';

// Exercise the real adapters, furniture painters, texture bake and Scene image
// dispatch. Only the canvas/Phaser host is replaced; no renderer or WebGL boots.
vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Math: { Vector2: class { constructor(public x: number, public y: number) {} } },
} }));
import { CafeScene } from './cafe-scene';

class CanvasStub {
  width = 0;
  height = 0;
  context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
    globalAlpha: 1, imageSmoothingEnabled: true,
    fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
    translate: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
  };
  getContext() { return this.context; }
}

function textureManager() {
  const uploaded = new Map<string, HTMLCanvasElement>();
  const live = new Map<string, { context: CanvasStub['context']; refresh: ReturnType<typeof vi.fn> }>();
  const addCanvas = vi.fn((key: string, source: HTMLCanvasElement) => uploaded.set(key, source));
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const canvas = Object.assign(new CanvasStub(), { width, height });
    const texture = { context: canvas.context, refresh: vi.fn() };
    uploaded.set(key, canvas as unknown as HTMLCanvasElement);
    live.set(key, texture);
    return texture;
  });
  return { uploaded, live, addCanvas, createCanvas,
    exists: (key: string) => uploaded.has(key), get: (key: string) => live.get(key) };
}

class ImageStub {
  key = ''; x = 0; y = 0; depth = 0; scaleX = 1; scaleY = 1;
  isCropped = false; visible = true;
  setTexture(key: string) { this.key = key; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setDepth(depth: number) { this.depth = depth; return this; }
  setVisible(visible: boolean) { this.visible = visible; return this; }
  setAlpha() { return this; }
  setFlipX() { return this; }
  setCrop() { return this; }
}

function graphics() {
  return { clear: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis() };
}

interface SceneHarness {
  floorTexture(id: string): { key: string; dx: number; dy: number; density: number };
  floorPiece(id: string, cx: number, foot: number, depth: number): void;
  drawGhost(state: GameState, ghost: Ghost, time: number, now: Date): void;
  drawCat(state: GameState, time: number, origin: { x: number; y: number }): void;
  drawServer(server: Server, depth: number): void;
  drawPass(time: number, origin: { x: number; y: number }): void;
  generatedCats: GeneratedCatAdapter | null;
  generatedServers: GeneratedServerAdapter | null;
}

function harness() {
  const textures = textureManager(), images: ImageStub[] = [];
  const ghostPiece = new ImageStub(), ghostBox = graphics();
  const view = { area: 'main', catHappy: 0, catSpot: CAT_SPOTS[0], catSpaceClear: vi.fn(() => true) };
  const sim = { furnitureSpaceClear: vi.fn(() => true), pass: [] as Plate[] };
  const scene = Object.assign(Object.create(CafeScene.prototype), {
    textures, images: { next: () => { const image = new ImageStub(); images.push(image); return image; } },
    ghostPiece, ghostBox, ghostCells: graphics(), view,
    sim, bellRang: -Infinity, generatedCats: null, generatedServers: null,
  }) as SceneHarness;
  return { scene, textures, images, ghostPiece, ghostBox, view, sim };
}

function installFurniture(...ids: GeneratedFurnitureId[]) {
  const sources = Object.fromEntries(ids.map(id => {
    const [width, height] = GENERATED_FURNITURE_CATALOG[id].size;
    return [id, { width, height } as HTMLCanvasElement];
  }));
  const adapter = createGeneratedFurnitureArt(sources);
  expect(adapter.readyIds).toEqual(expect.arrayContaining(ids));
  setGeneratedFurnitureAdapter(adapter);
  return adapter;
}

function visitorAdapter() {
  const manifest = runtimeCatalog.catManifests.find(item => item.breed === 'ginger')! as unknown as GeneratedCatManifest;
  const sources = Object.fromEntries(manifest.frames.map(frame => [`ginger-${frame.state}`,
    { width: frame.size[0], height: frame.size[1] } as HTMLCanvasElement]));
  const adapter = createGeneratedCatArt(manifest, sources);
  expect(adapter.errors).toEqual([]);
  expect(adapter.readyBreeds).toEqual(['ginger']);
  return adapter;
}

const PAD = 20;
const snap = (value: number) => Math.round(value * 2) / 2;
const backing = (textures: ReturnType<typeof textureManager>, key: string) =>
  textures.uploaded.get(key)! as unknown as CanvasStub;

beforeEach(() => {
  setSceneHeight(MIN_SCENE_H);
  setGeneratedFurnitureAdapter(null);
  setGeneratedFoodAdapter(null);
  setGeneratedTablewareAdapter(null);
  vi.stubGlobal('document', { createElement: () => new CanvasStub() });
});
afterEach(() => {
  setGeneratedFurnitureAdapter(null);
  setGeneratedFoodAdapter(null);
  setGeneratedTablewareAdapter(null);
  setSceneHeight(MIN_SCENE_H);
  vi.unstubAllGlobals();
});

describe('generated furniture Scene textures retain logical world geometry', () => {
  it.each(['plant_snake', 'lamp', 'bench'] as const)('bakes %s on the world art grid while preserving its foot, envelope and tap bounds', id => {
    const h = harness(), state = createInitialState(0);
    const placed = { id, col: 4, row: 18 }, def = furnitureDef(id)!;
    state.decor.placed = [placed];
    const anchor = floorAnchor(def, placed.col, placed.row);
    const painted = projectMainWorld({ x: anchor.cx, y: anchor.foot });
    const legacyBounds = floorFurnitureBounds(id, anchor.cx, anchor.foot);
    const legacy = h.scene.floorTexture(id), oldCanvas = backing(h.textures, legacy.key);
    const adapter = installFurniture(id);
    const before = JSON.stringify(state);
    const texture = h.scene.floorTexture(id), canvas = backing(h.textures, texture.key);
    h.scene.floorPiece(id, anchor.cx, anchor.foot, 1234.3);
    const image = h.images[0], bounds = floorFurnitureBounds(id, anchor.cx, anchor.foot);

    expect(bounds).toEqual(legacyBounds);
    expect(texture).toEqual({ key: `floor-${id}-${WORLD_ART_DENSITY}x`, dx: legacy.dx, dy: legacy.dy, density: WORLD_ART_DENSITY });
    expect(legacy.density).toBe(1);
    expect(texture.key).not.toBe(legacy.key);
    expect([canvas.width, canvas.height]).toEqual([oldCanvas.width * WORLD_ART_DENSITY, oldCanvas.height * WORLD_ART_DENSITY]);
    expect(canvas.context.scale).toHaveBeenCalledExactlyOnceWith(WORLD_ART_DENSITY, WORLD_ART_DENSITY);
    expect(canvas.context.imageSmoothingEnabled).toBe(false);
    expect(canvas.context.drawImage).toHaveBeenCalledWith(fineSpriteArt(adapter.sprite(id)!).canvas,
      PAD + Math.floor(bounds.w / 2) - bounds.w / 2, PAD, bounds.w, bounds.h);
    expect(image).toMatchObject({ key: texture.key, scaleX: 1 / WORLD_ART_DENSITY, scaleY: 1 / WORLD_ART_DENSITY, depth: 1234.3,
      x: snap(painted.x + texture.dx), y: snap(painted.y + texture.dy) });
    expect([canvas.width * image.scaleX, canvas.height * image.scaleY])
      .toEqual([bounds.w + PAD * 2, bounds.h + PAD * 2]);
    expect(image.x + PAD + Math.floor(bounds.w / 2)).toBe(snap(painted.x));
    expect(image.y + PAD + bounds.h - 1).toBe(snap(painted.y));

    // Run the real projected pointer hit path at both inside and outside edges.
    const view = Object.assign(Object.create(CafeView.prototype), { area: 'main', presentedPointer: null });
    for (const [dx, dy, expected] of [[-bounds.w / 2, -bounds.h + 1, 0], [0, 0, 0],
      [bounds.w / 2 - 0.01, 0, 0], [bounds.w / 2, 0, -1], [0, 1, -1]]) {
      view.presentedPointer = { x: painted.x + dx, y: painted.y + dy };
      expect(view.furnitureAt(state, 0, 0)).toBe(expected);
      setGeneratedFurnitureAdapter(null);
      expect(view.furnitureAt(state, 0, 0)).toBe(expected);
      setGeneratedFurnitureAdapter(adapter);
    }
    expect(h.scene.floorTexture(id)).toEqual(texture);
    expect(h.textures.addCanvas).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([false, true])('keeps ungenerated furniture at density 1 (another generated identity: %s)', partial => {
    if (partial) installFurniture('bench');
    const h = harness(), bounds = floorFurnitureBounds('plant_snake', 0, 0);
    const texture = h.scene.floorTexture('plant_snake');
    h.scene.floorPiece('plant_snake', 100, 200, 1200);
    const canvas = backing(h.textures, texture.key);
    expect(texture.density).toBe(1);
    expect(texture.key).toBe('floor-plant_snake-1x');
    expect([canvas.width, canvas.height]).toEqual([bounds.w + PAD * 2, bounds.h + PAD * 2]);
    expect(canvas.context.scale).not.toHaveBeenCalled();
    expect(h.images[0]).toMatchObject({ scaleX: 1, scaleY: 1 });
  });

  it.each([false, true])('keeps a floor ghost at the same world anchor and footprint (generated: %s)', generated => {
    if (generated) installFurniture('plant_snake');
    const h = harness(), state = createInitialState(0);
    const ghost = { id: 'plant_snake', col: 1, row: 18, skip: -1 }, def = furnitureDef(ghost.id)!;
    const anchor = floorAnchor(def, ghost.col, ghost.row), bounds = floorFurnitureBounds(ghost.id, 0, 0);
    const painted = projectMainWorld({ x: anchor.cx, y: anchor.foot }), density = generated ? WORLD_ART_DENSITY : 1;
    const before = JSON.stringify({ state, ghost });
    h.scene.drawGhost(state, ghost, 0, new Date(0));
    const piece = h.ghostPiece, canvas = backing(h.textures, piece.key);
    expect(piece).toMatchObject({ scaleX: 1 / density, scaleY: 1 / density, visible: true });
    expect([canvas.width * piece.scaleX, canvas.height * piece.scaleY])
      .toEqual([bounds.w + PAD * 2, bounds.h + PAD * 2]);
    expect(piece.x + PAD + Math.floor(bounds.w / 2)).toBeCloseTo(painted.x, 12);
    expect(piece.y + PAD + bounds.h - 1).toBe(painted.y);
    expect(h.ghostBox.fillPoints.mock.calls[0][0]).toEqual(
      projectMainCellOutline(cellRect('floor', ghost.col, ghost.row, def.w, def.h), 'floor', 'main'));
    expect(JSON.stringify({ state, ghost })).toBe(before);
  });

  it.each([false, true])('repaints a wall ghost at physical resolution without enlarging its world footprint (generated: %s)', generated => {
    if (generated) installFurniture('clock');
    const h = harness(), state = createInitialState(0), density = generated ? WORLD_ART_DENSITY : 1;
    const ghost = { id: 'clock', col: 5, row: 1, skip: -1 }, def = furnitureDef(ghost.id)!;
    const rect = cellRect('wall', ghost.col, ghost.row, def.w, def.h);
    const left = projectMainPlaneWorld(rect, MAIN_WALL_PLANE);
    const right = projectMainPlaneWorld({ x: rect.x + rect.w, y: rect.y }, MAIN_WALL_PLANE);
    const wallScale = (right.x - left.x) / rect.w;
    const w = def.w * CELL + PAD * 2, height = def.h * CELL + PAD * 2;
    h.scene.drawGhost(state, ghost, 0, new Date(0));
    h.scene.drawGhost(state, ghost, 1, new Date(60_000));
    const piece = h.ghostPiece, canvas = backing(h.textures, piece.key), texture = h.textures.live.get(piece.key)!;
    expect(piece.key).toBe(`ghost-wall-clock-${density}x`);
    expect(h.textures.createCanvas).toHaveBeenCalledExactlyOnceWith(piece.key, w * density, height * density);
    expect(texture.context.clearRect).toHaveBeenCalledTimes(2);
    expect(texture.context.clearRect).toHaveBeenLastCalledWith(0, 0, w * density, height * density);
    expect(texture.refresh).toHaveBeenCalledTimes(2);
    expect(texture.context.scale.mock.calls).toEqual(generated ? [[density, density], [density, density]] : []);
    expect(piece.scaleX).toBeCloseTo(wallScale / density, 12);
    expect(piece.scaleY).toBe(1 / density);
    expect(canvas.width * piece.scaleX).toBeCloseTo(w * wallScale, 12);
    expect(canvas.height * piece.scaleY).toBe(height);
    expect(piece.x + PAD * wallScale).toBeCloseTo(left.x, 12);
    expect(piece.y + PAD).toBe(left.y);
    expect(h.ghostBox.fillPoints.mock.calls[1][0]).toEqual(projectMainCellOutline(rect, 'wall', 'main'));
  });
});

describe('generated visiting cat retains the original sill contact', () => {
  it.each([
    { time: 0, happy: false, pose: 'blink' }, { time: 0.2, happy: false, pose: 'idle' },
    { time: 0.8, happy: false, pose: 'swish' }, { time: 0.8, happy: true, pose: 'happy' },
  ] as const)('keeps the $pose pose at CAT_SPOTS with the same tap target', ({ time, happy, pose }) => {
    const h = harness(), state = createInitialState(0), adapter = visitorAdapter();
    h.scene.generatedCats = adapter;
    h.view.catHappy = happy ? 1 : 0;
    const before = JSON.stringify({ state, spots: CAT_SPOTS });
    const frames = adapter.resolve('ginger', catFrames('ginger')).frames, sprite = frames[pose];
    const contact = adapter.contactPoints(sprite)!.foot;
    const spot = projectMainPlaneWorld(CAT_SPOTS[0], MAIN_WALL_PLANE);
    h.scene.drawCat(state, time, { x: 0, y: 0 });
    const image = h.images[0], art = worldSpriteArt(sprite);
    expect(h.images).toHaveLength(1);
    expect(fineSpriteArt(sprite).density).toBe(4);
    expect(h.textures.uploaded.get(image.key)).toBe(art.canvas);
    expect([art.canvas.width, art.canvas.height]).toEqual([sprite.width * WORLD_ART_DENSITY, sprite.height * WORLD_ART_DENSITY]);
    expect([image.scaleX, image.scaleY]).toEqual([1 / WORLD_ART_DENSITY, 1 / WORLD_ART_DENSITY]);
    expect(image.x + contact.x).toBe(snap(spot.x) + 1);
    expect(image.y + contact.y).toBe(spot.y + 1);

    h.scene.generatedCats = null;
    h.scene.drawCat(state, time, { x: 0, y: 0 });
    const legacy = h.images[1], fallback = catFrames('ginger')[pose];
    expect(image.x + contact.x).toBe(legacy.x + 9);
    expect(image.y + contact.y).toBe(legacy.y + fallback.height - 1);
    const view = Object.assign(Object.create(CafeView.prototype), { area: 'main',
      presentedPointer: { x: image.x + contact.x, y: image.y + contact.y } });
    expect(view.hitCat(0, 0)).toBe(true);
    expect(view.catSpot).toBe(CAT_SPOTS[0]);
    expect(JSON.stringify({ state, spots: CAT_SPOTS })).toBe(before);
  });

  it('does not draw the visiting cat once a resident has been adopted', () => {
    const h = harness(), state = createInitialState(0);
    h.scene.generatedCats = visitorAdapter();
    state.pets = [{ id: 'ginger', careSeconds: 100, autoRefill: false }];
    h.scene.drawCat(state, 0.2, { x: 0, y: 0 });
    expect(h.images).toEqual([]);
    expect(h.textures.addCanvas).not.toHaveBeenCalled();
  });
});

function serverAdapter(complete = true) {
  const manifest = runtimeCatalog.serverManifest as GeneratedServerManifest;
  const sources = Object.fromEntries(manifest.frames.map(frame => [`server-${frame.direction}-${frame.state}`,
    { width: frame.size[0], height: frame.size[1] } as HTMLCanvasElement]));
  const adapter = createGeneratedServerArt(manifest, complete ? sources : {});
  expect(adapter.ready).toBe(complete);
  return adapter;
}

function serverFixture(count: number, walking = false): Server {
  const orders: Server['plates'] = [
    { customerId: 11, items: ['espresso', 'croissant'], barista: 0, server: 0, waited: 3 },
    { customerId: 29, items: ['cake', 'latte'], barista: 1, server: 0, waited: 5 },
    { customerId: 42, items: ['croissant'], barista: 0, server: 0, waited: 8 },
  ];
  return { x: 81, y: 200, tx: walking ? 97 : 81, ty: 200, stride: 0, via: [],
    look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 },
    phase: 'delivering', plates: orders.slice(0, count), ack: 0 };
}

function installServerFood() {
  const sources = Object.fromEntries(['espresso', 'cake', 'croissant'].map(id =>
    [id, { width: 120, height: 90 } as HTMLCanvasElement]));
  const adapter = createGeneratedFoodArt(sources);
  expect(adapter.readyIds).toHaveLength(3);
  setGeneratedFoodAdapter(adapter);
}

describe('generated server Scene composition retains live service payloads', () => {
  for (const mode of ['generated', 'other-look', 'missing-pack'] as const) {
    for (const count of [1, 3]) for (const walking of [false, true]) {
      it(`${mode}: ${count} live plates ${walking ? 'walking' : 'standing'} keep their identity, geometry and depth`, () => {
        const h = harness(), server = serverFixture(count, walking);
        h.scene.generatedServers = serverAdapter(mode !== 'missing-pack');
        if (mode === 'other-look') server.look.shirt = 1;
        installServerFood();
        const generated = mode === 'generated', fallback = character(server.look, 'server');
        const selected = h.scene.generatedServers.resolve({ role: 'server', look: server.look }, fallback);
        expect(selected.generated).toBe(generated);
        const frame = selected.frames[walking ? 'right' : 'down'][walking ? 1 : 0];
        const frameArt = worldSpriteArt(frame), frameCanvas = frameArt.canvas as unknown as CanvasStub;
        const frameDrawCount = frameCanvas.context.drawImage.mock.calls.length;
        // The same completed orders are still visible to simulation/pass owners.
        const pass = [...server.plates], originalItems = pass.map(plate => plate.items);
        const before = JSON.stringify({ server, pass });
        const foot = projectMainWorld(server), x = snap(foot.x), y = Math.round(foot.y), bob = walking ? 1 : 0;
        const depth = 1200, trayY = y - (generated ? 10 : 17) - bob;

        h.scene.drawServer(server, depth);

        expect(h.images).toHaveLength(count + 3); // shadow, body, each order and separate tray
        const body = h.images.find(image => h.textures.uploaded.get(image.key) === frameArt.canvas)!;
        expect(body).toMatchObject({ x: x - 9, y: y - (CHAR_H - 1) - bob,
          depth: depth + 0.001, scaleX: 1 / frameArt.density, scaleY: 1 / frameArt.density });
        expect(fineSpriteArt(frame).density).toBe(generated ? 4 : 2);
        expect(frameArt.density).toBe(WORLD_ART_DENSITY);
        if (!generated) expect(selected.frames).toBe(fallback);
        const tray = h.images.find(image => image.key === 'tray')!;
        expect(tray).toMatchObject({ x: x - 11, y: trayY, depth: depth + 0.003, scaleX: 1, scaleY: 1 });
        const trayCanvas = backing(h.textures, tray.key);
        expect([trayCanvas.width, trayCanvas.height]).toEqual([22, 3]);
        expect(trayCanvas.context.drawImage).not.toHaveBeenCalled();
        expect(frameCanvas.context.drawImage).toHaveBeenCalledTimes(frameDrawCount);

        for (const [i, plate] of pass.entries()) {
          const icon = itemIcon(plate.items[0], false);
          expect(fineSpriteArt(icon).density).toBe(4);
          const scale = generated ? Math.min(1, 8 / icon.width, 8 / icon.height) : 1;
          const art = worldSpriteArt(icon, icon.width * scale, icon.height * scale);
          const food = h.images.filter(image => h.textures.uploaded.get(image.key) === art.canvas);
          expect(food).toHaveLength(1);
          expect(art.density).toBe(WORLD_ART_DENSITY);
          const cx = x + Math.round((i - (count - 1) / 2) * 7);
          expect(food[0]).toMatchObject({
            x: snap(cx - (generated ? icon.width * scale / 2 : Math.floor(icon.width / 2))),
            y: snap(trayY - icon.height * scale), depth: depth + 0.002 + i * 0.0001,
            scaleX: 1 / art.density, scaleY: 1 / art.density,
          });
          // Scaled icons are resampled to whole art pixels: within half a room pixel of the exact size.
          const displayW = art.canvas.width * food[0].scaleX;
          const displayH = art.canvas.height * food[0].scaleY;
          expect(Math.abs(displayW - icon.width * scale)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(displayH - icon.height * scale)).toBeLessThanOrEqual(0.5);
          expect(food[0].depth).toBeGreaterThan(body.depth);
          expect(food[0].depth).toBeLessThan(tray.depth);
          if (generated) {
            expect(displayW).toBeLessThanOrEqual(8);
            expect(displayH).toBeLessThanOrEqual(8);
            expect(food[0].y).toBeGreaterThanOrEqual(y - 18 - bob);
          } else expect([displayW, displayH]).toEqual([icon.width, icon.height]);
          expect(server.plates[i]).toBe(plate);
          expect(server.plates[i].items).toBe(originalItems[i]);
        }
        expect(h.images.some(image => image.key === 'bubble-ack')).toBe(false);
        expect(JSON.stringify({ server, pass })).toBe(before);
      });
    }
  }

  it.each(['skin', 'hair', 'hairStyle', 'shirt', 'pants'] as const)('rejects a nonzero %s at the actual Scene draw boundary', key => {
    const h = harness(), server = serverFixture(0);
    h.scene.generatedServers = serverAdapter();
    server.look[key] = 1;
    const oldFrame = character(server.look, 'server').down[0];
    h.scene.drawServer(server, 1200);
    expect(h.images).toHaveLength(2);
    expect(h.textures.uploaded.get(h.images[1].key)).toBe(fineSpriteArt(oldFrame).canvas);
    expect(h.images[1].scaleX).toBe(0.5);
  });

  it('retains legacy icon size and integer centering when the server and menu adapters are absent', () => {
    const h = harness(), server = serverFixture(3, true), foot = projectMainWorld(server);
    h.scene.drawServer(server, 1200);
    const trayY = Math.round(foot.y) - 18;
    for (const [i, plate] of server.plates.entries()) {
      const icon = itemIcon(plate.items[0], false), art = fineSpriteArt(icon);
      const image = h.images.find(layer => h.textures.uploaded.get(layer.key) === art.canvas)!;
      const cx = snap(foot.x) + Math.round((i - 1) * 7);
      expect(image.x).toBe(cx - Math.floor(icon.width / 2));
      expect(image.y).toBe(trayY - icon.height);
      expect([art.canvas.width * image.scaleX, art.canvas.height * image.scaleY])
        .toEqual([icon.width, icon.height]);
    }
  });

  it.each(['toPass', 'delivering'] as const)('keeps acknowledgement separate and above the head during %s', phase => {
    const h = harness(), server = serverFixture(3, true);
    h.scene.generatedServers = serverAdapter();
    installServerFood();
    server.phase = phase;
    server.ack = 1;
    const before = JSON.stringify(server), foot = projectMainWorld(server);
    h.scene.drawServer(server, 1200);
    const ack = h.images.find(image => image.key === 'bubble-ack')!;
    expect(ack).toMatchObject({ x: snap(foot.x) - 3, y: Math.round(foot.y) - CHAR_H - 11,
      depth: 100001, scaleX: 1, scaleY: 1 });
    const body = h.images[1], bubble = backing(h.textures, ack.key);
    expect([bubble.width, bubble.height]).toEqual([7, 10]);
    expect(ack.y + bubble.height).toBeLessThan(body.y);
    expect(ack.depth).toBeGreaterThan(body.depth);
    if (phase === 'toPass') {
      expect(h.images).toHaveLength(3); // shadow, empty-handed body, acknowledgement
      expect(h.textures.exists('tray')).toBe(false);
      for (const plate of server.plates) {
        expect([...h.textures.uploaded.values()]).not.toContain(fineSpriteArt(itemIcon(plate.items[0], false)).canvas);
      }
    } else expect(h.images).toHaveLength(7);
    expect(JSON.stringify(server)).toBe(before);
  });

  it('draws no tray or food for an empty-handed generated server', () => {
    const h = harness(), server = serverFixture(0);
    h.scene.generatedServers = serverAdapter();
    h.scene.drawServer(server, 1200);
    expect(h.images).toHaveLength(2);
    expect(h.textures.exists('tray')).toBe(false);
    expect(h.textures.exists('bubble-ack')).toBe(false);
  });
});

function installShallowTableware(packed: boolean, ids: GeneratedTablewareId[] = ['shallow-plate', 'shallow-tray']) {
  const sources = Object.fromEntries(ids.map(id => {
    const path = packed ? `../../../public/art/generated/${GENERATED_TABLEWARE_ASSETS[id]}`
      : `../../../assets/generated/${GENERATED_TABLEWARE_CATALOG[id].file}`;
    const bytes = readFileSync(new URL(path, import.meta.url));
    return [id, { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } as HTMLCanvasElement];
  }));
  const adapter = createGeneratedTablewareArt(sources);
  expect(adapter.readyIds).toEqual(expect.arrayContaining(ids));
  setGeneratedTablewareAdapter(adapter);
  return adapter;
}

describe('authored shallow serviceware Scene support and live food layers', () => {
  for (const packed of [false, true]) for (const generatedServer of [false, true]) {
    for (const count of [1, 3]) for (const walking of [false, true]) {
      it(`${packed ? 'packed' : 'original'} tray: ${count} orders on ${generatedServer ? 'generated' : 'legacy'} ${walking ? 'walking' : 'standing'} server`, () => {
        const h = harness(), state = createInitialState(0), server = serverFixture(count, walking);
        Object.assign(h.scene, { getState: () => state });
        h.scene.generatedServers = serverAdapter();
        if (!generatedServer) server.look.hair = 1;
        installServerFood();
        const tableware = installShallowTableware(packed), sprite = tableware.sprite('shallow-tray')!;
        expect(tableware.tray()).toBe(sprite);
        const trayArt = worldSpriteArt(sprite), trayCanvas = trayArt.canvas as unknown as CanvasStub;
        const bakedDraws = trayCanvas.context.drawImage.mock.calls.slice();
        h.sim.pass = [...server.plates];
        const before = JSON.stringify({ state, server, pass: h.sim.pass });
        const originalPlates = [...server.plates], originalItems = server.plates.map(plate => plate.items);
        const foot = projectMainWorld(server), x = snap(foot.x), y = Math.round(foot.y);
        const trayY = y - (generatedServer ? 10 : 17) - (walking ? 1 : 0);
        const supportY = tableware.support('shallow-tray')!.y;

        h.scene.drawServer(server, 1200);

        expect(h.images).toHaveLength(count + 3);
        const tray = h.images.at(-1)!;
        expect(h.textures.uploaded.get(tray.key)).toBe(trayArt.canvas);
        expect(tray).toMatchObject({ x: x - 11, y: trayY, depth: 1200.003, scaleX: 1 / WORLD_ART_DENSITY, scaleY: 1 / WORLD_ART_DENSITY });
        expect([fineSpriteArt(sprite).canvas.width, fineSpriteArt(sprite).canvas.height]).toEqual([88, 12]);
        expect([trayArt.canvas.width, trayArt.canvas.height]).toEqual([22 * WORLD_ART_DENSITY, 3 * WORLD_ART_DENSITY]);
        expect([trayArt.canvas.width * tray.scaleX, trayArt.canvas.height * tray.scaleY]).toEqual([22, 3]);
        expect(h.textures.exists('tray')).toBe(false);
        expect(supportY).toBeGreaterThan(0);
        expect(supportY).toBeLessThan(tableware.anchor('shallow-tray')!.y);
        for (const [i, plate] of server.plates.entries()) {
          const food = h.images[i + 2], icon = itemIcon(plate.items[0], false);
          const scale = generatedServer ? Math.min(1, 8 / icon.width, 8 / icon.height) : 1;
          const art = worldSpriteArt(icon, icon.width * scale, icon.height * scale);
          const cx = x + Math.round((i - (count - 1) / 2) * 7);
          expect(h.textures.uploaded.get(food.key)).toBe(art.canvas);
          expect(food).toMatchObject({
            x: snap(cx - (generatedServer ? icon.width * scale / 2 : Math.floor(icon.width / 2))),
            y: snap(trayY + supportY - icon.height * scale),
            depth: 1200.002 + i * 0.0001, scaleX: 1 / art.density, scaleY: 1 / art.density,
          });
          // Whole art pixels: the resampled icon may end up to half a room pixel off the support.
          const physicalBottom = food.y + art.canvas.height * food.scaleY;
          expect(Math.abs(physicalBottom - (tray.y + supportY))).toBeLessThanOrEqual(0.5);
          expect(food.depth).toBeGreaterThan(h.images[1].depth);
          expect(food.depth).toBeLessThan(tray.depth);
          expect(server.plates[i]).toBe(originalPlates[i]);
          expect(server.plates[i].items).toBe(originalItems[i]);
        }
        // Repainting live orders never paints a recipe into the empty tray.
        expect(trayCanvas.context.drawImage.mock.calls).toEqual(bakedDraws);
        expect(trayCanvas.context.fillRect).not.toHaveBeenCalled();
        expect(JSON.stringify({ state, server, pass: h.sim.pass })).toBe(before);
      });
    }
  }

  it.each([false, true])('keeps both pass shelves, changing food and order removal live (packed: %s)', packed => {
    const h = harness(), state = createInitialState(0);
    Object.assign(h.scene, { getState: () => state });
    installServerFood();
    const tableware = installShallowTableware(packed), plate = tableware.sprite('shallow-plate')!;
    expect(tableware.passPlate()).toBe(plate);
    const plateArt = worldSpriteArt(plate), supportY = tableware.support('shallow-plate')!.y;
    const plateCanvas = plateArt.canvas as unknown as CanvasStub;
    const bakedDraws = plateCanvas.context.drawImage.mock.calls.slice();
    const firstRow = serverFixture(3).plates;
    h.sim.pass = [...firstRow, ...firstRow.map(order => ({ ...order, customerId: order.customerId + 100, items: [...order.items] }))];
    const origin = { x: 7, y: 3 };
    const drawAndCheck = () => {
      const before = JSON.stringify({ state, pass: h.sim.pass });
      const orders = [...h.sim.pass], items = orders.map(order => order.items);
      h.images.length = 0;
      h.scene.drawPass(3, origin);
      expect(h.images).toHaveLength(orders.length * 2 + 1); // live food/dishes, then the bell
      for (const [i, order] of orders.entries()) {
        const slot = projectMainPlaneWorld(passSlot(i), MAIN_COUNTER_PLANE);
        const food = h.images[i * 2], dish = h.images[i * 2 + 1];
        const icon = itemIcon(order.items[0], false), foodArt = worldSpriteArt(icon);
        const depth = 30.5 + i * 0.01;
        expect(h.textures.uploaded.get(food.key)).toBe(foodArt.canvas);
        expect(h.textures.uploaded.get(dish.key)).toBe(plateArt.canvas);
        expect(food).toMatchObject({
          x: snap(origin.x + slot.x + Math.floor((PASS_SLOT_W - icon.width) / 2)),
          y: snap(origin.y + slot.y - 3 + supportY - icon.height), depth,
          scaleX: 1 / foodArt.density, scaleY: 1 / foodArt.density,
        });
        expect(dish).toMatchObject({ x: snap(origin.x + slot.x), y: origin.y + slot.y - 3,
          depth: depth + 0.001, scaleX: 1 / WORLD_ART_DENSITY, scaleY: 1 / WORLD_ART_DENSITY });
        expect([fineSpriteArt(plate).canvas.width, fineSpriteArt(plate).canvas.height]).toEqual([48, 8]);
        expect([plateArt.canvas.width, plateArt.canvas.height]).toEqual([12 * WORLD_ART_DENSITY, 2 * WORLD_ART_DENSITY]);
        expect(Math.abs(food.y + icon.height - (dish.y + supportY))).toBeLessThanOrEqual(0.25);
        expect(food.depth).toBeLessThan(dish.depth);
        expect(h.sim.pass[i]).toBe(order);
        expect(order.items).toBe(items[i]);
      }
      expect(JSON.stringify({ state, pass: h.sim.pass })).toBe(before);
      expect(plateCanvas.context.drawImage.mock.calls).toEqual(bakedDraws);
      expect(plateCanvas.context.fillRect).not.toHaveBeenCalled();
      expect(h.textures.exists('pass-plate')).toBe(false);
    };
    drawAndCheck();
    expect(h.images[1].y).not.toBe(h.images[7].y); // lower ledge and upper shelf
    const originalFoodKey = h.images[0].key, cachedDishKey = h.images[1].key;
    h.sim.pass[0].items[0] = 'cake';
    drawAndCheck();
    expect(h.images[0].key).not.toBe(originalFoodKey);
    expect(h.images[1].key).toBe(cachedDishKey);
    h.sim.pass.splice(0, 4);
    drawAndCheck();
    h.sim.pass.length = 0;
    drawAndCheck();
    expect(h.images).toHaveLength(1);
    expect(h.textures.uploaded.get(h.images[0].key)).not.toBe(plateArt.canvas);
    expect(h.textures.addCanvas.mock.calls.filter(([, source]) => source === plateArt.canvas)).toHaveLength(1);
  });

  it('keeps an initially empty pass free of plates despite loaded serviceware', () => {
    const h = harness(), adapter = installShallowTableware(true);
    h.scene.drawPass(3, { x: 0, y: 0 });
    expect(h.images).toHaveLength(1);
    expect(h.textures.exists('pass-plate')).toBe(false);
    expect([...h.textures.uploaded.values()]).not.toContain(fineSpriteArt(adapter.passPlate()!).canvas);
    expect([...h.textures.uploaded.values()]).not.toContain(fineSpriteArt(adapter.tray()!).canvas);
  });

  it.each(['toPass', 'empty'] as const)('does not create a loaded generated tray while the server is %s', mode => {
    const h = harness(), server = serverFixture(mode === 'empty' ? 0 : 3, true);
    const tableware = installShallowTableware(true);
    h.scene.generatedServers = serverAdapter();
    if (mode === 'toPass') server.phase = 'toPass';
    const before = JSON.stringify(server);
    h.scene.drawServer(server, 1200);
    expect(h.images).toHaveLength(2);
    expect(h.textures.exists('tray')).toBe(false);
    expect([...h.textures.uploaded.values()]).not.toContain(fineSpriteArt(tableware.tray()!).canvas);
    expect(JSON.stringify(server)).toBe(before);
  });

  it('falls back per missing shallow identity while another identity is ready', () => {
    installServerFood();
    const pass = harness(), serverView = harness(), server = serverFixture(1, true);
    serverView.scene.generatedServers = serverAdapter();
    pass.sim.pass = [...server.plates];
    const plateOnly = installShallowTableware(true, ['shallow-plate']);
    expect(plateOnly.tray()).toBeUndefined();
    serverView.scene.drawServer(server, 1200);
    const tray = serverView.images.at(-1)!;
    expect(tray).toMatchObject({ key: 'tray', y: server.y - 11, scaleX: 1, scaleY: 1 });
    const icon = itemIcon(server.plates[0].items[0], false), scale = Math.min(1, 8 / icon.width, 8 / icon.height);
    expect(serverView.images[2].y).toBe(snap(tray.y - icon.height * scale));

    const trayOnly = installShallowTableware(true, ['shallow-tray']);
    expect(trayOnly.passPlate()).toBeUndefined();
    pass.scene.drawPass(3, { x: 0, y: 0 });
    const slot = projectMainPlaneWorld(passSlot(0), MAIN_COUNTER_PLANE);
    expect(pass.images[1]).toMatchObject({ key: 'pass-plate', y: slot.y - 3, scaleX: 1, scaleY: 1 });
    expect(pass.images[0].y).toBe(slot.y - 2 - icon.height);
    expect([backing(pass.textures, 'pass-plate').width, backing(pass.textures, 'pass-plate').height]).toEqual([12, 2]);
  });

  it('clears tableware registration on a new asset load and stops reusing the previous generated dish', () => {
    const h = harness(), tableware = installShallowTableware(true);
    h.sim.pass = serverFixture(1).plates;
    const before = JSON.stringify(h.sim.pass);
    h.scene.drawPass(3, { x: 0, y: 0 });
    const firstKey = h.images[1].key;
    expect(getGeneratedTablewareAdapter()).toBe(tableware);
    expect(h.textures.uploaded.get(firstKey)).toBe(worldSpriteArt(tableware.passPlate()!).canvas);
    clearGeneratedMainAssets();
    expect(getGeneratedTablewareAdapter()).toBeNull();
    h.images.length = 0;
    h.scene.drawPass(3, { x: 0, y: 0 });
    expect(h.images[1].key).toBe('pass-plate');
    expect(h.images[1].key).not.toBe(firstKey);
    expect(h.images[1].scaleX).toBe(1);
    expect(JSON.stringify(h.sim.pass)).toBe(before);
  });
});
