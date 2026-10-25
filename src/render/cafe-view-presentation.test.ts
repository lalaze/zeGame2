import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { adoptCat } from '../game/pets';
import { MIN_SCENE_H, doorwayY, passageSpot, setSceneHeight } from '../game/layout';
import { furnitureDef } from '../game/furniture';
import { CafeView, cellRect, floorAnchor } from './cafe-view';
import { MAIN_COUNTER_PLANE, MAIN_WALL_PLANE, mainPixelProjection, projectMainAttachment, projectMainCellOutline, projectMainPlaneWorld, projectMainWorld, unprojectMainWorld } from './main-pixel-presentation';

vi.mock('./furniture-art', () => ({
  floorFurnitureBounds: (_id: string, cx: number, foot: number) => ({ x: cx - 10, y: foot - 40, w: 20, h: 41 }),
}));

afterEach(() => setSceneHeight(MIN_SCENE_H));

describe('main presentation input and geometry', () => {
  it('uses the real stretched doors at every supported height', () => {
    for (const height of [240, 280, 360]) {
      setSceneHeight(height);
      const options = mainPixelProjection(height);
      expect(options.floorBottom).toBe(height - 7);
      expect(options.doorways).toEqual([{ side: 'left', y: doorwayY('main', 'left') }, { side: 'right', y: doorwayY('main', 'right') }]);
      for (const [x, side] of [[0, 'left'], [320, 'right']] as const) {
        const point = { x, y: doorwayY('main', side) };
        expect(projectMainWorld(point)).toEqual(point);
        expect(unprojectMainWorld(point)).toEqual(point);
        // The existing HTML door controls sit five pixels inside these portals.
        expect(projectMainWorld(passageSpot(side, 'main'))).toEqual(passageSpot(side, 'main'));
      }
    }
  });

  it('never maps other rooms or their elevated objects through the main wall plane', () => {
    for (const point of [{ x: -100, y: 100 }, { x: 450, y: 100 }, { x: 100, y: -100 }]) {
      expect(projectMainWorld(point)).toEqual(point);
      expect(projectMainPlaneWorld(point)).toEqual(point);
    }
  });

  it('inverts floor taps and wall hovers without changing the saved grid', () => {
    const view = new CafeView();
    for (const height of [240, 360]) {
      setSceneHeight(height);
      const logical = { x: 64, y: 181 };
      const expected = view.cellAt('lamp', logical.x, logical.y);
      const painted = projectMainWorld(logical);
      view.withPresentedPointer(painted, point => {
        expect(point.x).toBeCloseTo(logical.x, 10);
        expect(view.cellAt('lamp', point.x, point.y)).toEqual(expected);
      });
      const wall = { x: 92, y: 18 };
      const expectedWall = view.cellAt('clock', wall.x, wall.y);
      view.withPresentedPointer(projectMainPlaneWorld(wall, MAIN_WALL_PLANE), point => {
        expect(view.cellAt('clock', point.x, point.y)).toEqual(expectedWall);
      });
    }
  });

  it('selects a tall sprite at its projected foot bounds, including its upper corners', () => {
    const view = new CafeView();
    const state = createInitialState(0);
    state.decor.placed = [{ id: 'lamp', col: 4, row: 11 }];
    const foot = floorAnchor(furnitureDef('lamp')!, 4, 11);
    const painted = projectMainWorld({ x: foot.cx, y: foot.foot });
    const before = JSON.stringify(state);
    for (const dx of [-9.9, 0, 9.9]) {
      view.withPresentedPointer({ x: painted.x + dx, y: painted.y - 39 }, point => {
        expect(view.furnitureAt(state, point.x, point.y)).toBe(0);
      });
    }
    view.withPresentedPointer({ x: painted.x + 10.1, y: painted.y - 39 }, point => {
      expect(view.furnitureAt(state, point.x, point.y)).toBe(-1);
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps wall item picking on its affine plane and restores input context after an exception', () => {
    const view = new CafeView();
    const state = createInitialState(0);
    state.decor.placed = [{ id: 'clock', col: 10, row: 0 }];
    const rect = cellRect('wall', 10, 0, 3, 3);
    const painted = projectMainPlaneWorld({ x: rect.x + 2, y: rect.y + 2 });
    view.withPresentedPointer(painted, point => expect(view.furnitureAt(state, point.x, point.y)).toBe(0));
    expect(() => view.withPresentedPointer(painted, () => { throw new Error('cancel'); })).toThrow('cancel');
    expect(view.furnitureAt(state, rect.x + 1, rect.y + 1)).toBe(0);
  });

  it('matches resident hit targets and hearts to the projected cat instead of its head depth', () => {
    const state = createInitialState(0); state.coins = 1e6; adoptCat(state, 'ginger');
    const view = new CafeView(); view.livingCats.update(state, 0);
    const cat = view.livingCats.actors.get('ginger')!;
    Object.assign(cat, { area: 'main', x: 42, y: 179 });
    const painted = projectMainWorld(cat);
    view.withPresentedPointer({ x: painted.x + 23, y: painted.y - 8 }, point => expect(view.hitResidentCat(point.x, point.y, 24)).toBe('ginger'));
    view.withPresentedPointer({ x: painted.x + 25, y: painted.y - 8 }, point => expect(view.hitResidentCat(point.x, point.y, 24)).toBe(null));
    expect(view.petResidentCat('ginger')).toBe(true);
    expect(view.effectPoint(view.effects[0])).toEqual(projectMainAttachment(view.effects[0], cat));
  });

  it('keeps assistance feedback and particles anchored on the person who was helped', () => {
    const view = new CafeView(); const anchor = { x: 94, y: 108 };
    view.assistance('A little faster!', anchor, 'brew');
    expect(view.assistanceLabels).toEqual([{ text: 'A little faster!', ...projectMainAttachment({ x: 94, y: 70 }, anchor) }]);
    expect(view.effects).toHaveLength(4);
    for (const effect of view.effects) expect(view.effectPoint(effect)).toEqual(projectMainAttachment(effect, anchor));
    expect(view.effects.at(-1)?.kind).toBe('steam');
  });

  it('projects bell and restock effects with the fixed counter plane', () => {
    const view = new CafeView();
    view.addEvents([{ type: 'bell', x: 244, y: 59 }, { type: 'restock' } as never]);
    for (const effect of view.effects) expect(view.effectPoint(effect)).toEqual(projectMainPlaneWorld(effect, MAIN_COUNTER_PLANE));
  });

  it('projects all ghost corners and intermediate edges but preserves other-room boundary cells', () => {
    const rect = { x: 16, y: 105, w: 40, h: 32 };
    const outline = projectMainCellOutline(rect, 'floor', 'main');
    for (const corner of [{ x: 16, y: 105 }, { x: 56, y: 105 }, { x: 56, y: 137 }, { x: 16, y: 137 }]) {
      expect(outline).toContainEqual(projectMainWorld(corner));
    }
    expect(outline.length).toBeGreaterThan(4);
    expect(projectMainCellOutline({ x: 320, y: 100, w: 8, h: 8 }, 'floor', 'reading')[0]).toEqual({ x: 320, y: 100 });
  });

  it('keeps map-selection input unprojected', () => {
    const view = new CafeView(); view.setOverview(true, true);
    const point = { x: 24, y: 80 };
    view.withPresentedPointer(point, logical => expect(logical).toEqual(point));
  });
});
