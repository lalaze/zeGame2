import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, type ItemId } from './data';
import { checkOpen, finishDay, openShop } from './day';
import {
  buyItem, consumeServing, dayDemand, menuItems, projectMorningBake,
  readyServings, servingsLeft, setOnMenu,
} from './economy';
import { createInitialState, deserialize, serialize } from './state';

function menuState(ids: ItemId[]) {
  const state = createInitialState(0);
  state.kitchen = true;
  state.onMenu = ids;
  for (const id of ids) state.items[id] = 1;
  return state;
}

describe('unlocking dishes without changing an open menu', () => {
  it.each(['roll', 'americano'] as const)('keeps a live %s unlock off-menu until explicitly selected in prep', (id) => {
    const state = createInitialState(0);
    state.coins = 1e6;
    state.kitchen = id === 'roll';
    openShop(state);
    const pantry = { ...state.pantry };
    expect(state.kitchen).toBe(id === 'roll');
    expect(buyItem(state, id, 1)).toBe(true);
    expect(state.items[id]).toBe(1);
    expect(state.onMenu).toEqual(['espresso']);
    expect(menuItems(state).map((m) => m.id)).toEqual(['espresso']);
    expect(state.bakePlan[id]).toBeUndefined();
    expect(state.shelf[id]).toBeUndefined();
    expect(state.pantry).toEqual(pantry);
    expect(deserialize(serialize(state), 0).onMenu).toEqual(['espresso']);
    finishDay(state);
    expect(state.onMenu).toEqual(['espresso']);
    setOnMenu(state, id, true);
    expect(state.onMenu).toContain(id);
    if (id === 'roll') expect(state.bakePlan.roll).toBeGreaterThan(0);
  });

  it('preserves prep auto-enabling and bake plans', () => {
    const state = createInitialState(0);
    state.coins = 1e6;
    state.kitchen = true;
    expect(buyItem(state, 'roll', 1)).toBe(true);
    expect(buyItem(state, 'americano', 1)).toBe(true);
    expect(state.onMenu).toEqual(['espresso', 'americano', 'roll']);
    expect(state.bakePlan.roll).toBeGreaterThan(0);
  });

  it.each(['prep', 'open'] as const)('does not re-enable a previously unlocked, disabled dish on a %s upgrade', (phase) => {
    const state = createInitialState(0);
    state.coins = 1e6;
    state.kitchen = true;
    buyItem(state, 'roll', 1);
    setOnMenu(state, 'roll', false);
    state.phase = phase;
    expect(buyItem(state, 'roll', 1)).toBe(true);
    expect(state.items.roll).toBe(2);
    expect(state.onMenu).not.toContain('roll');
  });
});

describe('opening-stock projection', () => {
  it('warns when an earlier bake consumes the ingredients a later bake needs', () => {
    // Reverse the selection order: production must still follow canonical MENU order.
    const state = menuState(['bagel', 'roll']);
    state.bakePlan = { roll: 30, bagel: 30 };
    state.pantry.flour = state.pantry.butter = state.pantry.sugar = 30;
    const before = serialize(state);
    const projected = projectMorningBake(state);
    expect(projected.shelf).toEqual({ roll: 30, bagel: 0 });
    expect(readyServings(state, 'roll')).toBe(30);
    expect(readyServings(state, 'bagel')).toBe(0);
    expect(checkOpen(state)).toEqual({ ok: false, reason: 'lowStock', items: ['bagel'] });
    expect(serialize(state)).toBe(before);
    expect(openShop(state)).toBe(30);
    expect(state.shelf).toEqual(projected.shelf);
    expect(state.pantry).toEqual(projected.pantry);
    // The report counts actual production, omitting recipes that baked nothing.
    expect(state.today.baked).toEqual({ roll: 30 });
  });

  it('checks drinks after reserving the morning bake, even though drinks come first in MENU', () => {
    const state = menuState(['hotchoc', 'bagel']);
    state.bakePlan.bagel = 30;
    state.pantry.flour = state.pantry.sugar = state.pantry.cocoa = state.pantry.milk = 30;
    expect(servingsLeft(state, 'hotchoc')).toBe(30);
    expect(readyServings(state, 'hotchoc')).toBe(0);
    expect(checkOpen(state)).toEqual({ ok: false, reason: 'lowStock', items: ['hotchoc'] });
    expect(openShop(state)).toBe(30);
    expect(consumeServing(state, 'hotchoc')).toBe(false);
    expect(state.shelf.bagel).toBe(30);
  });

  it('does not count the same beans toward two drinks’ half-day targets', () => {
    const state = menuState(['espresso', 'americano']);
    const demand = dayDemand(state);
    const espressoNeed = Math.ceil(demand.get('espresso')! / 2);
    const americanoNeed = Math.ceil(demand.get('americano')! / 2);
    state.pantry.beans = Math.max(espressoNeed, americanoNeed);
    expect(checkOpen(state)).toEqual({ ok: false, reason: 'lowStock', items: ['americano'] });
    state.pantry.beans = espressoNeed + americanoNeed;
    expect(checkOpen(state)).toEqual({ ok: true });
    openShop(state);
    for (let n = 0; n < espressoNeed; n++) expect(consumeServing(state, 'espresso')).toBe(true);
    for (let n = 0; n < americanoNeed; n++) expect(consumeServing(state, 'americano')).toBe(true);
    expect(state.pantry.beans).toBe(0);
  });

  it('matches actual baking for all recipes with partial, missing, and ample stock', () => {
    for (const stock of [0, 17, 1e6]) {
      const state = menuState(MENU.map((m) => m.id));
      for (const [index, m] of MENU.entries()) state.bakePlan[m.id] = index % 4 === 0 ? 0 : 7;
      for (const ing of INGREDIENTS) state.pantry[ing.id] = stock;
      const before = serialize(state);
      const projected = projectMorningBake(state);
      checkOpen(state);
      for (const m of MENU) readyServings(state, m.id);
      expect(serialize(state)).toBe(before);
      const total = openShop(state);
      expect(state.pantry).toEqual(projected.pantry);
      expect(state.shelf).toEqual(projected.shelf);
      expect(total).toBe(Object.values(projected.shelf).reduce<number>((sum, n) => sum + (n ?? 0), 0));
      for (const n of Object.values(state.pantry)) expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('ignores off-menu bake plans and preserves live shelf/drink readiness', () => {
    const state = menuState(['espresso']);
    state.items.roll = 1;
    state.bakePlan.roll = 100;
    state.pantry.flour = state.pantry.butter = 100;
    expect(projectMorningBake(state).shelf).toEqual({});
    expect(readyServings(state, 'roll')).toBe(0);
    openShop(state);
    state.shelf.roll = 3;
    expect(readyServings(state, 'roll')).toBe(3);
    expect(readyServings(state, 'espresso')).toBe(state.pantry.beans);
    expect(checkOpen(state)).toEqual({ ok: true });
  });
});
