import { describe, expect, it } from 'vitest';
import { CUSTOMER_CAST, CustomerCastCycle } from './customer-cast';
import { openShop } from './day';
import { Sim } from './sim';
import { createInitialState, LOOK_RANGES, serialize } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
describe('thirty-six-customer cast', () => {
  it('contains exactly thirty-six distinct, immutable designs within the saved look ranges', () => {
    expect(CUSTOMER_CAST).toHaveLength(36);
    expect(new Set(CUSTOMER_CAST.map(c => c.name)).size).toBe(36);
    expect(new Set(CUSTOMER_CAST.map(c => c.id)).size).toBe(36);
    for (const c of CUSTOMER_CAST) {
      expect(Object.isFrozen(c.look)).toBe(true);
      for (const [key, max] of Object.entries(LOOK_RANGES)) {
        const value = c.look[key as keyof typeof c.look];
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(max);
      }
    }
    expect(new Set(CUSTOMER_CAST.map(c => c.hairstyle)).size).toBe(8);
    expect(new Set(CUSTOMER_CAST.map(c => c.outfit)).size).toBe(10);
    expect(new Set(CUSTOMER_CAST.map(c => c.accessory)).size).toBe(5);
  });
  it('visits all thirty-six once per cycle and avoids repeats at the cycle boundary', () => {
    for (const rng of [seeded(71), () => 0, () => 0.999999]) {
      const cycle = new CustomerCastCycle(rng);
      let previous = -1;
      for (let round = 0; round < 5; round++) {
        const ids: number[] = [];
        for (let n = 0; n < 36; n++) {
          const id = cycle.next().id;
          expect(id).not.toBe(previous);
          previous = id;
          ids.push(id);
        }
        expect(ids.sort((a, b) => a - b)).toEqual(CUSTOMER_CAST.map(c => c.id));
      }
    }
  });
  it('is reproducible with an injected random source and actually shuffles order', () => {
    const a = new CustomerCastCycle(seeded(42));
    const b = new CustomerCastCycle(seeded(42));
    const first = Array.from({ length: 72 }, () => a.next().id);
    expect(first).toEqual(Array.from({ length: 72 }, () => b.next().id));
    expect(first.slice(0, 36)).not.toEqual(CUSTOMER_CAST.map(c => c.id));
  });
  it('spawns roster appearances naturally without serializing them into the save', () => {
    const state = createInitialState(0);
    state.pantry.beans = 1000;
    openShop(state);
    const sim = new Sim(seeded(8));
    const seen = new Map<number, number>();
    for (let t = 0; t < 1800 && seen.size < 36; t++) {
      sim.update(state, 0.5);
      for (const c of sim.customers) {
        expect(c.appearanceId).toBeDefined();
        expect(c.look).toEqual(CUSTOMER_CAST[c.appearanceId!].look);
        expect(c.look).not.toBe(CUSTOMER_CAST[c.appearanceId!].look);
        seen.set(c.id, c.appearanceId!);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(36);
    expect(new Set([...seen.values()].slice(0, 36)).size).toBe(36);
    expect(serialize(state)).not.toContain('appearanceId');
  });
});
