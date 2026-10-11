// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';
import { showPrepare } from './prepare';
import { closeModal } from './modal';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));

function showUpgrades(state: GameState): Panel {
  document.body.innerHTML = `
    <section id="panel">
      <button data-tab="upgrades"></button>
      <div class="buy-amount"><button data-amount="1"></button><button data-amount="max"></button></div>
      <div class="pantry-amount"></div><div class="menu-filter"></div>
      <div id="list"></div><div id="goal"></div>
    </section>`;
  const panel = new Panel(
    document.getElementById('panel')!, document.getElementById('list')!, document.getElementById('goal')!,
    state, vi.fn(), vi.fn(),
  );
  panel.showTab('menu');
  return panel;
}


beforeEach(() => setLocale('en'));
afterEach(() => {
  closeModal();
  setLocale('en');
  document.body.replaceChildren();
});

describe('kitchen menu prerequisites', () => {
  it.each(['en', 'zh'] as const)('explains blocked food in %s and enables it only after building', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.coins = 1e8;
    state.items.roll = 3;
    state.onMenu.push('roll');
    state.bakePlan.roll = 20;
    const panel = showUpgrades(state);
    const food = () => document.querySelector<HTMLButtonElement>('[data-buy="item:roll"]')!;
    expect(food().disabled).toBe(true);
    expect(food().closest('.row')!.textContent).toContain(t('menu.requiresKitchen'));
    expect(document.querySelector<HTMLButtonElement>('[data-buy="item:donut"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-buy="item:blacktea"]')!.disabled).toBe(false);
    food().click();
    expect(state.items.roll).toBe(3);
    state.kitchen = true;
    panel.update();
    expect(food().disabled).toBe(false);
  });
});

it('keeps legacy food disabled in preparation without changing its plan', () => {
  const state = createInitialState(0);
  state.items.roll = 2;
  state.onMenu.push('roll');
  state.bakePlan.roll = 20;
  document.body.innerHTML = '<div id="modal-root"></div>';
  showPrepare(state, vi.fn(), vi.fn());
  const food = document.querySelector<HTMLInputElement>('[data-dish="roll"]')!;
  expect(food.disabled).toBe(true);
  expect(food.checked).toBe(false);
  expect(food.closest('label')!.textContent).toContain(t('menu.requiresKitchen'));
  expect(document.querySelector('[data-bake="roll:1"]')).toBeNull();
  expect(document.querySelector<HTMLInputElement>('[data-dish="espresso"]')!.checked).toBe(true);
  expect(state.bakePlan.roll).toBe(20);
  expect(state.onMenu).toContain('roll');
});
