// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOnMenu } from '../game/economy';
import { createInitialState } from '../game/state';
import { formatNumber } from '../game/format';
import { setLocale, t } from '../i18n';
import { closeModal } from './modal';
import { ingredientName } from './panel';
import { showPrepare } from './prepare';

vi.mock('../render/sprites', () => ({
  itemArtwork: () => document.createElement('canvas'),
  toDataURL: () => 'data:image/png;base64,',
}));

const start = () => document.querySelector<HTMLButtonElement>('[data-start]')!;
const details = () => document.querySelector<HTMLDetailsElement>('.prep-details')!;
const espresso = () => document.querySelector<HTMLInputElement>('[data-dish="espresso"]')!;

beforeEach(() => {
  document.body.innerHTML = '<div id="modal-root"></div>';
  setLocale('en');
});
afterEach(() => {
  closeModal();
  setLocale('en');
  document.body.replaceChildren();
});

describe.each(['en', 'zh'] as const)('preparation guidance in %s', (locale) => {
  beforeEach(() => setLocale(locale));

  it('explains the free starting stock and per-drink ingredients without changing the save', () => {
    const state = createInitialState(0);
    const before = structuredClone(state);
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep')!.textContent).toContain(t('prep.menuHint'));
    expect(document.querySelector('.prep-starter')!.textContent).toBe(t('prep.starterStock', { n: formatNumber(50) }));
    expect(document.querySelector('.prep-recipe')!.textContent).toBe(t('prep.drinkIngredients', { items: `${ingredientName('beans')} ×1` }));
    expect(espresso().checked).toBe(true);
    expect(start().disabled).toBe(false);
    expect(document.querySelector('[data-bake]')).toBeNull();
    expect(document.querySelector('[data-forecast]')).toBeNull();
    expect(document.querySelector('.prep-bakery-hint')).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-restock]')!.disabled).toBe(true);
    expect(state).toEqual(before);
  });

  it('keeps the forecast and reputation optional and explains that opening has no timer', () => {
    showPrepare(createInitialState(0), vi.fn(), vi.fn());
    expect(details().open).toBe(false);
    expect(details().querySelector('summary')!.textContent).toBe(t('prep.details'));
    expect(details().textContent).toContain(t('prep.forecastHint'));
    expect(details().textContent).toContain(t('prep.sharedIngredients'));
    expect(details().textContent).toContain(t('rating.prep', { pct: '±0' }));
    expect(details().contains(document.activeElement)).toBe(false);
  });

  it('explains an empty menu, preserves checkbox focus, and recovers after selecting again', () => {
    const state = createInitialState(0);
    const change = vi.fn();
    showPrepare(state, vi.fn(), change);
    espresso().focus();
    espresso().click();
    expect(state.onMenu).toEqual([]);
    expect(start().disabled).toBe(true);
    const reason = document.getElementById(start().getAttribute('aria-describedby')!);
    expect(reason!.textContent).toBe(t('prep.emptyMenu'));
    expect(document.querySelector('[data-restock]')).toBeNull();
    expect(document.activeElement).toBe(espresso());
    espresso().click();
    expect(start().disabled).toBe(false);
    expect(start().hasAttribute('aria-describedby')).toBe(false);
    expect(document.querySelector('.prep-empty-menu')).toBeNull();
    expect(document.activeElement).toBe(espresso());
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('introduces bakery stock only when a baked item can be prepared', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep-bakery-hint')).toBeNull();
    expect(document.querySelector('[data-forecast]')).toBeNull();
    closeModal();
    state.items.roll = 1;
    setOnMenu(state, 'roll', true);
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep-bakery-hint')!.textContent).toBe(t('prep.bakeryHint'));
    expect(document.querySelector<HTMLInputElement>('[data-amount="roll"]')!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-forecast]')!.disabled).toBe(false);
    const roll = document.querySelector<HTMLInputElement>('[data-dish="roll"]')!;
    roll.click();
    expect(document.querySelector<HTMLInputElement>('[data-amount="roll"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-forecast]')!.disabled).toBe(true);
  });

  it('leaves low-stock actions visible outside the collapsed details', () => {
    const state = createInitialState(0);
    state.pantry.beans = 0;
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep-starter')).toBeNull();
    const warning = [...document.querySelectorAll('.prep .warn')].find((p) => p.textContent!.includes(t('prep.lowNext')))!;
    expect(warning.textContent).toContain(t('prep.low'));
    expect(warning.closest('details')).toBeNull();
    expect(document.querySelector('.prep-row')!.classList.contains('low')).toBe(true);
    // Low stock remains a warning handled by the existing opening flow.
    expect(start().disabled).toBe(false);
  });
});

it('opens an already empty menu without focusing its disabled start action', () => {
  const state = createInitialState(0);
  state.onMenu = [];
  const onStart = vi.fn();
  showPrepare(state, onStart, vi.fn());
  expect(start().disabled).toBe(true);
  expect(document.activeElement).not.toBe(start());
  expect(document.querySelector('.prep-empty-menu')!.textContent).toBe(t('prep.emptyMenu'));
  start().click();
  expect(onStart).not.toHaveBeenCalled();
  espresso().click();
  expect(start().disabled).toBe(false);
  start().click();
  expect(onStart).toHaveBeenCalledTimes(1);
});

it('preserves expanded details and numeric-input focus during bakery edits', () => {
  const state = createInitialState(0);
  state.kitchen = true;
  state.items.roll = 1;
  setOnMenu(state, 'roll', true);
  const change = vi.fn();
  showPrepare(state, vi.fn(), change);
  details().open = true;
  const input = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  input.focus();
  input.value = '7';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(state.bakePlan.roll).toBe(7);
  expect(document.activeElement?.getAttribute('data-amount')).toBe('roll');
  expect(details().open).toBe(true);
  document.querySelector<HTMLButtonElement>('[data-bake="roll:1"]')!.click();
  expect(state.bakePlan.roll).toBe(12);
  expect(details().open).toBe(true);
  expect(change).toHaveBeenCalledTimes(2);
});

it('keeps the purchase receipt and returns focus to a usable control after restocking', () => {
  const state = createInitialState(0);
  state.day = 2;
  state.coins = 100;
  state.pantry.beans = 0;
  showPrepare(state, vi.fn(), vi.fn());
  details().open = true;
  const restock = document.querySelector<HTMLButtonElement>('[data-restock]')!;
  restock.focus();
  restock.click();
  expect(state.pantry.beans).toBeGreaterThan(0);
  expect(state.coins).toBeLessThan(100);
  expect(document.querySelector('[role="status"]')!.textContent).toBe(t('prep.bought', { items: `${ingredientName('beans')} ×${state.pantry.beans}` }));
  expect(document.querySelector<HTMLButtonElement>('[data-restock]')!.disabled).toBe(true);
  expect(document.activeElement).toBe(espresso());
  expect(details().open).toBe(true);
  expect(document.querySelector('.prep-starter')).toBeNull();
  espresso().click();
  expect(document.querySelector('[role="status"]')!.textContent).toBe('');
});
