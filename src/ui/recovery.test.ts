// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GOALS } from '../game/goals';
import { createInitialState } from '../game/state';
import { setLocale, t } from '../i18n';
import { closeModal } from './modal';
import { showPrepare } from './prepare';
vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));
function stranded() {
  const s = createInitialState(0); s.goal = GOALS.length; s.coins = 0; s.pantry.beans = 0; s.onMenu = [];
  return s;
}
beforeEach(() => { document.body.innerHTML = '<div id="modal-root"></div>'; setLocale('en'); });
afterEach(() => { closeModal(); setLocale('en'); });
for (const locale of ['en', 'zh'] as const) it(`offers one bean and enables espresso once in ${locale}`, () => {
  setLocale(locale); const s = stranded(); const change = vi.fn(); showPrepare(s, vi.fn(), change);
  const button = document.querySelector<HTMLButtonElement>('[data-emergency-restock]')!;
  expect(button.textContent).toBe(t('prep.emergency'));
  expect(document.querySelector<HTMLButtonElement>('[data-start]')!.disabled).toBe(true);
  button.focus(); button.click();
  expect(document.activeElement?.getAttribute('data-dish')).toBe('espresso');
  expect(s.pantry.beans).toBe(1); expect(s.coins).toBe(0); expect(s.onMenu).toContain('espresso');
  expect(document.querySelector('[data-emergency-restock]')).toBeNull();
  expect(document.querySelector<HTMLButtonElement>('[data-start]')!.disabled).toBe(false);
  expect(document.querySelector('[role="status"]')!.textContent).toBe(t('prep.emergencyReceived'));
  button.click(); expect(s.pantry.beans).toBe(1); expect(change).toHaveBeenCalledTimes(1);
  closeModal(); showPrepare(s, vi.fn(), vi.fn()); expect(document.querySelector('[data-emergency-restock]')).toBeNull();
});
it('hides emergency stock when a normal bean or reward is available', () => {
  for (const option of ['bean', 'cash', 'reward', 'future-day-reward']) {
    const s = stranded();
    if (option === 'bean') s.pantry.beans = 1;
    if (option === 'cash') s.coins = 1;
    if (option === 'reward') { s.goal = 0; s.day = 2; }
    if (option === 'future-day-reward') s.goal = 0;
    showPrepare(s, vi.fn(), vi.fn()); expect(document.querySelector('[data-emergency-restock]')).toBeNull(); closeModal();
  }
});
it('rechecks eligibility if stock changes after the button renders', () => {
  const s = stranded(); showPrepare(s, vi.fn(), vi.fn()); const button = document.querySelector<HTMLButtonElement>('[data-emergency-restock]')!;
  s.coins = 1; button.click(); expect(s.pantry.beans).toBe(0); expect(s.onMenu).toEqual([]);
  expect(document.querySelector('[data-emergency-restock]')).toBeNull();
  expect(document.querySelector('[role="status"]')!.textContent).toBe(t('prep.emergencyUnavailable'));
});
it('offers aid when owned wall art cannot jointly fit enough comfort for the reward', () => {
  const s = stranded(); s.goal = GOALS.findIndex((g) => g.id === 'comfort');
  s.decor.stored.art_cat = 1; s.decor.stored.art_landscape = 1; s.decor.stored.poster_bakery = 1;
  const before = structuredClone(s.decor);
  showPrepare(s, vi.fn(), vi.fn());
  const button = document.querySelector<HTMLButtonElement>('[data-emergency-restock]');
  expect(button).not.toBeNull(); button!.click();
  expect(s.pantry.beans).toBe(1); expect(s.decor).toEqual(before);
});
