import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU } from './data';
import { checkOpen, finishDay, openShop } from './day';
import { bakeForForecast, bakeMorning, buyItem, canPrepareItem, consumeServing, dayDemand, menuItems, projectMorningBake, quoteItem, readyServings, requiresKitchen, salePrice, setBakePlan, setOnMenu } from './economy';
import { installedEquipment, KITCHEN_COST, nextBatch, shelveBatch, startBatch, unlockKitchen } from './kitchen';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

function legacy() {
  const s = createInitialState(0);
  s.coins = 1e15;
  for (const m of MENU) s.items[m.id] = 1;
  s.onMenu = MENU.map(m => m.id);
  s.bakePlan = { roll: 20, donut: 10 };
  s.shelf = { roll: 7, donut: 4 };
  for (const i of INGREDIENTS) s.pantry[i.id] = 1000;
  return deserialize(serialize(s), 0);
}

describe('bar-only before building the kitchen', () => {
  it('gates every food, including coffee-category affogato, but leaves true drinks available', () => {
    const s = legacy();
    for (const m of MENU) {
      expect(canPrepareItem(s, m.id)).toBe(!requiresKitchen(m.id));
      if (requiresKitchen(m.id)) {
        const before = serialize(s);
        expect(quoteItem(s, m.id, 1).affordable).toBe(false);
        expect(buyItem(s, m.id, 1)).toBe(false);
        setOnMenu(s, m.id, true);
        setBakePlan(s, m.id, 99);
        expect(consumeServing(s, m.id, s.today)).toBe(false);
        expect(salePrice(s, m.id)).toBe(0);
        expect(readyServings(s, m.id)).toBe(0);
        expect(serialize(s)).toBe(before);
      }
    }
    expect(menuItems(s).some(m => m.id === 'affogato')).toBe(false);
    expect(menuItems(s).some(m => m.id === 'smoothie')).toBe(true);
  });

  it('preserves legacy progression, plans, pantry and shelf through projection and whole drink-only days', () => {
    const s = legacy();
    const items = { ...s.items }, pantry = { ...s.pantry }, shelf = { ...s.shelf }, plan = { ...s.bakePlan };
    expect(projectMorningBake(s)).toEqual({ pantry, shelf });
    bakeForForecast(s);
    expect(bakeMorning(s)).toBe(0);
    expect(s.bakePlan).toEqual(plan);
    expect(checkOpen(s)).toEqual({ ok: true });
    expect([...dayDemand(s).keys()].every(id => !requiresKitchen(id))).toBe(true);
    expect(openShop(s)).toBe(0);
    const before = serialize(s);
    startBatch(s, 'roll', 5);
    shelveBatch(s, 'roll', 5);
    expect(nextBatch(s, [])).toBeNull();
    expect(installedEquipment(s).size).toBe(0);
    expect(serialize(s)).toBe(before);
    let seed = 31;
    const sim = new Sim(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
    for (let t = 0; t < 160; t += .1) {
      sim.update(s, .1);
      for (const c of sim.customers) {
        expect(requiresKitchen(c.order)).toBe(false);
        if (c.extra) expect(requiresKitchen(c.extra)).toBe(false);
      }
    }
    expect(Object.keys(s.today.sales).every(id => !requiresKitchen(id as keyof typeof s.items))).toBe(true);
    finishDay(s);
    expect(s.shelf).toEqual(shelf);
    expect(s.items).toEqual(items);
    expect(s.bakePlan).toEqual(plan);
    expect(s.pantry.flour).toBe(pantry.flour);
    expect(s.pantry.butter).toBe(pantry.butter);
  });

  it('does not grant recipes or resources on purchase and keeps category progression at all kitchen stages', () => {
    for (const stage of [0, 1, 2]) {
      const s = createInitialState(0);
      s.coins = 10000;
      const pantry = { ...s.pantry }, items = { ...s.items };
      expect(buyItem(s, 'roll', 1)).toBe(false);
      expect(unlockKitchen(s)).toBe(true);
      s.upgrades.cook = stage;
      expect(s.coins).toBe(10000 - KITCHEN_COST);
      expect(s.items).toEqual(items);
      expect(s.pantry).toEqual(pantry);
      expect(s.shelf).toEqual({});
      expect(buyItem(s, 'bagel', 1)).toBe(false);
      expect(buyItem(s, 'roll', 1)).toBe(true);
      expect(buyItem(s, 'bagel', 1)).toBe(true);
    }
  });

  it('blocks first building during business and reactivates retained plans and stock only after closing', () => {
    const s = legacy();
    openShop(s);
    const before = serialize(s);
    expect(unlockKitchen(s)).toBe(false);
    expect(serialize(s)).toBe(before);
    finishDay(s);
    const coins = s.coins;
    expect(unlockKitchen(s)).toBe(true);
    expect(s.coins).toBe(coins - KITCHEN_COST);
    expect(s.shelf.roll).toBe(7);
    expect(deserialize(serialize(s), 0).shelf.roll).toBe(7);
    expect(menuItems(s).some(m => m.id === 'roll')).toBe(true);
    const projected = projectMorningBake(s);
    expect(projected.shelf.roll).toBe(27);
    openShop(s);
    expect(s.today.baked.roll).toBe(20);
    expect(s.shelf.roll).toBe(27);
  });
});
