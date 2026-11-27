// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demandPlan } from '../game/customer-demand';
import { menuItems, restockPlan, setOnMenu } from '../game/economy';
import { createInitialState } from '../game/state';
import { formatTransactionMoney as formatMoney, formatNumber } from '../game/format';
import { setLocale, t } from '../i18n';
import { closeModal, isModalOpen } from './modal';
import { ingredientName } from './panel';
import { showPrepare } from './prepare';

vi.mock('../render/sprites', () => ({
  itemArtwork: () => document.createElement('canvas'),
  toDataURL: () => 'data:image/png;base64,',
}));

const start = () => document.querySelector<HTMLButtonElement>('[data-start]')!;
const direct = () => document.querySelector<HTMLButtonElement>('[data-start-direct]');
const details = () => document.querySelector<HTMLDetailsElement>('.prep-details')!;
const dishDetails = () => document.querySelector<HTMLDetailsElement>('.prep-dish-details')!;
const espresso = () => document.querySelector<HTMLInputElement>('[data-dish="espresso"]')!;

beforeEach(() => {
  document.body.innerHTML = '<div id="modal-root"></div><div id="toast" hidden></div>';
  setLocale('en');
});
afterEach(() => {
  closeModal();
  setLocale('en');
  document.body.replaceChildren();
});

describe.each(['en', 'zh'] as const)('preparation guidance in %s', (locale) => {
  beforeEach(() => setLocale(locale));

  it('explains the free starting stock and moves menu hint and recipe details into folds without changing the save', () => {
    const state = createInitialState(0);
    const before = structuredClone(state);
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep-head h2')!.textContent).toBe(t('prep.boardTitle'));
    expect(document.querySelector('.prep-sub')!.textContent).toBe(t('prep.boardSub'));
    expect(document.querySelector('.prep-sticky')).toBeNull();
    expect(document.querySelector('.prep-starter')!.textContent).toBe(t('prep.starterStock', { n: formatNumber(50) }));
    expect(details().open).toBe(false);
    details().open = true;
    expect(details().textContent).toContain(t('prep.menuHint'));
    expect(dishDetails().open).toBe(false);
    dishDetails().open = true;
    expect(dishDetails().querySelector('.prep-recipe')!.textContent).toBe(t('prep.drinkIngredients', { items: `${ingredientName('beans')} ×1` }));
    expect(espresso().checked).toBe(true);
    expect(start().disabled).toBe(false);
    expect(start().textContent).toBe(t('prep.start'));
    expect(direct()).toBeNull();
    expect(document.querySelector('.prep-stock-summary')!.textContent).toBe(t('prep.stockReadyShort'));
    expect(document.querySelector('[data-bake]')).toBeNull();
    expect(document.querySelector('[data-forecast]')).toBeNull();
    expect(document.querySelector('.prep-bakery-hint')).toBeNull();
    expect(state).toEqual(before);
  });

  it('keeps the forecast and reputation optional and explains that opening has no timer', () => {
    showPrepare(createInitialState(0), vi.fn(), vi.fn());
    expect(details().open).toBe(false);
    expect(details().querySelector('summary')!.textContent).toBe(t('prep.details'));
    details().open = true;
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
    expect(start().textContent).toBe(t('prep.start'));
    const reason = document.getElementById(start().getAttribute('aria-describedby')!);
    expect(reason!.textContent).toBe(t('prep.emptyMenu'));
    expect(direct()).toBeNull();
    expect(document.activeElement).toBe(espresso());
    espresso().click();
    expect(start().disabled).toBe(false);
    expect(start().hasAttribute('aria-describedby')).toBe(false);
    expect(document.querySelector('.prep-empty-menu')).toBeNull();
    expect(document.activeElement).toBe(espresso());
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('introduces bakery stock only when a baked item can be prepared and spans full width while on menu', () => {
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
    const rollTile = document.querySelector<HTMLInputElement>('[data-dish="roll"]')!.closest('.prep-row')!;
    expect(rollTile.classList.contains('bake-open')).toBe(true);
    expect(rollTile.textContent).toContain(t('prep.dishBake', { n: formatNumber(state.bakePlan.roll ?? 0) }));
    expect(document.querySelector<HTMLInputElement>('[data-amount="roll"]')!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-forecast]')!.disabled).toBe(false);
    document.querySelector<HTMLInputElement>('[data-dish="roll"]')!.click();
    const rollOff = document.querySelector<HTMLInputElement>('[data-dish="roll"]')!.closest('.prep-row')!;
    expect(rollOff.classList.contains('off')).toBe(true);
    expect(rollOff.classList.contains('bake-open')).toBe(false);
    expect(rollOff.textContent).toContain(t('menu.off'));
    expect(document.querySelector('[data-amount="roll"]')).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-forecast]')!.disabled).toBe(true);
  });

  it('leaves low-stock actions visible outside the collapsed details and marks the dish tile', () => {
    const state = createInitialState(0);
    state.pantry.beans = 0;
    showPrepare(state, vi.fn(), vi.fn());
    expect(document.querySelector('.prep-starter')).toBeNull();
    const warning = [...document.querySelectorAll('.prep .warn')].find((p) => p.textContent!.includes(t('prep.lowNext')))!;
    expect(warning.textContent).toContain(t('prep.low'));
    expect(warning.closest('details')).toBeNull();
    const row = document.querySelector('.prep-row')!;
    expect(row.classList.contains('low')).toBe(true);
    expect(row.textContent).toContain(t('prep.lowTag'));
    expect(document.querySelector('[data-pantry-pill="beans"]')!.classList.contains('missing')).toBe(true);
    // Low stock remains a warning handled by the opening action.
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
  dishDetails().open = true;
  const input = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  input.focus();
  input.value = '7';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(state.bakePlan.roll).toBe(7);
  expect(document.activeElement?.getAttribute('data-amount')).toBe('roll');
  expect(details().open).toBe(true);
  expect(dishDetails().open).toBe(true);
  document.querySelector<HTMLButtonElement>('[data-bake="roll:1"]')!.click();
  expect(state.bakePlan.roll).toBe(12);
  expect(details().open).toBe(true);
  expect(dishDetails().open).toBe(true);
  expect(change).toHaveBeenCalledTimes(2);
});

it('restocks and opens via the primary button in one step and appends the receipt to the toast', () => {
  const state = createInitialState(0);
  state.day = 2;
  state.coins = 100;
  state.pantry.beans = 0;
  const plan = restockPlan(state);
  const onChange = vi.fn();
  const onStart = vi.fn(() => {
    const el = document.getElementById('toast')!;
    el.textContent = t('toast.opened', { n: state.day });
    el.hidden = false;
  });
  showPrepare(state, onStart, onChange);
  expect(start().textContent).toBe(t('prep.restockOpen', { price: formatMoney(plan.cost) }));
  expect(direct()!.textContent).toBe(t('prep.openDirect'));
  start().click();
  expect(state.pantry.beans).toBeGreaterThan(0);
  expect(state.coins).toBe(100 - plan.cost);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onStart).toHaveBeenCalledOnce();
  expect(isModalOpen()).toBe(false);
  const toastEl = document.getElementById('toast')!;
  expect(toastEl.hidden).toBe(false);
  expect(toastEl.textContent).toContain(t('toast.opened', { n: 2 }));
  expect(toastEl.textContent).toContain(t('prep.bought', { items: `${ingredientName('beans')} ×${state.pantry.beans}` }));
});

it('covers all four primary button states and direct opening without restocking', () => {
  // 1. Empty menu -> disabled
  const s1 = createInitialState(0);
  s1.onMenu = [];
  showPrepare(s1, vi.fn(), vi.fn());
  expect(start().disabled).toBe(true);
  expect(start().textContent).toBe(t('prep.start'));
  expect(direct()).toBeNull();
  closeModal();

  // 2. Full stock -> direct start, no secondary button
  const s2 = createInitialState(0);
  const start2 = vi.fn();
  const coinsBefore2 = s2.coins;
  showPrepare(s2, start2, vi.fn());
  expect(start().disabled).toBe(false);
  expect(start().textContent).toBe(t('prep.start'));
  expect(direct()).toBeNull();
  start().click();
  expect(start2).toHaveBeenCalledOnce();
  expect(s2.coins).toBe(coinsBefore2);

  // 3a. Budget restock -> budgetOpen label, buys affordable amount and opens
  const s3 = createInitialState(0);
  s3.day = 2; s3.coins = 3; s3.pantry.beans = 0;
  const start3 = vi.fn();
  showPrepare(s3, start3, vi.fn());
  expect(start().textContent).toBe(t('prep.budgetOpen', { price: formatMoney(3) }));
  expect(direct()!.textContent).toBe(t('prep.openDirect'));
  start().click();
  expect(s3.pantry.beans).toBe(3);
  expect(s3.coins).toBe(0);
  expect(start3).toHaveBeenCalledOnce();

  // 3b. Open without restocking -> opens without buying
  const s3b = createInitialState(0);
  s3b.day = 2; s3b.coins = 100; s3b.pantry.beans = 0;
  const start3b = vi.fn();
  const change3b = vi.fn();
  showPrepare(s3b, start3b, change3b);
  direct()!.click();
  expect(start3b).toHaveBeenCalledOnce();
  expect(change3b).not.toHaveBeenCalled();
  expect(s3b.coins).toBe(100);
  expect(s3b.pantry.beans).toBe(0);
  expect(isModalOpen()).toBe(false);

  // 4. Missing stock, cannot afford anything -> start button without direct button, unmet warning visible
  const s4 = createInitialState(0);
  s4.day = 2; s4.coins = 0; s4.pantry.beans = 0;
  const start4 = vi.fn();
  showPrepare(s4, start4, vi.fn());
  expect(start().disabled).toBe(false);
  expect(start().textContent).toBe(t('prep.start'));
  expect(direct()).toBeNull();
  expect(document.querySelector('.prep')!.textContent).toContain(t('ing.beans'));
  start().click();
  expect(start4).toHaveBeenCalledOnce();
  expect(s4.pantry.beans).toBe(0);
});

it('toggles a dish by clicking its tile and renders guest share bars matching demandPlan', () => {
  const state = createInitialState(0);
  state.day = 5;
  state.items.americano = 1;
  state.items.latte = 1;
  state.items.blacktea = 1;
  state.onMenu = ['espresso', 'latte'];
  showPrepare(state, vi.fn(), vi.fn());
  // Verify guest bars match demandPlan percentages.
  const expected = demandPlan(state, menuItems(state)).guests;
  for (const g of expected) {
    const row = document.querySelector<HTMLElement>(`.prep-guest[data-guest-kind="${g.kind}"]`)!;
    expect(row.querySelector('.gp')!.textContent).toBe(`${Math.round(g.share * 100)}%`);
    expect(row.querySelector<HTMLElement>('.gb i')!.style.width).toBe(`${Math.round(g.share * 100)}%`);
    expect(row.querySelector('.gf')!.classList.contains('ok')).toBe(g.coverage >= 0.8);
  }
  // Clicking the dish name inside the tile label toggles the dish onto the menu.
  const teaName = document.querySelector('[data-dish="blacktea"]')!.closest('label')!.querySelector('b')!;
  teaName.click();
  expect(state.onMenu).toContain('blacktea');
  expect(document.querySelector<HTMLInputElement>('[data-dish="blacktea"]')!.checked).toBe(true);
});

it('commits numeric blur without removing the native next focus target mid-Tab', () => {
  const state = createInitialState(0); state.kitchen = true; state.items.roll = 1; setOnMenu(state, 'roll', true);
  showPrepare(state, vi.fn(), vi.fn());
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const input = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  const plus = document.querySelector<HTMLButtonElement>('[data-bake="roll:1"]')!;
  const scroll = document.querySelector<HTMLElement>('.modal-body')!; scroll.scrollTop = 200;
  input.focus(); input.value = '17'; input.blur();
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(state.bakePlan.roll).toBe(17); expect(plus.isConnected).toBe(true);
  plus.focus(); frames.at(-1)!(0);
  expect(document.activeElement?.getAttribute('data-focus')).toBe('plus-roll');
  expect(scroll.scrollTop).toBe(200);
});

it.each(['pointerup', 'pointercancel', 'blur'])('keeps a held quantity target connected until %s', (release) => {
  const state = createInitialState(0); state.kitchen = true; state.items.roll = 1; setOnMenu(state, 'roll', true);
  showPrepare(state, vi.fn(), vi.fn());
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const input = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  const plus = document.querySelector<HTMLButtonElement>('[data-bake="roll:1"]')!;
  input.focus(); input.value = '21';
  plus.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  input.blur(); input.dispatchEvent(new Event('change', { bubbles: true })); plus.focus();
  expect(state.bakePlan.roll).toBe(21);
  expect(frames).toHaveLength(0); expect(plus.isConnected).toBe(true);
  window.dispatchEvent(release === 'blur' ? new Event('blur') : new PointerEvent(release, { pointerId: 7 }));
  expect(frames).toHaveLength(1);
  if (release === 'pointerup') plus.click();
  frames.at(-1)!(0);
  expect(state.bakePlan.roll).toBe(release === 'pointerup' ? 26 : 21);
  expect(document.activeElement?.getAttribute('data-focus')).toBe('plus-roll');
});

it('does not redraw a closed preparation dialog when a held pointer releases', () => {
  const state = createInitialState(0); state.kitchen = true; state.items.roll = 1; setOnMenu(state, 'roll', true);
  showPrepare(state, vi.fn(), vi.fn());
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const input = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  const plus = document.querySelector<HTMLButtonElement>('[data-bake="roll:1"]')!;
  input.focus(); input.value = '21';
  plus.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  input.blur(); input.dispatchEvent(new Event('change', { bubbles: true }));
  closeModal(); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
  frames.at(-1)!(0);
  expect(document.querySelector('.modal')).toBeNull();
  expect(state.bakePlan.roll).toBe(21);
});

it('keeps the stock decision pinned in the footer while optional plans stay below the menu', () => {
  const state = createInitialState(0);
  state.day = 2; state.items.americano = 1; state.onMenu = ['espresso', 'americano'];
  state.pantry.beans = 13; state.coins = 100;
  showPrepare(state, vi.fn(), vi.fn());
  const footer = document.querySelector<HTMLElement>('.prep-stock-footer')!;
  const menu = document.querySelector<HTMLElement>('.prep-list')!;
  const style = document.querySelector<HTMLDetailsElement>('.prep-optional-style')!;
  expect(footer.closest('.modal-body')).toBeNull();
  expect(footer.querySelector('[data-start]')).not.toBeNull();
  expect(footer.querySelector('[data-start-direct]')).not.toBeNull();
  expect(footer.querySelector('[data-later]')).not.toBeNull();
  expect(footer.textContent).toContain(ingredientName('beans'));
  expect(footer.textContent).toContain('$');
  expect(style.open).toBe(false);
  expect(menu.compareDocumentPosition(style) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const scroller = document.querySelector<HTMLElement>('.modal-body')!;
  scroller.scrollTop = 240; style.open = true;
  espresso().focus(); espresso().click();
  expect(document.querySelector<HTMLDetailsElement>('.prep-optional-style')!.open).toBe(true);
  expect(scroller.scrollTop).toBe(240);
  expect(document.activeElement).toBe(espresso());
});

it('shows per-drink servings on tiles and names shared ingredient stock inside the details fold', () => {
  const state = createInitialState(0);
  state.items.americano = 1; state.items.latte = 1;
  state.onMenu = ['espresso', 'americano', 'latte']; state.pantry.beans = 13; state.pantry.milk = 4;
  showPrepare(state, vi.fn(), vi.fn());
  details().open = true;
  expect(details().querySelector('.prep-shared-stock')!.textContent).toBe(t('prep.sharedStock', { items: `${ingredientName('beans')} ×13` }));
  for (const [id, n] of [['espresso', 13], ['americano', 13], ['latte', 4]] as const) {
    const row = document.querySelector(`[data-dish="${id}"]`)!.closest('.prep-row')!;
    expect(row.textContent).toContain(t('prep.dishDrink', { n }));
  }
  document.querySelector<HTMLInputElement>('[data-dish="americano"]')!.click();
  document.querySelector<HTMLInputElement>('[data-dish="latte"]')!.click();
  expect(details().querySelector('.prep-shared-stock')).toBeNull();
});

it('does not lose a footer restock-and-open click when a bakery amount is committing on blur', () => {
  const state = createInitialState(0); state.day = 2; state.coins = 1000; state.kitchen = true; state.items.roll = 1;
  setOnMenu(state, 'roll', true); state.pantry.beans = 0;
  const started = vi.fn(); const changed = vi.fn(); showPrepare(state, started, changed);
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const amount = document.querySelector<HTMLInputElement>('[data-amount="roll"]')!;
  const go = start();
  amount.focus(); amount.value = '12';
  go.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }));
  amount.blur(); amount.dispatchEvent(new Event('change', { bubbles: true })); go.focus();
  expect(state.bakePlan.roll).toBe(12);
  expect(frames).toHaveLength(0); expect(go.isConnected).toBe(true);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9 })); go.click();
  frames.at(-1)!(0);
  expect(state.pantry.beans).toBeGreaterThan(0); expect(state.coins).toBeLessThan(1000);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(started).toHaveBeenCalledOnce();
  expect(isModalOpen()).toBe(false);
});
