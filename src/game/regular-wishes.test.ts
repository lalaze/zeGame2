import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { finishDay, openShop } from './day';
import { recordRegularGuestArrival, recordRegularGuestDeparture, recordRegularGuestService, regularGuestOrder } from './regular-guests';
import { chooseMinaWish, displayMinaMap, isMinaWishDrink, minaMapChoice, minaReservedTable, minaWish, minaWishAvailable, setMinaWishPaused, type WishHandoff } from './regular-wishes';
import { makeSignatureId, saveSignature, setSignatureOnMenu, trialSignature } from './signature-drinks';
import { Sim } from './sim';

function handoff(s: GameState, context?: WishHandoff, guest = 'mina') {
  const id = recordRegularGuestArrival(s, guest)!;
  recordRegularGuestService(s, guest, id, context);
  return id;
}
function metCafe(): GameState {
  const s = createInitialState(0); openShop(s); handoff(s); finishDay(s);
  s.pantry.beans = 1000;
  return s;
}
function seeded(initial: number) {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe('Mina’s optional arrangement', () => {
  it('requires an actual first handoff and only changes preparation after an explicit choice', () => {
    const s = createInitialState(0);
    expect(minaWishAvailable(s)).toBe(false);
    expect(chooseMinaWish(s, 'quiet')).toBe(false);
    openShop(s); const visit = recordRegularGuestArrival(s, 'mina')!;
    expect(minaWishAvailable(s)).toBe(false);
    recordRegularGuestService(s, 'mina', visit);
    expect(chooseMinaWish(s, 'quiet')).toBe(false);
    finishDay(s);
    const before = structuredClone(s);
    expect(chooseMinaWish(s, 'quiet')).toBe(true);
    expect(chooseMinaWish(s, 'quiet')).toBe(false);
    expect(minaReservedTable(s)).toBe(0);
    expect({ ...s, regularWishes: before.regularWishes }).toEqual(before);
    expect(setMinaWishPaused(s, true)).toBe(true);
    expect(minaReservedTable(s)).toBeNull();
    expect(chooseMinaWish(s, 'milky')).toBe(true);
    expect(minaWish(s)).toMatchObject({ choice: 'milky', paused: false });
  });

  it('advances only once on a validated delivered order, and needs a later day for the map', () => {
    let s = metCafe(); chooseMinaWish(s, 'quiet'); openShop(s);
    const table = { seat: 0, items: ['espresso'] as const };
    recordRegularGuestService(s, 'mina', 999, table);
    const failed = recordRegularGuestArrival(s, 'mina')!;
    recordRegularGuestDeparture(s, 'mina', failed);
    recordRegularGuestService(s, 'mina', failed, table);
    handoff(s, { seat: -1, items: ['espresso'] });
    handoff(s, { seat: 2, items: ['espresso'] });
    handoff(s, { seat: 0, items: [] });
    handoff(s, table, 'theo');
    expect(minaWish(s)!.rehearsedDay).toBeNull();
    const success = handoff(s, table);
    expect(minaWish(s)).toMatchObject({ rehearsedDay: 2, completedDay: null, displayed: false });
    expect(minaReservedTable(s)).toBeNull();
    handoff(s, table);
    expect(minaMapChoice(s)).toBeNull();
    s = deserialize(serialize(s), 0);
    expect(minaWish(s)!.rehearsedDay).toBe(2);
    finishDay(s);
    expect(chooseMinaWish(s, 'milky')).toBe(false);
    openShop(s);
    recordRegularGuestService(s, 'mina', success, table);
    expect(minaMapChoice(s)).toBeNull();
    handoff(s, { seat: -1, items: ['espresso'] });
    expect(minaWish(s)).toMatchObject({ completedDay: 3, displayed: true, choice: 'quiet' });
    expect(minaMapChoice(s)).toBe('quiet');
    const before = structuredClone(s);
    expect(displayMinaMap(s, false)).toBe(true);
    expect(displayMinaMap(s, false)).toBe(false);
    expect(deserialize(serialize(s), 0).regularWishes).toEqual(s.regularWishes);
    expect(displayMinaMap(s, true)).toBe(true);
    expect(s).toEqual(before);
  });

  it('uses actual supplied milk drinks, including custom drinks; food and stock-outs do not qualify', () => {
    const s = metCafe(); chooseMinaWish(s, 'milky');
    const formula = { beans: 1, milk: 1 };
    s.pantry.milk = 50;
    const id = makeSignatureId('coffee', formula)!;
    expect(trialSignature(s, 'coffee', formula).ok).toBe(true);
    expect(saveSignature(s, id, 'Practice cup')).toBe(true);
    expect(setSignatureOnMenu(s, id, true)).toBe(true);
    expect(isMinaWishDrink(id)).toBe(true);
    expect(isMinaWishDrink('cheesecake')).toBe(false);
    expect(regularGuestOrder(s, 'mina', 'espresso', null).order).toBe(id);
    expect(regularGuestOrder(s, 'mina', 'roll', null)).toEqual({ order: 'roll', extra: null });
    expect(regularGuestOrder(s, 'mina', 'roll', 'espresso')).toEqual({ order: 'roll', extra: id });
    s.pantry.milk = 0;
    expect(regularGuestOrder(s, 'mina', 'espresso', null).order).toBe('espresso');
    openShop(s);
    handoff(s, { seat: 0, items: ['roll'] });
    handoff(s, { seat: 0, items: ['espresso'] });
    expect(minaWish(s)!.rehearsedDay).toBeNull();
    // Only the successfully delivered drink is included in the handoff receipt.
    handoff(s, { seat: -1, items: [id] });
    expect(minaWish(s)!.rehearsedDay).toBe(2);
    expect(regularGuestOrder(s, 'mina', 'espresso', null).order).toBe('espresso');
  });

  it('does not infer old wishes or accept impossible dates and rewards from a save', () => {
    const s = metCafe();
    const legacy = JSON.parse(serialize(s)); delete legacy.regularWishes; legacy.version = 19;
    expect(deserialize(JSON.stringify(legacy), 0).regularWishes).toEqual({ mina: null });
    chooseMinaWish(s, 'quiet');
    expect(deserialize(serialize(s), 0).regularWishes).toEqual(s.regularWishes);
    const bad = JSON.parse(serialize(s));
    bad.regularWishes.mina = { choice: 'quiet', acceptedDay: 99, rehearsedDay: 99, completedDay: 100, displayed: true };
    expect(deserialize(JSON.stringify(bad), 0).regularWishes.mina).toBeNull();
    bad.regularWishes.mina.acceptedDay = 2;
    expect(deserialize(JSON.stringify(bad), 0).regularWishes.mina).toMatchObject({ rehearsedDay: null, completedDay: null, displayed: false });
    bad.regularGuests = { guests: {}, nextVisitId: 1 };
    expect(deserialize(JSON.stringify(bad), 0).regularWishes.mina).toBeNull();
    expect(displayMinaMap(s, true)).toBe(false);
  });
});

describe('actual service and saved visits', () => {
  it('serves the requested latte through ordinary stock, payment and review transitions', () => {
    const s = metCafe(); s.items.latte = 1; s.onMenu = ['espresso', 'latte']; s.pantry.milk = 100;
    chooseMinaWish(s, 'milky'); openShop(s);
    const sim = new Sim(seeded(42)); let orderedLatte = false;
    for (let i = 0; i < 7200 && minaWish(s)!.rehearsedDay === null; i++) {
      sim.update(s, .05);
      if (sim.customers.some(c => c.regularGuestId === 'mina' && c.order === 'latte')) orderedLatte = true;
    }
    expect(orderedLatte).toBe(true);
    expect(minaWish(s)!.rehearsedDay).toBe(2);
    expect(s.today.sales.latte).toBeGreaterThan(0);
    expect(s.pantry.milk).toBeLessThan(100);
    expect(s.today.revenue).toBeGreaterThan(0);
    expect(s.reputation.recent.length).toBeGreaterThan(0);
  });

  it('keeps both chairs for Mina, delivers through a server, and resumes her live visit safely', () => {
    let s = metCafe(); chooseMinaWish(s, 'quiet'); openShop(s);
    let sim = new Sim(seeded(42)); let restored = false, sawReservedSeat = false;
    for (let i = 0; i < 7200 && minaWish(s)!.rehearsedDay === null; i++) {
      sim.update(s, .05);
      for (const c of sim.customers) if (c.seat === 0 || c.seat === 1) {
        expect(c.regularGuestId).toBe('mina'); sawReservedSeat = true;
      }
      if (!restored && sim.customers.some(c => c.regularGuestId === 'mina' && c.phase === 'waiting')) {
        const snapshot = sim.snapshot(s);
        s = deserialize(serialize(s), 0);
        sim = new Sim(seeded(43));
        expect(sim.restore(snapshot, s)).toBe(true);
        restored = true;
      }
    }
    expect(restored).toBe(true); expect(sawReservedSeat).toBe(true);
    expect(minaWish(s)!.rehearsedDay).toBe(2);
    expect(s.today.sales.espresso).toBeGreaterThan(0);
    expect(s.today.ingredientCost).toBeGreaterThan(0);
    expect(sim.customers.find(c => c.regularGuestId === 'mina' && c.hasCup)?.dineIn).toBe(true);
  });

  it('does not grant rehearsal when accepted service is discarded', () => {
    const s = metCafe(); chooseMinaWish(s, 'quiet'); openShop(s);
    const sim = new Sim(seeded(42));
    for (let i = 0; i < 3600 && !sim.customers.some(c => c.regularGuestId === 'mina' && c.phase === 'ordering'); i++) sim.update(s, .05);
    expect(sim.customers.some(c => c.regularGuestId === 'mina' && c.phase === 'ordering')).toBe(true);
    sim.beginClosing(s); sim.closeShop(s);
    expect(minaWish(s)!.rehearsedDay).toBeNull();
  });

  it('a paused arrangement leaves ordinary seeded service, income and stories unchanged', () => {
    const plain = metCafe(), paused = structuredClone(plain);
    chooseMinaWish(paused, 'quiet'); setMinaWishPaused(paused, true);
    const a = new Sim(seeded(24)), b = new Sim(seeded(24));
    openShop(plain); openShop(paused);
    for (let i = 0; i < 3600; i++) { a.update(plain, .05); b.update(paused, .05); }
    expect(paused.today).toEqual(plain.today);
    expect(paused.regularGuests).toEqual(plain.regularGuests);
    expect(b.snapshot(paused)).toEqual(a.snapshot(plain));
    expect(minaWish(paused)!.rehearsedDay).toBeNull();
  });
});
