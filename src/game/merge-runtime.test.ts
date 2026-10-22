import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from './day';
import { bakeForForecast, canPrepareItem, menuItems } from './economy';
import { kitchenObstacles, stationSpot } from './kitchen';
import { COUNTER, MIN_SCENE_H, MAX_SCENE_H, setKitchenLevel, setSceneHeight } from './layout';
import { segmentCrossesObstacle } from './navigation';
import { Sim, type Walker } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';

const rng = (initial = 77) => { let seed = initial; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
function shop(cook = 0): GameState {
  const s = createInitialState(0);
  s.kitchen = true;
  s.upgrades.cook = cook;
  s.upgrades.barista = 3;
  s.upgrades.server = 2;
  s.upgrades.marketing = 4;
  s.items.roll = 1;
  s.onMenu = ['espresso', 'roll'];
  for (const id of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) s.pantry[id] = 1000;
  bakeForForecast(s);
  s.bakePlan.roll = 0;
  openShop(s);
  return s;
}
function tick(s: GameState, sim: Sim, seconds: number) {
  for (let i = 0; i < seconds / 0.05; i++) sim.update(s, 0.05);
}
function reachLiveOrders(s: GameState, sim: Sim): void {
  for (let i = 0; i < 6000 && !(sim.cooks.some((c) => c.batch) && sim.customers.some((c) => c.phase === 'waiting')); i++) sim.update(s, 0.05);
  expect(sim.cooks.some((c) => c.batch)).toBe(true);
  expect(sim.customers.some((c) => c.phase === 'waiting')).toBe(true);
}
afterEach(() => { setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });

describe('merged service persistence and kitchen rules', () => {
  it('keeps both ice-cream desserts and all bakery dishes behind the kitchen gate', () => {
    const s = createInitialState(0);
    s.items.roll = s.items.affogato = s.items.matchafloat = 1;
    s.onMenu = ['espresso', 'roll', 'affogato', 'matchafloat'];
    expect(menuItems(s).map((m) => m.id)).toEqual(['espresso']);
    expect(canPrepareItem(s, 'matchafloat')).toBe(false);
    s.kitchen = true;
    expect(menuItems(s).map((m) => m.id)).toHaveLength(4);
  });

  it.each([0, 1, 2])('restores live routes, appearances and paid batches at kitchen stage %i across viewport sizes', (stage) => {
    const s = shop(stage);
    const sim = new Sim(rng());
    reachLiveOrders(s, sim);
    const raw = JSON.parse(JSON.stringify(sim.snapshot(s)));
    const pantry = { ...s.pantry };
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      const loaded = deserialize(serialize(s), 0);
      const resumed = new Sim(rng(12));
      expect(resumed.restore(raw, loaded)).toBe(true);
      expect(resumed.customers.map((c) => c.appearanceId)).toEqual(sim.customers.map((c) => c.appearanceId));
      expect(loaded.pantry).toEqual(pantry);
      expect(loaded.inProduction).toEqual(s.inProduction);
      resumed.beginClosing(loaded);
      for (let i = 0; i < 5000 && !resumed.finishedService; i++) {
        const before = new Map<Walker, { x: number; y: number }>(resumed.cooks.map((c) => [c, { x: c.x, y: c.y }]));
        resumed.update(loaded, 0.05);
        for (const cook of resumed.cooks) for (const box of kitchenObstacles()) {
          expect(segmentCrossesObstacle(before.get(cook)!, cook, box)).toBe(false);
        }
      }
      expect(resumed.finishedService).toBe(true);
      expect(Object.values(loaded.inProduction).every((n) => n === 0)).toBe(true);
      expect(loaded.today.baked.roll).toBeGreaterThan(0);
    }
  });

  it('migrates v1 service at safe anchors without losing paid work or duplicating reviews', () => {
    const s = shop();
    const sim = new Sim(rng());
    reachLiveOrders(s, sim);
    sim.beginClosing(s);
    const raw = JSON.parse(JSON.stringify(sim.snapshot(s)));
    raw.version = 1;
    raw.height = 192; // Original remote compact viewport, before the redesigned floor plan.
    delete raw.kitchenLevel;
    for (const c of [...raw.customers, ...raw.servers, ...raw.cooks]) {
      c.x = 100; c.y = 100; c.tx = 200; c.ty = 150;
      c.via = [{ x: 200, y: 150 }];
      delete c.journey; delete c.pathBlocked; delete c.appearanceId;
      // A real v1 save also predates regular identities; do not retain a modern
      // identity whose required appearance was just removed from this fixture.
      delete c.regularGuestId; delete c.regularGuestVisitId;
    }
    const loaded = deserialize(serialize(s), 0);
    const resumed = new Sim(rng(1));
    const pantry = { ...loaded.pantry };
    const cost = loaded.today.ingredientCost;
    expect(resumed.restore(raw, loaded)).toBe(true);
    expect(loaded.pantry).toEqual(pantry);
    expect(loaded.today.ingredientCost).toBe(cost);
    expect(loaded.inProduction).toEqual(s.inProduction);
    expect(resumed.cooks.some((c) => c.batch && c.x === stationSpot(c.batch.steps[c.batch.step]).x)).toBe(true);
    for (let i = 0; i < 5000 && !resumed.finishedService; i++) resumed.update(loaded, 0.05);
    expect(resumed.finishedService).toBe(true);
    expect(loaded.today.baked.roll).toBeGreaterThan(0);
    const reviews = loaded.reputation.recent.length;
    const report = resumed.closeShop(loaded)!;
    tick(loaded, resumed, 20);
    expect(loaded.reputation.recent.length).toBe(reviews);
    expect(report.ingredientCost).toBeGreaterThanOrEqual(cost);
  });

  it('keeps the first thirty births distinct when reloading after every arrival', () => {
    let state = createInitialState(0);
    state.pantry.beans = 1000;
    openShop(state);
    let sim = new Sim(() => 0.5);
    const appearances = new Map<number, number>();
    for (let i = 0; i < 12000 && appearances.size < 30; i++) {
      sim.update(state, 0.05);
      const born = sim.customers.filter((c) => !appearances.has(c.id));
      if (!born.length) continue;
      for (const c of born) appearances.set(c.id, c.appearanceId!);
      const runtime = JSON.parse(JSON.stringify(sim.snapshot(state)));
      const loaded = deserialize(serialize(state), 0);
      const restored = new Sim(() => 0.5);
      expect(restored.restore(runtime, loaded)).toBe(true);
      expect(restored.snapshot(loaded).customerCast).toEqual(runtime.customerCast);
      state = loaded; sim = restored;
    }
    expect(appearances.size).toBe(30);
    expect(new Set(appearances.values()).size).toBe(30);
    const corrupt = sim.snapshot(state);
    corrupt.customerCast.remaining = [0, 0];
    expect(new Sim().restore(corrupt, state)).toBe(false);
  });

  it('rejects malformed new navigation atomically and does not enter furniture', () => {
    const s = shop(); const sim = new Sim(rng()); tick(s, sim, 20);
    const raw = sim.snapshot(s);
    for (const version of ['1', '2']) {
      expect(new Sim().restore({ ...raw, version }, s)).toBe(false);
    }
    const invalidJourney = structuredClone(raw);
    invalidJourney.customers[0].journey = [{ x: Infinity, y: 10 }];
    const resumed = new Sim();
    expect(resumed.restore(invalidJourney, s)).toBe(false);
    const invalidPosition = structuredClone(raw);
    invalidPosition.customers[0].x = COUNTER.x + 20;
    invalidPosition.customers[0].y = COUNTER.front;
    expect(resumed.restore(invalidPosition, s)).toBe(false);
    expect(resumed.customers).toEqual([]);
    expect(resumed.cooks).toEqual([]);
  });

  it('resets staff jobs, navigation, customer cycles and tap cooldown for a new café', () => {
    const s = shop(2); const sim = new Sim(rng()); tick(s, sim, 25);
    // Bigger kitchens finish bigger batches quickly; catch a cook mid-batch.
    for (let n = 0; n < 60 && !sim.cooks.some((c) => c.batch); n++) tick(s, sim, 1);
    expect(sim.cooks.some((c) => c.batch)).toBe(true);
    sim.reset();
    expect(sim.cooks).toEqual([]); expect(sim.customers).toEqual([]); expect(sim.rack).toEqual([]);
    expect(sim.boost()).toBe(false);
    const fresh = createInitialState(5);
    tick(fresh, sim, 30);
    expect(fresh.today.ingredientCost).toBe(0);
    expect(fresh.shelf).toEqual({}); expect(fresh.inProduction).toEqual({});
    expect(sim.cooks).toEqual([]); expect(sim.customers).toEqual([]);
    expect(sim.snapshot(fresh).nextId).toBe(1);
  });
});
