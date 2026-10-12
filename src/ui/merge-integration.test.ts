// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU } from '../game/data';
import { suggestedBake } from '../game/economy';
import { FURNITURE } from '../game/furniture';
import { adoptCat } from '../game/pets';
import { bookPromotion } from '../game/promotion';
import { createInitialState, type GameState } from '../game/state';
import { signatureCost } from '../game/taste';
import { messagesFor, setLocale, t } from '../i18n';
import enSource from '../locales/en.json?raw';
import zhSource from '../locales/zh.json?raw';
import { closeModal, isModalOpen } from './modal';
import { Panel } from './panel';
import { showPrepare } from './prepare';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'),
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));

const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
function panelFor(state: GameState, onPurchase = vi.fn()): Panel {
  return new Panel(query('#panel'), query('#list'), query('#goal'), state, onPurchase, vi.fn());
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = `<section id="panel">
    <button id="opener">Prepare</button>
    <div class="buy-amount"><button data-amount="1"></button><button data-amount="max"></button></div>
    <div class="pantry-amount"></div><div class="menu-filter"></div>
    <div id="list"></div><div id="goal"></div>
  </section><div id="modal-root"></div><div id="toast" hidden></div>`;
  query('#opener').focus();
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
});
afterEach(() => { closeModal(); setLocale('en'); vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('merged preparation and progression', () => {
  it('suspends legacy and expanded food, including affogato, without losing their plans', () => {
    const state = createInitialState(0);
    state.items.ciabatta = state.items.affogato = state.items.matchafloat = 2;
    state.onMenu = ['ciabatta', 'affogato', 'matchafloat'];
    state.bakePlan.ciabatta = 17;
    showPrepare(state, vi.fn(), vi.fn());
    for (const id of ['ciabatta', 'affogato', 'matchafloat']) {
      const input = query<HTMLInputElement>(`[data-dish="${id}"]`);
      expect(input.disabled).toBe(true);
      expect(input.checked).toBe(false);
      expect(input.closest('label')!.textContent).toContain(t('menu.requiresKitchen'));
    }
    expect(document.querySelector('[data-amount="ciabatta"]')).toBeNull();
    expect(query<HTMLButtonElement>('[data-start]').disabled).toBe(true);
    expect(state.onMenu).toEqual(['ciabatta', 'affogato', 'matchafloat']);
    expect(state.bakePlan.ciabatta).toBe(17);
    closeModal();
    state.kitchen = true;
    showPrepare(state, vi.fn(), vi.fn());
    expect(query<HTMLInputElement>('[data-dish="ciabatta"]').disabled).toBe(false);
    expect(query<HTMLInputElement>('[data-amount="ciabatta"]').value).toBe('17');
    expect(query<HTMLButtonElement>('[data-start]').disabled).toBe(false);
  });

  it('preserves focused exact amounts, supports five-step and forecast controls, and closes once', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    state.items.ciabatta = 1;
    state.onMenu.push('ciabatta');
    state.bakePlan.ciabatta = 10;
    const start = vi.fn();
    const change = vi.fn();
    showPrepare(state, start, change);
    const amount = query<HTMLInputElement>('[data-amount="ciabatta"]');
    amount.focus(); amount.value = '17'; amount.dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.bakePlan.ciabatta).toBe(17);
    expect(document.activeElement).toBe(query('[data-amount="ciabatta"]'));
    query<HTMLButtonElement>('[data-bake="ciabatta:1"]').click();
    expect(state.bakePlan.ciabatta).toBe(22);
    query<HTMLButtonElement>('[data-forecast]').click();
    expect(state.bakePlan.ciabatta).toBe(suggestedBake(state, 'ciabatta'));
    expect(change).toHaveBeenCalledTimes(3);
    const button = query<HTMLButtonElement>('[data-start]');
    button.click(); button.click();
    expect(start).toHaveBeenCalledTimes(1);
    expect(isModalOpen()).toBe(false);
    expect(document.activeElement).toBe(query('#opener'));
  });

  it('reports only purchased stock when the preparation budget is partial', () => {
    const state = createInitialState(0); state.coins = 2;
    for (const id of Object.keys(state.pantry) as (keyof GameState['pantry'])[]) state.pantry[id] = 0;
    const change = vi.fn(); showPrepare(state, vi.fn(), change);
    query<HTMLButtonElement>('[data-restock]').click();
    expect(state.coins).toBe(0);
    expect(state.pantry.beans).toBe(2);
    expect(query('.prep [role="status"]').textContent).toContain(t('prep.bought', { items: `${t('ing.beans')} ×2` }));
    expect(query<HTMLButtonElement>('[data-restock]').disabled).toBe(true);
    query<HTMLButtonElement>('[data-restock]').click();
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('lets a one-coin mixed-menu budget buy a complete espresso through preparation', () => {
    const state = createInitialState(0); state.coins = 1;
    state.items.latte = 1; state.onMenu = ['espresso', 'latte'];
    for (const id of Object.keys(state.pantry) as (keyof GameState['pantry'])[]) state.pantry[id] = 0;
    const change = vi.fn(); showPrepare(state, vi.fn(), change);
    expect(query<HTMLButtonElement>('[data-restock]').disabled).toBe(false);
    query<HTMLButtonElement>('[data-restock]').click();
    expect(state.coins).toBe(0);
    expect(state.pantry.beans).toBe(1);
    expect(state.pantry.milk).toBe(0);
    expect(query('.prep [role="status"]').textContent).toContain(t('prep.bought', { items: `${t('ing.beans')} ×1` }));
    expect(change).toHaveBeenCalledTimes(1);
  });

  it.each(['en', 'zh'] as const)('includes taste, reputation, pet and promotion forecasts in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0); state.coins = 10000;
    expect(adoptCat(state, 'ginger')).toBe(true);
    expect(bookPromotion(state, 'clipLocal')).toBe(true);
    showPrepare(state, vi.fn(), vi.fn());
    const text = query('.prep').textContent!;
    expect(text).toContain(t('prep.barOnly'));
    expect(text).toContain(t('rating.prep', { pct: '±0' }));
    expect(text).toContain(t('pet.forecast', { pct: 8 }));
    expect(text).toContain(t('promo.prep', { pct: 50, seconds: 180 }));
    expect(text).toContain(t('taste.label', { score: '4.0', tier: t('taste.tier.standard') }));
    expect(text).not.toMatch(/undefined|\{\w+\}/);
  });

  it('retains all 55 menu items and new recipe research alongside kitchen stage previews', () => {
    const state = createInitialState(0); state.kitchen = true; state.coins = 1e12;
    for (const item of MENU) state.items[item.id] = 1;
    state.taste.served.ciabatta = 100;
    const purchase = vi.fn(); const panel = panelFor(state, purchase); panel.showTab('menu');
    expect(document.querySelectorAll('[data-buy^="item:"]')).toHaveLength(55);
    query<HTMLButtonElement>('[data-taste="ciabatta"]').click();
    const before = state.coins;
    query<HTMLButtonElement>('.modal-actions .pixel-btn:not(.ghost)').click();
    expect(state.taste.signature).toContain('ciabatta');
    expect(state.coins).toBe(before - signatureCost('ciabatta'));
    expect(purchase).toHaveBeenCalledWith('recipe', 'ciabatta');
    panel.showTab('upgrades');
    const row = query('[data-buy="upgrade:cook"]').closest('.row')!;
    expect(row.textContent).toContain('Stage 1/3');
    expect(row.textContent).toContain('1 in the kitchen → 2 in the kitchen');
    query<HTMLButtonElement>('[data-amount="max"]').click();
    expect(row.textContent).toContain('1 in the kitchen → 3 in the kitchen');
  });
});

describe('merged management tabs', () => {
  it('keeps furnishing categories separate and preserves focus after changing catalogs', () => {
    const panel = panelFor(createInitialState(0)); panel.showTab('decor');
    for (const category of ['furniture', 'decoration'] as const) {
      query<HTMLButtonElement>(`[data-decor-category="${category}"]`).click();
      expect(document.activeElement).toBe(query(`[data-decor-category="${category}"]`));
      const actual = [...document.querySelectorAll<HTMLElement>('[data-furnishing]')].map((el) => el.dataset.furnishing).sort();
      expect(actual).toEqual(FURNITURE.filter((piece) => piece.category === category).map((piece) => piece.id).sort());
    }
    query<HTMLButtonElement>('[data-decor-category="renovation"]').click();
    expect(document.querySelectorAll('[data-furnishing]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-decor]').length).toBeGreaterThan(0);
  });

  it('keeps cat browsing free and allows only one creator booking, including while paused', () => {
    const state = createInitialState(0); state.coins = 10000;
    const panel = panelFor(state); panel.showTab('pets');
    query<HTMLButtonElement>('[data-choose-cat="ginger"]').click();
    expect(state.coins).toBe(10000);
    query<HTMLButtonElement>('[data-pet="ginger"] [data-adopt]').click();
    const afterAdoption = state.coins;
    query<HTMLButtonElement>('[data-pet="ginger"] [data-adopt]').click();
    expect(state.pets).toHaveLength(1);
    expect(state.coins).toBe(afterAdoption);
    panel.showTab('promotion');
    query<HTMLButtonElement>('[data-book-promo="clipLocal"]').click();
    const afterBooking = state.coins;
    query<HTMLButtonElement>('[data-promo-pause]').click();
    expect(state.promotion?.paused).toBe(true);
    expect(query<HTMLButtonElement>('[data-book-promo="noteLocal"]').disabled).toBe(true);
    query<HTMLButtonElement>('[data-book-promo="noteLocal"]').click();
    expect(state.promotion?.id).toBe('clipLocal');
    expect(state.coins).toBe(afterBooking);
  });

  it('retains independent local and remote locale keys without duplicate declarations', () => {
    for (const source of [enSource, zhSource]) {
      const declarations = [...source.matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]);
      expect(declarations.length).toBe(new Set(declarations).size);
    }
    for (const locale of ['en', 'zh'] as const) {
      const keys = Object.keys(messagesFor(locale));
      for (const key of ['save.temporary', 'upgrade.cook.stage', 'thought.customer.enjoy', 'menu.requiresKitchen', 'item.ciabatta', 'rating.prep', 'taste.rules', 'pet.intro', 'promo.intro', 'decor.category.furniture']) expect(keys).toContain(key);
    }
  });
});
