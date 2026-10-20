import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIN_SCENE_H, setSceneHeight, tablePos } from '../../game/layout';
import { projectMainWorld } from '../main-pixel-presentation';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../table-centerpiece-art',()=>({centerpieceSprite:()=>undefined}));
vi.mock('./textures', () => ({ baked: (_manager: unknown, key: string) => key, canvasKey: () => 'canvas' }));
vi.mock('../sprites', () => {
  const sprite = (name: string) => ({ name, width: 18, height: 28 });
  const frames = { down: [sprite('down')], up: [sprite('up')], left: [sprite('left')], right: [sprite('right')], sitRight: sprite('sit-right'), sitLeft: sprite('sit-left') };
  return { CHAR_H: 28, OUTLINE: '#39281f', character: () => frames, itemIcon: () => ({ name: 'food', width: 8, height: 8 }), catFrames: () => ({}), crownSprite: () => sprite('crown'), dropSprite: () => sprite('drop'), heartSprite: () => sprite('heart'), pixelSprite: () => sprite('pixel') };
});
vi.mock('../room-art', () => ({ RoomPainter: class {}, TABLE_CX: 16, TABLE_TOP_DY: 19, TABLE: () => ({ name: 'table', width: 33, height: 27 }), CHAIR_RIGHT: () => ({ name: 'chair-right', width: 15, height: 26 }), CHAIR_LEFT: () => ({ name: 'chair-left', width: 15, height: 26 }) }));

import { CafeScene } from './cafe-scene';

afterEach(() => setSceneHeight(MIN_SCENE_H));

function harness() {
  const images: { key: string; x: number; y: number }[] = [];
  const scene = Object.create(CafeScene.prototype);
  Object.assign(scene, {
    motionPreference: { matches: true },
    view: { paused: false, livingCats: { actors: new Map() } },
    sim: { customers: [], seats: [] },
    textures: {},
    image: (sprite: string | { name: string }, x: number, y: number) => {
      images.push({ key: typeof sprite === 'string' ? sprite : sprite.name, x, y });
      return { setCrop: () => undefined };
    },
    shadow: vi.fn(),
    rect: vi.fn(),
  });
  return { scene, images };
}

describe('scene projection attachment groups', () => {
  it('moves a server, tray and food by exactly the same foot displacement', () => {
    const { scene, images } = harness();
    const server = { x: 90, y: 190, tx: 90, ty: 190, stride: 0, phase: 'delivering', plates: [{ items: ['espresso'] }], look: {}, ack: 0 };
    scene.drawServer(server, 1190);
    const foot = projectMainWorld(server);
    expect(images.find(i => i.key === 'down')).toMatchObject({ x: Math.round(foot.x * 2) / 2 - 9, y: 163 });
    expect(images.find(i => i.key === 'tray')).toMatchObject({ x: Math.round(foot.x * 2) / 2 - 11, y: 173 });
    expect(images.find(i => i.key === 'food')).toMatchObject({ x: Math.round(foot.x * 2) / 2 - 4, y: 165 });
    expect(server.x).toBe(90);
  });

  it('keeps both chairs, sitter and drink in one unchanged table-local coordinate group', () => {
    const { scene, images } = harness();
    const table = tablePos(0);
    const customer = { id: 7, seat: 0, phase: 'sitting', look: {}, x: table.x - 20, y: table.y + 1 };
    scene.sim.customers = [customer]; scene.sim.seats = [7, null];
    scene.drawTable(0, 0, 1174);
    const foot = projectMainWorld(table);
    expect(images.find(i => i.key === 'table')).toMatchObject({ x: foot.x - 16, y: table.y - 26 });
    expect(images.find(i => i.key === 'chair-right')).toMatchObject({ x: foot.x - 29, y: table.y - 24 });
    expect(images.find(i => i.key === 'chair-left')).toMatchObject({ x: foot.x + 14, y: table.y - 24 });
    expect(images.filter(i => i.key === 'sit-right')).toHaveLength(2);
    expect(images.filter(i => i.key === 'sit-right').every(i => i.x === foot.x - 29)).toBe(true);
    expect(images.find(i => i.key === 'cup')).toMatchObject({ x: foot.x - 9, y: table.y - 24 });
    expect(scene.customerPoint(customer).x).toBe(foot.x - 20);
  });

  it('anchors a sale pop-up on the paying guest, not on stale coordinates', () => {
    const { scene } = harness();
    const table = tablePos(0);
    // A seated guest pays; their coordinates may drift with the walk cycle.
    const guest = { id: 42, seat: 0, phase: 'waiting', look: {}, x: table.x + 9, y: table.y + 3 };
    scene.sim.customers = [guest]; scene.sim.seats = [42, null];
    scene.add = {
      bitmapText: () => ({}),
      container: () => ({ setDepth: () => undefined, setY: () => undefined, destroy: () => undefined, alpha: 1 }),
    };
    scene.tweens = { add: () => undefined, killTweensOf: () => undefined };
    scene.floaters = [];
    scene.view = { viewX: 0, viewY: 0, viewWidth: 320, viewHeight: 240, sales: [], sparkle: () => undefined };
    const floater = scene as unknown as { addFloater: (e: unknown) => void };
    // The event names the visit, so the pop-up lands over their table.
    floater.addFloater({ type: 'sale', amount: 3, x: guest.x, y: guest.y - 52, vip: false, customerId: 42 });
    expect(scene.floaters).toHaveLength(1);
    const seatX = projectMainWorld(table).x;
    expect(Math.abs(scene.floaters[0].x - seatX)).toBeLessThan(30);
    // A guest who already left keeps their own recorded spot.
    floater.addFloater({ type: 'sale', amount: 5, x: 210, y: 90, vip: false, customerId: 999 });
    expect(scene.floaters).toHaveLength(2);
    expect(Math.abs(scene.floaters[1].x - projectMainWorld({ x: 210, y: 142 }).x)).toBeLessThan(30);
  });
});
