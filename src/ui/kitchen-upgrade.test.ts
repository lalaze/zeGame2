// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buyUpgrade, cookCount, quoteUpgrade } from '../game/economy';
import { createInitialState, deserialize, serialize, type GameState } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemIcon: () => document.createElement('canvas'),
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
  panel.showTab('upgrades');
  return panel;
}

const cookButton = () => document.querySelector<HTMLButtonElement>('[data-buy="upgrade:cook"]')!;
const cookRow = () => cookButton().closest<HTMLElement>('.row')!;

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  document.body.replaceChildren();
});

describe('kitchen expansion upgrade', () => {
  it('requires the kitchen first and explains both expansion prices', () => {
    const state = createInitialState(0);
    state.coins = 1e6;
    showUpgrades(state);
    expect(cookButton().disabled).toBe(true);
    expect(cookRow().querySelector('.lv')!.textContent).toBe('');
    expect(cookRow().textContent).toContain('Open the kitchen first');
    expect(cookRow().textContent).toContain('More floor space and +1 cook');
    expect(cookRow().textContent).toContain('3 stages; expand for $900, then $9.00K');
    expect(buyUpgrade(state, 'cook', 1)).toBe(false);
    expect(state.upgrades.cook).toBe(0);
  });

  it('shows all three stages, preserves purchase prices, and caps repeat purchases', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    state.coins = 9900;
    state.phase = 'open'; // Existing hiring is also allowed while the café is open.
    showUpgrades(state);
    expect(cookRow().querySelector('.lv')!.textContent).toBe('Stage 1/3');
    expect(quoteUpgrade(state, 'cook', 1).cost).toBe(900);
    cookButton().click();
    expect(state.coins).toBe(9000);
    expect(cookCount(state)).toBe(2);
    expect(cookRow().querySelector('.lv')!.textContent).toBe('Stage 2/3');
    expect(quoteUpgrade(state, 'cook', 1).cost).toBe(9000);
    cookButton().click();
    expect(state.coins).toBe(0);
    expect(cookCount(state)).toBe(3);
    expect(cookRow().querySelector('.lv')!.textContent).toBe('Stage 3/3');
    expect(cookButton().disabled).toBe(true);
    expect(cookButton().textContent).toContain(t('btn.maxed'));
    cookButton().click();
    expect(state.upgrades.cook).toBe(2);
    expect(state.coins).toBe(0);
  });

  it('keeps bulk purchasing both remaining expansions at the existing combined price', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    state.coins = 9900;
    showUpgrades(state);
    document.querySelector<HTMLButtonElement>('[data-amount="max"]')!.click();
    expect(cookButton().textContent).toContain('+2');
    expect(quoteUpgrade(state, 'cook', 'max').cost).toBe(9900);
    cookButton().click();
    expect(state.coins).toBe(0);
    expect(cookRow().querySelector('.lv')!.textContent).toBe('Stage 3/3');
  });

  it.each([0, 1, 2])('maps saved cook level %i to the matching stage without migration', (level) => {
    const saved = createInitialState(0);
    saved.kitchen = true;
    saved.upgrades.cook = level;
    const restored = deserialize(serialize(saved), 0);
    const panel = showUpgrades(restored);
    expect(cookRow().querySelector('.lv')!.textContent).toBe(`Stage ${level + 1}/3`);
    expect(cookCount(restored)).toBe(level + 1);
    setLocale('zh');
    panel.refresh();
    expect(cookRow().querySelector('.name')!.textContent).toContain(t('upgrade.cook.name'));
    expect(cookRow().querySelector('.lv')!.textContent).toBe(`阶段 ${level + 1}/3`);
    expect(cookRow().textContent).not.toMatch(/\{(?:first|second|n|total)\}/);
  });
});
