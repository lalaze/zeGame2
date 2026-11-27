// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adoptCat } from '../game/pets';
import { createInitialState } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';
import type { LivingCatControls } from './living-cats';

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

function mountPanel(state = createInitialState(0), living: LivingCatControls = {}) {
  document.body.innerHTML = `<section id="panel">
    <nav role="tablist">${tabs.map((tab) => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="panel-scroll"><div class="buy-amount"><span>Buy</span><button data-amount="1" class="active">×1</button><button data-amount="10">×10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount" hidden><button data-pantry-amount="10" class="active">10</button></div>
    <div class="menu-filter"><button data-cat="all" class="active">All</button></div>
    <div id="list"></div><div id="goal"></div></div>
  </section>`;
  return new Panel(
    document.getElementById('panel')!,
    document.getElementById('list')!,
    document.getElementById('goal')!,
    state,
    vi.fn(),
    vi.fn(),
    living,
  );
}

beforeEach(() => setLocale('zh'));
afterEach(() => {
  setLocale('en');
  document.body.replaceChildren();
});

describe('Direction A Stage 3 ledger tabs', () => {
  it('renders upgrades in three ordered groups: staff, shop (with streets entry), and operations', () => {
    const panel = mountPanel();
    panel.showTab('upgrades');
    const items = [...document.querySelectorAll<HTMLElement>('#list [data-upgrade-group], #list [data-upgrade], #list [data-room-projects], #list [data-ops-tile]')];
    const order = items.map((el) =>
      el.dataset.upgradeGroup ? `group:${el.dataset.upgradeGroup}`
        : el.dataset.upgrade ? `upgrade:${el.dataset.upgrade}`
          : el.dataset.opsTile ? `ops:${el.dataset.opsTile}`
            : 'room-projects',
    );
    expect(order).toEqual([
      'group:staff', 'upgrade:barista', 'upgrade:server', 'upgrade:cook',
      'group:shop', 'upgrade:marketing', 'upgrade:machine', 'upgrade:tables', 'upgrade:pass', 'room-projects',
      'group:ops', 'ops:manager', 'ops:orders', 'ops:chain',
    ]);
  });

  it('starts with operations tiles collapsed, then expands, switches, and collapses on repeat click', () => {
    const state = createInitialState(0);
    state.day = 5;
    state.coins = 5000;
    const panel = mountPanel(state);
    panel.showTab('upgrades');
    const detail = document.querySelector<HTMLElement>('.ops-detail')!;
    const managerTile = document.querySelector<HTMLButtonElement>('[data-ops-tile="manager"]')!;
    const ordersTile = document.querySelector<HTMLButtonElement>('[data-ops-tile="orders"]')!;
    const chainTile = document.querySelector<HTMLButtonElement>('[data-ops-tile="chain"]')!;
    expect(detail.hidden).toBe(true);
    expect(managerTile.getAttribute('aria-expanded')).toBe('false');

    managerTile.click();
    expect(detail.hidden).toBe(false);
    expect(detail.querySelector<HTMLElement>('.manager-card:not(.orders-card):not(.chain-card)')!.hidden).toBe(false);
    expect(detail.querySelector<HTMLElement>('.orders-card')!.hidden).toBe(true);
    expect(managerTile.getAttribute('aria-expanded')).toBe('true');

    ordersTile.click();
    expect(detail.hidden).toBe(false);
    expect(detail.querySelector<HTMLElement>('.manager-card:not(.orders-card):not(.chain-card)')!.hidden).toBe(true);
    expect(detail.querySelector<HTMLElement>('.orders-card')!.hidden).toBe(false);
    expect(ordersTile.getAttribute('aria-expanded')).toBe('true');
    expect(managerTile.getAttribute('aria-expanded')).toBe('false');

    chainTile.click();
    expect(detail.querySelector<HTMLElement>('.chain-card')!.hidden).toBe(false);
    expect(detail.querySelector<HTMLElement>('.orders-card')!.hidden).toBe(true);

    chainTile.click();
    expect(detail.hidden).toBe(true);
    expect(chainTile.getAttribute('aria-expanded')).toBe('false');
  });

  it('scrolls the panel an operations tile opens into view, and leaves the page alone when it shuts', () => {
    const panel = mountPanel();
    panel.showTab('upgrades');
    const detail = document.querySelector<HTMLElement>('.ops-detail')!;
    const scrolled = vi.spyOn(detail, 'scrollIntoView');
    const managerTile = document.querySelector<HTMLButtonElement>('[data-ops-tile="manager"]')!;

    managerTile.click();
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });

    managerTile.click();
    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it('shows comfort and tip percentage on Decor with no next-tier hint or progress bar', () => {
    const panel = mountPanel();
    panel.showTab('decor');
    const comfortCard = document.querySelector<HTMLElement>('.decor-comfort')!;
    expect(comfortCard.querySelector('.comfort-val')!.textContent).toMatch(/^\d+$/);
    expect(comfortCard.querySelector('.comfort-tip')!.textContent).toMatch(/^\+\d+%$/);
    expect(comfortCard.querySelector('progress')).toBeNull();
    expect(comfortCard.querySelector('.bar')).toBeNull();
    expect(comfortCard.textContent).not.toContain('下一档');
    expect(comfortCard.textContent).not.toContain('升到');
    expect(comfortCard.textContent).not.toMatch(/next tier/i);
  });

  it('shows Adopt for unowned cats and In café · Find for adopted cats with actor-aware locate', () => {
    const state = createInitialState(0);
    state.coins = 50000;
    adoptCat(state, 'ginger');
    const locate = vi.fn();
    let hasActor = true;
    const panel = mountPanel(state, {
      getActor: (id) => hasActor && id === 'ginger' ? { area: 'main', behavior: 'sleep', affection: 0 } : undefined,
      locate,
    });
    panel.showTab('pets');

    const unownedAdopt = document.querySelector<HTMLButtonElement>('[data-pet="tuxedo"] [data-adopt]')!;
    const unownedHome = document.querySelector<HTMLButtonElement>('[data-pet="tuxedo"] [data-home-locate="tuxedo"]')!;
    expect(unownedAdopt.hidden).toBe(false);
    expect(unownedHome.hidden).toBe(true);

    const ownedAdopt = document.querySelector<HTMLButtonElement>('[data-pet="ginger"] [data-adopt]')!;
    const ownedHome = document.querySelector<HTMLButtonElement>('[data-pet="ginger"] [data-home-locate="ginger"]')!;
    expect(ownedAdopt.hidden).toBe(true);
    expect(ownedHome.hidden).toBe(false);
    expect(ownedHome.textContent).toBe(t('pet.inShop'));
    expect(ownedHome.disabled).toBe(false);
    ownedHome.click();
    expect(locate).toHaveBeenCalledWith('ginger');

    hasActor = false;
    panel.update();
    expect(ownedHome.disabled).toBe(true);
  });

  it('gives the Menu on-sale checkmark button at least a 40x40 touch target while keeping a 26x26 circle', () => {
    const css = readFileSync('src/ui/floors-ui.css', 'utf8');
    const hitRule = css.match(/\.menu-toggle:not\(\[hidden\]\)\s*\{([^}]+)\}/);
    expect(hitRule).not.toBeNull();
    expect(hitRule![1]).toMatch(/width:\s*40px/);
    expect(hitRule![1]).toMatch(/height:\s*40px/);
    expect(hitRule![1]).toMatch(/min-width:\s*40px/);
    expect(hitRule![1]).toMatch(/min-height:\s*40px/);
    const visualCircle = css.match(/\.menu-toggle::after\s*\{([^}]+)\}/);
    expect(visualCircle).not.toBeNull();
    expect(visualCircle![1]).toMatch(/inset:\s*7px/);
  });
});
