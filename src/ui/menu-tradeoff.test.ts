// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { averageDishPrice, itemPrice, menuItem, menuItems, tipMultiplier } from '../game/economy';
import { formatTransactionMoney } from '../game/format';
import { createInitialState } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'),
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));

const tabs = ['menu', 'pantry', 'upgrades', 'decor', 'pets', 'promotion'] as const;
function panelFor(state = createInitialState(0)): Panel {
  document.body.innerHTML = `<section id="panel">
    <nav role="tablist">${tabs.map((tab) => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="buy-amount"><button data-amount="1" class="active">1</button><button data-amount="10">10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount buy-amount" hidden><button data-pantry-amount="10" class="active">10</button></div>
    <div class="menu-filter"><button data-cat="all" class="active">All</button></div>
    <div id="list"></div><div id="goal"></div>
  </section>`;
  const panel = new Panel(document.querySelector('#panel')!, document.querySelector('#list')!, document.querySelector('#goal')!, state, vi.fn(), vi.fn());
  panel.showTab('menu');
  panel.update();
  return panel;
}
const tradeoff = (id: string) => document.querySelector(`[data-buy="item:${id}"]`)!.closest('.row')!.querySelector<HTMLElement>('.menu-tradeoff')!;

beforeEach(() => setLocale('en'));
afterEach(() => { setLocale('en'); document.body.replaceChildren(); });

describe('menu price trade-off', () => {
  it('averages the takeaway price of today\'s dishes, pricing locked ones at Lv1', () => {
    const state = createInitialState(0);
    state.items.espresso = 5;
    const espresso = itemPrice(menuItem('espresso'), 5) * tipMultiplier(state);
    expect(averageDishPrice(state)).toBeCloseTo(espresso, 10);
    const withAmericano = averageDishPrice(state, [...menuItems(state), menuItem('americano')]);
    expect(withAmericano).toBeCloseTo((espresso + itemPrice(menuItem('americano'), 1) * tipMultiplier(state)) / 2, 10);
    expect(averageDishPrice(createInitialState(0), [])).toBe(0);
  });

  it('warns before a cheap Lv1 dish lowers a levelled menu, and stays quiet otherwise', () => {
    // The playtest: Espresso Lv5 sells for about $20, while a new Americano starts at $5.
    const state = createInitialState(0);
    state.items.espresso = 5;
    panelFor(state);
    const before = averageDishPrice(state), after = averageDishPrice(state, [...menuItems(state), menuItem('americano')]);
    expect(tradeoff('americano').hidden).toBe(false);
    expect(tradeoff('americano').textContent).toBe(t('menu.tradeoffNew', { before: formatTransactionMoney(before), after: formatTransactionMoney(after) }));
    // Once unlocked but off the menu, the advice is about levelling it first.
    state.items.americano = 1; panelFor(state);
    expect(tradeoff('americano').textContent).toBe(t('menu.tradeoff', { before: formatTransactionMoney(before), after: formatTransactionMoney(after) }));
    state.items.americano = 0;
    expect(document.querySelector('.menu-variety')!.textContent).toContain(formatTransactionMoney(before));
    // A fresh café's Espresso is the cheapest dish, so adding Americano raises the average.
    panelFor(createInitialState(0));
    expect(tradeoff('americano').hidden).toBe(true);
  });

  it.each(['en', 'zh'] as const)('labels the On/Off menu toggle state for assistive technology in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.items.americano = 1;
    panelFor(state);
    expect(document.querySelector('[data-menu="espresso"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-menu="americano"]')!.getAttribute('aria-pressed')).toBe('false');
  });
});
