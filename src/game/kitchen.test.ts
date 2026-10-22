import { afterEach, describe, expect, it } from 'vitest';
import { COOK_BATCHES, MENU } from './data';
/** These kitchens are at their first stage. */
const COOK_BATCH = COOK_BATCHES[0];
import { openShop } from './day';
import { buyUpgrade, cookCount, dayNeeds, isBakery } from './economy';
import { canPlace } from './furniture';
import {
  BASE_EQUIPMENT,
  BENCH,
  BINS,
  DISH_PIT,
  KITCHEN_COST,
  bakeryPlan,
  ZONES,
  batchSteps,
  cookHome,
  installedEquipment,
  kitchenBlock,
  kitchenPath,
  kitchenObstacles,
  nextBatch,
  stationSpot,
  unlockKitchen,
  cookBatch,
  type Station,
} from './kitchen';
import { MAX_SCENE_H, MIN_SCENE_H, areaAtPoint, areaBounds, doorwayY, kitchenFloorY, kitchenHeight, resizeRoomPoint, roomRoute, setKitchenLevel, setSceneHeight } from './layout';
import { segmentCrossesObstacle } from './navigation';
import { regionOffset } from './regions';
import { Sim, WALK_SPEED, type SimEvent } from './sim';
import { createInitialState, deserialize, serialize } from './state';

afterEach(() => { setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });

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
    expect(s.coins).toBe(1e9 - 900);
    const loaded = deserialize(serialize(s), 0);
    expect(loaded.kitchen).toBe(true);
    expect(cookCount(loaded)).toBe(2);
    expect(buyUpgrade(s, 'cook', 1)).toBe(true);
    expect(s.coins).toBe(1e9 - 900 - 9_000);
    expect(cookCount(s)).toBe(3);
    expect(buyUpgrade(s, 'cook', 1)).toBe(false);
    expect(deserialize(JSON.stringify({ kitchen: 'yes' }), 0).kitchen).toBe(false);
    for (const level of [0, 1, 2]) {
      s.upgrades.cook = level;
      const oldSave = deserialize(serialize(s), 0);
      const sim = new Sim(seeded(7));
      sim.update(oldSave, 0);
      expect(kitchenHeight()).toBe([184, 216, 240][level]);
      expect(cookCount(oldSave)).toBe(level + 1);
      expect(oldSave.upgrades).toEqual(s.upgrades);
      expect(Object.keys(oldSave)).toEqual(Object.keys(s));
    }
  });

  it('is fitted with the equipment the menu calls for', () => {
    const s = createInitialState(0);
    expect(installedEquipment(s).size).toBe(0);
    s.kitchen = true;
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

  it('uses real compact footprints at every stage, independently of screen height', () => {
    const state = createInitialState(0);
    const sim = new Sim(seeded(2));
    sim.update(state, 0);
    expect(kitchenHeight()).toBe(184);
    expect(sim.cooks).toHaveLength(0);
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(height);
      for (const level of [0, 1, 2]) {
        state.kitchen = true;
        state.upgrades.cook = level;
        const stageSim = new Sim(seeded(2));
        stageSim.update(state, 0);
        expect(stageSim.cooks).toHaveLength(level + 1);
        const bounds = areaBounds('kitchen');
        expect(bounds).toEqual({ x: -320, y: 0, w: 320, h: [184, 216, 240][level] });
        expect(areaAtPoint(-160, bounds.h - 1)).toBe('kitchen');
        expect(areaAtPoint(-160, bounds.h)).toBeUndefined();
        expect(areaAtPoint(-160, height - 1)).toBe(bounds.h === height ? 'kitchen' : undefined);
        expect(kitchenFloorY(BENCH.front)).toBe(134);
        expect(kitchenFloorY(BINS.foot)).toBe([156, 164, 172][level]);
        expect(kitchenFloorY(DISH_PIT.foot)).toBe([152, 160, 168][level]);
        for (let y = 81; y <= 240; y++) expect(kitchenFloorY(y)).toBeGreaterThan(kitchenFloorY(y - 1));
      }
    }
  });

  it('walks cooks around every fixture and through the staff door to pickup, at every size', () => {
    const stations = Object.keys(ZONES) as Station[];
    for (const h of [MIN_SCENE_H, MAX_SCENE_H]) {
      setSceneHeight(h);
      for (const level of [0, 1, 2]) {
        setKitchenLevel(level);
        const obstacles = kitchenObstacles();
        const spots = [...stations.map(stationSpot), cookHome(0), cookHome(1), cookHome(2)];
        for (const from of spots) {
          for (const to of spots) {
            let at = { x: from.x, y: from.y };
            const route = kitchenPath(from, to);
            for (const next of route) {
              for (const obstacle of obstacles) expect(segmentCrossesObstacle(at, next, obstacle), `${JSON.stringify(from)} to ${JSON.stringify(to)}`).toBe(false);
              for (let k = 0; k <= 20; k++) {
                const x = at.x + ((next.x - at.x) * k) / 20;
                const y = at.y + ((next.y - at.y) * k) / 20;
                const room = areaAtPoint(x, y);
                expect(room === 'kitchen' || room === 'main').toBe(true);
                if (x >= 0) {
                  expect(y).toBe(88);
                  expect(x).toBeLessThanOrEqual(202);
                }
              }
              at = next;
            }
            expect({ x: at.x, y: at.y }).toEqual({ x: to.x, y: to.y });
            if ((from.x < 0) !== (to.x < 0)) {
              expect(route).toContainEqual({ x: -12, y: 88 });
              expect(route).toContainEqual({ x: 12, y: 88 });
            }
          }
        }
        expect(stationSpot('door')).toEqual({ x: 202, y: 88, facing: 'down' });
        expect(doorwayY('main', 'left')).toBe(doorwayY('kitchen', 'right'));
        expect(roomRoute('main', 'kitchen')).toEqual(roomRoute('kitchen', 'main').reverse());
        expect(roomRoute('main', 'kitchen').every((p) => p.y === 88)).toBe(true);
      }
    }
  });

  it('restocks every bakery recipe only after carrying it to pickup, then walks back', () => {
    for (const level of [0, 1, 2]) {
      for (const item of MENU.filter((m) => isBakery(m.id))) {
        const state = createInitialState(0);
        state.kitchen = true;
        state.upgrades.cook = level;
        state.items[item.id] = 1;
        state.onMenu = [item.id];
        state.phase = 'open';
        for (const ingredient of Object.keys(state.pantry) as (keyof typeof state.pantry)[]) state.pantry[ingredient] = 100;
        const sim = new Sim(seeded(5));
        let delivered = false;
        const crossings = new Set<string>();
        for (let tick = 0; tick < 1_200; tick++) {
          const before = sim.cooks.map((c) => ({ x: c.x, y: c.y }));
          const events = sim.update(state, 0.1);
          for (const [i, cook] of sim.cooks.entries()) {
            const previous = before[i];
            if (!previous) continue;
            expect(Math.hypot(cook.x - previous.x, cook.y - previous.y)).toBeLessThanOrEqual(WALK_SPEED * 0.1 + 0.0001);
            if ((previous.x < 0) !== (cook.x < 0)) {
              expect(cook.y).toBe(88);
              crossings.add(cook.x < 0 ? 'return' : 'delivery');
            }
          }
          if (events.some((e) => e.type === 'restock' && e.item === item.id)) {
            const cook = sim.cooks[0];
            expect({ x: cook.x, y: cook.y }).toEqual({ x: 202, y: 88 });
            // Bigger kitchens bake bigger batches.
            expect(state.today.baked[item.id]).toBe(cookBatch(state));
            delivered = true;
            state.phase = 'prep';
          }
          if (delivered && !sim.cooks[0].via.length && sim.cooks[0].x === cookHome(0).x && sim.cooks[0].y === cookHome(0).y) break;
        }
        expect(delivered, `${item.id}, stage ${level}`).toBe(true);
        expect(crossings).toEqual(new Set(['delivery', 'return']));
        expect({ x: sim.cooks[0].x, y: sim.cooks[0].y }).toEqual({ x: cookHome(0).x, y: cookHome(0).y });
      }
    }
  }, 15000);

  it('keeps all cook positions and paths fixed when the viewport becomes taller', () => {
    const state = bakingState();
    const sim = new Sim(seeded(5));
    for (let i = 0; i < 180; i++) sim.update(state, 0.1);
    const before = sim.cooks.map((c) => ({ x: c.x, y: c.y, tx: c.tx, ty: c.ty, via: c.via.map((p) => ({ ...p })) }));
    setSceneHeight(MAX_SCENE_H);
    sim.resizeScene(MIN_SCENE_H);
    expect(sim.cooks.map((c) => ({ x: c.x, y: c.y, tx: c.tx, ty: c.ty, via: c.via }))).toEqual(before);
    expect(resizeRoomPoint({ x: -160, y: 160 }, MIN_SCENE_H)).toEqual({ x: -160, y: 160 });
    for (let i = 0; i < 500; i++) sim.update(state, 0.1);
    expect(state.today.baked.roll).toBeGreaterThan(0);
  });

  it('expands around working cooks and returns them safely when closing at the threshold', () => {
    for (const initialLevel of [0, 1]) {
      const state = bakingState();
      state.upgrades.cook = initialLevel;
      const sim = new Sim(seeded(5));
      let crossed = false;
      for (let tick = 0; tick < 1_000; tick++) {
        sim.update(state, 0.05);
        const cook = sim.cooks[0];
        if (Math.abs(cook.x) < 5 && cook.y === 88) {
          crossed = true;
          state.upgrades.cook++;
          sim.update(state, 0);
          expect(sim.cooks).toHaveLength(initialLevel + 2);
          sim.closeShop(state);
          break;
        }
      }
      expect(crossed).toBe(true);
      for (let tick = 0; tick < 400; tick++) sim.update(state, 0.05);
      for (const [i, cook] of sim.cooks.entries()) {
        expect({ x: cook.x, y: cook.y }).toEqual({ x: cookHome(i).x, y: cookHome(i).y });
        expect(cook.batch).toBeNull();
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
    expect(['kitchen', 'main']).toContain(areaAtPoint(sim.cooks[0].x, sim.cooks[0].y));
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
    expect(dayNeeds(s).flour).toBeUndefined();
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
