import { describe, expect, it, vi } from 'vitest';
import { REGULAR_GUESTS } from './regular-guests-content';
import * as regularGuests from './regular-guests';
import {
  emptyRegularGuests, markRegularGuestChapterRead, parseRegularGuests,
  recordRegularGuestArrival, recordRegularGuestDeparture, recordRegularGuestService,
  regularGuestChapterRequirement, regularGuestForAppearance, regularGuestOrder,
  regularGuestProgress, regularGuestUnreadCount,
} from './regular-guests';
import { openShop } from './day';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, deserialize, serialize, SAVE_VERSION, type GameState } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
function openCafe(day = 1): GameState {
  const state = createInitialState(0);
  state.day = day;
  state.pantry.beans = 10000;
  openShop(state);
  return state;
}
function serve(state: GameState, id = 'mina') {
  const visit = recordRegularGuestArrival(state, id);
  expect(visit).not.toBeNull();
  return recordRegularGuestService(state, id, visit!);
}
function until(state: GameState, sim: Sim, done: () => boolean) {
  for (let n = 0; n < 12000 && !done(); n++) sim.update(state, 0.05);
  expect(done()).toBe(true);
}

describe('regular guest progression', () => {
  it('starts empty and never infers old-save meetings or unlocks from café totals', () => {
    expect(createInitialState(0).regularGuests).toEqual(emptyRegularGuests());
    const legacy = deserialize(JSON.stringify({ version: 12, day: 100, served: 99999, today: { served: 30, sales: { espresso: 50 } } }), 0);
    expect(legacy.regularGuests).toEqual(emptyRegularGuests());
    expect(legacy.version).toBe(SAVE_VERSION);
    expect(regularGuestProgress(legacy, 'mina')).toBeUndefined();
    expect(regularGuestUnreadCount(legacy)).toBe(0);
  });

  it('records meeting separately and unlocks once per day on successful handoff only', () => {
    const state = openCafe();
    const visit = recordRegularGuestArrival(state, 'mina')!;
    expect(regularGuestProgress(state, 'mina')).toMatchObject({ firstMetDay: 1, served: 0, unlockedChapters: [], readChapters: [] });
    expect(recordRegularGuestService(state, 'mina', visit)).toBe(0);
    expect(recordRegularGuestService(state, 'mina', visit)).toBeNull();
    expect(serve(state)).toBeNull();
    expect(regularGuestProgress(state, 'mina')).toMatchObject({ served: 2, unlockedChapters: [0], lastUnlockDay: 1 });
    state.day = 2;
    expect(serve(state)).toBeNull();
    state.day = 3;
    expect(serve(state)).toBe(1);
    expect(regularGuestProgress(state, 'mina')!.readChapters).toEqual([]);
    expect(regularGuestUnreadCount(state)).toBe(2);
  });

  it('uses absolute debut-day gates and daily caps even for a very late first meeting', () => {
    const state = openCafe(30);
    for (let n = 0; n < 9; n++) serve(state);
    expect(regularGuestProgress(state, 'mina')).toMatchObject({ firstMetDay: 30, served: 9, unlockedChapters: [0] });
    for (let day = 31; day <= 34; day++) {
      state.day = day;
      expect(serve(state)).toBe(day - 30);
    }
    expect(regularGuestProgress(state, 'mina')!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
    expect(regularGuestUnreadCount(state, 'mina')).toBe(5);
    state.day = 50;
    expect(serve(state)).toBeNull();
    expect(regularGuestChapterRequirement('mina', 0)).toEqual({ day: 1, served: 1 });
    expect(regularGuestChapterRequirement('mina', 4)).toEqual({ day: 9, served: 5 });
    for (const index of [-1, 5, 1.5, NaN]) expect(regularGuestChapterRequirement('mina', index)).toBeNull();
  });

  it('reading is explicit, idempotent and independent of service and future chapters', () => {
    const state = openCafe();
    expect(markRegularGuestChapterRead(state, 'mina', 0)).toBe(false);
    serve(state);
    const before = serialize(state);
    expect(regularGuestUnreadCount(state, 'mina')).toBe(1);
    expect(serialize(state)).toBe(before); // Querying/opening a journal is read-only.
    expect(markRegularGuestChapterRead(state, 'mina', 1)).toBe(false);
    expect(markRegularGuestChapterRead(state, 'mina', 0)).toBe(true);
    expect(markRegularGuestChapterRead(state, 'mina', 0)).toBe(false);
    expect(markRegularGuestChapterRead(state, 'unknown', 0)).toBe(false);
    expect(regularGuestUnreadCount(state)).toBe(0);
    const loaded = deserialize(serialize(state), 0);
    expect(loaded.regularGuests).toEqual(state.regularGuests);
    state.day = 3;
    serve(state);
    expect(regularGuestProgress(state, 'mina')!.unlockedChapters).toEqual([0, 1]);
    expect(regularGuestUnreadCount(state)).toBe(1);
  });

  it('rejects unissued, duplicate, failed and wrong-guest service receipts', () => {
    const state = openCafe();
    const visit = recordRegularGuestArrival(state, 'mina')!;
    for (const bad of [0, -1, visit + 1, 0.5, NaN, Infinity]) expect(recordRegularGuestService(state, 'mina', bad)).toBeNull();
    expect(recordRegularGuestService(state, 'unknown', visit)).toBeNull();
    recordRegularGuestDeparture(state, 'mina', visit);
    expect(recordRegularGuestService(state, 'mina', visit)).toBeNull();
    expect(regularGuestProgress(state, 'mina')!.served).toBe(0);
    const next = recordRegularGuestArrival(state, 'mina')!;
    recordRegularGuestService(state, 'mina', next);
    const loaded = deserialize(serialize(state), 0);
    expect(recordRegularGuestService(loaded, 'mina', next)).toBeNull();
    expect(regularGuestProgress(loaded, 'mina')!.served).toBe(1);
  });

  it('bounds completed receipts while retaining an earlier active visit, including across save/load', () => {
    let state = openCafe(30);
    const earlier = recordRegularGuestArrival(state, 'mina')!;
    let retired = 0;
    for (let i = 0; i < 200; i++) {
      const visit = recordRegularGuestArrival(state, 'mina')!;
      retired ||= visit;
      recordRegularGuestService(state, 'mina', visit);
    }
    expect(regularGuestProgress(state, 'mina')!.servedVisitIds).toHaveLength(160);
    state = deserialize(serialize(state), 0);
    expect(recordRegularGuestService(state, 'mina', retired)).toBeNull();
    recordRegularGuestService(state, 'mina', earlier);
    expect(regularGuestProgress(state, 'mina')!.served).toBe(201);
    recordRegularGuestService(state, 'mina', earlier);
    expect(regularGuestProgress(state, 'mina')!.served).toBe(201);
  });

  it('sanitizes unknown guests, malformed counts, chapter gaps, duplicates and receipt bounds', () => {
    const parsed = parseRegularGuests({ nextVisitId: 10, guests: {
      stranger: { firstMetDay: 1, served: 99 },
      mina: { firstMetDay: 1, served: 3, unlockedChapters: [0, 0, 1, 2, 3, 4, -1, 0.5], readChapters: [0, 0, 2, 4], lastUnlockDay: 999,
        servedVisitIds: [1, 1, 2, 0, -3, 3.5, '4', 10, 99], pendingDay: 3, pendingVisitIds: [1, 3, 3, 4, 10, -1] },
    } }, 3);
    expect(Object.keys(parsed.guests)).toEqual(['mina']);
    expect(parsed.guests.mina).toMatchObject({ served: 3, unlockedChapters: [0, 1], readChapters: [0], lastUnlockDay: 3,
      servedVisitIds: [1, 2], pendingVisitIds: [3, 4] });
    expect(parseRegularGuests({ guests: { mina: { firstMetDay: 2, served: 10, unlockedChapters: [0] } } }, 1).guests).toEqual({});
    const gaps = parseRegularGuests({ guests: { mina: { firstMetDay: 1, served: 10, unlockedChapters: [0, 2, 3] } } }, 20);
    expect(gaps.guests.mina!.unlockedChapters).toEqual([0]);
    for (const malformed of [null, [], 'text', 7]) expect(parseRegularGuests(malformed)).toEqual(emptyRegularGuests());
    const bad = parseRegularGuests({nextVisitId: -10, guests:{mina:{firstMetDay:1,served:1.5,unlockedChapters:[0],readChapters:[0]}}},5);
    expect(bad.nextVisitId).toBe(1);
    expect(bad.guests.mina).toMatchObject({served:0,unlockedChapters:[],readChapters:[]});
  });

  it('does not unlock on loading, even if all current-day requirements are already met', () => {
    const state = openCafe(19);
    for (let i = 0; i < 5; i++) serve(state);
    const loaded = deserialize(serialize(state), 0);
    expect(regularGuestProgress(loaded, 'mina')!.unlockedChapters).toEqual([0]);
    state.day = 20;
    const nextDay = deserialize(serialize(state), 0);
    expect(regularGuestProgress(nextDay, 'mina')!.unlockedChapters).toEqual([0]);
    expect(serve(nextDay)).toBe(1);
  });

  it('makes every chapter independently reachable without reading or cross-character dependencies', () => {
    const state = openCafe();
    for (let day = 1; day <= 19; day++) {
      state.day = day;
      for (const guest of REGULAR_GUESTS) {
        expect(regularGuestForAppearance(guest.appearanceId, day)?.id).toBe(day >= guest.debutDay ? guest.id : undefined);
        if (day >= guest.debutDay) serve(state, guest.id);
        else expect(recordRegularGuestArrival(state, guest.id)).toBeNull();
      }
    }
    for (const guest of REGULAR_GUESTS) {
      expect(regularGuestProgress(state, guest.id)!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
      expect(regularGuestProgress(state, guest.id)!.readChapters).toEqual([]);
    }
    expect(regularGuestUnreadCount(state)).toBe(REGULAR_GUESTS.length * 5);
  });
});

describe('regular guest orders and natural visits', () => {
  it('uses a preference only when unlocked, on-menu and actually in stock, preserving combo structure', () => {
    const state = openCafe();
    state.items.americano = 1;
    state.onMenu = ['espresso', 'americano'];
    expect(regularGuestOrder(state, 'mina', 'americano', 'roll')).toEqual({ order: 'espresso', extra: 'roll' });
    expect(regularGuestOrder(state, 'mina', 'roll', 'americano')).toEqual({ order: 'roll', extra: 'espresso' });
    expect(regularGuestOrder(state, 'mina', 'roll', null)).toEqual({ order: 'roll', extra: null });
    for (const unavailable of ['locked', 'off-menu', 'sold-out'] as const) {
      const other = structuredClone(state);
      if (unavailable === 'locked') other.items.espresso = 0;
      if (unavailable === 'off-menu') other.onMenu = ['americano'];
      if (unavailable === 'sold-out') other.pantry.beans = 0;
      expect(regularGuestOrder(other, 'mina', 'americano', 'roll')).toEqual({ order: 'americano', extra: 'roll' });
    }
    expect(regularGuestOrder(state, undefined, 'americano', null)).toEqual({order:'americano',extra:null});
  });

  it('meets Mina naturally, advances at a real handoff, persists identity, and never recounts after refresh', () => {
    const state = openCafe();
    const sim = new Sim(seeded(8));
    until(state, sim, () => sim.customers.some((c) => c.regularGuestId === 'mina' && c.phase === 'ordering'));
    const mina = sim.customers.find((c) => c.regularGuestId === 'mina')!;
    expect(mina.appearanceId).toBe(0);
    expect(mina.regularGuestVisitId).toBeGreaterThan(0);
    expect(regularGuestProgress(state, 'mina')).toMatchObject({ firstMetDay: 1, served: 0, unlockedChapters: [] });
    sim.beginClosing(state);
    const snapshot = sim.snapshot(state);
    const loaded = deserialize(serialize(state), 0);
    const restored = new Sim(seeded(9));
    expect(restored.restore(snapshot, loaded)).toBe(true);
    expect(restored.customers.find((c) => c.id === mina.id)).toMatchObject({ regularGuestId: 'mina', regularGuestVisitId: mina.regularGuestVisitId, appearanceId: 0, look: mina.look });
    expect(regularGuestProgress(loaded, 'mina')!.served).toBe(0);
    until(loaded, restored, () => regularGuestProgress(loaded, 'mina')!.served === 1);
    expect(regularGuestProgress(loaded, 'mina')!.unlockedChapters).toEqual([0]);
    const paidState = deserialize(serialize(loaded), 0);
    const paid = new Sim(seeded(10));
    expect(paid.restore(restored.snapshot(loaded), paidState)).toBe(true);
    until(paidState, paid, () => paid.customers.length === 0);
    expect(regularGuestProgress(paidState, 'mina')!.served).toBe(1);
    expect(regularGuestUnreadCount(paidState, 'mina')).toBe(1);
  });

  it('opens all five Mina chapters through nine real business days without reading or synthetic service', () => {
    let state = openCafe();
    let sim = new Sim(seeded(8));
    for (let day = 1; day <= 9; day++) {
      expect(state.day).toBe(day);
      const previous = regularGuestProgress(state, 'mina')?.served ?? 0;
      until(state, sim, () => (regularGuestProgress(state, 'mina')?.served ?? 0) > previous);
      const progress = regularGuestProgress(state, 'mina')!;
      expect(progress.unlockedChapters).toHaveLength(Math.ceil(day / 2));
      expect(progress.readChapters).toEqual([]);
      sim.beginClosing(state);
      until(state, sim, () => sim.finishedService);
      sim.closeShop(state);
      const savedJournal = structuredClone(state.regularGuests);
      state = deserialize(serialize(state), 0);
      expect(state.regularGuests).toEqual(savedJournal);
      expect(regularGuestUnreadCount(state, 'mina')).toBe(Math.ceil(day / 2));
      if (day < 9) {
        openShop(state);
        sim = new Sim(seeded(8 + day));
      }
    }
    expect(regularGuestProgress(state, 'mina')!.unlockedChapters).toEqual([0, 1, 2, 3, 4]);
  });

  it('leaves a cancelled named visit unmet by service and rejects malformed narrative snapshots', () => {
    const state = openCafe();
    const sim = new Sim(seeded(8));
    until(state, sim, () => sim.customers.some((c) => c.regularGuestId === 'mina' && c.phase === 'ordering'));
    const snapshot = sim.snapshot(state);
    const mina = snapshot.customers.find((c) => c.regularGuestId === 'mina')!;
    const wrong = structuredClone(snapshot);
    wrong.customers.find((c) => c.id === mina.id)!.regularGuestId = 'unknown';
    expect(validSnapshot(wrong, state)).toBe(false);
    const mismatched = structuredClone(snapshot);
    mismatched.customers.find((c) => c.id === mina.id)!.appearanceId = 1;
    expect(validSnapshot(mismatched, state)).toBe(false);
    const futureToken = structuredClone(snapshot);
    futureToken.customers.find((c) => c.id === mina.id)!.regularGuestVisitId = state.regularGuests.nextVisitId;
    expect(validSnapshot(futureToken, state)).toBe(false);
    sim.closeShop(state);
    expect(regularGuestProgress(state, 'mina')).toMatchObject({ served: 0, unlockedChapters: [], pendingVisitIds: [] });
  });

  it('restores old in-flight visits without inferring narrative identity or retroactive progress', () => {
    const state = openCafe();
    const sim = new Sim(seeded(8));
    until(state, sim, () => sim.customers.some((c) => c.regularGuestId === 'mina' && c.phase === 'ordering'));
    sim.beginClosing(state);
    const snapshot = sim.snapshot(state);
    for (const c of snapshot.customers) { delete c.regularGuestId; delete c.regularGuestVisitId; }
    state.regularGuests = emptyRegularGuests();
    const restored = new Sim(seeded(9));
    expect(restored.restore(snapshot, state)).toBe(true);
    expect(restored.customers.every((c) => c.regularGuestId === undefined)).toBe(true);
    until(state, restored, () => restored.customers.length === 0);
    expect(state.regularGuests).toEqual(emptyRegularGuests());
  });

  it('does not perturb economic RNG, arrivals, orders, reviews or payments when preferences fall back', () => {
    const run = () => {
      const state = openCafe();
      const random = vi.fn(seeded(31));
      const sim = new Sim(random);
      for (let n = 0; n < 1200; n++) sim.update(state, 0.1);
      const { regularGuests: _history, ...economicState } = state;
      const snapshot = sim.snapshot(state);
      const customers = snapshot.customers.map(({ regularGuestId: _id, regularGuestVisitId: _visit, ...customer }) => customer);
      return { state: economicState, snapshot: { ...snapshot, customers }, draws: random.mock.calls.length };
    };
    const original = vi.spyOn(regularGuests, 'regularGuestForAppearance').mockReturnValue(undefined);
    const before = run();
    original.mockRestore();
    const after = run();
    expect(after).toEqual(before);
  });
});
