// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { INGREDIENTS, MENU } from '../game/data';
import { setLocale } from '../i18n';
import { showSignatureDrinks } from './signature-drinks';
import { closeModal, isModalOpen } from './modal';
import { salePrice, prepTime } from '../game/economy';
import { formatTransactionMoney } from '../game/format';
import { tasteScore } from '../game/taste';
import { listSignatureDrinks, trialSignature, saveSignature, makeSignatureId } from '../game/signature-drinks';
const click = (key: string) => document.querySelector<HTMLButtonElement>(`[data-signature-action="${key}"]`)!.click();
const action = (key: string) => document.querySelector<HTMLButtonElement>(`[data-signature-action="${key}"]`)!;
function name(value: string) {
  const input = document.querySelector<HTMLInputElement>('[data-signature-name]')!;
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
}
function dose(key: string, value: number) {
  const select = document.querySelector<HTMLSelectElement>(`[data-signature-dose="${key}"]`)!;
  select.value = String(value); select.dispatchEvent(new Event('change', { bubbles: true }));
}
function ready() {
  const state = createInitialState(0);
  for (const item of MENU) state.items[item.id] = 1;
  for (const ing of INGREDIENTS) state.pantry[ing.id] = 50;
  state.kitchen = true; state.phase = 'prep'; return state;
}
beforeEach(() => { setLocale('en'); document.body.innerHTML = '<button id="opener">Open</button><div id="modal-root"></div>'; });
afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); });

describe('signature drink research workbench', () => {
  it('walks base, compatible doses, exact paid trial, naming, menu, rename and deletion', () => {
    const state = ready(); const changed = vi.fn(); const coins = state.coins;
    showSignatureDrinks(state, changed); click('create');
    expect(document.querySelector('[data-signature-dose="fruit"]')).toBeNull();
    dose('milk', 2); dose('sugar', 1);
    expect(document.body.textContent).toContain('Current sale price');
    expect(document.body.textContent).toContain('roasted · lightly sweet · creamy');
    expect(action('save').disabled).toBe(true);
    click('trial'); expect(state.pantry.beans).toBe(49.75); expect(state.pantry.milk).toBe(49.5); expect(state.pantry.sugar).toBe(49.75); expect(state.coins).toBe(coins);
    name('Morning cloud'); click('save');
    const drink = listSignatureDrinks(state)[0]; expect(drink.name).toBe('Morning cloud');
    click(`detail:${drink.id}`); click('toggle-menu'); expect(drink.onMenu).toBe(true);
    const input = document.querySelector<HTMLInputElement>('[data-signature-rename]')!; input.value = '<b>Cloud</b>'; click('rename');
    expect(document.querySelector('h3')!.textContent).toBe('<b>Cloud</b>'); expect(document.querySelector('h3 b')).toBeNull();
    click('delete'); expect(listSignatureDrinks(state)).toHaveLength(1); click('confirm-delete'); expect(listSignatureDrinks(state)).toHaveLength(0);
    expect(changed).toHaveBeenCalledTimes(5);
  });
  it('shows exact quarter-serving shortages and respects locked ingredients and live phase changes', () => {
    const state = createInitialState(0); state.phase = 'prep'; state.pantry.beans = .125;
    const changed = vi.fn(); showSignatureDrinks(state, changed); click('create');
    expect(document.body.textContent).toContain('Coffee beans × 0.125'); expect(action('trial').disabled).toBe(true);
    expect(action('base:fruit').disabled).toBe(true);
    state.pantry.beans = 10; closeModal(); showSignatureDrinks(state, changed); click('create');
    state.phase = 'open'; const before = JSON.stringify(state); click('trial');
    expect(JSON.stringify(state)).toBe(before); expect(changed).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('preparation only');
  });
  it('invalidates a tasting when the formula changes and filters incompatible mixed additions', () => {
    const state = ready(); showSignatureDrinks(state, vi.fn()); click('create'); click('base:milk');
    dose('cocoa', 1); expect(document.querySelector('[data-signature-dose="fruit"]')).toBeNull();
    click('trial'); name('Cocoa milk'); expect(action('save').disabled).toBe(false);
    dose('sugar', 1); expect(action('save').disabled).toBe(true);
  });
  it('edits a saved formula atomically even with six recipes and preserves menu status', () => {
    const state = ready();
    for (const recipe of [{ beans: 1 }, { beans: 2 }, { beans: 1, sugar: 1 }, { beans: 1, sugar: 2 }, { beans: 1, milk: 1 }, { beans: 1, milk: 2 }]) {
      const trial = trialSignature(state, 'coffee', recipe); saveSignature(state, trial.id!, `Recipe ${listSignatureDrinks(state).length}`);
    }
    const old = listSignatureDrinks(state)[0]; old.onMenu = true;
    showSignatureDrinks(state, vi.fn()); expect(action('create').disabled).toBe(true); click(`detail:${old.id}`); click('edit');
    dose('cream', 1); click('trial'); click('save');
    expect(listSignatureDrinks(state)).toHaveLength(6); expect(listSignatureDrinks(state)[0].id).not.toBe(old.id); expect(listSignatureDrinks(state)[0].onMenu).toBe(true);
  });
  it('quotes the same current price, speed and ingredient margin as the sale economy', () => {
    const state = ready(); state.upgrades.machine = 3; state.cafeStyle.focus = 'takeaway';
    showSignatureDrinks(state, vi.fn()); click('create'); dose('milk', 1);
    const id = makeSignatureId('coffee', { beans: 1, milk: 1 })!;
    const values = [...document.querySelectorAll('.signature-metrics dd')].map(el => el.textContent);
    expect(values).toEqual([formatTransactionMoney(3), formatTransactionMoney(salePrice(state, id)), `${prepTime(state, id)}s`, formatTransactionMoney(salePrice(state, id) - 3)]);
  });
  it('explains delivery-only practice, current formula rating and automatic 30/100 mastery bilingually', () => {
    const state = ready(); const result = trialSignature(state, 'coffee', { beans: 1, cream: 2 });
    saveSignature(state, result.id!, 'Cream cloud'); const id = result.id!;
    for (const locale of ['en', 'zh'] as const) {
      setLocale(locale);
      for (const served of [0, 29, 30, 99, 100]) {
        state.signatureDrinks.served[id] = served;
        showSignatureDrinks(state, vi.fn()); click(`detail:${id}`);
        expect(document.querySelector('.signature-taste')!.textContent).toContain(`${tasteScore(state, id).toFixed(1)} / 5`);
        expect(document.querySelector('.signature-delivered')!.textContent).toContain(String(served));
        expect(document.querySelector('.signature-next')!.textContent).toContain(served < 30 ? `${served} / 30` : served < 100 ? `${served} / 100` : locale === 'en' ? 'Mastery reached' : '已精通');
        expect(document.querySelector('.signature-growth')!.textContent).toContain(locale === 'en' ? 'saving and renaming give no experience' : '试饮、保存和改名均不增加经验');
        expect(document.querySelector('.signature-growth')!.textContent).toContain(locale === 'en' ? 'no research fee' : '无需支付研发费');
        closeModal();
      }
    }
  });
  it('explains dose ranges, caps and hidden gameplay incompatibilities in both languages', () => {
    for (const locale of ['en', 'zh'] as const) {
      setLocale(locale); showSignatureDrinks(ready(), vi.fn()); click('create');
      expect(document.querySelector('.signature-dose-rules')!.textContent).toBe(locale === 'en'
        ? 'Base: 1–2 portions. Each addition: 0–2 portions. Up to 3 addition types and 6 portions in total.'
        : '基底用量为 1–2 份，每种配料为 0–2 份；最多 3 种配料，总用量不超过 6 份。');
      expect(document.querySelector('.signature-pairing-rules')!.textContent).toBe(locale === 'en'
        ? 'Game pairing rules: coffee cannot pair with fruit or matcha; tea cannot pair with cocoa; fruit and cocoa cannot mix. Incompatible additions are hidden.'
        : '游戏搭配规则：咖啡不能搭配水果或抹茶，茶不能搭配可可，水果与可可不能混用。不兼容的配料会隐藏。');
      dose('milk', 2); dose('sugar', 2); dose('cream', 2);
      expect(action('trial').disabled).toBe(true);
      expect(document.body.textContent).toContain(locale === 'en' ? 'Choose a valid recipe' : '请使用有效配方');
      closeModal();
    }
  });
  it('limits menu listings to three and keeps service-time management read-only', () => {
    const state = ready();
    for (const n of [1, 2]) for (const sugar of [1, 2]) { const result = trialSignature(state, 'coffee', { beans: n, sugar }); saveSignature(state, result.id!, `Cup ${n} ${sugar}`); }
    const drinks = listSignatureDrinks(state); drinks.slice(0, 3).forEach(d => d.onMenu = true);
    showSignatureDrinks(state, vi.fn()); click(`detail:${drinks[3].id}`); expect(action('toggle-menu').disabled).toBe(true); expect(document.body.textContent).toContain('Three signature drinks');
    closeModal(); state.phase = 'closing'; showSignatureDrinks(state, vi.fn()); click(`detail:${drinks[0].id}`);
    for (const key of ['edit', 'rename', 'toggle-menu', 'delete']) expect(action(key).disabled).toBe(true);
  });
  it('renders Chinese throughout the full flow and supports repeated mobile-sized open/close without stale mutations', () => {
    setLocale('zh'); Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const state = ready(); const changed = vi.fn(); const opener = document.getElementById('opener')!;
    for (let i = 0; i < 4; i++) {
      opener.focus(); showSignatureDrinks(state, changed); click('create'); click('base:tea'); dose('spice', 2);
      expect(document.body.textContent).toContain('双份香料带来浓烈而温暖的余味。');
      expect(document.body.textContent).not.toContain('Current sale price');
      const stale = action('trial'); const before = JSON.stringify(state);
      document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(isModalOpen()).toBe(false); expect(document.activeElement).toBe(opener); stale.click(); expect(JSON.stringify(state)).toBe(before);
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    }
    expect(changed).not.toHaveBeenCalled();
  });
});
