// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIN_SCENE_H, MAX_SCENE_H, kitchenHeight, setKitchenLevel, setSceneHeight } from '../game/layout';
import { KITCHEN_COST } from '../game/kitchen';
import { createInitialState } from '../game/state';
import { RegionsUI } from './regions';

afterEach(() => { setKitchenLevel(0); setSceneHeight(MIN_SCENE_H); document.body.replaceChildren(); });

describe('staff door controls', () => {
  it('keeps arrows on the shared staff doorway while kitchen size and viewport change', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    const edges = document.createElement('div'), card = document.createElement('div');
    document.body.append(edges, card);
    const ui = new RegionsUI(edges, card, () => state, () => {}, () => {}, () => {});
    for (const height of [MIN_SCENE_H, MAX_SCENE_H]) for (let stage = 0; stage < 3; stage++) {
      setSceneHeight(height); setKitchenLevel(stage); state.upgrades.cook = stage;
      ui.select('main');
      const top = (direction: string) => parseFloat(edges.querySelector<HTMLElement>(`[data-direction="${direction}"]`)!.style.top);
      expect(top('left')).toBeCloseTo(88 / height * 100, 5);
      expect(edges.querySelector<HTMLElement>('[data-direction="right"]')!.hidden).toBe(true);
      ui.select('kitchen');
      expect(top('right')).toBeCloseTo((88 + (height - kitchenHeight()) / 2) / height * 100, 5);
      expect(card.hidden).toBe(true);
    }
  });
});

describe('the kitchen under the building', () => {
  function inPlace(coins: number) {
    const state = createInitialState(0);
    state.coins = coins;
    const edges = document.createElement('div'), card = document.createElement('div');
    document.body.append(edges, card);
    const moved = vi.fn(), unlocked = vi.fn(), street = vi.fn();
    const ui = new RegionsUI(edges, card, () => state, moved, unlocked, street, true);
    ui.select('main');
    moved.mockClear();
    const way = () => edges.querySelector<HTMLButtonElement>('[data-direction="left"]')!;
    return { state, card, ui, moved, unlocked, street, way };
  }

  it('is offered over the café without leaving it, and can be put off', () => {
    const { card, moved, way } = inPlace(0);
    expect(way().hidden).toBe(false);
    expect(card.hidden).toBe(true);
    way().click();
    expect(card.hidden).toBe(false);
    expect(way().getAttribute('aria-expanded')).toBe('true');
    expect(card.querySelector<HTMLButtonElement>('[data-expand]')!.disabled).toBe(true);
    card.querySelector<HTMLButtonElement>('[data-later]')!.click();
    expect(card.hidden).toBe(true);
    way().click();
    way().click();
    expect(card.hidden).toBe(true);
    expect(moved).not.toHaveBeenCalled();
  });

  it('is built from its card, and then leaves no way to wander off', () => {
    const { state, card, ui, moved, unlocked, way } = inPlace(KITCHEN_COST);
    way().click();
    card.querySelector<HTMLButtonElement>('[data-expand]')!.click();
    expect(state.kitchen).toBe(true);
    expect(unlocked).toHaveBeenCalledOnce();
    expect(card.hidden).toBe(true);
    expect(way().hidden).toBe(true);
    ui.select('kitchen');
    ui.move('left');
    expect(card.hidden).toBe(true);
    expect(moved).not.toHaveBeenCalled();
  });
});
