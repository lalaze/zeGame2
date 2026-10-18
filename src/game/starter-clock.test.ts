import { describe, expect, it } from 'vitest';
import { canPlace } from './furniture';
import { mainTableCount } from './regions';
import { createInitialState, deserialize, serialize, SAVE_VERSION } from './state';

describe('starter clock clearance', () => {
  it('keeps the new starter clock in a legal, selectable wall footprint', () => {
    const state = createInitialState(0);
    const index = state.decor.placed.findIndex(p => p.id === 'clock');
    const clock = state.decor.placed[index];
    expect(clock).toEqual({ id: 'clock', col: 11, row: 0 });
    expect(canPlace(state, 'clock', clock.col, clock.row, mainTableCount(state), index)).toBe(true);
  });

  it('moves the legacy default clock once and preserves the rest of the café', () => {
    const state = createInitialState(100);
    state.version = 16;
    state.decor.placed[0].col = 10;
    state.day = 7;
    state.coins = 1234;
    state.pantry.beans = 27;
    const restored = deserialize(serialize(state), 200);
    expect(restored.decor.placed[0]).toEqual({ id: 'clock', col: 11, row: 0 });
    expect(restored.decor.placed.slice(1)).toEqual(state.decor.placed.slice(1));
    expect(restored.decor.stored).toEqual(state.decor.stored);
    expect(restored.day).toBe(7);
    expect(restored.coins).toBe(1234);
    expect(restored.pantry.beans).toBe(27);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(deserialize(serialize(restored), 300)).toEqual(restored);
  });

  it('preserves clocks the player already moved, and current saves', () => {
    for (const [version, col, row] of [[16, 9, 2], [SAVE_VERSION, 10, 0]]) {
      const state = createInitialState(100);
      state.version = version;
      state.decor.placed[0] = { id: 'clock', col, row };
      expect(deserialize(serialize(state), 200).decor.placed[0]).toEqual(state.decor.placed[0]);
    }
  });
});
