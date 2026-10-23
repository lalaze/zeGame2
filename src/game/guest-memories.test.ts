import { describe, expect, it } from 'vitest';
import { CUSTOMER_CAST } from './customer-cast';
import { openShop } from './day';
import { rememberedOrder, memoryGuest, parseGuestMemories } from './guest-memories';
import { MomentDirector, recommendOptions } from './moments';
import { salePrice, setOnMenu } from './economy';
import { Sim, type Customer } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { selectTrialSale } from './trial-sales';
import { deleteSignature, makeSignatureId, renameSignature, saveSignature, trialSignature } from './signature-drinks';
import { thoughtCandidates } from '../render/thoughts';

const seeded = (initial: number) => { let seed = initial; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
function cafe() {
  const s = createInitialState(123); s.day = 3;
  s.items.americano = s.items.latte = 1; s.onMenu = ['espresso', 'latte'];
  s.upgrades.marketing = 3; s.pantry.beans = s.pantry.milk = s.pantry.sugar = 10000;
  return s;
}
function until(s: GameState, sim: Sim, done: () => boolean) {
  for (let n = 0; n < 8000 && !done(); n++) sim.update(s, .05);
  expect(done()).toBe(true);
}
function line() {
  const s = cafe(), sim = new Sim(seeded(42)); openShop(s);
  until(s, sim, () => sim.customers.some(c => c.phase === 'queue' && !c.regularGuestId && memoryGuest(c.appearanceId)));
  const c = sim.customers.find(c => c.phase === 'queue' && !c.regularGuestId && memoryGuest(c.appearanceId))!;
  // A known ordinary face who likes milk and avoids toast, with an unprepared order.
  c.appearanceId = 11; c.look = { ...CUSTOMER_CAST[11].look }; c.order = 'espresso'; c.extra = null; c.patience = 200;
  return { s, sim, c };
}
function recommend(s: GameState, sim: Sim, c: Customer, item: Customer['order'] = 'latte') {
  const director = new MomentDirector(seeded(9));
  director.active = { kind: 'recommend', customerId: c.id, options: [c.order, item], age: 0 };
  return director.recommend(s, sim, item);
}

describe('a delivered recommendation becomes a familiar order', () => {
  it('waits for real delivery, restores a pending recommendation and remembers only once', () => {
    let { s, sim, c } = line();
    expect(recommend(s, sim, c)).toBe('love');
    expect(s.guestMemories).toEqual({});
    until(s, sim, () => c.phase === 'ordering' || c.phase === 'toSeat');
    expect(s.guestMemories).toEqual({});
    const snapshot = sim.snapshot(s); expect(validSnapshot(snapshot, s)).toBe(true);
    s = deserialize(serialize(s), 0); sim = new Sim(seeded(43));
    expect(sim.restore(snapshot, s)).toBe(true); c = sim.customers.find(g => g.id === c.id)!;
    until(s, sim, () => c.hasCup);
    expect(c.recommendation).toBeUndefined();
    expect(s.guestMemories[11]).toEqual({ item: 'latte', source: 'recommend', learnedDay: 3, lastServedDay: 3, returns: 0 });
    expect(thoughtCandidates(sim, s).find(t => t.id === `customer:${c.id}`)?.key).toBe('memory.thought.loved');
    const memory = structuredClone(s.guestMemories);
    for (let n = 0; n < 10; n++) sim.update(s, .05);
    expect(s.guestMemories).toEqual(memory);
    expect(deserialize(serialize(s), 0).guestMemories).toEqual(memory);
    expect(validSnapshot(sim.snapshot(s), s)).toBe(true);
  });

  it('uses a remembered cup on a later actual visit, with normal payment and no repeated tip', () => {
    const { s, sim, c } = line(); recommend(s, sim, c); until(s, sim, () => c.hasCup);
    sim.closeShop(s); s.upgrades.barista = 2; s.upgrades.server = 1; openShop(s);
    const next = new Sim(seeded(65));
    until(s, next, () => next.customers.some(g => g.appearanceId === 11 && g.rememberedOrder));
    const returned = next.customers.find(g => g.appearanceId === 11 && g.rememberedOrder)!;
    expect(returned.order).toBe('latte'); expect(returned.momentTip).toBeUndefined();
    expect(s.guestMemories[11]!.returns).toBe(0);
    expect(validSnapshot(next.snapshot(s), s)).toBe(true);
    let payment: number | undefined;
    for (let n = 0; n < 8000 && payment === undefined; n++) {
      const event = next.update(s, .05).find(event => event.type === 'sale' && event.customerId === returned.id);
      if (event?.type === 'sale') payment = event.amount;
    }
    expect(payment).toBeCloseTo(salePrice(s, 'latte', returned.vip, returned.dineIn, ['latte']));
    expect(s.guestMemories[11]).toMatchObject({ learnedDay: 3, lastServedDay: 4, returns: 1 });
    expect(validSnapshot(next.snapshot(s), s)).toBe(true);
  });

  it('does not remember a cancelled, sold-out, ordinary or merely acceptable drink', () => {
    for (const kind of ['cancelled', 'soldOut', 'ordinary', 'fine'] as const) {
      const { s, sim, c } = line();
      if (kind !== 'ordinary') expect(recommend(s, sim, c, kind === 'fine' ? 'espresso' : 'latte')).not.toBeNull();
      if (kind === 'cancelled') sim.closeShop(s);
      else {
        if (kind === 'soldOut') s.pantry.milk = 0;
        until(s, sim, () => c.hasCup || c.phase === 'exiting');
      }
      expect(s.guestMemories[11]).toBeUndefined();
    }
  });

  it('keeps combinations and ordinary fallback, including off-menu stock and named regulars', () => {
    const { s, sim, c } = line(); recommend(s, sim, c); until(s, sim, () => c.hasCup);
    expect(rememberedOrder(s, 11, 'roll', 'espresso')).toEqual({ order: 'roll', extra: 'latte', rememberedOrder: 'latte' });
    expect(rememberedOrder(s, 11, 'roll', null)).toEqual({ order: 'roll', extra: null });
    expect(rememberedOrder(s, 0, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
    s.pantry.milk = 0;
    expect(rememberedOrder(s, 11, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
    s.pantry.milk = 100; s.onMenu = ['espresso'];
    expect(rememberedOrder(s, 11, 'espresso', null)).toEqual({ order: 'espresso', extra: null });
  });

  it('allows a delivered trial to create a memory without putting the drink on the menu', () => {
    const s = cafe(); s.onMenu = ['espresso']; selectTrialSale(s, 'latte'); openShop(s);
    const sim = new Sim(seeded(42));
    until(s, sim, () => sim.customers.some(c => c.trialSale === 'reserved' && !c.regularGuestId));
    const c = sim.customers.find(c => c.trialSale === 'reserved' && !c.regularGuestId)!;
    c.appearanceId = 11; c.look = { ...CUSTOMER_CAST[11].look }; c.patience = 200;
    expect(s.guestMemories[11]).toBeUndefined(); until(s, sim, () => c.hasCup);
    expect(s.guestMemories[11]).toMatchObject({ item: 'latte', source: 'trial', returns: 0 });
    expect(s.onMenu).toEqual(['espresso']);
    expect(rememberedOrder(s, 11, 'espresso', null).rememberedOrder).toBeUndefined();
    sim.closeShop(s); setOnMenu(s, 'latte', true);
    expect(rememberedOrder(s, 11, 'espresso', null).rememberedOrder).toBe('latte');
  });

  it('keeps custom recipe identity across rename/removal, without fabricating availability', () => {
    const { s, sim, c } = line(); sim.closeShop(s);
    const recipe = { beans: 1, milk: 1 }, id = makeSignatureId('coffee', recipe)!;
    trialSignature(s, 'coffee', recipe); saveSignature(s, id, '<b>Milk</b>'); setOnMenu(s, id, true); openShop(s);
    const next = new Sim(seeded(42));
    until(s, next, () => next.customers.some(g => g.phase === 'queue' && memoryGuest(g.appearanceId)));
    const guest = next.customers.find(g => g.phase === 'queue' && memoryGuest(g.appearanceId))!;
    Object.assign(guest, { appearanceId: 11, look: { ...c.look }, patience: 200 });
    expect(recommend(s, next, guest, id)).toBe('love'); until(s, next, () => guest.hasCup);
    next.closeShop(s); renameSignature(s, id, 'New name');
    expect(rememberedOrder(s, 11, 'espresso', null).order).toBe(id);
    deleteSignature(s, id);
    expect(rememberedOrder(s, 11, 'espresso', null).order).toBe('espresso');
    expect(deserialize(serialize(s), 0).guestMemories[11]).toMatchObject({ item: id, name: '<b>Milk</b>' });
  });
});

describe('safe recommendation choices and memory saves', () => {
  it('offers the first eligible two-drink recommendation at both 1× and 4×', () => {
    for (const speed of [1, 4]) {
      const s = cafe(), sim = new Sim(seeded(42)), director = new MomentDirector(seeded(1)); openShop(s);
      let first: string | undefined;
      for (let n = 0; n < 10000 && !first; n++) {
        sim.update(s, .05); director.update(s, sim, .05, .05 / speed);
        if (director.active) first = director.active.kind;
      }
      expect(first).toBe('recommend');
      expect(director.active!.options).toHaveLength(2);
      expect(director.active!.options).toContain(sim.customers.find(c => c.id === director.active!.customerId)!.order);
    }
  });

  it('honors current stock, trials, closing and dismissing without awarding a memory', () => {
    const { s, sim, c } = line();
    expect(recommendOptions(s, sim, c, seeded(1))).toEqual(['espresso', 'latte']);
    s.pantry.milk = 0; expect(recommendOptions(s, sim, c, seeded(1))).toEqual([]);
    expect(recommend(s, sim, c)).toBeNull(); expect(c.recommendation).toBeUndefined();
    s.pantry.milk = 100; c.trialSale = 'reserved';
    expect(recommend(s, sim, c)).toBeNull(); delete c.trialSale;
    s.phase = 'closing'; expect(recommend(s, sim, c)).toBeNull();
    expect(s.guestMemories).toEqual({});
  });

  it('rejects forged live recommendations and impossible memories; old saves start empty', () => {
    const { s, sim, c } = line(); recommend(s, sim, c);
    const snap = sim.snapshot(s); expect(validSnapshot(snap, s)).toBe(true);
    snap.customers.find(g => g.id === c.id)!.recommendation = 'americano'; expect(validSnapshot(snap, s)).toBe(false);
    const valid = { item: 'latte', source: 'recommend', learnedDay: 1, lastServedDay: 2, returns: 1 };
    expect(parseGuestMemories({ 11: valid }, 3)[11]).toEqual(valid);
    for (const change of [{ item: 'roll' }, { item: 'hotchoc' }, { learnedDay: 4 }, { lastServedDay: 0 }, { returns: -1 }, { source: 'sale' }])
      expect(parseGuestMemories({ 11: { ...valid, ...change } }, 3)).toEqual({});
    expect(parseGuestMemories({ 0: valid, 99999: valid }, 3)).toEqual({});
    const old = JSON.parse(serialize(s)); delete old.guestMemories; old.version = 21;
    expect(deserialize(JSON.stringify(old), 0).guestMemories).toEqual({});
  });
});
