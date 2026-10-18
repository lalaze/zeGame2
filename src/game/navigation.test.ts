import { afterEach, describe, expect, it } from 'vitest';
import { routeFloorSegment, segmentCrossesObstacle, type FloorObstacle, type FloorPoint } from './navigation';
import { MAX_QUEUE } from './data';
import { openShop } from './day';
import { canPlace } from './furniture';
import { COUNTER, COUNTER_GATE, FLOOR_Y, MAIN_CUPBOARDS, MAX_SCENE_H, MIN_SCENE_H, areaAtPoint, areaOrigin, doorPlantSpots, floorY, passageY, seatApproach, seatSpot, setSceneHeight, tableFootprint, tablePos } from './layout';
import { REGIONS, activeTableIndices, areaConnections, unlockRegion } from './regions';
import { SERVER_SPEED, Sim, WALK_SPEED, type Walker } from './sim';
import { createInitialState } from './state';

afterEach(() => setSceneHeight(MIN_SCENE_H));

const inflate = (r: FloorObstacle, n = 3) => ({ x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 });
function expectClear(from: FloorPoint, path: FloorPoint[] | null, obstacles: FloorObstacle[], bounds?: FloorObstacle, clearance = 3): void {
  expect(path).not.toBeNull();
  let previous = from;
  for (const p of path!) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p).not.toEqual(previous);
    if (bounds) {
      expect(p.x).toBeGreaterThanOrEqual(bounds.x);
      expect(p.x).toBeLessThanOrEqual(bounds.x + bounds.w);
      expect(p.y).toBeGreaterThanOrEqual(bounds.y);
      expect(p.y).toBeLessThanOrEqual(bounds.y + bounds.h);
    }
    for (const r of obstacles) expect(segmentCrossesObstacle(previous, p, inflate(r, clearance)), JSON.stringify({ previous, p, r })).toBe(false);
    previous = p;
  }
}

describe('room-local floor navigation', () => {
  it('returns direct clear routes and no movement for identical endpoints', () => {
    expect(routeFloorSegment({ x: 1, y: 2 }, { x: 8, y: 9 }, [])).toEqual([{ x: 8, y: 9 }]);
    expect(routeFloorSegment({ x: 1, y: 2 }, { x: 1, y: 2 }, [])).toEqual([]);
  });

  it('detects narrow obstacle crossings, but permits tangents and corner touches', () => {
    const box = { x: 10, y: 10, w: 10, h: 10 };
    expect(segmentCrossesObstacle({ x: 0, y: 15 }, { x: 30, y: 15 }, box)).toBe(true);
    expect(segmentCrossesObstacle({ x: 15, y: 0 }, { x: 15, y: 30 }, box)).toBe(true);
    expect(segmentCrossesObstacle({ x: 0, y: 10 }, { x: 30, y: 10 }, box)).toBe(false);
    expect(segmentCrossesObstacle({ x: 0, y: 20 }, { x: 20, y: 0 }, box)).toBe(false);
    expect(segmentCrossesObstacle({ x: 15, y: 15 }, { x: 15, y: 15 }, box)).toBe(true);
  });

  it('goes around inflated furniture instead of walking diagonally through it', () => {
    const from = { x: 15, y: 50 }, to = { x: 85, y: 50 };
    const obstacles = [{ x: 40, y: 30, w: 20, h: 40 }];
    const path = routeFloorSegment(from, to, obstacles);
    expectClear(from, path, obstacles);
    expect(path).toHaveLength(3);
    expect(path!.at(-1)).toEqual(to);
  });

  it('handles overlapping obstacles and duplicate corners without entering their union', () => {
    const from = { x: 10, y: 50 }, to = { x: 90, y: 50 };
    const obstacles = [{ x: 30, y: 20, w: 25, h: 45 }, { x: 45, y: 35, w: 25, h: 45 }, { x: 30, y: 20, w: 25, h: 45 }];
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const path = routeFloorSegment(from, to, obstacles, { bounds });
    expectClear(from, path, obstacles, bounds);
    expect(path!.at(-1)).toEqual(to);
  });

  it('never escapes the room to get around an impassable barrier', () => {
    const from = { x: 10, y: 50 }, to = { x: 90, y: 50 };
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    expect(routeFloorSegment(from, to, [{ x: 40, y: 0, w: 20, h: 100 }], { bounds })).toBeNull();
    expect(routeFloorSegment(from, { x: 101, y: 50 }, [], { bounds })).toBeNull();
  });

  it('rejects gaps smaller than the requested walker clearance', () => {
    const from = { x: 10, y: 50 }, to = { x: 90, y: 50 };
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const obstacles = [{ x: 40, y: 0, w: 20, h: 48 }, { x: 40, y: 52, w: 20, h: 48 }];
    expect(routeFloorSegment(from, to, obstacles, { bounds, clearance: 3 })).toBeNull();
    expectClear(from, routeFloorSegment(from, to, obstacles, { bounds, clearance: 1 }), obstacles, bounds, 1);
  });

  it('requires an explicit chair approach and exempts only the endpoint obstacle', () => {
    const seat = { x: 85, y: 101 }, apron = { x: 85, y: 112 }, to = { x: 150, y: 140 };
    const table = { x: 77, y: 90, w: 46, h: 13 };
    expect(routeFloorSegment(seat, to, [table])).toBeNull();
    const exit = routeFloorSegment(seat, to, [table], { startApproach: apron });
    expect(exit![0]).toEqual(apron);
    expectClear(apron, exit!.slice(1), [table]);
    const enter = routeFloorSegment(to, seat, [table], { endApproach: apron });
    expect(enter!.slice(-2)).toEqual([apron, seat]);
    expectClear(to, enter!.slice(0, -1), [table]);
    const furniture = { x: 80, y: 107, w: 10, h: 2 };
    expect(routeFloorSegment(seat, to, [table, furniture], { startApproach: { x: 85, y: 120 } })).toBeNull();
  });

  it('works identically for rooms with negative world coordinates', () => {
    const origin = { x: -320, y: -360 };
    const from = { x: origin.x + 10, y: origin.y + 50 };
    const to = { x: origin.x + 90, y: origin.y + 50 };
    const obstacles = [{ x: origin.x + 40, y: origin.y + 30, w: 20, h: 40 }];
    const bounds = { ...origin, w: 100, h: 100 };
    expectClear(from, routeFloorSegment(from, to, obstacles, { bounds }), obstacles, bounds);
  });

  it('keeps maximum café capacity reachable across compact and tall floor plans', () => {
    // Explicit fixture geometry keeps this pure module independent of changing
    // scene globals. Production integration should also test its live layout.
    for (const height of [192, 240, 280, 320, 360]) {
      const secondRow = height - 22;
      const firstRow = Math.min(144, secondRow - 48);
      const spots = [100, 220, 40, 280].flatMap((x) => [{ x, y: firstRow }]);
      spots.push(...[100, 220, 40, 280].map((x) => ({ x, y: secondRow })));
      const bounds = { x: 8, y: 80, w: 304, h: height - 88 };
      const counter = { x: 64, y: 80, w: 186, h: 31 };
      const queue = Array.from({ length: 6 }, (_, i) => ({ x: 132 + (i % 2) * 24, y: 130 + Math.floor(i / 2) * 14 }));
      const service = Array.from({ length: 4 }, (_, i) => ({ x: 100 + i * 25, y: 120 }));
      const staff = Array.from({ length: 3 }, (_, i) => ({ x: 265 + i * 13, y: 96 }));
      for (let count = 2; count <= 8; count++) {
        const tables = spots.slice(0, count).map((p) => ({ x: p.x - 23, y: p.y - 10, w: 46, h: 13 }));
        const obstacles = [counter, ...tables];
        const approaches = spots.slice(0, count).flatMap((p) => [
          { x: p.x - 15, y: p.y + 12 }, { x: p.x + 15, y: p.y + 12 },
        ]);
        for (const from of [...queue, ...service, ...staff]) {
          // Some compact fixture queue points may occupy a table footprint.
          // They are not legal endpoints; those conflicts belong to layout QA.
          if (obstacles.some((r) => segmentCrossesObstacle(from, from, inflate(r)))) continue;
          for (const to of approaches) expectClear(from, routeFloorSegment(from, to, obstacles, { bounds }), obstacles, bounds);
        }
      }
    }
  });
});

function fullShop(tables = 8, expanded = false) {
  const state = createInitialState(0);
  state.coins = 1e6;
  state.upgrades.tables = tables - 2;
  state.upgrades.barista = 3;
  state.upgrades.server = 2;
  state.upgrades.marketing = 25;
  state.pantry.beans = 1e6;
  if (expanded) for (const r of REGIONS) unlockRegion(state, r.id);
  openShop(state);
  return state;
}

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function sampleWalkers(sim: Sim): Map<Walker, FloorPoint> {
  return new Map([...sim.customers, ...sim.servers].map((w) => [w, { x: w.x, y: w.y }]));
}

function assertWalkersClear(sim: Sim, before: Map<Walker, FloorPoint>, tableIndices: number[], dt: number): void {
  const fixed = [{ x: COUNTER.x, y: FLOOR_Y, w: COUNTER.w + COUNTER_GATE.w, h: COUNTER.bottom - FLOOR_Y }, ...MAIN_CUPBOARDS,
    ...doorPlantSpots().map((p) => ({ x: p.x - 5, y: p.y - 4, w: 10, h: 6 }))];
  for (const w of [...sim.customers, ...sim.servers]) {
    if (w.pathBlocked) throw new Error(`Blocked walker: ${JSON.stringify({ x: w.x, y: w.y, phase: w.phase, journey: w.journey })}`);
    const previous = before.get(w);
    if (!previous) continue;
    const isCustomer = 'seat' in w;
    if (Math.hypot(w.x - previous.x, w.y - previous.y) > (isCustomer ? WALK_SPEED : SERVER_SPEED) * dt + 0.0001) throw new Error('Walker exceeded normal speed');
    for (const box of fixed) if (segmentCrossesObstacle(previous, w, box)) throw new Error(`Fixture collision: ${JSON.stringify({ previous, now: { x: w.x, y: w.y }, box })}`);
    // Entering/leaving a seat is the sole intentional furniture overlap; ordinary
    // travel must avoid the full chairs, including where adjacent bays meet.
    const chairStep = tableIndices.some(table => [0, 1].some(side => {
      const seat = seatSpot(table, side as 0 | 1), apron = seatApproach(table, side as 0 | 1);
      return Math.abs(previous.x - seat.x) < .001 && Math.abs(w.x - seat.x) < .001 &&
        previous.y >= Math.min(seat.y, apron.y) - .001 && previous.y <= Math.max(seat.y, apron.y) + .001 &&
        w.y >= Math.min(seat.y, apron.y) - .001 && w.y <= Math.max(seat.y, apron.y) + .001;
    }));
    for (const table of tableIndices) {
      const boxes = [tableFootprint(table)];
      if (!chairStep && boxes.some(box => segmentCrossesObstacle(previous, w, box))) throw new Error(`Table/chair collision: ${JSON.stringify({ previous, now: { x: w.x, y: w.y }, phase: w.phase, table })}`);
    }
    const a = areaAtPoint(previous.x, previous.y), b = areaAtPoint(w.x, w.y);
    if (a && b && a !== b) {
      const connection = areaConnections(a).find((edge) => edge.to === b);
      expect(connection).toBeDefined();
      const origin = areaOrigin(a);
      if (connection!.direction === 'left' || connection!.direction === 'right') expect(w.y).toBeCloseTo(origin.y + passageY(), 5);
      else expect(w.x).toBeCloseTo(origin.x + 160, 5);
    }
  }
}

describe('simulation obstacle-aware routes', () => {
  it('walks around the rendered chairs rather than just the old tabletop footprint', () => {
    const state = fullShop(2), sim = new Sim(seeded(77));
    state.phase = 'prep'; sim.update(state, 0);
    const walker = sim.servers[0], table = tablePos(0);
    const from = { x: table.x + 38, y: table.y + 36 };
    const to = { x: from.x, y: table.y - 24 };
    Object.assign(walker, from, { phase: 'returning' });
    const internal = sim as unknown as { walk(w: Walker, ...p: FloorPoint[]): void };
    internal.walk(walker, to);
    expect(walker.pathBlocked).toBe(false);
    // The current chair artwork reaches 36px to either side of the table;
    // retain the same 8px body clearance used for other floor furniture.
    expectClear(from, [{ x: walker.tx, y: walker.ty }, ...walker.via],
      [{ x: table.x - 36, y: table.y - 10, w: 72, h: 13 }], undefined, 8);
  });

  it('aligns arrival and departure with the authored chair floor contacts', () => {
    for (const table of [0, 1, 8, 12, 16]) {
      const p = tablePos(table);
      expect(seatSpot(table, 0)).toEqual({ x: p.x - 20, y: p.y + 1 });
      expect(seatSpot(table, 1)).toEqual({ x: p.x + 20, y: p.y + 1 });
    }
  });

  it('rejects floor placement on a walker or their clearance margin until they move away', () => {
    const sim = new Sim(seeded(1));
    sim.update(fullShop(2), 0);
    const walker = sim.servers[0];
    Object.assign(walker, { x: 216, y: 212 });
    expect(sim.furnitureSpaceClear('plant_fern', 26, 16)).toBe(false);
    walker.x = 200; // Left edge of the required 8px walking margin.
    expect(sim.furnitureSpaceClear('plant_fern', 26, 16)).toBe(false);
    walker.x = 195;
    expect(sim.furnitureSpaceClear('plant_fern', 26, 16)).toBe(true);
    Object.assign(walker, { x: 216, y: 212 });
    expect(sim.furnitureSpaceClear('clock', 26, 16)).toBe(true);
  });

  it('checks stretched furniture in its actual room rather than its saved grid coordinates', () => {
    setSceneHeight(MAX_SCENE_H);
    const sim = new Sim(seeded(2));
    sim.update(fullShop(2, true), 0);
    const walker = sim.servers[0], origin = areaOrigin('greenhouse');
    Object.assign(walker, { x: origin.x + 216, y: origin.y + (floorY(208) + floorY(216)) / 2 });
    // Greenhouse uses stable furniture columns 80–119, although it is above the reading room.
    expect(sim.furnitureSpaceClear('plant_fern', 106, 16)).toBe(false);
    expect(sim.furnitureSpaceClear('plant_fern', 26, 16)).toBe(true);
    walker.x += 40;
    expect(sim.furnitureSpaceClear('plant_fern', 106, 16)).toBe(true);
  });

  it('samples normal-speed travel with 2–8 tables, six queued customers, four baristas and three servers', () => {
    let fullQueueSeen = false;
    for (const height of [MIN_SCENE_H, 300, MAX_SCENE_H]) {
      setSceneHeight(height);
      for (let tables = 2; tables <= 8; tables++) {
        const state = fullShop(tables), sim = new Sim(seeded(tables + height));
        for (let tick = 0; tick < 1600; tick++) {
          const before = sampleWalkers(sim);
          sim.update(state, 0.05);
          fullQueueSeen ||= sim.queue.length === MAX_QUEUE;
          assertWalkersClear(sim, before, activeTableIndices(state), 0.05);
        }
        expect(sim.baristas).toHaveLength(4);
        expect(sim.servers).toHaveLength(3);
        expect(state.served).toBeGreaterThan(20);
      }
    }
    expect(fullQueueSeen).toBe(true);
  }, 30000);

  it('routes every extension-room journey and interrupted closing trip through shared doors', () => {
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      const state = fullShop(8, true), sim = new Sim(seeded(219));
      for (let tick = 0; tick < 1800; tick++) {
        const before = sampleWalkers(sim);
        sim.update(state, 0.05);
        assertWalkersClear(sim, before, activeTableIndices(state), 0.05);
      }
      sim.closeShop(state);
      for (let tick = 0; tick < 1800; tick++) {
        const before = sampleWalkers(sim);
        sim.update(state, 0.05);
        assertWalkersClear(sim, before, activeTableIndices(state), 0.05);
      }
      expect(sim.customers, JSON.stringify(sim.customers)).toHaveLength(0);
      expect(sim.servers.every((s) => s.phase === 'idle'), JSON.stringify(sim.servers)).toBe(true);
    }
  }, 30000);

  it('does not claim arrival when furniture makes a route impossible, and retries after removal', () => {
    const state = fullShop(2), sim = new Sim(seeded(25));
    sim.update(state, 0);
    const walker = sim.servers[0];
    const internal = sim as unknown as { walk(w: Walker, ...p: FloorPoint[]): void };
    // Deliberately malformed old placement creates a solid cross-room barrier.
    state.decor.placed.push(...Array.from({ length: 10 }, (_, i) => ({ id: 'bench', col: i * 4, row: 7 })));
    sim.update(state, 0);
    Object.assign(walker, { x: 160, y: 210, phase: 'returning' });
    internal.walk(walker, { x: 160, y: 140 });
    expect(walker.pathBlocked).toBe(true);
    sim.update(state, 0.1);
    expect(walker.phase).toBe('returning');
    expect(walker.y).toBe(210);
    state.decor.placed = state.decor.placed.filter((p) => p.id !== 'bench');
    sim.update(state, 0.1);
    expect(walker.pathBlocked).toBe(false);
    expect(walker.y).toBeLessThan(210);
  });

  it('replans an active route when valid furniture or a newly bought table appears ahead', () => {
    const state = fullShop(2), sim = new Sim(seeded(315));
    state.phase = 'prep';
    sim.update(state, 0);
    const walker = sim.servers[0];
    const internal = sim as unknown as { walk(w: Walker, ...p: FloorPoint[]): void };
    Object.assign(walker, { x: 270, y: 210, phase: 'returning' });
    internal.walk(walker, { x: 195, y: 210 });
    expect(walker.via).toHaveLength(0);
    expect(canPlace(state, 'plant_fern', 26, 16, 2)).toBe(true);
    state.decor.placed.push({ id: 'plant_fern', col: 26, row: 16 });
    sim.update(state, 0);
    expect(walker.pathBlocked).toBe(false);
    expect(walker.via.length).toBeGreaterThan(0);
    const plant = { x: 208, y: 208, w: 16, h: 8 };
    for (let tick = 0; tick < 150; tick++) {
      const previous = { x: walker.x, y: walker.y };
      sim.update(state, 0.05);
      expect(segmentCrossesObstacle(previous, walker, plant)).toBe(false);
    }
    expect({ x: walker.x, y: walker.y }).toEqual({ x: 195, y: 210 });
    Object.assign(walker, { x: 10, y: 210, phase: 'returning' });
    internal.walk(walker, { x: 10, y: 150 });
    state.upgrades.tables = 1;
    sim.update(state, 0);
    expect(walker.pathBlocked).toBe(false);
    for (let tick = 0; tick < 250; tick++) {
      const before = sampleWalkers(sim);
      sim.update(state, 0.05);
      assertWalkersClear(sim, before, activeTableIndices(state), 0.05);
    }
    expect({ x: walker.x, y: walker.y }).toEqual({ x: 10, y: 150 });
  });

  it('keeps partial walking paths valid after growing and shrinking the room', () => {
    const state = fullShop(8, true), sim = new Sim(seeded(713));
    let height = MIN_SCENE_H;
    for (let tick = 0; tick < 2400; tick++) {
      if (tick > 0 && tick % 200 === 0) {
        const old = height;
        height = height === MIN_SCENE_H ? MAX_SCENE_H : MIN_SCENE_H;
        setSceneHeight(height);
        sim.resizeScene(old);
      }
      const before = sampleWalkers(sim);
      sim.update(state, 0.05);
      assertWalkersClear(sim, before, activeTableIndices(state), 0.05);
    }
    expect(state.served).toBeGreaterThan(40);
  }, 30000);
});
