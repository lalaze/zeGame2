import { describe, expect, it } from 'vitest';
import { STATION_SECONDS, type Station } from '../../game/kitchen';
import { DOOR, FLOOR_ART, QUEUE, SERVICE, building, cookHome, kitchenPlace, kitchenSpot, route, tableSeats, worldPoint } from './floors-layout';

describe('floors building', () => {
  it('opens a floor above for tables three to five and another for six to eight, and a basement with the kitchen', () => {
    expect(building(2, false).floors).toEqual(['roof', 'ground']);
    expect(building(3, false).floors).toEqual(['roof', 'floor-2', 'ground']);
    expect(building(5, true).floors).toEqual(['roof', 'floor-2', 'ground', 'basement']);
    expect(building(6, true).floors).toEqual(['roof', 'floor-3', 'floor-2', 'ground', 'basement']);
  });

  it('stacks the floors without gaps, top down', () => {
    const b = building(6, true);
    let y = 0;
    for (const floor of b.floors) { expect(b.offsets[floor]).toBe(y); y += FLOOR_ART[floor].height; }
    expect(b.height).toBe(y);
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

  it('puts a second cook beside the first, and their homes apart', () => {
    expect(kitchenSpot('oven', 1).x).toBeGreaterThan(kitchenSpot('oven', 0).x);
    expect(cookHome(0)).not.toEqual(cookHome(1));
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
