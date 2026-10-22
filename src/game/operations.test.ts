import { describe, expect, it, vi } from 'vitest';
import { MENU, PRICE_MILESTONES, type ItemId } from './data';
import { openShop } from './day';
import { bakeForForecast, dayDemand, dayNeeds, itemPrice, milestoneMultiplier, restock, setBakePlan, suggestedBake } from './economy';
import { bakeryPlan, cookHome, kitchenLoad, kitchenObstacles, kitchenPath, nextBatch, stationSpot } from './kitchen';
import { areaBounds, doorwayY, FLOOR_Y } from './layout';
import { segmentCrossesObstacle, type FloorPoint } from './navigation';
import { OperationMonitor, operationStatus } from './operations';
import { SaveSession } from './save-session';
import { Sim, type Cook } from './sim';
import type { SimSnapshot } from './sim-snapshot';
import { createInitialState, deserialize, SAVE_KEY, serialize, type GameState } from './state';

function ready(ids: ItemId[] = ['espresso', 'roll']) {
  const s = createInitialState(0);
  s.onMenu = ids;
  for (const id of ids) s.items[id] = 1;
  s.kitchen = true;
  s.coins = 10000;
  for (const id of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) s.pantry[id] = 1000;
  bakeForForecast(s);
  return s;
}
function tick(s: GameState, sim: Sim, seconds: number) {
  for (let n = 0; n < Math.round(seconds / 0.05); n++) sim.update(s, 0.05);
}
function rng(seed = 12) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function storage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
}

/** Restore rebuilds cook routes from their current feet to the active station.
 * Canonicalize only those four derived fields; every other runtime field stays exact. */
function withCanonicalCookRoutes(snapshot: SimSnapshot): SimSnapshot {
  const expected = structuredClone(snapshot);
  expected.cooks = expected.cooks.map((cook, i) => {
    const destination = cook.batch ? stationSpot(cook.batch.steps[cook.batch.step]) : cookHome(i);
    const journey = kitchenPath(cook, destination);
    let previous: FloorPoint = cook;
    const route = journey.filter((point) => {
      const different = point.x !== previous.x || point.y !== previous.y;
      previous = point;
      return different;
    });
    const [first, ...via] = route;
    return { ...cook, tx: first?.x ?? cook.x, ty: first?.y ?? cook.y, via, journey };
  });
  return expected;
}

/** Check actual segments independently of the route builder, including clearance
 * around fixtures and the only legal crossing into the main café's staff lane. */
function expectClearCookRoute(cook: Cook, i: number): void {
  expect(cook.pathBlocked).toBe(false);
  const target = cook.batch ? stationSpot(cook.batch.steps[cook.batch.step]) : cookHome(i);
  const destination = { x: target.x, y: target.y };
  const bounds = areaBounds('kitchen');
  const laneY = doorwayY('kitchen', 'right');
  const obstacles = kitchenObstacles().map((r) => ({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }));
  const pointIsClear = (point: FloorPoint) => {
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    if (point.x >= -12 && point.x <= stationSpot('door').x && Math.abs(point.y - laneY) < 0.001) return;
    expect(point.x).toBeGreaterThanOrEqual(bounds.x + 5);
    expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.w - 5);
    expect(point.y).toBeGreaterThanOrEqual(bounds.y + FLOOR_Y);
    expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.h - 8);
  };
  for (const route of [[{ x: cook.tx, y: cook.ty }, ...cook.via], cook.journey ?? []]) {
    let at: FloorPoint = { x: cook.x, y: cook.y };
    pointIsClear(at);
    for (const next of route) {
      pointIsClear(next);
      for (const obstacle of obstacles) expect(segmentCrossesObstacle(at, next, obstacle)).toBe(false);
      if ((at.x < 0) !== (next.x < 0)) {
        expect(at.y).toBeCloseTo(laneY, 8);
        expect(next.y).toBeCloseTo(laneY, 8);
      }
      at = next;
    }
    expect({ x: at.x, y: at.y }).toEqual(destination);
  }
}

describe('production planning', () => {
  it('keeps bakery locked without a kitchen and plans a lead-time buffer with one', () => {
    const s = ready();
    s.kitchen = false;
    expect(suggestedBake(s, 'roll')).toBe(0);
    expect(dayDemand(s).has('roll')).toBe(false);
    s.kitchen = true;
    expect(suggestedBake(s, 'roll')).toBeLessThan(Math.ceil(dayDemand(s).get('roll')!));
    const single = suggestedBake(s, 'roll');
    s.items.bagel = s.items.donut = 1;
    s.onMenu = ['roll', 'bagel', 'donut'];
    expect(bakeryPlan(s).get('roll')!.lead).toBeGreaterThan(bakeryPlan(ready(['roll'])).get('roll')!.lead);
    expect(single).toBeGreaterThan(0);
  });
  it('does not double-buy shelf goods or batches already paid for', () => {
    const s = ready(['roll']);
    // A kitchen that keeps up bakes a small morning batch and refills during the day.
    s.upgrades.cook = 2;
    expect(kitchenLoad(s)).toBeLessThan(1);
    bakeForForecast(s);
    const need = dayNeeds(s).flour!;
    openShop(s);
    const left = s.shelf.roll!;
    expect(dayNeeds(s).flour).toBe(need - left);
    s.inProduction.roll = 5;
    expect(dayNeeds(s).flour).toBe(need - left - 5);
    const stock = { ...s.pantry };
    restock(s);
    expect(s.pantry).toEqual(stock);
  });
  it('never overwrites a manual plan when changing forecasts and ignores invalid amounts', () => {
    const s = ready();
    setBakePlan(s, 'roll', 7);
    s.upgrades.marketing = 10;
    suggestedBake(s, 'roll');
    expect(s.bakePlan.roll).toBe(7);
    setBakePlan(s, 'roll', NaN);
    expect(s.bakePlan.roll).toBe(7);
    openShop(s);
    setBakePlan(s, 'roll', 99);
    expect(s.bakePlan.roll).toBe(7);
  });
  it('responds earlier to higher demand, avoids duplicate batches and stops at closing', () => {
    const s = ready(['roll']);
    const low = bakeryPlan(s).get('roll')!.trigger;
    s.upgrades.marketing = 20;
    s.upgrades.barista = 3;
    const high = bakeryPlan(s).get('roll')!.trigger;
    expect(high).toBeGreaterThan(low);
    openShop(s);
    s.shelf.roll = high;
    expect(nextBatch(s, [])?.item).toBe('roll');
    expect(nextBatch(s, ['roll'])).toBeNull();
    s.phase = 'closing';
    expect(nextBatch(s, [])).toBeNull();
  });
});

describe('gentle closing and saved service', () => {
  it('stops arrivals, finishes accepted orders and batches, then settles only once', () => {
    const s = ready();
    const sim = new Sim(rng());
    openShop(s);
    tick(s, sim, 30);
    const accepted = sim.customers.filter((c) => !['queue', 'sitting', 'exiting'].includes(c.phase)).length;
    const served = s.served;
    const missed = s.today.missed;
    sim.beginClosing(s);
    expect(s.phase).toBe('closing');
    expect(sim.queue).toEqual([]);
    const lastId = sim.snapshot(s).nextId;
    for (let i = 0; i < 3000 && !sim.finishedService; i++) sim.update(s, 0.05);
    expect(sim.finishedService).toBe(true);
    expect(sim.snapshot(s).nextId).toBe(lastId);
    expect(s.served - served + s.today.missed - missed).toBe(accepted);
    expect(Object.values(s.inProduction).every((n) => n === 0)).toBe(true);
    const report = sim.closeShop(s)!;
    expect(report.duration).toBeGreaterThanOrEqual(30);
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost);
    expect(sim.closeShop(s)).toBeNull();
    expect(s.day).toBe(2);
  });
  it.each([12, 291])('refreshes mid-close with in-flight plates and batches without consuming ingredients twice (seed %i)', (seed) => {
    const random = vi.spyOn(Math, 'random').mockImplementation(rng(seed));
    try {
      const store = storage();
      const s = ready();
      s.upgrades.marketing = 4;
      store.setItem(SAVE_KEY, serialize(s));
      const first = new SaveSession(store, 0, () => {});
      openShop(first.state);
      // Stop at a genuine batch plus accepted-order state.
      let found = false;
      for (let n = 0; n < 6000; n++) {
        first.sim.update(first.state, 0.05);
        if (first.sim.cooks.some((c) => c.batch) && first.sim.customers.some((c) => c.phase === 'waiting')) { found = true; break; }
      }
      expect(found).toBe(true);
      first.sim.beginClosing(first.state);
      expect(first.save(first.state)).toBe('saved');
      const snapshot = first.sim.snapshot(first.state);
      const savedPantry = { ...first.state.pantry };
      const savedCost = first.state.today.ingredientCost;
      const inProduction = { ...first.state.inProduction };
      const expected = withCanonicalCookRoutes(snapshot);
      snapshot.cooks.forEach(expectClearCookRoute);
      if (seed === 291) {
        // Preserve the failing doorway case: x >= 0 replans directly to pickup,
        // omitting the old route's still-unreached x=12 doorway waypoint.
        const cook = snapshot.cooks[0];
        expect(cook.x).toBeGreaterThanOrEqual(0);
        expect(cook.x).toBeLessThan(12);
        expect(cook.y).toBe(doorwayY('kitchen', 'right'));
        expect(cook.tx).toBe(12);
        expect(cook.journey).toEqual([{ x: 12, y: cook.y }, { x: stationSpot('door').x, y: cook.y }]);
        expect(expected.cooks[0].tx).toBe(stationSpot('door').x);
      }
      first.close();
      // An accepted customer still walking to the counter has not paid ingredients yet.
      // Compare with uninterrupted service, rather than assuming all costs were consumed.
      for (let n = 0; n < 4000 && !first.sim.finishedService; n++) first.sim.update(first.state, 0.05);
      expect(first.sim.finishedService).toBe(true);
      const pantry = { ...first.state.pantry };
      const cost = first.state.today.ingredientCost;
      const second = new SaveSession(store, 0, () => {});
      expect(second.state.phase).toBe('closing');
      expect(second.state.pantry).toEqual(savedPantry);
      expect(second.state.today.ingredientCost).toBe(savedCost);
      expect(second.state.inProduction).toEqual(inProduction);
      const restored = second.sim.snapshot(second.state);
      expect(restored).toEqual(expected);
      restored.cooks.forEach(expectClearCookRoute);
      for (let n = 0; n < 4000 && !second.sim.finishedService; n++) second.sim.update(second.state, 0.05);
      expect(second.sim.finishedService).toBe(true);
      expect(second.state.pantry).toEqual(pantry);
      expect(second.state.today.ingredientCost).toBe(cost);
      second.sim.closeShop(second.state);
      expect(second.save(second.state)).toBe('saved');
      const third = new SaveSession(store, 0, () => {});
      expect(third.state.phase).toBe('prep');
      expect(third.state.day).toBe(2);
      expect(third.sim.customers).toEqual([]);
    } finally {
      random.mockRestore();
    }
  });
  it('restores shared tray/pass references and keeps service moving', () => {
    const s = ready(); openShop(s);
    s.upgrades.marketing = 10; s.upgrades.barista = 3;
    const sim = new Sim(rng(98));
    for (let i = 0; i < 10000 && !sim.servers.some((s) => s.phase === 'toPass'); i++) sim.update(s, 0.05);
    expect(sim.servers.some((s) => s.phase === 'toPass')).toBe(true);
    const next = new Sim(rng());
    expect(next.restore(JSON.parse(JSON.stringify(sim.snapshot(s))), s)).toBe(true);
    const server = next.servers.find((s) => s.phase === 'toPass')!;
    expect(next.pass).toContain(server.plates[0]);
    const served = s.served;
    tick(s, next, 40);
    expect(s.served).toBeGreaterThan(served);
  });
  it('rejects corrupt runtime atomically and retains old economic progress', () => {
    const s = ready(); openShop(s); const sim = new Sim(rng()); tick(s, sim, 15);
    const snapshot = sim.snapshot(s);
    snapshot.customers[0].order = 'invalid' as ItemId;
    const next = new Sim();
    expect(next.restore(snapshot, s)).toBe(false);
    expect(next.customers).toEqual([]);
    const old = deserialize(JSON.stringify({ ...s, version: 7 }), 10);
    expect(old.coins).toBe(s.coins); expect(old.items).toEqual(s.items); expect(old.pantry).toEqual(s.pantry);
  });
  it('instant settlement clears production and cannot pay the same order later', () => {
    const s = ready(); openShop(s); const sim = new Sim(rng()); tick(s, sim, 25);
    sim.beginClosing(s);
    sim.closeShop(s);
    const coins = s.coins;
    tick(s, sim, 60);
    expect(s.coins).toBe(coins);
    expect(s.inProduction).toEqual({});
  });
});

describe('truthful feedback and smoother progression', () => {
  it('has no successful boost without an active production job', () => {
    const sim = new Sim(); expect(sim.boost()).toBe(false);
    const s = ready(); openShop(s); tick(s, sim, 1);
    expect(sim.boost()).toBe(false);
  });
  it('caps help at once per game second and preserves the cap across refresh', () => {
    const s = ready(['latte']); openShop(s); const sim = new Sim(rng());
    while (!sim.isBrewing(0)) sim.update(s, 0.05);
    expect(sim.boost()).toBe(true);
    const remaining = sim.baristas[0].remaining;
    for (let i = 0; i < 20; i++) expect(sim.boost()).toBe(false);
    expect(sim.baristas[0].remaining).toBe(remaining);
    const next = new Sim();
    expect(next.restore(sim.snapshot(s), s)).toBe(true);
    expect(next.boost()).toBe(false);
    tick(s, next, 1);
    expect(next.boost()).toBe(true);
  });
  it('prioritizes missing ingredients and separates a full pass from brewing', () => {
    const s = ready(['espresso']); openShop(s); const sim = new Sim(); tick(s, sim, 1);
    s.pantry.beans = 0;
    expect(operationStatus(s, sim)).toMatchObject({ kind: 'ingredients', ingredients: ['beans'] });
    s.pantry.beans = 30;
    sim.baristas[0].customerId = 12; sim.baristas[0].total = 3; sim.baristas[0].remaining = 0;
    expect(operationStatus(s, sim).kind).toBe('delivery');
    const monitor = new OperationMonitor();
    expect(monitor.update(s, sim).kind).toBe('steady');
    s.dayTime += 3;
    expect(monitor.update(s, sim).kind).toBe('delivery');
  });
  it('never reduces an existing price and softens every milestone jump', () => {
    for (const def of MENU) for (let level = 1; level <= 350; level++) {
      expect(itemPrice(def, level)).toBeGreaterThanOrEqual(def.basePrice * level * milestoneMultiplier(level));
      expect(itemPrice(def, level + 1)).toBeGreaterThan(itemPrice(def, level));
    }
    for (const level of PRICE_MILESTONES) expect(itemPrice(MENU[0], level) / itemPrice(MENU[0], level - 1)).toBeLessThan(1.4);
  });
  it('counts missing add-ons separately and loss totals reconcile', () => {
    const s = ready(); s.pantry.flour = s.pantry.butter = 0; s.bakePlan.roll = 0; openShop(s);
    const sim = new Sim(rng()); tick(s, sim, 180);
    expect(s.today.extraLost).toBeGreaterThan(0);
    expect(s.today.served).toBeGreaterThan(0);
    expect(s.today.missed).toBe(s.today.soldOut + s.today.queueLost + s.today.tableLost);
    expect(s.today.shortages.roll).toBe(s.today.soldOut + s.today.extraLost);
  });
});
