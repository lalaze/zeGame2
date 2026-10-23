import { describe, expect, it } from 'vitest';
import { validSnapshot } from '../../../src/game/sim-snapshot';
import { serialize } from '../../../src/game/state';
import { MinaReplay, REPLAY_STOPS } from './replay-model';

describe('synthetic Mina component replay', () => {
  it.each(['idle', 'nuzzleA', 'nuzzleB', 'petA', 'petB'] as const)('reaches %s only by ordinary seeded updates', stop => {
    const replay = new MinaReplay();
    replay.reset(stop);
    expect(replay.steps).toBe(REPLAY_STOPS[stop]);
    expect(replay.mina).toMatchObject({ id: 1, appearanceId: 0, regularGuestId: 'mina', phase: 'sitting', seat: 0,
      x: 80, y: 175, hasCup: true, missingExtra: false, soldOut: false });
    expect(replay.state.today.shortages).toEqual({});
    expect(validSnapshot(replay.sim.snapshot(replay.state), replay.state)).toBe(true);
    if (stop === 'idle') expect(replay.cat?.interaction).toBeUndefined();
    else if (stop === 'nuzzleA' || stop === 'nuzzleB') {
      expect(replay.cat).toMatchObject({ x: 80, y: 187, interaction: { guestId: 1, phase: 'nuzzle' } });
      expect(replay.cat!.interaction!.elapsed).toBeCloseTo(stop === 'nuzzleA' ? 0 : .65, 12);
    } else {
      expect(replay.cat).toMatchObject({ x: 80, y: 187, interaction: { guestId: 1, phase: 'response' } });
      expect(replay.petFrame).toBe(stop === 'petA' ? 0 : 1);
    }
  });

  it('replays the exact same state after running and resetting', () => {
    const replay = new MinaReplay();
    replay.reset('petB');
    const economy = serialize(replay.state), runtime = replay.sim.snapshot(replay.state);
    const cat = structuredClone(replay.cat);
    for (let i = 0; i < 80; i++) replay.step();
    replay.reset('petB');
    expect(serialize(replay.state)).toBe(economy);
    expect(replay.sim.snapshot(replay.state)).toEqual(runtime);
    expect(replay.cat).toEqual(cat);
  });

  it('steps from petA to petB without overwriting the live interaction', () => {
    const replay = new MinaReplay();
    const interaction = replay.cat!.interaction;
    for (let i = 0; i < 13; i++) replay.step();
    expect(replay.cat!.interaction).toBe(interaction);
    expect(replay.petFrame).toBe(1);
    expect(interaction!.elapsed).toBeCloseTo(0.65, 12);
    expect(replay.mina?.phase).toBe('sitting');
  });
});
