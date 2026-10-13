import { afterEach, describe, expect, it } from 'vitest';
import { FLOOR_Y, MAX_SCENE_H, MIN_SCENE_H, SCENE_W, doorwayY, passageY, setKitchenLevel, setSceneHeight } from '../game/layout';
import type { AreaId } from '../game/regions';
import { createInitialState } from '../game/state';
import { paintFloor } from './decor-art';
import { lightingAt } from './lighting';
import { paintPassageFloor, paintRoomBoundaries } from './passages';
import { RoomPainter } from './room-art';

type Rect = [x: number, y: number, width: number, height: number, color: string];
const SILL_COLORS = ['#967655', '#b89a70', '#dfc596'];

function record(paint: (ctx: CanvasRenderingContext2D) => void): Rect[] {
  const rectangles: Rect[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
      rectangles.push([x, y, w, h, this.fillStyle]);
    },
    save() {}, restore() {},
  } as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return rectangles;
}

function boundaries(area: AreaId, kitchen: boolean, kitchenDoor = 0, guestRooms = false): Rect[] {
  const state = createInitialState(0);
  state.kitchen = kitchen;
  if (guestRooms) state.regions = ['reading', 'greenhouse', 'terrace'];
  return record(ctx => paintRoomBoundaries(ctx, area, state, kitchenDoor));
}

function colorAt(rectangles: Rect[], x: number, y: number): string | undefined {
  for (let i = rectangles.length - 1; i >= 0; i--) {
    const [left, top, width, height, color] = rectangles[i];
    if (x >= left && x < left + width && y >= top && y < top + height) return color;
  }
}

afterEach(() => { setKitchenLevel(0); setSceneHeight(MIN_SCENE_H); });

describe('kitchen doorway threshold', () => {
  it.each([false, true])('keeps the sill within eight pixels on both sides (built: %s)', kitchen => {
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) for (const stage of [0, 1, 2]) {
      setSceneHeight(height);
      setKitchenLevel(stage);
      for (const kitchenDoor of [0, 0.5, 1]) {
        for (const area of ['main', 'kitchen'] as const) {
          const direction = area === 'main' ? 'left' : 'right';
          const x = area === 'main' ? 0 : SCENE_W - 8;
          expect(doorwayY(area, direction)).toBe(88);
          const rectangles = boundaries(area, kitchen, kitchenDoor);
          expect(rectangles.filter(rect => SILL_COLORS.includes(rect[4]))).toEqual([
            [x, 76, 8, 24, '#967655'],
            [x + 1, 77, 6, 22, '#b89a70'],
            [x + (area === 'main' ? 6 : 1), 77, 1, 22, '#dfc596'],
          ]);
          // Frames may overhang by two pixels, but no boundary becomes a floor-wide strip.
          expect(rectangles.every(rect => rect[2] <= 9)).toBe(true);
        }
      }
    }
  });

  it.each(['main', 'kitchen'] as const)('retains the construction barrier in %s until built', area => {
    const x = area === 'main' ? 0 : SCENE_W - 5;
    const closed = boundaries(area, false);
    expect(boundaries(area, false, 1)).toEqual(closed);
    expect(closed).toContainEqual([x, 76, 5, 24, '#916444']);
    for (const y of [78, 85, 92, 99]) expect(closed).toContainEqual([x, y, 5, 2, '#efcf94']);
    expect(closed).toContainEqual([x + 1, 86, 3, 4, '#e6b34d']);
    expect(closed.some(rect => rect[4] === '#b9c4cb')).toBe(false);
  });

  it.each(['main', 'kitchen'] as const)('keeps the swinging steel leaf above the sill in %s', area => {
    const x = area === 'main' ? 0 : SCENE_W - 5;
    const closed = boundaries(area, true);
    const halfOpen = boundaries(area, true, 0.5);
    const open = boundaries(area, true, 1);
    expect(closed).toContainEqual([x + 1, 75, 3, 25, '#b9c4cb']);
    expect(closed).toContainEqual([x + 2, 82, 1, 2, '#ffcf7a']);
    expect(halfOpen).toContainEqual([x + 1, 75, 3, 12, '#b9c4cb']);
    expect(open.some(rect => rect[4] === '#b9c4cb')).toBe(false);
    expect(closed.indexOf(closed.find(rect => rect[4] === '#b9c4cb')!))
      .toBeGreaterThan(closed.indexOf(closed.find(rect => rect[4] === '#dfc596')!));
    expect(closed).not.toContainEqual([x, 76, 5, 24, '#916444']);
  });

  it('does not add a service runner across the main floor or inside the kitchen', () => {
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      const main = record(ctx => paintPassageFloor(ctx, 'main'));
      expect(main.length).toBeGreaterThan(0);
      expect(main.every(([, y, , h]) => y >= 100 || y + h <= 76)).toBe(true);
      expect(main.every(([x]) => x >= 64)).toBe(true);
      expect(record(ctx => paintPassageFloor(ctx, 'kitchen'))).toEqual([]);
    }
  });

  it('leaves the main-room floor material visible between the sill and the counter', () => {
    const height = MIN_SCENE_H;
    setSceneHeight(height);
    const floor = record(ctx => paintFloor(ctx, 'floor_wood', 0, FLOOR_Y, SCENE_W, height - FLOOR_Y));
    const main = record(ctx => new RoomPainter(ctx).drawFloor('floor_wood', 'rug_none', lightingAt(0), height));
    // Beyond the edge shadow, there must be no STAFF label, arrows, or separate strip.
    for (let x = 12; x < 64; x++) for (let y = 83; y < 100; y++) {
      expect(colorAt(main, x, y), `floor at ${x},${y}`).toBe(colorAt(floor, x, y));
    }
  });
});

describe('guest doorway rendering', () => {
  it.each([false, true])('preserves the main-to-reading doorway (open: %s)', open => {
    const y = passageY();
    const guestDoor = (kitchen: boolean, kitchenDoor: number) => boundaries('main', kitchen, kitchenDoor, open)
      .filter(([x, top, , h]) => x >= SCENE_W - 7 && top >= y - 17 && top + h <= y + 17);
    const expected: Rect[] = [
      [313, y - 17, 9, 4, '#493127'], [314, y - 17, 7, 2, '#dec19a'],
      [313, y + 13, 9, 4, '#493127'], [314, y + 13, 7, 2, '#dec19a'],
    ];
    if (!open) expected.push(
      [315, y - 12, 5, 24, '#916444'],
      ...[-10, -3, 4, 11].map(offset => [315, y + offset, 5, 2, '#efcf94'] as Rect),
      [316, y - 2, 3, 4, '#e6b34d'],
    );
    // Joinery highlights can add marks; physical doorway layers and all locked
    // barrier primitives must still exist, independent of the service door.
    for (const rect of expected) expect(guestDoor(false, 0)).toContainEqual(rect);
    expect(guestDoor(true, 1)).toEqual(guestDoor(false, 0));
    for (const area of ['reading', 'greenhouse', 'terrace'] as const) {
      expect(boundaries(area, true, 1, open).some(rect => SILL_COLORS.includes(rect[4]))).toBe(false);
    }
  });
});
