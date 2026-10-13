/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest';
import fixture from '../../docs/cafe-styles/navigation/blocked-chair-fixture.json';
import { INGREDIENTS, MENU } from './data';
import { openShop } from './day';
import { bakeForForecast, restock } from './economy';
import { CELL, COLS, FLOOR_ROWS, canPlace, evictBlocked, placeFurniture } from './furniture';
import { GOALS } from './goals';
import { FLOOR_Y, MAX_SCENE_H, MIN_SCENE_H, areaOrigin, floorY, seatApproach, setKitchenLevel, setSceneHeight } from './layout';
import { REGIONS, activeTableIndices, areaAtX, mainTableCount, regionOffset } from './regions';
import { Sim } from './sim';
import { consumeFurnitureMovesOnLoad, createInitialState, deserialize, serialize } from './state';

afterEach(() => { setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });
function legacyFixture() {
  const state = createInitialState(0);
  Object.assign(state, structuredClone(fixture.ownership));
  state.coins = fixture.remainingCash;
  state.day = 10; state.goal = GOALS.length; state.served = MENU.length * 100;
  state.onMenu = ['cappuccino'];
  for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = 0;
  setSceneHeight(MIN_SCENE_H); setKitchenLevel(state.upgrades.cook);
  return state;
}
function runDay(state: ReturnType<typeof createInitialState>) {
  let seed = fixture.seed;
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; });
  bakeForForecast(state); restock(state); openShop(state);
  for (let tick = 0; tick < fixture.openSeconds / fixture.dt; tick++) sim.update(state, fixture.dt);
  sim.beginClosing(state);
  let closingSeconds = 0;
  while (!sim.finishedService && closingSeconds < 300) {
    sim.update(state, fixture.dt); closingSeconds += fixture.dt;
  }
  return { sim, closingSeconds };
}

describe('chair-access placement guard', () => {
  it('rejects the previously legal fern that covers table 2 left-chair approach', () => {
    const state = createInitialState(0);
    // The next table is protected before purchase, then remains protected after.
    expect(canPlace(state, 'plant_fern', 1, 14, mainTableCount(state))).toBe(false);
    state.upgrades.tables = 1;
    expect(canPlace(state, 'plant_fern', 1, 14, mainTableCount(state))).toBe(false);
    // A nearby genuinely clear location remains available for the same furniture.
    expect(canPlace(state, 'plant_fern', 1, 15, mainTableCount(state))).toBe(true);
    state.decor.stored.plant_fern = 1;
    expect(placeFurniture(state, 'plant_fern', 1, 14, mainTableCount(state))).toBe(false);
    expect(state.decor.stored.plant_fern).toBe(1);
  });

  it('stores the historical obstruction on load, retaining the asset and all purchases', () => {
    const original = legacyFixture();
    const restored = deserialize(serialize(original), 0);
    expect(restored.decor.placed.some(p => p.id === 'plant_fern')).toBe(false);
    expect(restored.decor.stored.plant_fern).toBe(1);
    expect(restored.coins).toBe(original.coins);
    expect(restored.items).toEqual(original.items); expect(restored.upgrades).toEqual(original.upgrades);
    expect(restored.pets).toEqual(original.pets); expect(restored.regions).toEqual(original.regions);
    expect(evictBlocked(restored, mainTableCount(restored))).toBe(0);
    expect(consumeFurnitureMovesOnLoad(restored)).toBe(1);
    expect(consumeFurnitureMovesOnLoad(restored)).toBe(0);
    const payload = serialize(restored);
    expect(payload).not.toContain('furnitureMovesOnLoad');
    let next = restored;
    for (let reload = 0; reload < 3; reload++) {
      next = deserialize(serialize(next), 0);
      expect(next.decor.stored.plant_fern).toBe(1);
      expect(next.decor.placed.filter(p => p.id === 'plant_fern')).toHaveLength(0);
      expect(next.coins).toBe(original.coins);
      expect(consumeFurnitureMovesOnLoad(next)).toBe(0);
    }
  });

  it('has no load notice for new cafés or unchanged valid arrangements', () => {
    const fresh = createInitialState(0);
    expect(consumeFurnitureMovesOnLoad(fresh)).toBe(0);
    fresh.decor.stored.plant_fern = 1;
    expect(placeFurniture(fresh, 'plant_fern', 1, 15, mainTableCount(fresh))).toBe(true);
    const loaded = deserialize(serialize(fresh), 0);
    expect(consumeFurnitureMovesOnLoad(loaded)).toBe(0);
    expect(loaded.decor).toEqual(fresh.decor);
  });

  it('keeps every permitted floor cell outside chair approach clearance in every dining room', () => {
    const state = createInitialState(0); state.upgrades.tables = 6; state.regions = REGIONS.map(r => r.id);
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      const approaches = activeTableIndices(state).flatMap(table => [seatApproach(table, 0), seatApproach(table, 1)]);
      for (let col = 0; col < COLS * 4; col++) for (let row = 0; row < FLOOR_ROWS; row++) {
        if (!canPlace(state, 'plant_snake', col, row, mainTableCount(state))) continue;
        const area = areaAtX(col * CELL)!; const origin = areaOrigin(area);
        const x = origin.x + col * CELL - regionOffset(area);
        const y = origin.y + floorY(FLOOR_Y + row * CELL);
        const bottom = origin.y + floorY(FLOOR_Y + (row + 1) * CELL);
        for (const approach of approaches) {
          const blocks = approach.x > x - 8 && approach.x < x + CELL + 8 && approach.y > y - 8 && approach.y < bottom + 8;
          expect(blocks, JSON.stringify({ height, col, row, approach })).toBe(false);
        }
      }
    }
  });

  it('resumes an already blocked saved visit after safely storing the old obstruction', () => {
    const original = legacyFixture();
    // Deliberately inject an old arrangement, bypassing the new placement guard.
    const { sim } = runDay(original);
    // Arrival timing can change the visit ID; the historical obstruction must
    // still genuinely block the guest approaching this left-hand chair.
    const blocked = sim.customers.find(c => c.pathBlocked && c.phase === 'toSeat');
    expect(blocked).toBeDefined();
    expect(blocked!.seat).toBe(4);
    const blockedId = blocked!.id;
    const snapshot = sim.snapshot(original);
    const state = deserialize(serialize(original), 0);
    const served = state.today.served;
    const resumed = new Sim(() => 0.5);
    expect(resumed.restore(snapshot, state)).toBe(true);
    expect(resumed.customers.find(c => c.id === blockedId)?.pathBlocked).toBe(false);
    expect(state.decor.stored.plant_fern).toBe(1);
    expect(state.today.served).toBe(served);
    for (let tick = 0; tick < 1200 && !resumed.finishedService; tick++) resumed.update(state, 0.05);
    expect(resumed.finishedService).toBe(true);
    expect(resumed.customers.some(c => c.pathBlocked)).toBe(false);
    expect(resumed.customers.find(c => c.id === blockedId)?.hasCup).toBe(true);
    expect(state.today.served).toBe(served + 1);
  });

  it('naturally finishes the exact historical paid fixture after obstruction repair', () => {
    const state = legacyFixture();
    evictBlocked(state, mainTableCount(state));
    const { sim, closingSeconds } = runDay(state);
    expect(sim.finishedService, JSON.stringify(sim.customers.map(c => ({ id: c.id, phase: c.phase, seat: c.seat, pathBlocked: c.pathBlocked, x: c.x, y: c.y, journey: c.journey })))).toBe(true);
    expect(sim.customers.some(c => c.pathBlocked)).toBe(false);
    expect(closingSeconds).toBeLessThan(300);
    if (import.meta.env.MODE === 'test' && process.env.CHAIR_ACCESS_EVIDENCE === '1') console.log(JSON.stringify({ seed: fixture.seed, openSeconds: fixture.openSeconds, closingSeconds, finishedService: sim.finishedService, served: state.today.served, storedFern: state.decor.stored.plant_fern }));
    expect(state.today.served).toBeGreaterThan(0);
  });
});
