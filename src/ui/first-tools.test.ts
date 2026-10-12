// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quoteItem } from '../game/economy';
import { createInitialState, serialize } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';

// Match the lightweight Panel fixture used by the kitchen and merge integration tests.
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
const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const button = (selector: string) => query<HTMLButtonElement>(selector);
const visibleRecipes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-buy^="item:"]'), (b) => b.dataset.buy);

function panelFor(state = createInitialState(0), onPurchase = vi.fn()): Panel {
  document.body.innerHTML = `<button id="outside">Show all tools</button><section id="panel">
    <nav role="tablist">${tabs.map((tab) => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="buy-amount"><button data-amount="1" class="active">1</button><button data-amount="10">10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount buy-amount" hidden><button data-pantry-amount="10" class="active">10</button><button data-pantry-amount="50">50</button><button data-pantry-amount="200">200</button></div>
    <div class="menu-filter"><button data-cat="all" class="active">All</button><button data-cat="coffee">Coffee</button><button data-cat="tea">Tea</button><button data-cat="bread">Bread</button></div>
    <div id="list"></div><div id="goal"></div>
  </section>`;
  const panel = new Panel(query('#panel'), query('#list'), query('#goal'), state, onPurchase, vi.fn());
  panel.showTab('menu');
  return panel;
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('first-shift management disclosure', () => {
  it('leaves the existing full interface as the default', () => {
    const state = createInitialState(0);
    const panel = panelFor(state);
    const espresso = button('[data-buy="item:espresso"]');
    panel.setIntroMode(false);
    expect(button('[data-buy="item:espresso"]')).toBe(espresso);
    for (const tab of tabs) expect(button(`[data-tab="${tab}"]`).hidden).toBe(false);
    expect(query('.buy-amount').hidden).toBe(false);
    expect(query('.menu-filter').hidden).toBe(false);
    expect(document.querySelector('.mystery')).not.toBeNull();
    expect(button('[data-buy="item:americano"]')).not.toBeNull();
    expect(button('[data-buy="item:roll"]').disabled).toBe(true);
  });

  it.each(['en', 'zh'] as const)('shows owned drinks and an actionable pantry in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    const before = serialize(state);
    const panel = panelFor(state);
    panel.setIntroMode(true);

    expect(visibleRecipes()).toEqual(['item:espresso']);
    expect(document.querySelector('.mystery')).toBeNull();
    expect(document.querySelector('.row.new')).toBeNull();
    expect(document.querySelectorAll('.menu-cat')).toHaveLength(1);
    expect(document.querySelector('.menu-cat small')).toBeNull();
    expect(document.querySelector('.menu-intro')).toBeNull();
    expect(button('[data-menu="espresso"]').disabled).toBe(false);
    expect(button('[data-taste="espresso"]').hidden).toBe(false);
    for (const tab of tabs) expect(button(`[data-tab="${tab}"]`).hidden).toBe(tab !== 'menu' && tab !== 'pantry');
    for (const selector of ['.buy-amount', '.pantry-amount', '.menu-filter']) expect(query(selector).hidden).toBe(true);

    button('[data-tab="pantry"]').click();
    expect(button('[data-tab="pantry"]').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-restock]')).not.toBeNull();
    expect(button('[data-buy="ing:beans"]').textContent).toContain(t('pantry.buy', { n: 10 }));
    expect(query('.pantry-amount').hidden).toBe(true);
    expect(serialize(state)).toBe(before);
  });

  it('keeps existing owned recipes, kitchen gates and saved choices intact', () => {
    const state = createInitialState(0);
    state.coins = 1e5;
    state.items.blacktea = 2;
    state.items.roll = 3;
    state.onMenu.push('blacktea', 'roll');
    state.bakePlan.roll = 20;
    const before = serialize(state);
    const panel = panelFor(state);
    panel.setIntroMode(true);
    expect(visibleRecipes()).toEqual(['item:espresso', 'item:blacktea', 'item:roll']);
    expect(button('[data-buy="item:roll"]').disabled).toBe(true);
    expect(button('[data-menu="roll"]').disabled).toBe(true);
    expect(button('[data-buy="item:roll"]').closest('.row')!.textContent).toContain(t('menu.requiresKitchen'));
    panel.setIntroMode(false);
    expect(button('[data-buy="item:roll"]').disabled).toBe(true);
    expect(serialize(state)).toBe(before);
  });

  it('uses small purchases during the intro without overwriting full-view filters or amounts', () => {
    const state = createInitialState(0);
    state.coins = 1e7;
    state.items.blacktea = 1;
    const purchased = vi.fn();
    const panel = panelFor(state, purchased);
    button('[data-cat="tea"]').click();
    button('[data-amount="max"]').click();
    panel.showTab('pantry');
    button('[data-pantry-amount="200"]').click();
    panel.setIntroMode(true);

    const beans = state.pantry.beans;
    button('[data-buy="ing:beans"]').click();
    expect(state.pantry.beans).toBe(beans + 10);
    panel.showTab('menu');
    expect(visibleRecipes()).toEqual(['item:espresso', 'item:blacktea']);
    const coins = state.coins;
    const singleCost = quoteItem(state, 'espresso', 1).cost;
    button('[data-buy="item:espresso"]').click();
    expect(state.items.espresso).toBe(2);
    expect(state.coins).toBe(coins - singleCost);
    expect(purchased).toHaveBeenCalledWith('item', 'espresso');

    panel.setIntroMode(false);
    expect(document.querySelector('[data-buy="item:espresso"]')).toBeNull();
    expect(button('[data-cat="tea"]').classList.contains('active')).toBe(true);
    expect(button('[data-amount="max"]').classList.contains('active')).toBe(true);
    expect(button('[data-buy="item:blacktea"]').querySelector('.label')!.textContent).toBe(`+${quoteItem(state, 'blacktea', 'max').count}`);
    panel.showTab('pantry');
    expect(query('.pantry-amount').hidden).toBe(false);
    expect(button('[data-pantry-amount="200"]').classList.contains('active')).toBe(true);
    expect(button('[data-buy="ing:beans"]').textContent).toContain(t('pantry.buy', { n: 200 }));
  });

  it('does not rebuild rows, reset scrolling, or lose focus on repeated intro updates', () => {
    const panel = panelFor();
    panel.setIntroMode(true);
    const list = query('#list');
    const replace = vi.spyOn(list, 'replaceChildren');
    const focused = button('[data-menu="espresso"]');
    focused.focus();
    list.scrollTop = 31;
    for (let i = 0; i < 5; i++) {
      panel.setIntroMode(true);
      panel.update();
    }
    expect(replace).not.toHaveBeenCalled();
    expect(button('[data-menu="espresso"]')).toBe(focused);
    expect(document.activeElement).toBe(focused);
    expect(list.scrollTop).toBe(31);
  });

  it.each(['upgrades', 'decor', 'pets', 'promotion'] as const)('reveals direct %s navigation and keeps focus reachable', (tab) => {
    const panel = panelFor();
    panel.setIntroMode(true);
    button('[data-menu="espresso"]').focus();
    panel.showTab(tab);
    expect(query('#panel').classList.contains('intro-mode')).toBe(false);
    for (const name of tabs) expect(button(`[data-tab="${name}"]`).hidden).toBe(false);
    expect(button(`[data-tab="${tab}"]`).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(button(`[data-tab="${tab}"]`));
    expect(query('#list').children.length).toBeGreaterThan(0);
    panel.showTab('menu');
    expect(document.querySelector('.mystery')).not.toBeNull();
    expect(query('.menu-filter').hidden).toBe(false);
  });

  it('moves focus from newly hidden controls to Menu while leaving outside focus alone', () => {
    const panel = panelFor();
    panel.showTab('upgrades');
    button('[data-tab="upgrades"]').focus();
    panel.setIntroMode(true);
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
    expect(button('[data-tab="menu"]').getAttribute('aria-selected')).toBe('true');
    panel.setIntroMode(false);
    button('[data-amount="max"]').focus();
    panel.setIntroMode(true);
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
    button('#outside').focus();
    panel.setIntroMode(false);
    panel.setIntroMode(true);
    expect(document.activeElement).toBe(button('#outside'));
  });

  it('updates owned drinks, restores every tool, and survives refreshes and state replacement', () => {
    const state = createInitialState(0);
    const panel = panelFor(state);
    panel.setIntroMode(true);
    state.items.americano = 1;
    panel.update();
    expect(visibleRecipes()).toEqual(['item:espresso', 'item:americano']);
    setLocale('zh');
    panel.refresh();
    expect(button('[data-buy="item:americano"]').closest('.row')!.textContent).toContain(t('item.americano'));
    expect(query('.menu-filter').hidden).toBe(true);
    panel.setState(createInitialState(1));
    expect(visibleRecipes()).toEqual(['item:espresso']);
    panel.setIntroMode(false);
    expect(document.querySelector('.mystery')).not.toBeNull();
    expect(query('.buy-amount').hidden).toBe(false);
    expect(query('.menu-filter').hidden).toBe(false);
    for (const tab of tabs) {
      button(`[data-tab="${tab}"]`).click();
      expect(button(`[data-tab="${tab}"]`).hidden).toBe(false);
      expect(button(`[data-tab="${tab}"]`).getAttribute('aria-selected')).toBe('true');
      expect(query('#list').children.length).toBeGreaterThan(0);
    }
  });
});
