import { describe, expect, it } from 'vitest';
import { STATION_SECONDS, type Station } from '../../game/kitchen';
import { BARISTAS, CATCH_UP, DISPLAY, DOOR, FLOOR_ART, FRAME, QUEUE, SERVER_HOMES, SERVICE, WALK, building, cookHome, kitchenPlace, kitchenSpot, restFocus, route, stepsLength, tableSeats, walkPace, worldPoint, type KitchenPlace } from './floors-layout';

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
  it('stands every barista a head apart, the owner near the middle of the counter', () => {
    const xs = BARISTAS.map(b => b.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(4);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(120);
    expect(BARISTAS[0].x).toBe(xs[1]);
  });

  it('keeps the first servers apart and out of the way of the cake display', () => {
    expect(SERVER_HOMES.length).toBeGreaterThanOrEqual(6);
    for (const [i, a] of SERVER_HOMES.entries()) for (const b of SERVER_HOMES.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(100);
    for (const home of SERVER_HOMES.slice(0, 4)) expect(home.x + 50 < DISPLAY.left || home.x - 50 > DISPLAY.right - 10, String(home.x)).toBe(true);
    // Nobody waits in the doorway.
    for (const home of SERVER_HOMES) expect(Math.abs(home.x - DOOR.x)).toBeGreaterThan(70);
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
  it('ties every spot to a cell where any floor piece may stand, with three tables', async () => {
    const { FURNITURE, STARTER_FURNITURE, canPlace, footprint, furnitureDef } = await import('../../game/furniture');
    const { createInitialState } = await import('../../game/state');
    const { FURNITURE_SPOTS, spotCell, spotOf, gameWallRectToPlate } = await import('./floors-layout');
    const state = createInitialState(0);
    state.upgrades.tables = 1;
    for (const def of FURNITURE.filter(d => d.surface === 'floor')) {
      for (const spot of FURNITURE_SPOTS) {
        const { col, row } = spotCell(spot, def.w, def.h);
        expect(canPlace(state, def.id, col, row, 3), `${def.id} at ${spot.col},${spot.row}`).toBe(true);
        expect(spotOf(col, row, def.w, def.h)).toBe(spot);
      }
    }
    // The starter clock and mug rack hang on the ground floor's cleared wall.
    for (const p of STARTER_FURNITURE) expect(gameWallRectToPlate(footprint(furnitureDef(p.id)!, p.col, p.row)), p.id).not.toBeNull();
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
    for (const piece of ['attic', 'pillar', 'beam', 'street', 'soil', 'sky', 'awning', 'door-left', 'door-right', 'step', 'side-window', 'wall-attic', 'wall-seating', 'wall-ground']) {
      expect(existsSync(`assets/generated/floor-sample-v1/build/frame/${piece}.webp`), piece).toBe(true);
    }
    expect(frame['wall-seating'].height).toBe(FLOOR_ART['floor-2'].height);
    expect(frame['wall-ground'].height).toBe(FLOOR_ART.ground.height);
  });
});
