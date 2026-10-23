import { describe, expect, it } from 'vitest';
import { demandPlan, emptyGuestStats, GUEST_KINDS, parseGuestStats } from './customer-demand';
import { conditionOn, type ConditionId } from './conditions';
import { INGREDIENTS, MENU, type ItemId } from './data';
import { arrivalRate, menuItems, orderChoices, orderSeatChance, orderShares, salePrice } from './economy';
import { openShop } from './day';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { makeSignatureId, trialSignature, saveSignature } from './signature-drinks';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
function cafe(condition: ConditionId = 'fair', menu: ItemId[] = ['espresso', 'latte', 'blacktea', 'roll', 'donut']): GameState {
  const state = createInitialState(0);
  state.day = 3;
  while (conditionOn(state, state.day) !== condition) state.day++;
  state.kitchen = true;
  state.coins = 10000;
  state.upgrades.barista = 2;
  state.upgrades.server = 2;
  state.upgrades.machine = 3;
  state.onMenu = menu;
  for (const id of menu) state.items[id] = 1;
  state.bakePlan = { roll: 80, donut: 80 };
  for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = 10000;
  return state;
}
function settle(state: GameState, sim: Sim) {
  for (let step = 0; step < 10000 && (state.phase === 'open' || !sim.finishedService); step++) sim.update(state, .05);
  expect(state.phase).toBe('closing');
  expect(sim.finishedService).toBe(true);
  return sim.closeShop(state)!;
}

describe('customer demand and daily choices', () => {
  it('preserves the two introductory days and fair-day espresso traffic', () => {
    const state = cafe('fair', ['espresso']);
    const rate = arrivalRate(state);
    const price = salePrice(state, 'espresso');
    const plan = demandPlan(state, menuItems(state));
    expect(plan.traffic).toBe(1);
    for (const day of [1, 2]) {
      state.day = day;
      expect(arrivalRate(state)).toBe(rate);
      expect(demandPlan(state, menuItems(state)).guests).toEqual([]);
    }
    expect(salePrice(state, 'espresso')).toBe(price);
  });

  it('new tastes add demand, similar drinks share it, and catalog size has a ceiling', () => {
    const state = cafe('fair', ['espresso']);
    const original = demandPlan(state, menuItems(state));
    const americano = MENU.find(item => item.id === 'americano')!;
    expect(demandPlan(state, [...menuItems(state), americano]).traffic).toBe(original.traffic);
    state.items.latte = 1; state.onMenu.push('latte');
    const mixed = demandPlan(state, menuItems(state));
    expect(mixed.traffic).toBeGreaterThan(original.traffic * 1.3);
    const mainShare = mixed.mains.filter(choice => choice.main.id === 'espresso').reduce((sum, choice) => sum + choice.probability, 0);
    expect(mainShare * mixed.traffic).toBeGreaterThan(.75);
    expect(demandPlan(state, MENU).traffic).toBeLessThanOrEqual(1.6);
    expect(demandPlan(state, []).mains).toEqual([]);
    expect(demandPlan(state, []).traffic).toBe(0);
  });

  it('weather changes who a menu can attract, without any price or tip multiplier', () => {
    const quiet = cafe('quiet'), market = cafe('market');
    const quietPlan = demandPlan(quiet, menuItems(quiet));
    const marketPlan = demandPlan(market, menuItems(market));
    expect(quietPlan.guests.find(guest => guest.kind === 'teaTime')!.share).toBeGreaterThan(marketPlan.guests.find(guest => guest.kind === 'teaTime')!.share);
    expect(marketPlan.guests.find(guest => guest.kind === 'commuter')!.share).toBeGreaterThan(quietPlan.guests.find(guest => guest.kind === 'commuter')!.share);
    expect(salePrice(quiet, 'latte')).toBe(salePrice(market, 'latte'));
    expect(orderSeatChance(market, ['espresso'], 'commuter')).toBeLessThan(orderSeatChance(market, ['espresso'], 'teaTime'));
    const pairs = orderChoices(menuItems(quiet), quiet);
    expect(pairs.find(choice => choice.kind === 'teaTime')!.comboChance).toBeGreaterThan(pairs.find(choice => choice.kind === 'commuter')!.comboChance);
  });

  it('custom recipes use their real flavours, not a special demand bonus', () => {
    const state = cafe('rain', ['espresso']);
    const recipe = { beans: 1, milk: 1 };
    const id = makeSignatureId('coffee', recipe)!;
    expect(trialSignature(state, 'coffee', recipe).ok).toBe(true);
    expect(saveSignature(state, id, 'Milk cloud')).toBe(true);
    const saved = state.signatureDrinks.recipes.find(recipe => recipe.id === id)!;
    saved.onMenu = true;
    expect(demandPlan(state, menuItems(state)).guests.find(guest => guest.kind === 'leisure')!.coverage).toBe(1);
  });

  it('keeps route promises: takeaway stays takeaway and bakery improves each group’s pairings', () => {
    const state = cafe();
    state.cafeStyle.focus = 'takeaway';
    for (const kind of GUEST_KINDS) expect(orderSeatChance(state, ['espresso'], kind)).toBe(0);
    state.cafeStyle.focus = null;
    const normal = orderChoices(menuItems(state), state);
    state.cafeStyle.focus = 'bakery';
    const bakery = orderChoices(menuItems(state), state);
    bakery.forEach((choice, index) => expect(choice.comboChance - normal[index].comboChance).toBeCloseTo(.15));
  });

  it('real arrivals follow forecast portions and audience shares, with regular preferences kept separate', () => {
    const state = cafe('rain');
    openShop(state);
    const sim = new Sim(seeded(41));
    const forecast = orderShares(menuItems(state), state);
    const expectedKinds = demandPlan(state, menuItems(state)).guests;
    const seen = new Set<number>(), portions = new Map<ItemId, number>();
    const kinds = emptyGuestStats();
    let n = 0;
    for (let step = 0; step < 100000; step++) {
      sim.update(state, .05);
      for (const guest of sim.customers) if (!seen.has(guest.id)) {
        seen.add(guest.id);
        if (guest.regularGuestId) continue;
        n++;
        kinds[guest.guestKind!].arrived++;
        for (const id of guest.extra ? [guest.order, guest.extra] : [guest.order]) portions.set(id, (portions.get(id) ?? 0) + 1);
      }
      if (state.phase !== 'open') { state.phase = 'open'; state.dayTime = 0; }
      if (state.shelf.roll! < 20) state.shelf.roll = 100;
      if (state.shelf.donut! < 20) state.shelf.donut = 100;
    }
    expect(n).toBeGreaterThan(500);
    for (const [id, share] of forecast) expect(Math.abs((portions.get(id) ?? 0) / n - share)).toBeLessThan(.065);
    for (const guest of expectedKinds) expect(Math.abs(kinds[guest.kind].arrived / n - guest.share)).toBeLessThan(.065);
  }, 30000);
});

describe('observed visits and save boundaries', () => {
  it('starts serving after an empty preparation menu, with a finite resumable clock', () => {
    const state = cafe('fair', []);
    const sim = new Sim(seeded(21));
    for (let i = 0; i < 100; i++) sim.update(state, .05);
    expect(Number.isFinite(sim.snapshot(state).spawnTimer)).toBe(true);
    state.onMenu = ['espresso'];
    openShop(state);
    for (let i = 0; i < 1000; i++) sim.update(state, .05);
    expect(state.today.served).toBeGreaterThan(0);
  });
  it('counts completed visits and pairs once, survives a live save, and resets only next day', () => {
    let state = cafe();
    openShop(state);
    let sim = new Sim(seeded(8));
    for (let step = 0; step < 1300; step++) sim.update(state, .05);
    const snapshot = sim.snapshot(state);
    const before = structuredClone(state.today.guests);
    expect(validSnapshot(snapshot, state)).toBe(true);
    state = deserialize(serialize(state), 0);
    sim = new Sim(seeded(18));
    expect(sim.restore(snapshot, state)).toBe(true);
    sim.update(state, 0);
    expect(state.today.guests).toEqual(before);
    const report = settle(state, sim);
    const totals = GUEST_KINDS.reduce((sum, kind) => {
      const stats = report.guests[kind];
      expect(stats.arrived).toBe(stats.served + stats.stockLost + stats.waitLost + stats.cancelled + stats.dismissed);
      sum.served += stats.served; sum.revenue += stats.revenue; sum.paired += stats.paired;
      return sum;
    }, { served: 0, revenue: 0, paired: 0 });
    expect(totals.served).toBe(report.served);
    expect(totals.revenue).toBeCloseTo(report.revenue, 8);
    expect(totals.paired).toBe(Object.values(report.sales).reduce<number>((a, b) => a + (b ?? 0), 0) - report.served);
    expect(state.today.guests).toEqual(emptyGuestStats());
    expect(sim.closeShop(state)).toBeNull();
    expect(report.guests).not.toEqual(emptyGuestStats());
  });

  it('distinguishes stock failures, cancelled accepted orders and harmless queued dismissals', () => {
    const state = cafe('rain', ['espresso', 'latte']);
    state.pantry.milk = 0;
    openShop(state);
    const sim = new Sim(seeded(4));
    for (let i = 0; i < 1600; i++) sim.update(state, .05);
    const report = sim.closeShop(state)!;
    const stats = Object.values(report.guests);
    expect(stats.reduce((sum, row) => sum + row.stockLost, 0)).toBe(report.soldOut);
    expect(report.soldOut).toBeGreaterThan(0);
    expect(stats.reduce((sum, row) => sum + row.cancelled, 0)).toBe(report.reviews.reasons.cancelled ?? 0);
    for (const row of stats) expect(row.arrived).toBe(row.served + row.stockLost + row.waitLost + row.cancelled + row.dismissed);
  });

  it('does not infer old audience history and rejects invalid live visit categories', () => {
    const state = cafe(); openShop(state);
    const sim = new Sim(seeded(3));
    for (let i = 0; i < 100; i++) sim.update(state, .05);
    const old = JSON.parse(serialize(state));
    delete old.today.guests; old.version = 18;
    const restored = deserialize(JSON.stringify(old), 0);
    expect(restored.today.guests).toEqual(emptyGuestStats());
    const snapshot = sim.snapshot(state);
    const legacy = JSON.parse(JSON.stringify(snapshot));
    legacy.customers.forEach((guest: Record<string, unknown>) => { delete guest.guestKind; });
    expect(validSnapshot(legacy, restored)).toBe(true);
    legacy.customers[0].guestKind = 'unknown';
    expect(validSnapshot(legacy, restored)).toBe(false);
    const parsed = parseGuestStats({ commuter: { arrived: 3, served: 2, paired: 999, waitLost: 99, revenue: Infinity }, unknown: { arrived: 100 } });
    expect(parsed.commuter.paired).toBe(2);
    expect(parsed.commuter.waitLost).toBe(1);
    expect(parsed.commuter.revenue).toBe(0);
    expect(Object.keys(parsed)).toEqual([...GUEST_KINDS]);
  });
});
