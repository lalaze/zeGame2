// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_SECONDS, INGREDIENTS, MENU } from '../game/data';
import { arrivalCap, arrivalRate, isTrafficCapped, trafficDemand } from '../game/economy';
import { createInitialState, type GameState } from '../game/state';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));

function mountPanel(state: GameState): Panel {
  document.body.innerHTML = `
    <section id="panel">
      <button data-tab="upgrades"></button>
      <button data-tab="promotion"></button>
      <div class="buy-amount"><button data-amount="1"></button></div>
      <div class="pantry-amount"></div><div class="menu-filter"></div>
      <div id="list"></div><div id="goal"></div>
    </section>`;
  return new Panel(
    document.getElementById('panel')!,
    document.getElementById('list')!,
    document.getElementById('goal')!,
    state,
    vi.fn(),
    vi.fn(),
  );
}

function cappedState(): GameState {
  const s = createInitialState(0);
  s.coins = 1e9;
  s.upgrades.marketing = 20;
  s.upgrades.barista = 3;
  s.upgrades.server = 5;
  s.upgrades.machine = 14;
  s.upgrades.tables = 6;
  s.regions = ['reading', 'greenhouse', 'terrace'];
  const drinks = MENU.filter((m) => m.category === 'coffee').slice(0, 6);
  for (const m of drinks) s.items[m.id] = 10;
  s.onMenu = drinks.map((m) => m.id);
  for (const i of INGREDIENTS) s.pantry[i.id] = 1000;
  return s;
}

beforeEach(() => setLocale('zh'));
afterEach(() => {
  setLocale('en');
  document.body.replaceChildren();
});

describe('traffic cap notice in upgrades and promotion panels (A5)', () => {
  it.each([
    { locale: 'zh' as const, needle: '客流已满' },
    { locale: 'en' as const, needle: 'traffic capped' },
  ])('shows the cap hint when demand >= cap and hides it below cap ($locale)', ({ locale, needle }) => {
    setLocale(locale);

    // Below cap: starter café.
    const uncapped = createInitialState(0);
    expect(trafficDemand(uncapped)).toBeLessThan(arrivalCap(uncapped));
    expect(isTrafficCapped(uncapped)).toBe(false);

    const p1 = mountPanel(uncapped);
    p1.showTab('upgrades');
    const mktUncapped = document.querySelector('[data-buy="upgrade:marketing"]')!.closest<HTMLElement>('.row')!;
    const d1 = mktUncapped.querySelector<HTMLDetailsElement>('.urow-details')!;
    d1.open = true; d1.dispatchEvent(new Event('toggle'));
    expect(mktUncapped.textContent!.toLowerCase()).not.toContain(needle);

    p1.showTab('promotion');
    expect(document.getElementById('list')!.textContent!.toLowerCase()).not.toContain(needle);
    expect(document.querySelector<HTMLElement>('.promo-capped-badge')!.hidden).toBe(true);

    // At/above cap: late-game café.
    const capped = cappedState();
    expect(trafficDemand(capped)).toBeGreaterThanOrEqual(arrivalCap(capped));
    expect(isTrafficCapped(capped)).toBe(true);

    const p2 = mountPanel(capped);
    p2.showTab('upgrades');
    const mktCapped = document.querySelector('[data-buy="upgrade:marketing"]')!.closest<HTMLElement>('.row')!;
    const d2 = mktCapped.querySelector<HTMLDetailsElement>('.urow-details')!;
    d2.open = true; d2.dispatchEvent(new Event('toggle'));
    expect(mktCapped.textContent!.toLowerCase()).toContain(needle);
    expect(mktCapped.querySelector('.sub')!.textContent).not.toContain('→');

    p2.showTab('promotion');
    const promoText = document.getElementById('list')!.textContent!;
    expect(document.querySelector<HTMLElement>('.promo-capped-badge')!.hidden).toBe(false);
    expect(promoText.toLowerCase()).toContain(needle);
    expect(promoText).toContain(t('promo.capped'));
    const cappedDaily = Math.round(arrivalRate(capped) * DAY_SECONDS);
    expect(promoText).toContain(t('promo.estimate', { before: cappedDaily, after: cappedDaily }));
  });

  it('does not show traffic capped when the menu is empty', () => {
    setLocale('zh');
    const s = cappedState();
    s.onMenu = [];
    const p = mountPanel(s);
    p.showTab('upgrades');
    const mkt = document.querySelector('[data-buy="upgrade:marketing"]')!.closest<HTMLElement>('.row')!;
    const d = mkt.querySelector<HTMLDetailsElement>('.urow-details')!;
    d.open = true; d.dispatchEvent(new Event('toggle'));
    expect(document.getElementById('list')!.textContent).not.toContain('客流已满');
    p.showTab('promotion');
    expect(document.querySelector<HTMLElement>('.promo-capped-badge')!.hidden).toBe(true);
    expect(document.getElementById('list')!.textContent).not.toContain('客流已满');
  });
});
