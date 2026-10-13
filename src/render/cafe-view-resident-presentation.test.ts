import { afterEach, describe, expect, it } from 'vitest';
import { areaOrigin, MIN_SCENE_H, setSceneHeight } from '../game/layout';
import { adoptCat } from '../game/pets';
import { createInitialState } from '../game/state';
import { CafeView } from './cafe-view';
import { projectMainWorld } from './main-pixel-presentation';
import type { PixelPoint } from './pixel-projection';

afterEach(() => setSceneHeight(MIN_SCENE_H));

function residents() {
  const state = createInitialState(0);
  state.coins = 1e6;
  adoptCat(state, 'siamese');
  adoptCat(state, 'ginger');
  const view = new CafeView();
  view.livingCats.update(state, 0);
  const cat = view.livingCats.actors.get('siamese')!;
  const other = view.livingCats.actors.get('ginger')!;
  Object.assign(cat, { area: 'main', x: 85, y: 187 });
  Object.assign(other, { area: 'main', x: 240, y: 187 });
  return { state, view, cat, other };
}

function hitPresented(view: CafeView, point: PixelPoint, radius?: number) {
  return view.withPresentedPointer(point, logical => view.hitResidentCat(logical.x, logical.y, radius));
}

describe('resident presentation hit points', () => {
  it.each([240, 360])('defaults to projected actor feet at height %s', height => {
    setSceneHeight(height);
    const { view, cat } = residents();
    const foot = projectMainWorld(cat);
    expect(hitPresented(view, { x: foot.x + 11.9, y: foot.y - 8 })).toBe(cat.id);
    expect(hitPresented(view, { x: foot.x + 12.1, y: foot.y - 8 })).toBe(null);
    expect(view.hitResidentCat(cat.x + 11.9, cat.y - 8)).toBe(cat.id);
  });

  it.each([-12, 12])('targets a 24×18 cat shifted by %s without mutating logical state', dx => {
    const { state, view, cat } = residents();
    const before = JSON.stringify({ state, actors: [...view.livingCats.actors] });
    const logicalFoot = projectMainWorld(cat);
    const painted = { x: logicalFoot.x + dx, y: logicalFoot.y - 8 };
    const outsideOldTarget = { x: painted.x + Math.sign(dx) * 11.9, y: painted.y - 17 };
    expect(hitPresented(view, outsideOldTarget)).toBe(null);
    view.setPresentedResidentCatPoint(cat.id, painted);
    expect(hitPresented(view, outsideOldTarget)).toBe(cat.id);
    expect(hitPresented(view, { x: painted.x, y: painted.y - 8 })).toBe(cat.id);
    expect(hitPresented(view, { x: painted.x + Math.sign(dx) * 12.1, y: painted.y - 8 })).toBe(null);
    expect(view.hitResidentCat(cat.x, cat.y - 8)).toBe(cat.id);
    expect(view.hitResidentCat(cat.x + Math.sign(dx) * 23.9, cat.y - 8)).toBe(null);
    expect(JSON.stringify({ state, actors: [...view.livingCats.actors] })).toBe(before);
  });

  it('uses presented feet for nearest-wins ordering, leaving raw ordering unchanged', () => {
    const { view, cat, other } = residents();
    Object.assign(cat, { x: 100, y: 150 });
    Object.assign(other, { x: 108, y: 150 });
    view.setPresentedResidentCatPoint(cat.id, { x: 108, y: 150 });
    view.setPresentedResidentCatPoint(other.id, { x: 100, y: 150 });
    expect(hitPresented(view, { x: 107, y: 142 })).toBe(cat.id);
    expect(view.hitResidentCat(107, 142)).toBe(other.id);
  });

  it('supports mixed registered and fallback feet and the existing mobile radius', () => {
    const { view, cat, other } = residents();
    const foot = { x: 100, y: 170 };
    view.setPresentedResidentCatPoint(cat.id, foot);
    expect(hitPresented(view, { x: 123, y: 162 }, 24)).toBe(cat.id);
    expect(hitPresented(view, { x: 125, y: 162 }, 24)).toBe(null);
    const fallback = projectMainWorld(other);
    expect(hitPresented(view, { x: fallback.x, y: fallback.y - 8 })).toBe(other.id);
  });

  it('clears the whole prior frame, including when the next frame draws no residents', () => {
    const { view, cat, other } = residents();
    view.setPresentedResidentCatPoint(cat.id, { x: 150, y: 150 });
    view.setPresentedResidentCatPoint(other.id, { x: 190, y: 150 });
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(cat.id);
    expect(hitPresented(view, { x: 190, y: 142 })).toBe(other.id);
    view.clearPresentedResidentCatPoints();
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
    expect(hitPresented(view, { x: 190, y: 142 })).toBe(null);
    const fallback = projectMainWorld(cat);
    expect(hitPresented(view, { x: fallback.x, y: fallback.y - 8 })).toBe(cat.id);
    view.setPresentedResidentCatPoint(cat.id, { x: 160, y: 150 });
    expect(hitPresented(view, { x: 160, y: 142 })).toBe(cat.id);
  });

  it('snapshots supplied points and replaces a cat’s prior presentation', () => {
    const { view, cat } = residents();
    const point = { x: 150, y: 150 };
    view.setPresentedResidentCatPoint(cat.id, point);
    point.x = 190;
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(cat.id);
    view.setPresentedResidentCatPoint(cat.id, point);
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
    expect(hitPresented(view, { x: 190, y: 142 })).toBe(cat.id);
  });

  it.each([{ x: NaN, y: 150 }, { x: 150, y: Infinity }])('drops invalid presentation %j', point => {
    const { view, cat } = residents();
    view.setPresentedResidentCatPoint(cat.id, { x: 150, y: 150 });
    view.setPresentedResidentCatPoint(cat.id, point);
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
    const fallback = projectMainWorld(cat);
    expect(hitPresented(view, { x: fallback.x, y: fallback.y - 8 })).toBe(cat.id);
  });

  it('cannot create phantom cats after removal or leak presentation to another view', () => {
    const { view, cat } = residents();
    const point = { x: 150, y: 150 };
    view.setPresentedResidentCatPoint(cat.id, point);
    expect(hitPresented(residents().view, { x: 150, y: 142 })).toBe(null);
    view.livingCats.actors.delete(cat.id);
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
    view.setPresentedResidentCatPoint(cat.id, point);
    view.livingCats.actors.set(cat.id, cat);
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
  });

  it.each(['paused', 'overview', 'panning'] as const)('keeps the %s input mask', mask => {
    const { view, cat } = residents();
    view.setPresentedResidentCatPoint(cat.id, { x: 150, y: 150 });
    if (mask === 'paused') view.paused = true;
    if (mask === 'overview') view.setOverview(true, true);
    if (mask === 'panning') {
      view.moveToArea('reading', true);
      view.moveToArea('main');
      expect(view.panning).toBe(true);
    }
    expect(hitPresented(view, { x: 150, y: 142 })).toBe(null);
    expect(view.hitResidentCat(cat.x, cat.y - 8)).toBe(null);
  });

  it.each(['reading', 'greenhouse', 'terrace'] as const)('uses world coordinates and room masking in %s', area => {
    const { view, cat, other } = residents();
    const origin = areaOrigin(area);
    Object.assign(cat, { area, x: origin.x + 85, y: origin.y + 187 });
    const painted = { x: cat.x + 12, y: cat.y - 8 };
    view.setPresentedResidentCatPoint(cat.id, painted);
    // A closer rendered point from a different room must not steal this tap.
    view.setPresentedResidentCatPoint(other.id, { x: painted.x + 11, y: painted.y });
    view.moveToArea(area, true);
    expect(hitPresented(view, { x: painted.x + 11, y: painted.y - 8 })).toBe(cat.id);
    expect(view.hitResidentCat(cat.x, cat.y - 8)).toBe(cat.id);
    view.clearPresentedResidentCatPoints();
    expect(hitPresented(view, { x: cat.x, y: cat.y - 8 })).toBe(cat.id);
    view.moveToArea('main', true);
    expect(hitPresented(view, { x: cat.x, y: cat.y - 8 })).toBe(null);
  });

  it('restores raw hit dispatch after a presented-pointer exception', () => {
    const { view, cat } = residents();
    view.setPresentedResidentCatPoint(cat.id, { x: 150, y: 150 });
    expect(() => view.withPresentedPointer({ x: 150, y: 142 }, () => {
      expect(view.hitResidentCat(0, 0)).toBe(cat.id);
      throw new Error('cancel');
    })).toThrow('cancel');
    expect(view.hitResidentCat(cat.x, cat.y - 8)).toBe(cat.id);
    expect(view.hitResidentCat(150, 142)).toBe(null);
  });
});
