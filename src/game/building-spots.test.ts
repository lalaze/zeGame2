import { describe, expect, it } from 'vitest';
import { BUILDING_SPOTS, FORMER_CELLS, storeys } from './building-spots';
import { comfort } from './decor';
import { FURNITURE, STARTER_FURNITURE, builtSpots, canStand, evictBlocked, furnitureDef, moveToSpot, openSpots, placeFurniture, settleInBuilding, standFurniture, storeFurniture, storedCount } from './furniture';
import { canEmergencyRestock } from './recovery';
import { GOALS } from './goals';
import { mainTableCount } from './regions';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { Sim } from './sim';

const NOW = 1_000;
function cafe(tables = 2): GameState {
  const state = createInitialState(NOW);
  state.upgrades.tables = tables - 2;
  state.decor.placed = [];
  settleInBuilding(state);
  return state;
}
const reload = (state: GameState) => deserialize(serialize(state), NOW);
const floorKinds = FURNITURE.filter((d) => d.surface === 'floor');

describe('the building\'s spots', () => {
  it('come with the storeys the tables bring', () => {
    expect(storeys(2)).toEqual(['roof', 'ground']);
    expect(storeys(3)).toEqual(['roof', 'floor-2', 'ground']);
    expect(storeys(8)).toEqual(['roof', 'floor-3', 'floor-2', 'ground']);
    expect(new Set(BUILDING_SPOTS.map((spot) => spot.id)).size).toBe(BUILDING_SPOTS.length);
    const count = (tables: number, surface: string) => builtSpots(cafe(tables)).filter((spot) => spot.surface === surface).length;
    expect([2, 3, 5, 6, 8].map((t) => count(t, 'floor'))).toEqual([6, 12, 12, 18, 18]);
    expect([2, 3, 5, 6, 8].map((t) => count(t, 'wall'))).toEqual([4, 7, 7, 10, 10]);
  });

  it('hold one piece each, of their own surface', () => {
    const state = cafe();
    state.decor.stored = { plant_fern: 2, sofa: 1, art_cat: 1 };
    expect(standFurniture(state, 'plant_fern', 'ground-left')).toBe(true);
    expect(standFurniture(state, 'sofa', 'ground-left')).toBe(false);
    expect(standFurniture(state, 'art_cat', 'ground-right')).toBe(false);
    expect(standFurniture(state, 'sofa', 'floor-2-front-1')).toBe(false);
    expect(standFurniture(state, 'piano', 'ground-right')).toBe(false);
    expect(standFurniture(state, 'art_cat', 'ground-wall-1')).toBe(true);
    expect(storedCount(state, 'plant_fern')).toBe(1);
    expect(state.decor.placed).toEqual([{ id: 'plant_fern', col: -1, row: -1, spot: 'ground-left' }, { id: 'art_cat', col: -1, row: -1, spot: 'ground-wall-1' }]);
    expect(openSpots(state, 'sofa').map((spot) => spot.id)).not.toContain('ground-left');
    expect(canStand(state, 'plant_fern', 'ground-left', 0)).toBe(true);
    expect(moveToSpot(state, 0, 'roof-back')).toBe(true);
    expect(standFurniture(state, 'sofa', 'ground-left')).toBe(true);
    storeFurniture(state, 0);
    expect(storedCount(state, 'plant_fern')).toBe(2);
    expect(comfort(state)).toBeGreaterThanOrEqual(furnitureDef('sofa')!.comfort + furnitureDef('art_cat')!.comfort);
  });

  it('can be filled with every table out, and keep their pieces as tables are added', () => {
    const state = cafe(2);
    state.decor.stored = { piano: 1, sofa: 1 };
    expect(standFurniture(state, 'piano', 'roof-front-1')).toBe(true);
    expect(standFurniture(state, 'sofa', 'ground-right')).toBe(true);
    for (let tables = 3; tables <= 8; tables++) {
      state.upgrades.tables = tables - 2;
      expect(evictBlocked(state, mainTableCount(state)), `${tables} tables`).toBe(0);
      expect(openSpots(state, 'lamp').length).toBeGreaterThan(0);
    }
    expect(state.decor.placed.map((p) => p.spot)).toEqual(['roof-front-1', 'ground-right']);
  });

  it('never stand in anyone\'s way in the Sim', () => {
    const state = cafe(2), bare = new Sim(() => .5), furnished = new Sim(() => .5);
    bare.update(state, 0);
    state.decor.stored = { piano: 1 };
    standFurniture(state, 'piano', 'ground-left');
    furnished.update(state, 0);
    const obstacles = (sim: Sim) => JSON.stringify([...(sim as unknown as { navigationObstacles: Map<string, unknown> }).navigationObstacles]);
    expect(obstacles(furnished)).toBe(obstacles(bare));
  });
});

describe('moving in from the pixel room', () => {
  it('hangs the starter pieces and does nothing the second time', () => {
    const state = createInitialState(NOW);
    expect(settleInBuilding(state)).toBe(0);
    expect(state.decor.building).toBe(true);
    expect(state.decor.placed.map((p) => p.id)).toEqual(STARTER_FURNITURE.map((p) => p.id));
    expect(state.decor.placed.map((p) => p.spot)).toEqual(['ground-wall-1', 'ground-wall-2']);
    const before = serialize(state);
    expect(settleInBuilding(state)).toBe(0);
    expect(serialize(state)).toBe(before);
  });

  it('keeps pieces where the building showed them, lets the cosiest choose next, and stores the rest', () => {
    const state = createInitialState(NOW);
    state.upgrades.tables = 1;
    state.decor.placed = [];
    state.decor.stored = Object.fromEntries(floorKinds.map((d) => [d.id, 1]));
    // One at a cell the building drew as a spot, the others anywhere on the grid.
    expect(placeFurniture(state, 'plant_fern', 2, 17, 3)).toBe(true);
    for (const d of floorKinds) {
      for (let row = 25; row >= 0 && storedCount(state, d.id); row--) for (let col = 0; col < 40 && storedCount(state, d.id); col++) placeFurniture(state, d.id, col, row, 3);
    }
    const placed = state.decor.placed.map((p) => p.id);
    expect(placed.length).toBeGreaterThan(12);
    const kept = state.decor.placed.filter((p) => FORMER_CELLS.some((cell) => cell.col - Math.floor(furnitureDef(p.id)!.w / 2) === p.col && cell.row - furnitureDef(p.id)!.h + 1 === p.row)).map((p) => p.id);
    expect(kept).toContain('plant_fern');
    const moved = settleInBuilding(state);
    expect(moved).toBe(placed.length - 12);
    expect(state.decor.placed.find((p) => p.id === 'plant_fern')!.spot).toBe('ground-left');
    expect(state.decor.placed.every((p) => p.spot !== undefined && p.col === -1)).toBe(true);
    // Nothing is lost, and what went to storage is less cosy than what stayed.
    for (const id of placed) expect(state.decor.placed.filter((p) => p.id === id).length + storedCount(state, id), id).toBe(1);
    const least = Math.min(...state.decor.placed.filter((p) => !kept.includes(p.id)).map((p) => furnitureDef(p.id)!.comfort));
    const stored = placed.filter((id) => !state.decor.placed.some((p) => p.id === id));
    expect(Math.max(...stored.map((id) => furnitureDef(id)!.comfort))).toBeLessThanOrEqual(least);
  });

  it('settles a second copy of a kind after the kinds that add comfort', () => {
    const state = cafe(2);
    state.decor.placed = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: 'piano', col: 1 + i, row: 20 })),
      ...['lamp', 'sofa', 'catbed'].map((id, i) => ({ id, col: 10 + i, row: 20 })),
    ];
    expect(settleInBuilding(state)).toBe(1);
    expect(state.decor.placed.map((p) => p.id).sort()).toEqual(['catbed', 'lamp', 'piano', 'piano', 'piano', 'sofa']);
    expect(storedCount(state, 'piano')).toBe(1);
  });
});

describe('saved furniture', () => {
  it('comes back at its spots', () => {
    const state = cafe(6);
    state.decor.stored = { bookshelf: 1, art_bean: 1 };
    standFurniture(state, 'bookshelf', 'floor-3-window');
    standFurniture(state, 'art_bean', 'roof-wall-1');
    const back = reload(state);
    expect(back.decor.placed).toEqual(state.decor.placed);
    expect(back.decor.building).toBe(true);
    expect(reload(createInitialState(NOW)).decor.building).toBeUndefined();
  });

  it('goes to storage from a spot that is unknown, taken, the wrong surface or not built', () => {
    const state = cafe(2);
    state.decor.placed = [
      { id: 'sofa', col: -1, row: -1, spot: 'ground-left' },
      { id: 'lamp', col: -1, row: -1, spot: 'ground-left' },
      { id: 'catbed', col: -1, row: -1, spot: 'cellar' },
      { id: 'art_cat', col: -1, row: -1, spot: 'ground-right' },
      { id: 'piano', col: -1, row: -1, spot: 'floor-3-front-1' },
    ];
    const back = reload(state);
    expect(back.decor.placed).toEqual([{ id: 'sofa', col: -1, row: -1, spot: 'ground-left' }]);
    expect(back.decor.stored).toEqual({ lamp: 1, catbed: 1, art_cat: 1, piano: 1 });
  });
});

describe('the comfort goal in the building', () => {
  function broke(state: GameState): GameState {
    state.goal = GOALS.findIndex((g) => g.id === 'comfort');
    state.coins = 0;
    for (const id of Object.keys(state.pantry) as (keyof typeof state.pantry)[]) state.pantry[id] = 0;
    state.decor.equipped = { ...createInitialState(NOW).decor.equipped };
    return state;
  }

  it('counts as reachable only with as many pieces as there are spots', () => {
    const cosy = broke(cafe(2));
    cosy.decor.stored = { piano: 1 };
    expect(canEmergencyRestock(cosy)).toBe(false);
    const bare = broke(cafe(2));
    bare.decor.stored = { plant_succulent: 9 };
    expect(canEmergencyRestock(bare)).toBe(true);
    // A café with furniture at its spots is still a valid one to help.
    standFurniture(bare, 'plant_succulent', 'ground-left');
    expect(canEmergencyRestock(bare)).toBe(true);
  });
});
