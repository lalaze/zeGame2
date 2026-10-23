import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { finishDay, openShop, type DayReport } from './day';
import { baseArrivalRate, dayNeeds, menuItems, offerTrialSale, promoteTrialSale, restock, salePrice, setOnMenu, servingCost } from './economy';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { SaveSession } from './save-session';
import { canTrialDrink, selectTrialSale, trialSaleItem, TRIAL_SALE_LIMIT } from './trial-sales';
import { chooseMinaWish } from './regular-wishes';
import { recordRegularGuestArrival, recordRegularGuestService } from './regular-guests';
import { deleteSignature, makeSignatureId, renameSignature, replaceSignature, saveSignature, setSignatureOnMenu, trialSignature } from './signature-drinks';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
function cafe() {
  const s = createInitialState(123); s.day = 3;
  s.items.americano = 1; s.items.latte = 1;
  s.coins = 10000; s.pantry.beans = 10000; s.pantry.milk = 10000;
  return s;
}
function until(s: GameState, sim: Sim, done: () => boolean) {
  for (let i = 0; i < 10000 && !done(); i++) sim.update(s, .05);
  expect(done()).toBe(true);
}
function finish(s: GameState, sim: Sim): DayReport {
  until(s, sim, () => s.phase === 'closing' && sim.finishedService);
  return sim.closeShop(s)!;
}

describe('one drink outside the regular menu', () => {
  it('requires ownership and closed preparation, without changing regular demand or buying stock', () => {
    const s = cafe(), before = structuredClone(s), arrivals = baseArrivalRate(s);
    expect(selectTrialSale(s, 'espresso')).toBe(false);
    expect(selectTrialSale(s, 'coldbrew')).toBe(false);
    expect(selectTrialSale(s, 'roll')).toBe(false);
    s.items.affogato = 1;
    expect(canTrialDrink(s, 'affogato')).toBe(false);
    s.items.affogato = 0;
    expect(selectTrialSale(s, 'latte')).toBe(true);
    expect(menuItems(s).map(item => item.id)).toEqual(['espresso']);
    expect(baseArrivalRate(s)).toBe(arrivals);
    expect({ ...s, trialSales: before.trialSales }).toEqual(before);
    openShop(s);
    expect(selectTrialSale(s, 'americano')).toBe(false);
    expect(s.trialSales.active).toMatchObject({ prepared: 0, reserved: 0, served: 0, item: 'latte' });
    const active = structuredClone(s.trialSales.active); openShop(s);
    expect(s.trialSales.active).toEqual(active);
  });

  it('adds exactly the remaining trial ingredients to the ordinary stock quote', () => {
    const s = cafe(); s.pantry.beans = s.pantry.milk = 0;
    const ordinary = dayNeeds(s);
    selectTrialSale(s, 'latte');
    expect(dayNeeds(s).beans).toBe(ordinary.beans! + 5);
    expect(dayNeeds(s).milk).toBe(5);
    const cash = s.coins; expect(restock(s)).toBe(true);
    expect(s.pantry.milk).toBe(5); expect(s.coins).toBeLessThan(cash);
    const sim = new Sim(seeded(42)); openShop(s);
    until(s, sim, () => s.trialSales.active!.prepared > 0);
    const withoutTrial = structuredClone(s); withoutTrial.trialSales.active = null;
    expect(dayNeeds(s).milk! - (dayNeeds(withoutTrial).milk ?? 0)).toBe(5 - s.trialSales.active!.prepared);
  });

  it('swaps only a drink slot and leaves other regulars and food-only orders alone', () => {
    const s = cafe(); selectTrialSale(s, 'latte'); openShop(s);
    expect(offerTrialSale(s, 'roll', null)).toEqual({ order: 'roll', extra: null });
    expect(offerTrialSale(s, 'espresso', null, 'theo')).toEqual({ order: 'espresso', extra: null });
    offerTrialSale(s, 'espresso', null); offerTrialSale(s, 'espresso', null);
    expect(offerTrialSale(s, 'roll', 'espresso')).toEqual({ order: 'roll', extra: 'latte', trialSale: 'reserved' });
    expect(s.trialSales.active!.reserved).toBe(1);
  });

  it('clears a plan when the drink joins the regular menu, and supports saved custom recipes', () => {
    const s = cafe(); selectTrialSale(s, 'latte'); setOnMenu(s, 'latte', true);
    expect(s.trialSales.selected).toBeNull(); setOnMenu(s, 'latte', false);
    expect(trialSaleItem(s)).toBeNull();
    const recipe = { beans: 1, milk: 1 }, id = makeSignatureId('coffee', recipe)!;
    trialSignature(s, 'coffee', recipe); saveSignature(s, id, '<b>New cup</b>');
    expect(selectTrialSale(s, id)).toBe(true);
    renameSignature(s, id, 'Renamed cup'); expect(trialSaleItem(s)).toBe(id);
    const replacement = { beans: 2, milk: 1 }, next = makeSignatureId('coffee', replacement)!;
    trialSignature(s, 'coffee', replacement);
    expect(replaceSignature(s, id, next, 'Two beans')).toBe(true);
    expect(s.trialSales.selected).toBeNull();
    selectTrialSale(s, next); setSignatureOnMenu(s, next, true);
    expect(s.trialSales.selected).toBeNull();
    setSignatureOnMenu(s, next, false); selectTrialSale(s, next); deleteSignature(s, next);
    expect(s.trialSales.selected).toBeNull();
  });
});

describe('real limited production, practice and feedback', () => {
  it('attributes only the trial cup’s payment when it replaces the drink in a bakery pairing', () => {
    const s = cafe(); s.kitchen = true; s.items.roll = 1; s.onMenu = ['espresso', 'roll'];
    s.pantry.flour = s.pantry.butter = 1000; s.bakePlan.roll = 100;
    s.upgrades.barista = 1; s.upgrades.server = 1; s.upgrades.marketing = 2;
    selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(83));
    let expected = 0, wholeBills = 0, sawExtra = false;
    for (let i = 0; i < 10000 && (s.phase === 'open' || !sim.finishedService); i++) {
      const pending = new Map(sim.customers.filter(c => c.trialSale === 'prepared').map(c => {
        sawExtra ||= c.extra === 'latte';
        return [c.id, salePrice(s, 'latte', c.vip, c.dineIn, c.extra ? [c.order, c.extra] : [c.order]) * (1 + (c.momentTip ?? 0))];
      }));
      for (const event of sim.update(s, .05)) if (event.type === 'sale' && event.customerId !== undefined && pending.has(event.customerId)) {
        expected += pending.get(event.customerId)!; wholeBills += event.amount;
      }
    }
    expect(sawExtra).toBe(true);
    const report = sim.closeShop(s)!.trialSale!;
    expect(report.revenue).toBeCloseTo(expected);
    expect(wholeBills).toBeGreaterThan(report.revenue);
    expect(report.ingredientCost).toBe(report.prepared * servingCost('latte'));
  });

  it.each([42, 79, 830])('makes at most five cups under pressure and reconciles the ledger (seed %s)', seed => {
    const s = cafe(); s.upgrades.marketing = 5; s.upgrades.barista = 2; s.upgrades.server = 2;
    s.taste.served.latte = 28;
    selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(seed));
    for (let i = 0; i < 10000 && (s.phase === 'open' || !sim.finishedService); i++) {
      sim.update(s, .05);
      const run = s.trialSales.active!;
      expect(run.prepared + run.reserved).toBeLessThanOrEqual(TRIAL_SALE_LIMIT);
      expect(run.reserved).toBe(sim.customers.filter(c => c.trialSale === 'reserved').length);
    }
    expect(sim.finishedService).toBe(true); expect(s.phase).toBe('closing');
    const report = sim.closeShop(s)!, trial = report.trialSale!;
    expect(trial.prepared).toBe(5); expect(trial.served).toBe(5);
    expect(trial.served).toBe(report.sales.latte);
    expect(s.taste.served.latte).toBe(28 + trial.served);
    expect(trial.qualityBefore).toBe(4); expect(trial.qualityAfter).toBe(4.5);
    expect(trial.ingredientCost).toBe(servingCost('latte') * trial.prepared);
    expect(s.pantry.milk).toBe(10000 - trial.prepared);
    expect(Object.values(trial.feedback).reduce((sum, n) => sum + n, 0)).toBe(trial.served);
    expect(trial.revenue).toBeGreaterThan(0); expect(trial.revenue).toBeLessThan(report.revenue);
    expect(report.ingredientCost).toBe((report.sales.espresso ?? 0) * servingCost('espresso') + trial.ingredientCost);
    expect(s.trialSales.active).toBeNull(); expect(s.trialSales.selected).toBeNull();
    expect(s.trialSales.last).toEqual(trial);
    expect(deserialize(serialize(s), 0).trialSales).toEqual(s.trialSales);
    expect(selectTrialSale(s, trial.item)).toBe(true);
    expect(promoteTrialSale(s)).toBe(true); expect(promoteTrialSale(s)).toBe(false);
    expect(s.onMenu).toContain('latte'); expect(s.trialSales.selected).toBeNull();
  });

  it('releases unprepared reservations at closing without consuming ingredients or granting practice', () => {
    const s = cafe(); s.upgrades.marketing = 5; selectTrialSale(s, 'latte'); openShop(s);
    const sim = new Sim(seeded(42));
    until(s, sim, () => sim.customers.some(c => c.trialSale === 'reserved' && c.phase === 'queue'));
    sim.beginClosing(s);
    expect(sim.customers.some(c => c.phase === 'queue' && c.trialSale)).toBe(false);
    expect(s.trialSales.active!.reserved).toBe(sim.customers.filter(c => c.trialSale === 'reserved').length);
    const report = finish(s, sim);
    expect(report.trialSale!.ingredientCost).toBe(report.trialSale!.prepared * servingCost('latte'));
    expect(s.taste.served.latte ?? 0).toBe(report.trialSale!.served);
  });

  it('keeps the cost and quota of a prepared cup cancelled before delivery', () => {
    const s = cafe(); selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(42));
    until(s, sim, () => sim.customers.some(c => c.trialSale === 'prepared'));
    const report = sim.closeShop(s)!, trial = report.trialSale!;
    expect(trial.prepared).toBeGreaterThan(trial.served);
    expect(trial.ingredientCost).toBe(trial.prepared * servingCost('latte'));
    expect(s.taste.served.latte ?? 0).toBe(trial.served);
  });

  it('handles stock disappearing after a reservation without counting an undelivered cup', () => {
    const s = cafe(); selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(42));
    until(s, sim, () => s.trialSales.active!.reserved > 0);
    s.pantry.milk = 0;
    const report = finish(s, sim), trial = report.trialSale!;
    expect(trial.prepared).toBe(0); expect(trial.served).toBe(0);
    expect(trial.ingredientCost).toBe(0); expect(trial.revenue).toBe(0);
    expect(report.shortages.latte).toBeGreaterThan(0);
    expect(s.taste.served.latte ?? 0).toBe(0);
  });

  it('keeps one place for Mina and advances her milk wish on actual trial delivery', () => {
    const s = cafe(); s.day = 1; openShop(s);
    recordRegularGuestService(s, 'mina', recordRegularGuestArrival(s, 'mina')!); finishDay(s);
    chooseMinaWish(s, 'milky'); selectTrialSale(s, 'latte');
    s.upgrades.marketing = 2; s.upgrades.barista = 1;
    openShop(s); const sim = new Sim(seeded(42)); const report = finish(s, sim);
    expect(s.regularWishes.mina!.rehearsedDay).toBe(report.day);
    expect(report.trialSale!.served).toBe(5);
    expect(s.onMenu).toEqual(['espresso']);
    expect(s.regularGuests.guests.mina!.served).toBeGreaterThan(1);
  });
});

describe('save recovery and bounded live quotas', () => {
  it('resumes a prepared trial without recreating its quota, and validates live reservations', () => {
    let s = cafe(); selectTrialSale(s, 'latte'); openShop(s); let sim = new Sim(seeded(42));
    until(s, sim, () => s.trialSales.active!.prepared > 0);
    const snapshot = sim.snapshot(s); expect(validSnapshot(snapshot, s)).toBe(true);
    s = deserialize(serialize(s), 0); sim = new Sim(seeded(43));
    expect(sim.restore(snapshot, s)).toBe(true);
    const report = finish(s, sim);
    expect(report.trialSale!.prepared).toBeLessThanOrEqual(5);
    expect(report.trialSale!.served).toBe(s.taste.served.latte);
    expect(report.trialSale!.ingredientCost).toBe(report.trialSale!.prepared * servingCost('latte'));
  });

  it('missing runtime releases only unprepared places, retaining consumed cost and cup count', () => {
    const s = cafe(); selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(42));
    until(s, sim, () => s.trialSales.active!.prepared > 0);
    const before = structuredClone(s.trialSales.active!);
    let raw = JSON.stringify({ ...s, runtime: {} });
    const session = new SaveSession({ getItem: () => raw, setItem: (_key, value) => { raw = value; } }, 0, () => {});
    expect(session.state.trialSales.active).toMatchObject({ prepared: before.prepared, ingredientCost: before.ingredientCost, reserved: 0 });
    expect(finish(session.state, session.sim).trialSale!.prepared).toBeLessThanOrEqual(5);
    session.close();
  });

  it('does not invent old trials, and rejects oversized or mismatched saved quotas', () => {
    const s = cafe(); const legacy = JSON.parse(serialize(s)); delete legacy.trialSales; legacy.version = 20;
    expect(deserialize(JSON.stringify(legacy), 0).trialSales).toEqual({ selected: null, active: null, last: null });
    selectTrialSale(s, 'latte'); openShop(s); const sim = new Sim(seeded(42));
    until(s, sim, () => s.trialSales.active!.reserved > 0);
    const snapshot = sim.snapshot(s), wrong = structuredClone(s);
    wrong.trialSales.active!.reserved = 0;
    expect(validSnapshot(snapshot, wrong)).toBe(false);
    const corrupted = JSON.parse(serialize(s)); corrupted.trialSales.active.prepared = 6;
    expect(deserialize(JSON.stringify(corrupted), 0).trialSales.active).toBeNull();
  });

  it('ordinary operation stays identical when no trial is selected', () => {
    const a = cafe(), b = structuredClone(a); selectTrialSale(b, 'latte'); selectTrialSale(b, null);
    openShop(a); openShop(b); const sa = new Sim(seeded(77)), sb = new Sim(seeded(77));
    for (let i = 0; i < 1000; i++) { sa.update(a, .05); sb.update(b, .05); }
    expect(b).toEqual(a); expect(sb.snapshot(b)).toEqual(sa.snapshot(a));
  });
});
