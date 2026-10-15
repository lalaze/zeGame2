import { CafeView } from './cafe-view';
import { canPlace } from '../game/furniture';
import { createInitialState } from '../game/state';
import { afterEach, describe, expect, it } from 'vitest';
import { fittedRoomWidth, narrowRoomX, roomSideSpace, setRoomPresentationWidth, widenRoomX } from './room-width';
import { projectMainWorld, unprojectMainWorld } from './main-pixel-presentation';
afterEach(() => setRoomPresentationWidth(320));
describe('responsive room presentation', () => {
  it('fills wide desktop while leaving small-screen framing unchanged', () => {
    expect(fittedRoomWidth(1600, 600, 240, true)).toBe(640);
    expect(fittedRoomWidth(350, 500, 240, true)).toBe(320);
    expect(fittedRoomWidth(1600, 600, 240, false)).toBe(320);
  });
  it.each([320, 480, 720, 1280])('keeps furnishings, inverse hits and door contacts at width %i', width => {
    setRoomPresentationWidth(width);
    for (const x of [40, 100, 116, 144, 160, 176, 220, 264, 280]) expect(widenRoomX(x)).toBe(x);
    expect(widenRoomX(5)).toBe(5 - roomSideSpace());
    expect(widenRoomX(315)).toBe(315 + roomSideSpace());
    let previous = -Infinity;
    for (let x = -40; x <= 360; x += .5) {
      const painted = widenRoomX(x);
      expect(painted).toBeGreaterThan(previous);
      expect(narrowRoomX(painted)).toBeCloseTo(x, 8);
      previous = painted;
    }
    for (const y of [53, 88, 138, 174, 218, 239]) for (const x of [5, 20, 35, 100, 160, 220, 285, 300, 315]) {
      const original = { x, y };
      const actual = unprojectMainWorld(projectMainWorld(original));
      expect(actual.x).toBeCloseTo(x, 7); expect(actual.y).toBe(y);
    }
  });
  it('does not widen invalid sizes', () => {
    setRoomPresentationWidth(NaN); expect(roomSideSpace()).toBe(0);
    expect(fittedRoomWidth(1200, 0, 240, true)).toBe(320);
  });
});

describe('wide bays cannot edit adjacent saved rooms', () => {
  it('rejects side-wall placement and hidden adjacent wall selection', () => {
    setRoomPresentationWidth(720);
    const view = new CafeView();
    const state = createInitialState();
    state.regions = ['reading'];
    state.decor.placed.push({ id: 'clock', col: 42, row: 1 });
    for (const x of [-50, 345, 390]) {
      const cell = view.withPresentedPointer({ x, y: 32 }, logical => view.cellAt('clock', logical.x, logical.y));
      expect(cell.row).toBe(-1);
      expect(canPlace(state, 'clock', cell.col, cell.row, 2)).toBe(false);
      const hit = view.withPresentedPointer({ x, y: 32 }, logical => view.furnitureAt(state, logical.x, logical.y));
      expect(hit).toBe(-1);
    }
    expect(state.decor.placed.some(p => p.id === 'clock' && p.col === 42)).toBe(true);
  });
});
