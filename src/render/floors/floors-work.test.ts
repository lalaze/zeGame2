import { describe, expect, it } from 'vitest';
import { STATION_SECONDS } from '../../game/kitchen';
import type { Cook } from '../../game/sim';
import { createInitialState } from '../../game/state';
import { bakeShare, brewShare } from './floors-work';

describe('work in progress', () => {
  it('follows a barista from taking an order to finishing it', () => {
    const at = (customerId: number | null, remaining: number, total = 4) => brewShare({ customerId, remaining, total });
    expect([at(7, 4), at(7, 3), at(7, 1)]).toEqual([0, .25, .75]);
    // Nothing ordered yet, nothing on, or finished and being called out.
    expect([at(7, 0, 0), at(null, 0, 0), at(7, 0)]).toEqual([null, null, null]);
  });

  it('follows a cook at a station, and shows nothing on the way there', () => {
    const state = createInitialState(0), total = STATION_SECONDS.deckOven;
    const sim = (timer: number, working: boolean, batch = true) => ({
      cooks: [{ batch: batch ? { item: 'roll', n: 1, steps: ['deckOven'], step: 0, timer } : null } as unknown as Cook],
      cookStation: () => (batch ? { station: 'deckOven' as const, working } : null),
    });
    expect(bakeShare(sim(total, true), state, 0)).toBe(0);
    expect(bakeShare(sim(total / 2, true), state, 0)).toBeCloseTo(.5);
    // The last moment overshoots a little.
    expect(bakeShare(sim(-.1, true), state, 0)).toBe(1);
    expect(bakeShare(sim(total, false), state, 0)).toBeNull();
    expect(bakeShare(sim(0, true, false), state, 0)).toBeNull();
    expect(bakeShare(sim(total, true), state, 1)).toBeNull();
  });
});
