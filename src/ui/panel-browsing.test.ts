// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU } from '../game/data';
import { createInitialState, serialize } from '../game/state';
import { setLocale } from '../i18n';
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

/** happy-dom has no layout engine: emulate the reset caused by replacing a scroller's contents. */
function resetScrollOnRebuild(list: HTMLElement, scroller = list) {
  const replaceChildren = list.replaceChildren.bind(list);
  return vi.spyOn(list, 'replaceChildren').mockImplementation((...children) => {
    replaceChildren(...children);
    scroller.scrollTop = 0;
  });
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('panel browsing position', () => {
  it('keeps a deeply scrolled Furnish list intact when its active tab is selected again', () => {
    const { panel, list } = panelFor();
    panel.showTab('decor');
    list.scrollTop = 1648;
    const tile = button('[data-furniture^="buy:"]');
    const rebuild = resetScrollOnRebuild(list);
    for (let i = 0; i < 3; i++) button('[data-tab="decor"]').click();
    expect(list.scrollTop).toBe(1648);
    expect(button('[data-furniture^="buy:"]')).toBe(tile);
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('remembers each tab independently and starts unvisited tabs at the top', () => {
    const { panel, list } = panelFor();
    resetScrollOnRebuild(list);
    tabs.forEach((tab, index) => {
      panel.showTab(tab);
      expect(list.scrollTop).toBe(0);
      list.scrollTop = 120 + index * 150;
    });
    [...tabs].reverse().forEach((tab) => {
      panel.showTab(tab);
      expect(list.scrollTop).toBe(120 + tabs.indexOf(tab) * 150);
    });
  });

  it('keeps active menu-filter clicks stable but resets an explicit category change', () => {
    const { panel, list } = panelFor();
    const rebuild = resetScrollOnRebuild(list);
    list.scrollTop = 290;
    button('[data-cat="all"]').click();
    expect(list.scrollTop).toBe(290);
    expect(rebuild).not.toHaveBeenCalled();
    button('[data-cat="tea"]').click();
    expect(list.scrollTop).toBe(0);
    expect(rebuild).toHaveBeenCalledTimes(1);
    list.scrollTop = 130;
    button('[data-cat="tea"]').click();
    expect(list.scrollTop).toBe(130);
    expect(rebuild).toHaveBeenCalledTimes(1);
    panel.showTab('decor');
    panel.showTab('menu');
    expect(list.scrollTop).toBe(130);
    expect(button('[data-cat="tea"]').classList.contains('active')).toBe(true);
  });

  it('keeps repeated furnishing filters stable and focuses changed filters without scrolling', () => {
    const { panel, list } = panelFor();
    panel.showTab('decor');
    const rebuild = resetScrollOnRebuild(list);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    list.scrollTop = 1648;
    button('[data-decor-category="decoration"]').click();
    expect(list.scrollTop).toBe(1648);
    expect(rebuild).not.toHaveBeenCalled();
    button('[data-decor-category="furniture"]').click();
    expect(list.scrollTop).toBe(0);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button('[data-decor-category="furniture"]'));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    list.scrollTop = 400;
    button('[data-decor-category="furniture"]').click();
    expect(list.scrollTop).toBe(400);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it.each(['en', 'zh'] as const)('preserves scroll and the purchased control when unlocking rebuilds the %s menu', (locale) => {
    setLocale(locale);
    const state = createInitialState(0);
    state.coins = 10000;
    const purchased = vi.fn();
    const { list } = panelFor(state, purchased);
    const original = button('[data-buy="item:americano"]');
    original.focus();
    list.scrollTop = 238;
    const rebuild = resetScrollOnRebuild(list);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    original.click();
    const replacement = button('[data-buy="item:americano"]');
    expect(state.items.americano).toBe(1);
    expect(purchased).toHaveBeenCalledWith('item', 'americano');
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(replacement).not.toBe(original);
    expect(document.activeElement).toBe(replacement);
    expect(list.scrollTop).toBe(238);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(button('[data-buy="item:latte"]')).not.toBeNull();
  });

  it('preserves a surviving pantry control when a recipe adds ingredients', () => {
    const { panel, list, state } = panelFor();
    state.coins = 10000;
    panel.showTab('pantry');
    button('[data-buy="ing:beans"]').focus();
    list.scrollTop = 172;
    resetScrollOnRebuild(list);
    state.items.latte = 1;
    state.onMenu.push('latte');
    panel.update();
    expect(button('[data-buy="ing:milk"]')).not.toBeNull();
    expect(document.activeElement).toBe(button('[data-buy="ing:beans"]'));
    expect(list.scrollTop).toBe(172);
  });

  it('leaves ordinary purchases, quantities and updates on the same DOM and scroll position', () => {
    const state = createInitialState(0);
    state.coins = 10000;
    const { panel, list } = panelFor(state);
    panel.showTab('pantry');
    const beans = button('[data-buy="ing:beans"]');
    beans.focus();
    list.scrollTop = 220;
    const rebuild = resetScrollOnRebuild(list);
    const previousStock = state.pantry.beans;
    beans.click();
    button('[data-pantry-amount="50"]').click();
    beans.click();
    for (let i = 0; i < 5; i++) panel.update();
    expect(state.pantry.beans).toBe(previousStock + 60);
    expect(rebuild).not.toHaveBeenCalled();
    expect(button('[data-buy="ing:beans"]')).toBe(beans);
    expect(document.activeElement).toBe(beans);
    expect(list.scrollTop).toBe(220);
  });

  it('restores the matching action after a locale refresh without changing game data', () => {
    const { panel, list, state } = panelFor();
    state.coins = 10000;
    panel.showTab('upgrades');
    button('[data-buy="upgrade:machine"]').focus();
    list.scrollTop = 335;
    resetScrollOnRebuild(list);
    const before = serialize(state);
    setLocale('zh');
    panel.refresh();
    expect(document.activeElement).toBe(button('[data-buy="upgrade:machine"]'));
    expect(list.scrollTop).toBe(335);
    expect(serialize(state)).toBe(before);
  });

  it('uses the active tab as a reachable fallback when the purchased control becomes disabled', () => {
    const state = createInitialState(0);
    state.coins = 40;
    const { list } = panelFor(state);
    const unlock = button('[data-buy="item:americano"]');
    unlock.focus();
    list.scrollTop = 238;
    resetScrollOnRebuild(list);
    unlock.click();
    expect(button('[data-buy="item:americano"]').disabled).toBe(true);
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
    expect(list.scrollTop).toBe(238);
  });

  it('does not focus a hidden or removed action after replacing game state', () => {
    const state = createInitialState(0);
    state.coins = 10000;
    for (const item of MENU) state.items[item.id] = 1;
    const { panel, list } = panelFor(state);
    button('[data-menu="americano"]').focus();
    list.scrollTop = 278;
    resetScrollOnRebuild(list);
    panel.setState(createInitialState(1));
    expect(button('[data-menu="americano"]').hidden).toBe(true);
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
    expect(list.scrollTop).toBe(278);
    panel.setState(state);
    button('[data-buy="item:latte"]').focus();
    panel.setState(createInitialState(2));
    expect(document.querySelector('[data-buy="item:latte"]')).toBeNull();
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
  });

  it('keeps guide navigation and explicit goal focus in control after returning to a scrolled tab', () => {
    const { panel, list, state } = panelFor();
    panel.showTab('pantry');
    list.scrollTop = 175;
    panel.showTab('decor');
    list.scrollTop = 1648;
    button('[data-tab="decor"]').focus();
    panel.setIntroMode(true);
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
    button('#guide').focus();
    panel.showTab('pantry');
    expect(list.scrollTop).toBe(175);
    expect(document.activeElement).toBe(button('#guide'));
    panel.showTab('decor');
    expect(list.scrollTop).toBe(1648);
    expect(query('#panel').classList.contains('intro-mode')).toBe(false);
    expect(document.activeElement).toBe(button('#guide'));
    state.day = 2;
    panel.update();
    const goal = button('[data-claim]');
    expect(goal).not.toBeNull();
    goal.focus();
    panel.showTab('upgrades');
    expect(document.activeElement).toBe(goal);
  });
});


describe('mobile panel scroll wrapper', () => {
  function mobilePanel(state = createInitialState(0)) {
    const fixture = panelFor(state);
    query('#panel').classList.add('mobile-panel');
    return { ...fixture, scroller: query('.panel-scroll') };
  }

  it('preserves wrapper positions through repeated tabs and returning to previous tabs', () => {
    const { panel, list, scroller } = mobilePanel();
    resetScrollOnRebuild(list, scroller);
    scroller.scrollTop = 330;
    panel.showTab('decor');
    expect(scroller.scrollTop).toBe(0);
    scroller.scrollTop = 1648;
    button('[data-tab="decor"]').click();
    expect(scroller.scrollTop).toBe(1648);
    panel.showTab('menu');
    expect(scroller.scrollTop).toBe(330);
    panel.showTab('decor');
    expect(scroller.scrollTop).toBe(1648);
    expect(list.scrollTop).toBe(0);
  });

  it('restores a surviving unlock action and wrapper scroll after rebuild', () => {
    const state = createInitialState(0);
    state.coins = 10000;
    const { list, scroller } = mobilePanel(state);
    const unlock = button('[data-buy="item:americano"]');
    unlock.focus();
    scroller.scrollTop = 338;
    resetScrollOnRebuild(list, scroller);
    unlock.click();
    expect(button('[data-buy="item:americano"]')).not.toBe(unlock);
    expect(document.activeElement).toBe(button('[data-buy="item:americano"]'));
    expect(scroller.scrollTop).toBe(338);
    expect(list.scrollTop).toBe(0);
  });

  it('resets only changed filters and keeps refreshes on the wrapper scroll owner', () => {
    const { panel, list, scroller } = mobilePanel();
    resetScrollOnRebuild(list, scroller);
    scroller.scrollTop = 330;
    button('[data-cat="all"]').click();
    expect(scroller.scrollTop).toBe(330);
    button('[data-cat="tea"]').click();
    expect(scroller.scrollTop).toBe(0);
    panel.showTab('decor');
    scroller.scrollTop = 1648;
    button('[data-decor-category="decoration"]').click();
    expect(scroller.scrollTop).toBe(1648);
    button('[data-decor-category="furniture"]').click();
    expect(scroller.scrollTop).toBe(0);
    scroller.scrollTop = 440;
    panel.refresh();
    expect(scroller.scrollTop).toBe(440);
    expect(list.scrollTop).toBe(0);
  });

  it('continues using the list on desktop even when a wrapper is present', () => {
    const { panel, list } = panelFor();
    const wrapper = query('.panel-scroll');
    list.scrollTop = 260;
    wrapper.scrollTop = 90;
    panel.showTab('decor');
    expect(list.scrollTop).toBe(0);
    expect(wrapper.scrollTop).toBe(90);
    panel.showTab('menu');
    expect(list.scrollTop).toBe(260);
    expect(wrapper.scrollTop).toBe(90);
  });
});


describe('panel accessible selected state', () => {
  function expectPressed(attribute: string, selected: string) {
    for (const control of document.querySelectorAll<HTMLButtonElement>(`button[${attribute}]`)) {
      const active = control.getAttribute(attribute) === selected;
      expect(control.getAttribute('aria-pressed')).toBe(String(active));
      expect(control.classList.contains('active')).toBe(active);
    }
  }

  it('initializes Menu selection and quantity/filter state before the first showTab call', () => {
    const { list } = panelFor(createInitialState(0), vi.fn(), false);
    // Constructor sets controls only; the caller still owns the first list render.
    expect(list.children).toHaveLength(0);
    for (const tab of tabs) {
      const control = button(`[data-tab="${tab}"]`);
      expect(control.getAttribute('aria-selected')).toBe(String(tab === 'menu'));
      expect(control.classList.contains('active')).toBe(tab === 'menu');
    }
    expectPressed('data-amount', '1');
    expectPressed('data-pantry-amount', '10');
    expectPressed('data-cat', 'all');
    expect(query('.pantry-amount').hidden).toBe(true);
  });

  it('keeps aria-pressed and visual states synchronized after repeated quantity/filter clicks', () => {
    const { panel, list } = panelFor();
    for (const amount of ['10', 'max', 'max', '1']) {
      list.scrollTop = 240;
      button(`[data-amount="${amount}"]`).click();
      expectPressed('data-amount', amount);
      expect(list.scrollTop).toBe(240);
    }
    panel.showTab('pantry');
    for (const amount of ['50', '50', '10']) {
      list.scrollTop = 160;
      button(`[data-pantry-amount="${amount}"]`).click();
      expectPressed('data-pantry-amount', amount);
      expect(list.scrollTop).toBe(160);
    }
    panel.showTab('menu');
    for (const category of ['coffee', 'tea', 'tea', 'all']) {
      button(`[data-cat="${category}"]`).click();
      expectPressed('data-cat', category);
    }
  });

  it('retains full-view selections when intro mode hides controls and direct navigation reveals them', () => {
    const { panel } = panelFor();
    button('[data-amount="max"]').click();
    button('[data-cat="tea"]').click();
    panel.showTab('pantry');
    button('[data-pantry-amount="50"]').click();
    panel.setIntroMode(true);
    expectPressed('data-amount', 'max');
    expectPressed('data-pantry-amount', '50');
    expectPressed('data-cat', 'tea');
    panel.showTab('upgrades');
    expectPressed('data-amount', 'max');
    expect(button('[data-tab="upgrades"]').getAttribute('aria-selected')).toBe('true');
    expect(button('[data-tab="pantry"]').getAttribute('aria-selected')).toBe('false');
    panel.showTab('menu');
    expectPressed('data-cat', 'tea');
  });
});

describe('catalog-relative positions across responsive scroll owners', () => {
  function responsivePanel() {
    const fixture = panelFor();
    const root = query('#panel'); const wrapper = query('.panel-scroll');
    let prefix = 212.59375;
    vi.mocked(fixture.list.getBoundingClientRect).mockImplementation(() => ({
      top: root.classList.contains('mobile-panel') ? prefix - wrapper.scrollTop : 0,
    }) as DOMRect);
    return { ...fixture, root, wrapper, setPrefix: (value: number) => { prefix = value; } };
  }

  it('restores an inactive desktop Menu at its list-relative position on mobile', () => {
    const { panel, list, root, wrapper } = responsivePanel();
    list.scrollTop = 757;
    panel.showTab('decor');
    root.classList.add('mobile-panel');
    panel.showTab('menu');
    expect(wrapper.scrollTop).toBe(969.59375);
    expect(wrapper.scrollTop - 212.59375).toBe(757);
  });

  it('restores an inactive mobile Menu on desktop without its former header prefix', () => {
    const { panel, list, root, wrapper } = responsivePanel();
    root.classList.add('mobile-panel'); wrapper.scrollTop = 969.59375;
    panel.showTab('decor');
    root.classList.remove('mobile-panel');
    panel.showTab('menu');
    expect(list.scrollTop).toBe(757);
  });

  it('uses the current header geometry after an inactive tab crosses widths repeatedly', () => {
    const { panel, list, root, wrapper, setPrefix } = responsivePanel();
    list.scrollTop = 757; panel.showTab('decor');
    root.classList.add('mobile-panel'); setPrefix(240);
    panel.showTab('menu'); expect(wrapper.scrollTop).toBe(997);
    panel.showTab('decor'); setPrefix(190);
    panel.showTab('menu'); expect(wrapper.scrollTop).toBe(947);
    panel.showTab('decor'); root.classList.remove('mobile-panel');
    panel.showTab('menu'); expect(list.scrollTop).toBe(757);
  });

  it('retains the actually clamped catalog position after rebuilding and returning', () => {
    const { panel, list, root, wrapper } = responsivePanel();
    list.scrollTop = 757; panel.showTab('decor'); root.classList.add('mobile-panel');
    let top = 0;
    Object.defineProperty(wrapper, 'scrollTop', { configurable: true, get: () => top,
      set: (value: number) => { top = Math.min(600, Math.max(0, value)); } });
    panel.showTab('menu'); expect(wrapper.scrollTop).toBe(600);
    resetScrollOnRebuild(list, wrapper); panel.refresh(); expect(wrapper.scrollTop).toBe(600);
    panel.showTab('decor'); root.classList.remove('mobile-panel'); panel.showTab('menu');
    expect(list.scrollTop).toBe(387.40625);
  });

  it('preserves a header-visible mobile position without a negative desktop scroll', () => {
    const { panel, list, root, wrapper } = responsivePanel();
    root.classList.add('mobile-panel'); wrapper.scrollTop = 40;
    panel.showTab('decor'); panel.showTab('menu'); expect(wrapper.scrollTop).toBe(40);
    panel.showTab('decor'); root.classList.remove('mobile-panel'); panel.showTab('menu');
    expect(list.scrollTop).toBe(0);
  });
});
