import { describe, expect, it } from 'vitest';
import { CATEGORIES, INGREDIENTS, MENU, RECIPES } from './data';
import { buyItem, consumeServing, isBakery, isItemAvailable, servingCost } from './economy';
import { openShop } from './day';
import { batchSteps, shelveBatch, startBatch } from './kitchen';
import { createInitialState, deserialize, serialize } from './state';
import { ITEM_ART } from '../render/sprites';

describe('expanded café menu', () => {
  it('keeps recipes profitable and unlock costs increasing within each category', () => {
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length);
    for (const category of CATEGORIES) {
      let previousCost = 0;
      for (const m of MENU.filter((m) => m.category === category)) {
        expect(m.baseCost, m.id).toBeGreaterThan(previousCost);
        expect(m.basePrice, m.id).toBeGreaterThan(servingCost(m.id));
        expect(m.prepTime, m.id).toBeGreaterThan(0);
        previousCost = m.baseCost;
      }
    }
  });

  it('preserves old ownership, menus and upgrades when a new predecessor is inserted', () => {
    const state = deserialize(JSON.stringify({
      version: 5, coins: 1e9, items: { espresso: 3, flatwhite: 2, mocha: 7 },
      onMenu: ['espresso', 'mocha'], phase: 'prep',
    }), 0);
    expect(state.items.cortado).toBe(0);
    expect(state.items.mocha).toBe(7);
    expect(state.onMenu).toEqual(['espresso', 'mocha']);
    expect(buyItem(state, 'mocha', 1)).toBe(true);
    expect(state.items.mocha).toBe(8);
    expect(isItemAvailable(state, 'cortado')).toBe(true);
    expect(buyItem(state, 'cortado', 1)).toBe(true);
    expect(deserialize(serialize(state), 0).items.cortado).toBe(1);
    expect(buyItem(createInitialState(0), 'cortado', 1)).toBe(false);
  });

  it.each(MENU)('can stock, produce and serve $id without losing ingredient accounting', (m) => {
    const state = createInitialState(0);
    state.items[m.id] = 1;
    state.onMenu = [m.id];
    state.bakePlan = { [m.id]: 0 };
    for (const ing of INGREDIENTS) state.pantry[ing.id] = 100;
    openShop(state);
    const pantry = { ...state.pantry };
    if (isBakery(m.id)) {
      const steps = batchSteps(m.id);
      expect(steps.some((s) => s === 'deckOven' || s === 'convection' || s === 'fryer')).toBe(true);
      startBatch(state, m.id, 1);
      shelveBatch(state, m.id, 1);
    }
    expect(consumeServing(state, m.id, state.today)).toBe(true);
    for (const ing of INGREDIENTS) {
      expect(state.pantry[ing.id], ing.id).toBe(pantry[ing.id] - (RECIPES[m.id][ing.id] ?? 0));
    }
    expect(state.today.ingredientCost).toBe(servingCost(m.id));
    if (isBakery(m.id)) {
      expect(state.shelf[m.id]).toBe(0);
      expect(consumeServing(state, m.id)).toBe(false);
    }
  });

  it('has a drawable icon and a palette entry for every visible menu pixel', () => {
    for (const m of MENU) {
      const art = ITEM_ART[m.id];
      expect(art.rows.length, m.id).toBeGreaterThan(0);
      for (const pixel of new Set(art.rows.join('').replaceAll('.', ''))) {
        expect(art.palette[pixel], `${m.id}: ${pixel}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
