// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { MIN_SCENE_H, MAX_SCENE_H, kitchenHeight, passageY, setKitchenLevel, setSceneHeight } from '../game/layout';
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
      expect(top('right')).toBeCloseTo(passageY() / height * 100, 5);
      ui.select('kitchen');
      expect(top('right')).toBeCloseTo((88 + (height - kitchenHeight()) / 2) / height * 100, 5);
      expect(card.hidden).toBe(true);
    }
  });
});
