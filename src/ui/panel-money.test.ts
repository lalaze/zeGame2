// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, serialize } from '../game/state';
import { setLocale } from '../i18n';
import { closeModal } from './modal';
import { quoteItem } from '../game/economy';
import { formatTransactionMoney } from '../game/format';
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
const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const button = (selector: string) => query<HTMLButtonElement>(selector);

function panelFor(state = createInitialState(0), onPurchase = vi.fn(), render = true) {
  document.body.innerHTML = `<button id="guide">Guide action</button><section id="panel">
    <nav role="tablist">${tabs.map((tab) => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="panel-scroll"><div class="buy-amount"><button data-amount="1" class="active">1</button><button data-amount="10">10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount" hidden><button data-pantry-amount="10" class="active">10</button><button data-pantry-amount="50">50</button></div>
    <div class="menu-filter"><button data-cat="all" class="active">All</button><button data-cat="coffee">Coffee</button><button data-cat="tea">Tea</button></div>
    <div id="list"></div><div id="goal"></div></div>
  </section>`;
  const list = query('#list');
  // Model the wrapper's scrolling geometry; happy-dom itself has no layout.
  vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({
    top: query('#panel').classList.contains('mobile-panel') ? -query('.panel-scroll').scrollTop : 0,
  }) as DOMRect);
  const panel = new Panel(query('#panel'), list, query('#goal'), state, onPurchase, vi.fn());
  if (render) panel.showTab('menu');
  return { panel, list, state };
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  closeModal();
  setLocale('en');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('purchase amount presentation', () => {
  it.each(['en', 'zh'] as const)('shows exact first price and post-purchase balance in %s', (locale) => {
    setLocale(locale);
    const state = createInitialState(0); state.coins = 66;
    const { panel } = panelFor(state);
    const buy = button('[data-buy="item:espresso"]');
    expect(buy.querySelector('.cost')!.textContent).toBe('$8.96');
    buy.click();
    expect(state.coins).toBe(57.04);
    expect(state.items.espresso).toBe(2);
    expect(buy.querySelector('.cost')!.textContent).toBe(formatTransactionMoney(quoteItem(state, 'espresso', 1).cost));
    panel.refresh();
    expect(state.coins).toBe(57.04);
  });

  it('offers exact details and a shortfall when a rounded price would appear affordable', () => {
    const state = createInitialState(0); state.items.espresso = 2; state.coins = 10.03;
    const { panel } = panelFor(state);
    document.body.insertAdjacentHTML('beforeend', '<div id="modal-root"></div>');
    const buy = button('[data-buy="item:espresso"]');
    const cost = quoteItem(state, 'espresso', 1).cost;
    const details = button('[data-price-details="item:espresso"]');
    expect(buy.disabled).toBe(true);
    expect(buy.querySelector('.cost')!.textContent).toBe(formatTransactionMoney(cost));
    expect(details.disabled).toBe(false);
    expect(details.textContent).toContain('Need');
    details.focus(); details.click();
    expect(query('[role="dialog"]').textContent).toContain('$' + String(cost));
    expect(query('[role="dialog"]').textContent).toContain('$' + String(cost - state.coins));
    closeModal();
    expect(document.activeElement).toBe(details);
    buy.click(); expect(state.coins).toBe(10.03);
    state.coins = cost; panel.update();
    expect(buy.disabled).toBe(false);
    expect(details.textContent).toBe('Amounts');
    buy.click(); expect(state.coins).toBe(0);
  });

  it('updates details for bulk, Max, upgrades and pantry without altering economy state', () => {
    const state = createInitialState(0); state.coins = 500;
    const { panel } = panelFor(state);
    document.body.insertAdjacentHTML('beforeend', '<div id="modal-root"></div>');
    const before = serialize(state);
    for (const amount of ['10', 'max']) {
      button(`[data-amount="${amount}"]`).click();
      const quote = quoteItem(state, 'espresso', amount === 'max' ? 'max' : 10);
      button('[data-price-details="item:espresso"]').click();
      expect(query('[role="dialog"]').textContent).toContain('$' + String(quote.cost));
      closeModal();
    }
    panel.showTab('upgrades');
    expect(button('[data-price-details="upgrade:marketing"]').textContent).toBeTruthy();
    panel.showTab('pantry');
    expect(button('[data-price-details="ing:beans"]').textContent).toBeTruthy();
    expect(serialize(state)).toBe(before);
  });

  it('quotes Max at activation time when a sale arrives between display refreshes', () => {
    const state = createInitialState(0); state.coins = 10;
    panelFor(state);
    document.body.insertAdjacentHTML('beforeend', '<div id="modal-root"></div>');
    button('[data-amount="max"]').click();
    const oldCost = quoteItem(state, 'espresso', 'max').cost;
    state.coins = 100;
    const liveCost = quoteItem(state, 'espresso', 'max').cost;
    expect(liveCost).not.toBe(oldCost);
    button('[data-price-details="item:espresso"]').click();
    expect(query('[role="dialog"]').textContent).toContain('Price: $' + String(liveCost));
    expect(query('[role="dialog"]').textContent).toContain('Balance: $100');
  });
});
