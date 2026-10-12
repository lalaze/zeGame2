import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { CATS, adoptCat, parsePets, petPreferences, petTraffic, updatePetCare } from './pets';

describe('cat personality persistence', () => {
  it('gives each catalog cat a stable distinct profile on adoption and legacy migration', () => {
    const profiles = new Set<string>();
    for (const cat of CATS) {
      const state = createInitialState(0);
      state.coins = cat.adoption;
      expect(adoptCat(state, cat.id)).toBe(true);
      const defaults = petPreferences({ id: cat.id });
      profiles.add(JSON.stringify(defaults));
      expect(state.pets[0]).toMatchObject(defaults);
      const legacy = { id: cat.id, careSeconds: 42, autoRefill: true };
      expect(parsePets([legacy])[0]).toEqual({ ...legacy, ...defaults });
      // Parsing other residents first cannot affect identity defaults.
      const preceding = CATS.find((other) => other.id !== cat.id)!;
      expect(petPreferences(parsePets([{ id: preceding.id }, legacy])[1])).toEqual(defaults);
    }
    expect(profiles.size).toBe(CATS.length);
  });

  it('round-trips non-default preferences without changing supplies or offline economics', () => {
    const state = createInitialState(0);
    state.coins = 10000;
    adoptCat(state, 'ginger');
    Object.assign(state.pets[0], { personality: 'quiet', preferredArea: 'terrace', preferredSpot: 'window' });
    state.phase = 'open';
    updatePetCare(state, 25);
    const restored = deserialize(serialize(state), 86400000);
    expect(restored.pets).toEqual(state.pets);
    expect(restored.today.petCost).toBe(state.today.petCost);
    expect(restored.coins).toBe(state.coins);
    expect(petTraffic(restored)).toBe(petTraffic(state));
    expect(deserialize(serialize(restored), 172800000).pets).toEqual(state.pets);
  });

  it('migrates pre-personality saves once without requiring a version change', () => {
    const state = createInitialState(0);
    state.pets = [{ id: 'ginger', careSeconds: 42, autoRefill: false }];
    const restored = deserialize(serialize(state), 1000);
    expect(restored.pets).toEqual([{ ...state.pets[0], personality: 'playful', preferredArea: 'main', preferredSpot: 'explore' }]);
    expect(deserialize(serialize(restored), 2000).pets).toEqual(restored.pets);
  });

  it.each([undefined, null, false, 4, [], {}, 'unknown', '__proto__', 'constructor'])('rejects malformed preference values %j', (value) => {
    const [pet] = parsePets([{ id: 'ginger', careSeconds: 42, autoRefill: false, personality: value, preferredArea: value, preferredSpot: value }]);
    expect(pet).toEqual({ id: 'ginger', careSeconds: 42, autoRefill: false, personality: 'playful', preferredArea: 'main', preferredSpot: 'explore' });
  });

  it('repairs fields independently and ignores unsupported transient or unknown data', () => {
    const [pet] = parsePets([{ id: 'ginger', personality: 'quiet', preferredArea: 'missing', preferredSpot: 'window', restingLocation: { x: Infinity, y: -1 }, unexpected: true }]);
    expect(pet).toEqual({ id: 'ginger', careSeconds: 0, autoRefill: false, personality: 'quiet', preferredArea: 'main', preferredSpot: 'window' });
  });

  it('keeps preference resolution pure for legacy in-memory pets', () => {
    const legacy = Object.freeze({ id: 'ginger' as const, careSeconds: 42, autoRefill: false });
    const first = petPreferences(legacy);
    first.personality = 'quiet';
    expect(petPreferences(legacy).personality).toBe('playful');
    expect(legacy).toEqual({ id: 'ginger', careSeconds: 42, autoRefill: false });
  });

  it('keeps care spending and traffic independent of every personality and preference', () => {
    for (const personality of ['playful', 'quiet', 'affectionate'] as const) {
      const state = createInitialState(0);
      state.coins = 10000;
      adoptCat(state, 'ginger');
      Object.assign(state.pets[0], { personality, preferredArea: 'terrace', preferredSpot: 'window' });
      state.phase = 'open';
      updatePetCare(state, 181);
      expect(state.coins).toBe(10000 - 300 - 8);
      expect(state.today.petCost).toBeCloseTo(181 / 180 * 8);
      expect(state.pets[0].careSeconds).toBe(179);
      expect(petTraffic(state)).toBeCloseTo(1.08);
    }
  });
});
