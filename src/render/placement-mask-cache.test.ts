import { afterEach, describe, expect, it } from 'vitest';
import { MIN_SCENE_H, setSceneHeight } from '../game/layout';
import { createInitialState, type GameState } from '../game/state';
import { placementMaskKey } from './placement-mask-cache';

afterEach(() => setSceneHeight(MIN_SCENE_H));

describe('placement mask dependency key', () => {
  const key = (state: GameState) => placementMaskKey(state, 'main', 'floor');

  it.each<[string, (state: GameState) => void]>([
    ['table count', state => { state.upgrades.tables++; }],
    ['opening a region', state => { state.regions.push('reading'); }],
    ['kitchen', state => { state.kitchen = true; }],
    ['placed item id', state => { state.decor.placed[0].id = 'shelf'; }],
    ['placed item column', state => { state.decor.placed[0].col++; }],
    ['placed item row', state => { state.decor.placed[0].row++; }],
    ['adding an item', state => { state.decor.placed.push({ id: 'lamp', col: 4, row: 15 }); }],
    ['storing an item', state => { state.decor.placed.splice(0, 1); }],
    ['item order used by skip', state => { state.decor.placed.reverse(); }],
  ])('invalidates after an in-place change to %s', (_name, mutate) => {
    const state = createInitialState(0);
    const before = key(state);
    mutate(state);
    expect(key(state)).not.toBe(before);
  });

  it('includes area, surface, scene geometry and the skipped item index', () => {
    const state = createInitialState(0);
    const before = key(state);
    expect(placementMaskKey(state, 'reading', 'floor')).not.toBe(before);
    expect(placementMaskKey(state, 'main', 'wall')).not.toBe(before);
    expect(placementMaskKey(state, 'main', 'floor', 0)).not.toBe(before);
    expect(placementMaskKey(state, 'main', 'floor', 1)).not.toBe(placementMaskKey(state, 'main', 'floor', 0));
    expect(placementMaskKey(state, 'main', 'floor', -1)).toBe(before);
    setSceneHeight(360);
    expect(key(state)).not.toBe(before);
  });

  it('detects removing a region without requiring a new state object', () => {
    const state = createInitialState(0);
    state.regions.push('reading');
    const before = key(state);
    state.regions.pop();
    expect(key(state)).not.toBe(before);
  });

  it('reuses equivalent values while ignoring unrelated live state', () => {
    const state = createInitialState(0);
    const before = key(state);
    expect(key(structuredClone(state))).toBe(before);
    state.coins++;
    state.dayTime++;
    state.upgrades.barista++;
    state.decor.stored.lamp = 3;
    state.decor.equipped.floor = 'floor_test';
    expect(key(state)).toBe(before);
  });

  it('does not mutate simulation state', () => {
    const state = createInitialState(0);
    const before = structuredClone(state);
    key(state);
    expect(state).toEqual(before);
  });
});
