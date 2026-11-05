import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from './day';
import { arrivalRate, buyUpgrade, tableCount } from './economy';
import { canPlace, placeFurniture } from './furniture';
import { MAX_SCENE_H, MIN_SCENE_H, SCENE_W, areaAtPoint, areaOrigin, setSceneHeight, tablePos } from './layout';
import { MIN_BUILD_SHARE, REGIONS, activeTableIndices, buildSeconds, buildShare, constructionLeft, finishConstruction, mainTableCount, parseConstruction, regionBlock, regionDef, startConstruction, unlockRegion } from './regions';
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
    expect(canPlace(s, 'plant_fern', 53, 9, 2)).toBe(false);
    s.coins = 1_200;
    unlockRegion(s, 'reading');
    expect(placeFurniture(s, 'plant_fern', 53, 9, 2)).toBe(true);
    expect(canPlace(s, 'plant_fern', 39, 7, 2)).toBe(false);
    expect(canPlace(s, 'plant_fern', 59, 7, 2)).toBe(false); // Central aisle.
    expect(canPlace(s, 'plant_fern', 47, 3, 2)).toBe(false); // Table.
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.regions).toEqual(['reading']);
    expect(loaded.decor.placed).toContainEqual({ id: 'plant_fern', col: 53, row: 9 });
    expect(loaded.decor.stored.plant_fern).toBe(1);
  });

  it('fits each room’s tables and chairs at short and tall scene heights', () => {
    const s = createInitialState(0);
    s.coins = 1_000_000;
    for (const r of REGIONS) unlockRegion(s, r.id);
    for (const h of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(h);
      for (const { id } of REGIONS) {
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

describe('building rooms in real time', () => {
  const MIN = 60_000;
  const rich = () => { const s = createInitialState(0); s.coins = 1_000_000; return s; };

  it('charges once, builds for its real time, and opens only while the café is closed', () => {
    const s = rich();
    expect(startConstruction(s, 'greenhouse', 0)).toBe(false);
    expect(startConstruction(s, 'reading', 0)).toBe(true);
    expect(s.coins).toBe(1_000_000 - regionDef('reading').cost);
    expect(regionBlock(s, 'reading')).toBe('building');
    expect(startConstruction(s, 'reading', 0)).toBe(false);
    expect(unlockRegion(s, 'reading')).toBe(false);
    const done = regionDef('reading').buildSeconds * 1000;
    expect(constructionLeft(s, done / 2)).toBe(regionDef('reading').buildSeconds / 2);
    expect(finishConstruction(s, done - 1)).toEqual([]);
    s.phase = 'open';
    expect(finishConstruction(s, done)).toEqual([]);
    expect(constructionLeft(s, done)).toBe(0);
    s.phase = 'prep';
    expect(finishConstruction(s, done)).toEqual(['reading']);
    expect(s.regions).toEqual(['reading']);
    expect(s.construction).toEqual([]);
    expect(tableCount(s)).toBe(mainTableCount(s) + 4);
  });

  it('builds one room at a time in the first café, and takes bookings from the first branch on', () => {
    const first = rich();
    expect(startConstruction(first, 'reading', 0)).toBe(true);
    expect(regionBlock(first, 'greenhouse')).toBe('busy');
    expect(regionBlock(first, 'terrace')).toBe('previous');

    const branch = rich();
    branch.chain.branches = 1;
    expect(startConstruction(branch, 'reading', 0)).toBe(true);
    expect(startConstruction(branch, 'greenhouse', 5 * MIN)).toBe(true);
    expect(startConstruction(branch, 'terrace', 5 * MIN)).toBe(true);
    const [reading, greenhouse, terrace] = branch.construction;
    // Each booking starts the moment the room before it is finished.
    expect(greenhouse.finishAt).toBe(reading.finishAt + buildSeconds(branch, 'greenhouse') * 1000);
    expect(terrace.finishAt).toBe(greenhouse.finishAt + buildSeconds(branch, 'terrace') * 1000);
    expect(finishConstruction(branch, greenhouse.finishAt)).toEqual(['reading', 'greenhouse']);
    expect(finishConstruction(branch, terrace.finishAt)).toEqual(['terrace']);
    expect(branch.regions).toEqual(['reading', 'greenhouse', 'terrace']);
  });

  it('builds faster with every branch, down to a floor', () => {
    const s = createInitialState(0);
    expect(buildSeconds(s, 'terrace')).toBe(regionDef('terrace').buildSeconds);
    s.chain.branches = 1;
    expect(buildSeconds(s, 'terrace')).toBe(Math.round(regionDef('terrace').buildSeconds * buildShare(1)));
    expect(buildShare(1)).toBeLessThan(1);
    expect(buildShare(2)).toBeLessThanOrEqual(buildShare(1));
    expect(buildShare(100)).toBe(MIN_BUILD_SHARE);
  });

  it('saves builds and reads back only an in-order run that a set-back clock cannot stretch', () => {
    const s = rich();
    s.chain.branches = 1;
    startConstruction(s, 'reading', 0);
    startConstruction(s, 'greenhouse', 0);
    expect(deserialize(serialize(s), 0).construction).toEqual(s.construction);
    expect(parseConstruction([{ id: 'greenhouse', finishAt: 5 }], [], 0)).toEqual([]);
    expect(parseConstruction([{ id: 'reading', finishAt: 5 }, { id: 'terrace', finishAt: 9 }], [], 0)).toEqual([{ id: 'reading', finishAt: 5 }]);
    expect(parseConstruction([{ id: 'reading', finishAt: 5 }], ['reading'], 0)).toEqual([]);
    expect(parseConstruction({ id: 'reading', finishAt: 'soon' }, [], 0)).toEqual([]);
    const far = parseConstruction([{ id: 'reading', finishAt: 1e15 }, { id: 'greenhouse', finishAt: 2e15 }], [], 1_000);
    expect(far[0].finishAt).toBe(1_000 + regionDef('reading').buildSeconds * 1000);
    expect(far[1].finishAt).toBe(far[0].finishAt + regionDef('greenhouse').buildSeconds * 1000);
  });
});
