import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from './day';
import { canPlace } from './furniture';
import { AREA_IDS, REGIONS, areaConnections, unlockRegion } from './regions';
import { MAX_SCENE_H, MIN_SCENE_H, areaAtPoint, areaOrigin, passageY, roomRoute, sceneHeight, seatSpot, setSceneHeight, tableArea } from './layout';
import { Sim, WALK_SPEED } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => setSceneHeight(MIN_SCENE_H));

function expandedState() {
  const state = createInitialState(0);
  state.coins = 1_000_000;
  for (const region of REGIONS) unlockRegion(state, region.id);
  state.pantry.beans = 1_000;
  return state;
}

describe('physical café floor plan', () => {
  it('places shared doors on actual adjacent walls, with no direct garden-to-street shortcut', () => {
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      expect(areaOrigin('terrace')).toEqual({ x: 0, y: -height });
      expect(areaOrigin('greenhouse')).toEqual({ x: 320, y: -height });
      expect(areaConnections('main')).toEqual([{ direction: 'right', to: 'reading' }]);
      for (const area of AREA_IDS) {
        for (const { to, direction } of areaConnections(area)) {
          const a = areaOrigin(area), b = areaOrigin(to);
          expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(direction === 'left' || direction === 'right' ? 320 : height);
        }
      }
      const route = roomRoute('main', 'terrace');
      expect(route.map((p) => areaAtPoint(p.x, p.y))).toContain('reading');
      expect(route.map((p) => areaAtPoint(p.x, p.y))).toContain('greenhouse');
      expect(route.every((p) => areaAtPoint(p.x, p.y))).toBe(true);
      expect(roomRoute('terrace', 'main')).toEqual([...route].reverse());
    }
  });

  it('protects doorways and circulation from placed furniture, and stores old obstructions safely', () => {
    const state = expandedState();
    expect(canPlace(state, 'plant_fern', 50, 7, 2)).toBe(false);
    expect(canPlace(state, 'art_landscape', 58, 0, 2)).toBe(false); // Reading room rear doorway.
    expect(canPlace(state, 'plant_fern', 51, 9, 2)).toBe(true);
    state.decor.placed.push({ id: 'plant_fern', col: 49, row: 7 });
    const restored = deserialize(serialize(state), 0);
    expect(restored.decor.placed.some((p) => p.id === 'plant_fern')).toBe(false);
    expect(restored.decor.stored.plant_fern).toBe(1);
    expect(restored.regions).toEqual(state.regions);
  });

  it('walks at normal speed through every shared door in both directions and never crosses a solid wall', () => {
    const state = expandedState();
    openShop(state);
    let seed = 42;
    const sim = new Sim(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
    const crossings = new Set<string>();
    const seated = new Set<string>();
    for (let tick = 0; tick < 3_600; tick++) {
      const before = new Map(sim.customers.map((c) => [c.id, { x: c.x, y: c.y }]));
      sim.update(state, 0.05);
      for (const c of sim.customers) {
        if (c.phase === 'sitting') seated.add(tableArea(Math.floor(c.seat / 2)));
        const previous = before.get(c.id);
        if (!previous) continue;
        expect(Math.hypot(c.x - previous.x, c.y - previous.y)).toBeLessThanOrEqual(WALK_SPEED * 0.05 + 0.0001);
        const a = areaAtPoint(previous.x, previous.y), b = areaAtPoint(c.x, c.y);
        if (!a || !b || a === b) continue;
        const connection = areaConnections(a).find((link) => link.to === b);
        expect(connection).toBeDefined();
        if (connection!.direction === 'up' || connection!.direction === 'down') {
          expect(c.x).toBe(480);
        } else expect(c.y).toBe(areaOrigin(a).y + passageY());
        crossings.add(`${a}>${b}`);
      }
    }
    expect(seated).toEqual(new Set(AREA_IDS));
    expect(crossings).toEqual(new Set(['main>reading', 'reading>main', 'reading>greenhouse', 'greenhouse>reading', 'greenhouse>terrace', 'terrace>greenhouse']));
  });

  it('keeps seated and walking customers in their rooms after changing screen height', () => {
    const state = expandedState();
    openShop(state);
    let seed = 13;
    const sim = new Sim(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
    for (let tick = 0; tick < 1_200; tick++) sim.update(state, 0.05);
    const rooms = new Map(sim.customers.map((c) => [c.id, areaAtPoint(c.x, c.y)]));
    const oldHeight = sceneHeight();
    setSceneHeight(MAX_SCENE_H);
    sim.resizeScene(oldHeight);
    for (const c of sim.customers) {
      if (rooms.get(c.id)) expect(areaAtPoint(c.x, c.y)).toBe(rooms.get(c.id));
      if (c.phase === 'sitting') expect({ x: c.x, y: c.y }).toEqual(seatSpot(Math.floor(c.seat / 2), c.seat % 2 as 0 | 1));
    }
    for (let tick = 0; tick < 1_200; tick++) sim.update(state, 0.05);
    expect(state.served).toBeGreaterThan(0);
  });
});
