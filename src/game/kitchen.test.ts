import { afterEach, describe, expect, it } from 'vitest';
import { COOK_BATCH, MENU } from './data';
import { openShop } from './day';
import { buyUpgrade, cookCount, dayNeeds, isBakery } from './economy';
import { canPlace } from './furniture';
import {
  BASE_EQUIPMENT,
  BENCH,
  KITCHEN_COST,
  bakeryPlan,
  ZONES,
  batchSteps,
  cookHome,
  installedEquipment,
  kitchenBlock,
  kitchenPath,
  nextBatch,
  stationSpot,
  unlockKitchen,
  type Station,
} from './kitchen';
import { MAX_SCENE_H, MIN_SCENE_H, areaAtPoint, areaOrigin, floorY, setSceneHeight } from './layout';
import { regionOffset } from './regions';
import { Sim, type SimEvent } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => setSceneHeight(MIN_SCENE_H));

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** An open shop with a kitchen, selling butter rolls and nothing baked this morning. */
function bakingState() {
  const s = createInitialState(0);
  s.coins = KITCHEN_COST;
  unlockKitchen(s);
  s.items.roll = 1;
  s.onMenu = ['espresso', 'roll'];
  s.bakePlan = { roll: 0 };
  s.pantry.beans = 1_000;
  s.pantry.flour = 40;
  s.pantry.butter = 40;
  openShop(s);
  return s;
}

describe('the kitchen', () => {
  it('is built between business days, once, and comes with its first cook', () => {
    const s = createInitialState(0);
    expect(kitchenBlock(s)).toBe('coins');
    expect(buyUpgrade({ ...s, coins: 1e9 }, 'cook', 1)).toBe(false);
    s.coins = KITCHEN_COST + 5;
    s.phase = 'open';
    expect(unlockKitchen(s)).toBe(false);
    s.phase = 'prep';
    expect(cookCount(s)).toBe(0);
    expect(unlockKitchen(s)).toBe(true);
    expect(s.coins).toBe(5);
    expect(unlockKitchen(s)).toBe(false);
    expect(cookCount(s)).toBe(1);
    s.coins = 1e9;
    expect(buyUpgrade(s, 'cook', 1)).toBe(true);
    expect(cookCount(s)).toBe(2);
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.kitchen).toBe(true);
    expect(cookCount(loaded)).toBe(2);
    expect(deserialize(JSON.stringify({ kitchen: 'yes' }), 0).kitchen).toBe(false);
  });

  it('is fitted with the equipment the menu calls for', () => {
    const s = createInitialState(0);
    expect([...installedEquipment(s)].sort()).toEqual([...BASE_EQUIPMENT].sort());
    s.items.roll = 1;
    expect(installedEquipment(s).has('mixer')).toBe(true);
    expect(installedEquipment(s).has('deckOven')).toBe(true);
    expect(installedEquipment(s).has('fryer')).toBe(false);
    s.items.bagel = 1;
    expect(installedEquipment(s).has('kettle')).toBe(true);
    s.items.donut = 1;
    expect(installedEquipment(s).has('fryer')).toBe(true);
    expect(installedEquipment(s).has('proofer')).toBe(true);
    s.items.croissant = 1;
    expect(installedEquipment(s).has('sheeter')).toBe(true);
    expect(installedEquipment(s).has('convection')).toBe(true);
    expect(installedEquipment(s).has('pastryFridge')).toBe(false);
    s.items.cake = 1;
    expect(installedEquipment(s).has('standMixer')).toBe(true);
    expect(installedEquipment(s).has('pastryFridge')).toBe(true);
  });

  it('moves every batch one way, from storage through prep and the ovens to the café door', () => {
    for (const m of MENU.filter((m) => isBakery(m.id))) {
      const steps = batchSteps(m.id);
      expect(ZONES[steps[0]], m.id).toBe(0);
      expect(steps.at(-1), m.id).toBe('door');
      expect(steps.some((s) => ZONES[s] === 2), `${m.id} is baked`).toBe(true);
      for (let i = 1; i < steps.length; i++) expect(ZONES[steps[i]], `${m.id}: ${steps.join(' → ')}`).toBeGreaterThanOrEqual(ZONES[steps[i - 1]]);
    }
    // Butter comes from the cold room; a baguette is just flour, water and salt.
    expect(batchSteps('roll')[0]).toBe('cooler');
    expect(batchSteps('baguette')[0]).toBe('dryStore');
    expect(batchSteps('cake')).toEqual(['cooler', 'standMixer', 'convection', 'rack', 'pastryFridge', 'door']);
  });

  it('walks cooks around the bench rather than through it, at any height', () => {
    const stations = Object.keys(ZONES) as Station[];
    for (const h of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(h);
      const o = areaOrigin('kitchen');
      const bench = { x0: o.x + BENCH.x, x1: o.x + BENCH.x + BENCH.w, y0: o.y + floorY(BENCH.front) - BENCH.depth, y1: o.y + floorY(BENCH.front) };
      const spots = [...stations.map(stationSpot), cookHome(0), cookHome(1), cookHome(2)];
      for (const from of spots) {
        for (const to of spots) {
          let at = { x: from.x, y: from.y };
          for (const next of kitchenPath(from, to)) {
            for (let k = 0; k <= 20; k++) {
              const x = at.x + ((next.x - at.x) * k) / 20;
              const y = at.y + ((next.y - at.y) * k) / 20;
              expect(areaAtPoint(x, y)).toBe('kitchen');
              const inBench = x > bench.x0 && x < bench.x1 && y > bench.y0 && y < bench.y1;
              expect(inBench, `${JSON.stringify(from)} → ${JSON.stringify(to)} at ${x},${y}`).toBe(false);
            }
            at = next;
          }
          expect({ x: at.x, y: at.y }).toEqual({ x: to.x, y: to.y });
        }
      }
    }
  });

  it('bakes fresh batches while the shop is open when the pastry case runs low', () => {
    const s = bakingState();
    const sim = new Sim(seeded(5));
    const events: SimEvent[] = [];
    for (let t = 0; t < 60; t += 0.05) events.push(...sim.update(s, 0.05));
    const restocks = events.filter((e) => e.type === 'restock');
    expect(restocks.length).toBeGreaterThan(0);
    expect(s.today.baked.roll).toBe(restocks.length * COOK_BATCH);
    // Each batch took its ingredients from the pantry and counts toward the day's costs.
    const started = restocks.length + sim.cooks.filter((c) => c.batch).length;
    expect(s.pantry.flour).toBe(40 - started * COOK_BATCH);
    expect(s.today.ingredientCost).toBeGreaterThan(0);
    expect(sim.cooks).toHaveLength(1);
    expect(areaAtPoint(sim.cooks[0].x, sim.cooks[0].y)).toBe('kitchen');
  });

  it('leaves a well-stocked case alone, and bakes what the pantry allows', () => {
    const s = bakingState();
    s.shelf.roll = bakeryPlan(s).get('roll')!.trigger + 1;
    expect(nextBatch(s, [])).toBeNull();
    s.shelf.roll = bakeryPlan(s).get('roll')!.trigger;
    expect(nextBatch(s, [])).toEqual({ item: 'roll', n: COOK_BATCH });
    // One cook per dish at a time.
    expect(nextBatch(s, ['roll'])).toBeNull();
    // A short pantry makes a smaller batch, an empty one none.
    s.pantry.butter = 2;
    expect(nextBatch(s, [])).toEqual({ item: 'roll', n: 2 });
    s.pantry.butter = 0;
    expect(nextBatch(s, [])).toBeNull();
  });

  it('keeps flour and butter on hand for the cooks when stocking up', () => {
    const s = createInitialState(0);
    s.items.roll = 1;
    s.onMenu = ['roll'];
    s.bakePlan = { roll: 20 };
    expect(dayNeeds(s).flour).toBe(20);
    s.coins = KITCHEN_COST;
    unlockKitchen(s);
    expect(dayNeeds(s).flour).toBeGreaterThan(20);
    const needs = dayNeeds(s).flour;
    s.bakePlan.roll = 5;
    expect(dayNeeds(s).flour).toBe(needs); // shifting production does not buy the same flour twice
  });

  it('has no room for decorations', () => {
    const s = createInitialState(0);
    s.coins = KITCHEN_COST;
    unlockKitchen(s);
    s.decor.stored.plant_fern = 1;
    const col = regionOffset('kitchen') / 8 + 10;
    expect(canPlace(s, 'plant_fern', col, 8, 2)).toBe(false);
  });
});
