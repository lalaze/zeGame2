import { describe, expect, it } from 'vitest';
import { STATION_SECONDS, type Station } from '../../game/kitchen';
import { BUILDING_SPOTS } from '../../game/building-spots';
import { BARISTAS, CATCH_UP, COUNTER_FRONT, DOOR, FLOOR_ART, FLOOR_TABLES, FRAME, FURNITURE_SPOTS, PARCEL, PASS, QUEUE, SERVER_HOMES, SERVICE, STAIRS_HALL, STAIRS_RAIL, WALK, WORLD_W, baristaIdlePose, building, cookHome, inWell, kitchenPlace, kitchenSpot, restFocus, route, serverHome, stairsOf, stepsLength, tableMaskRects, tableSeats, walkPace, wellSink, worldPoint, type FloorId, type KitchenPlace } from './floors-layout';

describe('a parcel at the door', () => {
  it('stands on the front step, beside where guests come and go', () => {
    expect(PARCEL.floor).toBe(DOOR.floor);
    expect(Math.abs(PARCEL.y - DOOR.y)).toBeLessThan(10);
    expect(Math.abs(PARCEL.x - DOOR.x)).toBeGreaterThan(120);
  });
});

describe('floors building', () => {
  it('opens a floor above for tables three to five and another for six to eight, and a basement with the kitchen', () => {
    expect(building(2, false).floors).toEqual(['roof', 'ground']);
    expect(building(3, false).floors).toEqual(['roof', 'floor-2', 'ground']);
    expect(building(5, true).floors).toEqual(['roof', 'floor-2', 'ground', 'basement']);
    expect(building(6, true).floors).toEqual(['roof', 'floor-3', 'floor-2', 'ground', 'basement']);
  });

  it('stacks the floors under the roof, the street at the ground floor and the basement below it', () => {
    const b = building(6, true);
    let y = FLOOR_ART.roof.above!;
    for (const floor of b.floors) {
      if (floor === 'basement') { expect(b.street).toBe(y); y += FRAME.soilBand; }
      expect(b.offsets[floor]).toBe(y);
      y += FLOOR_ART[floor].height;
    }
    expect(b.height).toBe(y + FRAME.soilBelow);
    // Without a basement the street runs on below the ground floor.
    const small = building(2, false);
    expect(small.street).toBe(small.offsets.ground! + FLOOR_ART.ground.height);
    expect(small.height).toBe(small.street + FRAME.street);
    // A point on a floor's plate lands inside that floor's band.
    const counter = worldPoint(b, SERVICE[0]);
    expect(counter.y).toBeGreaterThan(b.offsets.ground!);
    expect(counter.y).toBeLessThan(b.offsets.basement!);
  });

  it('seats the first two tables downstairs and the rest upstairs, two facing seats each', () => {
    const active = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(active.map(t => tableSeats(t, active)[0].floor)).toEqual(['ground', 'ground', 'floor-2', 'floor-2', 'floor-2', 'floor-3', 'floor-3', 'floor-3']);
    for (const t of active) {
      const [left, right] = tableSeats(t, active);
      expect(left.faceLeft).toBe(false);
      expect(right.faceLeft).toBe(true);
      expect(left.x).toBeLessThan(right.x);
    }
    // Places follow the café's own order of tables, not their saved index.
    expect(tableSeats(9, [0, 1, 9])[0].floor).toBe('floor-2');
  });
});

describe('floors routes', () => {
  const end = (steps: ReturnType<typeof route>) => steps[steps.length - 1];

  it('walks across a floor without stairs', () => {
    const steps = route(QUEUE[0], QUEUE[0].aisle, SERVICE[0]);
    expect(steps.every(s => s.floor === 'ground' && !s.jump)).toBe(true);
    expect(end(steps)).toMatchObject({ x: SERVICE[0].x, y: SERVICE[0].y });
  });

  it('climbs to a table upstairs and comes back down to leave through the door', () => {
    const seat = tableSeats(2, [0, 1, 2])[0];
    const up = route(SERVICE[0], SERVICE[0].aisle, seat);
    expect(up.filter(s => s.jump).map(s => s.floor)).toEqual(['floor-2']);
    expect(end(up)).toMatchObject({ floor: 'floor-2', x: seat.x, y: seat.y });
    const down = route(seat, seat.aisle, { ...DOOR, fadeOut: true });
    expect(down.filter(s => s.jump).map(s => s.floor)).toEqual(['ground']);
    expect(end(down)).toMatchObject({ floor: 'ground', x: DOOR.x, y: DOOR.y, fadeOut: true });
  });

  it('comes up in the stairwell upstairs, onto its landing, and goes down the same way', () => {
    const seat = tableSeats(2, [0, 1, 2])[0], flight = stairsOf('floor-2')!, { inside, lip, on, out } = flight.well!;
    const way = [inside, lip, on, { x: out.x, y: out.y }].map(p => ({ floor: 'floor-2', ...p }));
    const up = route(SERVICE[0], SERVICE[0].aisle, seat), jump = up.findIndex(s => s.jump);
    expect(up.slice(jump, jump + 4)).toMatchObject(way);
    expect(up.some(s => s.floor === 'floor-2' && s.x === flight.foot.x && s.y === flight.foot.y)).toBe(false);
    const down = route(seat, seat.aisle, DOOR), back = down.findIndex(s => s.jump);
    expect(down.slice(back - 4, back)).toMatchObject([...way].reverse());
    expect(down[back]).toMatchObject({ floor: 'ground', ...stairsOf('ground')!.top });
    // Passing through: out of the well, round its front, then up the next flight from its foot.
    const top = route(SERVICE[0], SERVICE[0].aisle, tableSeats(5, [0, 1, 2, 3, 4, 5])[0]).filter(s => s.floor === 'floor-2');
    expect(top[0]).toMatchObject(inside);
    expect(top.at(-2)).toMatchObject(flight.foot);
    expect(top.at(-1)).toMatchObject(flight.top);
  });

  it('never walks anyone through the stairwell or its balustrade, but on its steps', () => {
    // The hole with its balustrade on the plate, slanting to the right towards us.
    const inside = (p: { x: number; y: number }) => {
      const share = (p.y - 546) / 230;
      return share > .03 && share < 1 && p.x > 1306 + 46 * share && p.x < 1444 + 82 * share;
    };
    const active = [0, 1, 2, 3, 4, 5, 6, 7], places = [...active.flatMap(t => [...tableSeats(t, active)]), SERVICE[0], DOOR];
    for (const from of places) for (const to of places) {
      let at: { floor: string; x: number; y: number } = from;
      for (const step of route(from, from.aisle, to)) {
        if (!step.jump && at.floor === step.floor && (step.floor === 'floor-2' || step.floor === 'floor-3')) {
          for (let k = 0; k <= 20; k++) {
            const p = { floor: step.floor, x: at.x + (step.x - at.x) * k / 20, y: at.y + (step.y - at.y) * k / 20 };
            if (inside(p)) expect(inWell(p), `${from.floor} to ${to.floor} at ${Math.round(p.x)},${Math.round(p.y)}`).toBe(true);
          }
        }
        at = step;
      }
    }
  });

  it('hides someone in the well more and more the deeper they are, and nobody else', () => {
    const flight = stairsOf('floor-2')!, { inside, lip, on } = flight.well!;
    let before = -1;
    for (let k = 1; k <= 10; k++) {
      const at = { floor: 'floor-2' as const, x: lip.x + (inside.x - lip.x) * k / 10, y: lip.y + (inside.y - lip.y) * k / 10 };
      expect(inWell(at), `step ${k}`).toBe(true);
      expect(wellSink(at)).toBeGreaterThanOrEqual(before);
      before = wellSink(at);
    }
    expect(before).toBeGreaterThan(80);
    expect(wellSink({ floor: 'floor-2', ...lip })).toBe(0);
    expect(inWell({ floor: 'floor-2', ...on })).toBe(false);
    for (let k = 0; k <= 100; k++) {
      expect(inWell({ floor: 'floor-2', x: flight.foot.x + (flight.top.x - flight.foot.x) * k / 100, y: flight.foot.y + (flight.top.y - flight.foot.y) * k / 100 }), `climb ${k}`).toBe(false);
    }
    expect(inWell({ floor: 'ground', ...inside })).toBe(false);
  });

  it('passes through every floor on the way to the top one', () => {
    const seat = tableSeats(5, [0, 1, 2, 3, 4, 5])[0];
    expect(route(QUEUE[0], QUEUE[0].aisle, seat).filter(s => s.jump).map(s => s.floor)).toEqual(['floor-2', 'floor-3']);
  });
});

describe('floors pace', () => {
  it('strolls a walk the Sim makes as long as this one, and stops gently at its end', () => {
    expect(walkPace(WALK * 4, 4)).toBe(1);
    expect(walkPace(WALK * 2, 6)).toBe(1);
    expect(walkPace(60, 0)).toBe(1);
  });

  it('hurries up the stairs to arrive with the Sim, but never faster than catching up allows', () => {
    expect(walkPace(WALK * 8, 4)).toBe(2);
    expect(walkPace(WALK * 40, 2)).toBe(CATCH_UP);
    expect(walkPace(WALK * 40, 0)).toBe(CATCH_UP);
  });

  it('counts the walk left, not the jump between two flights of stairs', () => {
    const seat = tableSeats(5, [0, 1, 2, 3, 4, 5])[0];
    const steps = route(SERVICE[0], SERVICE[0].aisle, seat);
    expect(stepsLength(SERVICE[0], steps)).toBeGreaterThan(stepsLength(SERVICE[0], route(SERVICE[0], SERVICE[0].aisle, tableSeats(2, [0, 1, 2])[0])));
    expect(stepsLength({ x: 0, y: 0 }, [{ floor: 'ground', x: 3, y: 4 }, { floor: 'floor-2', x: 900, y: 900, jump: true }, { floor: 'floor-2', x: 900, y: 910 }])).toBe(15);
    expect(stepsLength({ x: 5, y: 5 }, [])).toBe(0);
  });
});

describe('floors camera', () => {
  /** Where a world point lands on the screen, 0 at its top and 1 at its bottom. */
  const onScreen = (y: number, focus: number, view: number) => (y - focus) / view + .5;
  // Building pixels on screen for phones from 360 x 640 to 393 x 851 and up, and a wide desktop window.
  const phones = [1672 * 640 / 360, 1672 * 851 / 393, 1672 * 915 / 412];

  it('shows a small café whole, clear of the bars', () => {
    for (const view of phones) {
      const b = building(2, false), focus = restFocus(b, view);
      expect(onScreen(0, focus, view)).toBeCloseTo(.1);
      expect(onScreen(b.street, focus, view)).toBeLessThan(.88);
    }
  });

  it('keeps the ground floor on screen however tall the building grows', () => {
    for (const view of [...phones, 1672 * 800 / 1200]) {
      for (const tables of [3, 5, 8]) for (const kitchen of [false, true]) {
        const b = building(tables, kitchen), focus = restFocus(b, view);
        expect(onScreen(b.street, focus, view), `${tables} tables on ${Math.round(view)}`).toBeCloseTo(.68);
      }
    }
  });
});

describe('floors staff', () => {
  it('staggers baristas in depth and spacing behind the counter, with the owner near the middle', () => {
    const xs = BARISTAS.map(b => b.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(4);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(120);
    expect(new Set(gaps).size).toBeGreaterThan(1);
    expect(BARISTAS[0].x).toBe(xs[1]);
    const ys = BARISTAS.map(b => b.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(20);
    for (const [i, b] of BARISTAS.entries()) {
      expect(b.y).toBeLessThanOrEqual(COUNTER_FRONT.y - 40);
      expect(SERVICE[i].x).toBe(b.x);
      expect(SERVICE[i].y).toBeGreaterThan(COUNTER_FRONT.y);
    }
  });

  it('varies idle barista poses deterministically so neighbours never match and at most two share a pose', () => {
    const poseKey = (p: ReturnType<typeof baristaIdlePose>) => (p.pose === 'side' ? (p.flip ? 'side-left' : 'side-right') : p.pose);
    for (const count of [2, 3, 4]) {
      const byX = Array.from({ length: count }, (_, i) => i).sort((a, b) => BARISTAS[a].x - BARISTAS[b].x);
      const seenPerBarista = Array.from({ length: count }, () => new Set<string>());
      const frontCounts = Array.from({ length: count }, () => 0);
      let samples = 0;
      let zeroFrontSamples = 0;
      let prev: string[] | null = null;
      for (let clock = 0; clock < 200; clock += 0.25) {
        samples++;
        const poses = byX.map(i => poseKey(baristaIdlePose(i, clock)));
        const freq = new Map<string, number>();
        for (const p of poses) freq.set(p, (freq.get(p) ?? 0) + 1);
        for (const [p, n] of freq) {
          expect(n, `count=${count} clock=${clock} pose=${p}`).toBeLessThanOrEqual(2);
        }
        expect(freq.get('front') ?? 0, `count=${count} clock=${clock} front`).toBeLessThanOrEqual(1);
        if (!freq.has('front')) zeroFrontSamples++;
        for (let k = 0; k + 1 < poses.length; k++) {
          expect(poses[k], `count=${count} clock=${clock} neighbours ${byX[k]},${byX[k + 1]}`).not.toBe(poses[k + 1]);
        }
        if (prev) {
          const changed = poses.filter((p, k) => p !== prev![k]).length;
          expect(changed, `count=${count} clock=${clock} simultaneous turns`).toBeLessThanOrEqual(1);
        }
        prev = poses;
        byX.forEach((i, k) => {
          seenPerBarista[i].add(poses[k]);
          if (poses[k] === 'front') frontCounts[i]++;
        });
      }
      // Every idle barista cycles through back, both side facings, and an occasional front glance.
      for (let i = 0; i < count; i++) {
        expect(seenPerBarista[i], `count=${count} barista ${i}`).toEqual(new Set(['back', 'side-right', 'side-left', 'front']));
        expect(frontCounts[i] / samples, `count=${count} barista ${i} front share`).toBeLessThan(0.4);
      }
      expect(zeroFrontSamples, `count=${count} zero-front moments`).toBeGreaterThan(0);
    }
  });

  it('spreads idle servers across floors, staggered in depth and clear of obstacles', () => {
    expect(SERVER_HOMES.length).toBeGreaterThanOrEqual(6);
    const insideWellHole = (p: { x: number; y: number }) => {
      const share = (p.y - 546) / 230;
      return share > .03 && share < 1 && p.x > 1306 + 46 * share && p.x < 1444 + 82 * share;
    };
    const tallest = 281;
    const configs: readonly FloorId[][] = [
      building(2, false).floors,
      building(3, false).floors,
      building(6, true).floors,
    ];
    for (const floors of configs) {
      const homes = Array.from({ length: 6 }, (_, i) => serverHome(i, floors));
      expect(new Set(homes.map(h => h.id)).size, floors.join(',')).toBe(6);
      if (floors.includes('floor-2') && floors.includes('floor-3')) {
        expect(homes.filter(h => h.floor === 'ground').length).toBeLessThanOrEqual(3);
        expect(homes.filter(h => h.floor === 'floor-2').length).toBeGreaterThanOrEqual(1);
        expect(homes.filter(h => h.floor === 'floor-3').length).toBeGreaterThanOrEqual(1);
      }
      // Group by floor: spacing and no three within 24 px of feet y.
      for (const floor of floors) {
        const onFloor = homes.filter(h => h.floor === floor);
        for (const [i, a] of onFloor.entries()) for (const b of onFloor.slice(i + 1)) {
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} vs ${b.id}`).toBeGreaterThan(100);
        }
        const ys = onFloor.map(h => h.y).sort((a, b) => a - b);
        for (let i = 0; i + 2 < ys.length; i++) {
          expect(ys[i + 2] - ys[i], `${floor} in ${floors.join(',')}`).toBeGreaterThan(24);
        }
      }
      // Every home keeps clear of tables/chairs, queue, ordering spots, door lane, stairs and furniture spots.
      for (const home of homes) {
        expect(floors).toContain(home.floor);
        const top = FLOOR_ART[home.floor].top;
        for (const table of FLOOR_TABLES[home.floor] ?? []) {
          const inTable = home.x >= table.x && home.x <= table.x + table.w
            && home.y >= table.y + top && home.y <= table.y + table.h + top;
          expect(inTable, `${home.id} inside table`).toBe(false);
        }
        if (home.floor === 'ground') {
          for (const q of QUEUE) expect(Math.hypot(home.x - q.x, home.y - q.y), `${home.id} vs queue`).toBeGreaterThan(55);
          for (const s of SERVICE) expect(Math.hypot(home.x - s.x, home.y - s.y), `${home.id} vs service`).toBeGreaterThan(55);
          expect(Math.abs(home.x - DOOR.x), `${home.id} vs door`).toBeGreaterThan(70);
          const inDoorLane = home.x >= 776 && home.x <= 896 && home.y >= DOOR.aisle;
          expect(inDoorLane, `${home.id} in door lane`).toBe(false);
          const stairs = stairsOf('ground')!;
          expect(Math.hypot(home.x - stairs.landing.x, home.y - stairs.landing.y), `${home.id} vs stairs landing`).toBeGreaterThan(55);
          expect(home.x, `${home.id} clear of ground stairs`).toBeLessThan(1345);
        } else {
          const stairs = stairsOf(home.floor)!;
          expect(inWell(home), `${home.id} in well`).toBe(false);
          expect(insideWellHole(home), `${home.id} in well hole`).toBe(false);
          expect(Math.hypot(home.x - stairs.well!.out.x, home.y - stairs.well!.out.y), `${home.id} vs well out`).toBeGreaterThan(55);
          expect(Math.abs(home.x - 1288), `${home.id} vs hub`).toBeGreaterThan(50);
          if (home.x >= 1288) expect(Math.abs(home.y - stairs.landing.y), `${home.id} vs upper landing route`).toBeGreaterThan(40);
          // Walking from pass to home never walks through the stairwell hole outside the steps.
          let at: { floor: string; x: number; y: number } = PASS;
          for (const step of route(PASS, PASS.aisle, home)) {
            if (!step.jump && at.floor === step.floor && (step.floor === 'floor-2' || step.floor === 'floor-3')) {
              for (let k = 0; k <= 20; k++) {
                const p = { floor: step.floor, x: at.x + (step.x - at.x) * k / 20, y: at.y + (step.y - at.y) * k / 20 };
                if (insideWellHole(p)) expect(inWell(p), `route to ${home.id} at ${Math.round(p.x)},${Math.round(p.y)}`).toBe(true);
              }
            }
            at = step;
          }
        }
        for (const spot of FURNITURE_SPOTS) {
          if (spot.box || spot.floor !== home.floor) continue;
          if (home.y <= spot.y && spot.y - tallest <= home.y) {
            expect(Math.abs(home.x - spot.x), `${home.id} behind ${spot.id}`).toBeGreaterThan(spot.room / 2);
          }
        }
      }
    }
  });
});

describe('floors table rectangles', () => {
  it('covers each table and both of its chairs within its floor layer', () => {
    const active = [0, 1, 2, 3, 4, 5, 6, 7];
    const byFloor: Record<'ground' | 'floor-2' | 'floor-3', number[]> = { ground: [0, 1], 'floor-2': [2, 3, 4], 'floor-3': [5, 6, 7] };
    for (const [floor, indices] of Object.entries(byFloor) as ['ground' | 'floor-2' | 'floor-3', number[]][]) {
      const rects = FLOOR_TABLES[floor]!;
      const art = FLOOR_ART[floor];
      expect(rects, floor).toHaveLength(indices.length);
      for (const [k, tableIndex] of indices.entries()) {
        const rect = rects[k], [left, right] = tableSeats(tableIndex, active);
        expect(rect.x, `${floor}[${k}]`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w, `${floor}[${k}]`).toBeLessThanOrEqual(WORLD_W);
        expect(rect.y, `${floor}[${k}]`).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.h, `${floor}[${k}]`).toBeLessThanOrEqual(art.height);
        if (rect.fixturesY !== undefined) {
          expect(rect.fixturesY).toBeGreaterThanOrEqual(rect.y);
          expect(rect.fixturesY).toBeLessThan(rect.y + rect.h);
        }
        expect(rect.seatY).toBe(Math.min(left.y, right.y));
        const plateTop = rect.y + art.top, plateBottom = rect.y + rect.h + art.top;
        for (const seat of [left, right]) {
          // Both seats and the chairs around them sit inside the measured rectangle.
          expect(seat.x - 55, `${floor}[${k}] left chair`).toBeGreaterThanOrEqual(rect.x);
          expect(seat.x + 55, `${floor}[${k}] right chair`).toBeLessThanOrEqual(rect.x + rect.w);
          expect(seat.y - 120, `${floor}[${k}] chair back`).toBeGreaterThanOrEqual(plateTop);
          expect(seat.y, `${floor}[${k}] chair feet`).toBeLessThanOrEqual(plateBottom);
        }
        // Even coordinates so half-size art splits along exact texel boundaries.
        const top = rect.fixturesY ?? rect.y;
        for (const v of [rect.x, rect.y, rect.w, rect.h, top]) {
          expect(v % 2, `${floor}[${k}] even ${v}`).toBe(0);
        }
        for (const ex of rect.exclude ?? []) {
          for (const v of [ex.x, ex.y, ex.w, ex.h]) expect(v % 2, `${floor}[${k}] exclude even ${v}`).toBe(0);
          expect(ex.x).toBeGreaterThanOrEqual(rect.x);
          expect(ex.x + ex.w).toBeLessThanOrEqual(rect.x + rect.w);
          expect(ex.y).toBeGreaterThanOrEqual(top);
          expect(ex.y + ex.h).toBeLessThanOrEqual(rect.y + rect.h);
        }
      }
      // Table fixtures masks on a floor are pairwise disjoint.
      const allStrips = rects.flatMap((rect, k) => tableMaskRects(rect).map(strip => ({ k, strip })));
      for (let i = 0; i < allStrips.length; i++) {
        for (let j = i + 1; j < allStrips.length; j++) {
          const a = allStrips[i].strip, b = allStrips[j].strip;
          const overlaps = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlaps, `${floor} strip overlap between table ${allStrips[i].k} and ${allStrips[j].k}`).toBe(false);
        }
      }
    }
  });
});

describe('floors kitchen', () => {
  it('gives every kitchen station a place in the basement', () => {
    for (const station of [...Object.keys(STATION_SECONDS), 'door'] as Station[]) {
      const spot = kitchenSpot(kitchenPlace(station), 0);
      expect(spot.floor, station).toBe('basement');
    }
    expect(kitchenPlace('deckOven')).toBe('oven');
    expect(kitchenPlace('bench')).toBe('dough');
    expect(kitchenPlace('rack')).toBe('lift');
  });

  it('never stands two of the three cooks in one place', () => {
    for (const place of ['oven', 'dough', 'cold', 'dry', 'lift'] as KitchenPlace[]) {
      const xs = [0, 1, 2].map(i => kitchenSpot(place, i).x).sort((a, b) => a - b);
      expect(xs[1] - xs[0], place).toBeGreaterThanOrEqual(100);
      expect(xs[2] - xs[1], place).toBeGreaterThanOrEqual(100);
    }
    const homes = [0, 1, 2].map(i => cookHome(i));
    expect(new Set(homes.map(h => `${h.x},${h.y}`)).size).toBe(3);
  });
});

describe('floors furniture', () => {
  const inside = (a: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) => a.x > b.x && a.x < b.x + b.w && a.y > b.y && a.y < b.y + b.h;

  it('gives every spot of the game a place on its own floor', () => {
    expect(FURNITURE_SPOTS.map(spot => spot.id)).toEqual(BUILDING_SPOTS.map(spot => spot.id));
    for (const spot of FURNITURE_SPOTS) {
      const art = FLOOR_ART[spot.floor];
      expect(spot.floor).toBe(spot.storey);
      expect(!!spot.box, spot.id).toBe(spot.surface === 'wall');
      expect([spot.x, spot.y].every(Number.isFinite), spot.id).toBe(true);
      expect(spot.y, spot.id).toBeLessThan(art.top + art.height);
      expect(spot.x - spot.room / 2, spot.id).toBeGreaterThan(40);
      expect(spot.x + spot.room / 2, spot.id).toBeLessThan(WORLD_W - 40);
    }
  });

  it('keeps floor pieces apart, off the seats, the servers and the way in', () => {
    const floor = FURNITURE_SPOTS.filter(spot => !spot.box);
    for (const [i, a] of floor.entries()) for (const b of floor.slice(i + 1)) {
      if (a.floor !== b.floor || Math.abs(a.y - b.y) > 100) continue;
      expect(Math.abs(a.x - b.x), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual((a.room + b.room) / 2);
    }
    const active = [0, 1, 2, 3, 4, 5, 6, 7], tallest = 281; // the bookshelf of build/furniture/furniture.json
    for (const spot of floor) {
      for (const table of active) for (const seat of tableSeats(table, active)) {
        if (seat.floor !== spot.floor || seat.y > spot.y || spot.y - tallest > seat.y) continue;
        // A piece in front of a seat would hide whoever sits there.
        expect(Math.abs(seat.x - spot.x), `${spot.id} in front of table ${table}`).toBeGreaterThan(spot.room / 2);
      }
      if (spot.floor === 'ground') {
        expect(Math.abs(spot.x - DOOR.x)).toBeGreaterThan(spot.room / 2 + 60);
        // The open front's folded doors hide the corners.
        expect(spot.x - spot.room / 2, spot.id).toBeGreaterThanOrEqual(182);
        expect(spot.x + spot.room / 2, spot.id).toBeLessThanOrEqual(1492);
        for (const home of SERVER_HOMES) expect(Math.abs(home.x - spot.x) > spot.room / 2 || home.y > spot.y, spot.id).toBe(true);
      }
    }
  });

  it('hangs wall pieces clear of the awning, the staff and each other', () => {
    for (const spot of FURNITURE_SPOTS) {
      if (!spot.box) continue;
      if (spot.floor === 'ground') {
        expect(spot.box.y).toBeGreaterThanOrEqual(104);
        expect(spot.box.y + spot.box.h).toBeLessThanOrEqual(212);
      }
      for (const other of FURNITURE_SPOTS) if (other !== spot && other.box && other.floor === spot.floor) expect(inside(other, spot.box), `${spot.id} and ${other.id}`).toBe(false);
    }
  });

  it('opens more spots with every storey', () => {
    const open = (tables: number) => FURNITURE_SPOTS.filter(spot => building(tables, true).floors.includes(spot.floor)).length;
    expect(open(2)).toBeGreaterThanOrEqual(10);
    expect(open(3)).toBeGreaterThan(open(2));
    expect(open(6)).toBeGreaterThan(open(5));
    expect(open(8)).toBe(FURNITURE_SPOTS.length);
  });
});

describe('floors frame', () => {
  it('matches the frame pictures it lays out', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const path = 'assets/generated/floor-sample-v1/build/frame/frame.json';
    if (!existsSync(path)) return;
    const frame = JSON.parse(readFileSync(path, 'utf8'));
    expect(frame.attic.height - frame.attic.plateTop).toBe(FLOOR_ART.roof.height);
    expect(frame.attic.plateTop).toBe(FLOOR_ART.roof.above);
    expect(frame.street.height).toBe(FRAME.street);
    expect(frame.pillar.width).toBe(FRAME.pillar);
    expect(frame.soil.height).toBeGreaterThanOrEqual(FRAME.soilBand + 1);
    for (const piece of ['attic', 'pillar', 'beam', 'street', 'soil', 'sky', 'awning', 'door-left', 'door-right', 'step', 'side-window', 'stairs-hall', 'stairs-rail', 'wall-attic', 'wall-seating', 'wall-ground']) {
      expect(existsSync(`assets/generated/floor-sample-v1/build/frame/${piece}.webp`), piece).toBe(true);
    }
    expect([frame['stairs-hall'].x, frame['stairs-hall'].y]).toEqual([STAIRS_HALL.x, STAIRS_HALL.y]);
    expect([frame['stairs-rail'].x, frame['stairs-rail'].y]).toEqual([STAIRS_RAIL.x, STAIRS_RAIL.y]);
    expect(frame['wall-seating'].height).toBe(FLOOR_ART['floor-2'].height);
    expect(frame['wall-ground'].height).toBe(FLOOR_ART.ground.height);
  });
});
