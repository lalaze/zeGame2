// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createInitialState, serialize } from '../game/state';
import { setCafeStyle } from '../game/styles';
import { setLocale, t } from '../i18n';
import { Panel } from './panel';

vi.mock('../render/sprites', () => ({
  itemArtwork: () => document.createElement('canvas'), ingredientIcon: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));
afterEach(() => { setLocale('en'); document.body.replaceChildren(); });

const note = () => document.querySelector('.menu-style-prices');
it.each(['en', 'zh'] as const)('explains focused menu prices in %s without changing prices or stock', locale => {
  setLocale(locale);
  document.body.innerHTML = '<section id="panel"><button data-tab="menu"></button><button data-tab="upgrades"></button><div class="buy-amount"></div><div class="pantry-amount"></div><div class="menu-filter"></div><div id="list"></div><div id="goal"></div></section>';
  const state = createInitialState(0);
  const panel = new Panel(document.getElementById('panel')!, document.getElementById('list')!, document.getElementById('goal')!, state, vi.fn(), vi.fn());
  panel.showTab('menu');
  const priceLine = () => document.querySelector('[data-buy="item:espresso"]')!.closest('.row')!.querySelector('.sub')!.textContent!.split(' · ');
  const price = priceLine()[0]; const upgradePrice = priceLine().at(-1);
  expect(note()).toBeNull();
  setCafeStyle(state, 'coffee'); const saved = serialize(state);
  panel.update();
  expect(note()!.textContent).toBe(t('style.menu.prices'));
  expect(priceLine()[0]).toBe(price); expect(priceLine().at(-1)).toBe(upgradePrice);
  expect(serialize(state)).toBe(saved);
  panel.setIntroMode(true); expect(note()!.textContent).toBe(t('style.menu.prices'));
  panel.showTab('upgrades'); expect(note()).toBeNull();
  panel.showTab('menu'); expect(note()).not.toBeNull();
  setCafeStyle(state, null); panel.update(); expect(note()).toBeNull();
});
