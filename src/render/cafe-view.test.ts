import { describe, expect, it } from 'vitest';
import { CELL, WALL_TOP, furnitureDef } from '../game/furniture';
import { CAT_SPOT, FLOOR_Y, areaOrigin } from '../game/layout';
import { regionOffset } from '../game/regions';
import { CafeView, cellRect } from './cafe-view';

describe('café view', () => {
  it('queues effects and sales for the renderer', () => {
    const view = new CafeView();
    view.sparkle(10, 20);
    view.petCat();
    expect(view.effects.filter((e) => e.kind === 'heart')).toHaveLength(3);
    expect(view.effects[0]).toEqual({ kind: 'sparkle', x: 10, y: 20 });
    expect(view.catHappy).toBeGreaterThan(0);
    view.addEvents([
      { type: 'sale', amount: 5, x: 100, y: 80, vip: false },
      { type: 'dayEnd' } as never,
    ]);
    expect(view.sales).toHaveLength(1);
  });

  it('only finds the cat in the main café', () => {
    const view = new CafeView();
    expect(view.hitCat(CAT_SPOT.x, CAT_SPOT.y - 4)).toBe(true);
    expect(view.hitCat(CAT_SPOT.x + 40, CAT_SPOT.y)).toBe(false);
    view.moveToArea('reading', true);
    expect(view.hitCat(CAT_SPOT.x, CAT_SPOT.y - 4)).toBe(false);
  });

  it('maps a pointer to the grid cell of the room in view', () => {
    const view = new CafeView();
    const wall = furnitureDef('clock')!;
    const cell = view.cellAt('clock', 100 + (wall.w * CELL) / 2, WALL_TOP + (wall.h * CELL) / 2);
    expect(cell).toEqual({ col: Math.round(100 / CELL), row: 0 });

    // The same spot in the reading room is further along the shared grid.
    view.moveToArea('reading', true);
    const o = areaOrigin('reading');
    const there = view.cellAt('clock', o.x + 100 + (wall.w * CELL) / 2, o.y + WALL_TOP + (wall.h * CELL) / 2);
    expect(there.col).toBe(cell.col + regionOffset('reading') / CELL);
    expect(cellRect('wall', there.col, there.row, 1, 1).x).toBe(o.x + there.col * CELL - regionOffset('reading'));
  });

  it('puts a floor piece with its front edge where the pointer is', () => {
    const view = new CafeView();
    const lamp = furnitureDef('lamp')!;
    const { row } = view.cellAt('lamp', 60, FLOOR_Y + 3 * CELL + 1);
    expect(row + lamp.h - 1).toBe(3);
  });

  it('zooms out for the floor plan and back in to the chosen room', () => {
    const view = new CafeView();
    view.setOverview(true, true);
    expect(view.zoom).toBe(1 / 3);
    expect(view.viewWidth).toBe(960);
    expect(view.viewX).toBe(areaOrigin('kitchen').x);
    view.moveToArea('greenhouse', true);
    expect(view.overview).toBe(false);
    expect({ x: view.viewX, y: view.viewY }).toEqual(areaOrigin('greenhouse'));
  });
});
