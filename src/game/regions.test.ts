import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from './day';
import { arrivalRate, buyUpgrade, tableCount } from './economy';
import { canPlace, placeFurniture } from './furniture';
import { MAX_SCENE_H, MIN_SCENE_H, SCENE_W, areaAtPoint, areaOrigin, setSceneHeight, tablePos } from './layout';
import { AREA_IDS, REGIONS, activeTableIndices, mainTableCount, regionBlock, unlockRegion } from './regions';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => setSceneHeight(MIN_SCENE_H));

describe('connected café areas', () => {
  it('requires the previous area, enough coins and a closed shop; charges each area only once', () => {
    const s = createInitialState(0);
    expect(regionBlock(s, 'reading')).toBe('coins');
    s.coins = 1_000_000;
    expect(unlockRegion(s, 'greenhouse')).toBe(false);
    s.phase = 'open';
    expect(unlockRegion(s, 'reading')).toBe(false);
    expect(s.coins).toBe(1_000_000);
    s.phase = 'prep';
    expect(unlockRegion(s, 'reading')).toBe(true);
    expect(s.coins).toBe(998_800);
    expect(unlockRegion(s, 'reading')).toBe(false);
    expect(s.coins).toBe(998_800);
    expect(unlockRegion(s, 'greenhouse')).toBe(true);
    expect(unlockRegion(s, 'terrace')).toBe(true);
    expect(tableCount(s)).toBe(14);
    expect(arrivalRate(s)).toBeCloseTo(arrivalRate(createInitialState(0)) * 1.45);
  });

  it('keeps room seat indices stable when more main café tables are bought', () => {
    const s = createInitialState(0);
    s.coins = 10_000;
    unlockRegion(s, 'reading');
    expect(activeTableIndices(s)).toEqual([0, 1, 8, 9, 10, 11]);
    buyUpgrade(s, 'tables', 1);
    expect(activeTableIndices(s)).toEqual([0, 1, 2, 8, 9, 10, 11]);
    expect(mainTableCount(s)).toBe(3);
    expect(tableCount(s)).toBe(7);
  });

  it('loads old saves and validates the ordered expansion chain', () => {
    expect(deserialize(JSON.stringify({ version: 6, upgrades: { tables: 3 } }), 0).regions).toEqual([]);
    expect(deserialize(JSON.stringify({ regions: ['terrace', 'greenhouse'] }), 0).regions).toEqual([]);
    expect(deserialize(JSON.stringify({ regions: ['reading', 'terrace', 'bad', 'reading'] }), 0).regions).toEqual(['reading']);
  });

  it('allows furniture only in opened rooms and keeps it through a save and reload', () => {
    const s = createInitialState(0);
    s.decor.stored.plant_fern = 2;
    expect(canPlace(s, 'plant_fern', 51, 9, 2)).toBe(false);
    s.coins = 1_200;
    unlockRegion(s, 'reading');
    expect(placeFurniture(s, 'plant_fern', 51, 9, 2)).toBe(true);
    expect(canPlace(s, 'plant_fern', 39, 7, 2)).toBe(false);
    expect(canPlace(s, 'plant_fern', 59, 7, 2)).toBe(false); // Central aisle.
    expect(canPlace(s, 'plant_fern', 47, 3, 2)).toBe(false); // Table.
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.regions).toEqual(['reading']);
    expect(loaded.decor.placed).toContainEqual({ id: 'plant_fern', col: 51, row: 9 });
    expect(loaded.decor.stored.plant_fern).toBe(1);
  });

  it('fits each room’s tables and chairs at short and tall scene heights', () => {
    const s = createInitialState(0);
    s.coins = 1_000_000;
    for (const r of REGIONS) unlockRegion(s, r.id);
    for (const h of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(h);
      for (const id of AREA_IDS.slice(1)) {
        const spots = activeTableIndices(s).map(tablePos).filter((p) => areaAtPoint(p.x, p.y) === id);
        expect(spots).toHaveLength(4);
        for (const p of spots) {
          expect(p.x - 24).toBeGreaterThanOrEqual(areaOrigin(id).x);
          expect(p.x + 24).toBeLessThanOrEqual(areaOrigin(id).x + SCENE_W);
          expect(p.y).toBeGreaterThanOrEqual(areaOrigin(id).y + 80);
          expect(p.y).toBeLessThanOrEqual(areaOrigin(id).y + h - 8);
        }
      }
    }
  });

  it('seats customers in opened rooms while leaving unopened seats empty', () => {
    const s = createInitialState(0);
    s.coins = 1_200;
    unlockRegion(s, 'reading');
    s.pantry.beans = 1_000;
    openShop(s);
    let seed = 42;
    const sim = new Sim(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
    const visited = new Set<string>();
    for (let tick = 0; tick < 2_400; tick++) {
      sim.update(s, 0.05);
      for (const c of sim.customers) if (c.phase === 'sitting') visited.add(areaAtPoint(c.x, c.y)!);
      sim.seats.forEach((occupant, seat) => {
        if (occupant !== null) expect(activeTableIndices(s)).toContain(Math.floor(seat / 2));
      });
    }
    expect(visited).toContain('reading');
    expect(s.served).toBeGreaterThan(0);
  });
});
