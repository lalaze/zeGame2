// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { setLocale, t } from '../i18n';
import { showPrepare } from './prepare';
import { trialResultCard, trialSaleCard } from './trial-sales';
import { closeModal } from './modal';
import { makeSignatureId, saveSignature, setSignatureOnMenu, trialSignature } from '../game/signature-drinks';
import { regularWishCard } from './regular-wishes';
import { recordRegularGuestArrival, recordRegularGuestService } from '../game/regular-guests';
import { openShop, finishDay } from '../game/day';
import { chooseMinaWish } from '../game/regular-wishes';
import { selectTrialSale } from '../game/trial-sales';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));
const action = (name: string) => document.querySelector<HTMLButtonElement>(`[data-trial-action="${name}"]`)!;
const picker = () => document.querySelector<HTMLSelectElement>('[data-trial-select]')!;
function cafe() {
  const s = createInitialState(123); s.day = 4; s.items.latte = 1; s.pantry.milk = 10;
  return s;
}
function withResult() {
  const s = cafe();
  s.trialSales.last = { item: 'latte', day: 3, prepared: 5, served: 4, ingredientCost: 15, revenue: 40,
    feedback: { love: 2, fine: 1, meh: 1 }, practiceBefore: 28, qualityBefore: 4, qualityAfter: 4.5 };
  return s;
}
beforeEach(() => { document.body.innerHTML = '<div id="modal-root"></div>'; });
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); });

describe.each(['en', 'zh'] as const)('trial preparation and results in %s', locale => {
  beforeEach(() => setLocale(locale));
  it('selects a separate trial, preserves focus and refreshes the payable stock quote', () => {
    const s = cafe(); s.pantry.milk = 0; s.coins = 1000;
    const change = vi.fn(); showPrepare(s, vi.fn(), change);
    expect(picker().value).toBe('');
    expect([...picker().options].map(option => option.value)).not.toContain('espresso');
    picker().focus(); picker().value = 'latte'; picker().dispatchEvent(new Event('change', { bubbles: true }));
    expect(s.trialSales.selected).toBe('latte'); expect(s.onMenu).toEqual(['espresso']);
    expect(document.activeElement).toBe(picker()); expect(change).toHaveBeenCalledOnce();
    expect(document.querySelector('.trial-sales')!.textContent).toContain(t('trial.stock', { n: 0, limit: 5 }));
    expect(document.querySelector('.prep')!.textContent).toContain(t('ing.milk'));
    expect(document.querySelector<HTMLButtonElement>('[data-start]')!.disabled).toBe(false);
    expect(s.coins).toBe(1000); expect(s.pantry.milk).toBe(0);
    document.querySelector<HTMLButtonElement>('[data-restock]')!.click();
    expect(s.pantry.milk).toBe(5); expect(s.coins).toBeLessThan(1000);
    const latte = document.querySelector<HTMLInputElement>('[data-dish="latte"]')!; latte.click();
    expect(s.onMenu).toContain('latte'); expect(s.trialSales.selected).toBeNull();
  });

  it('presents actual delivered feedback, waste and practice, then supports explicit repeat and promotion', () => {
    const s = withResult(), changed = vi.fn(); const before = structuredClone(s);
    document.body.append(trialResultCard(s, changed)!);
    expect(s).toEqual(before);
    expect(document.body.textContent).toContain(t('trial.result.feedback', { love: 2, fine: 1, meh: 1 }));
    expect(document.body.textContent).toContain(t('trial.result.waste', { n: 1 }));
    expect(document.body.textContent).toContain(t('trial.result.practice', { n: 4, before: '4.0', after: '4.5' }));
    const repeat = action('repeat'); repeat.click(); repeat.click();
    expect(changed).toHaveBeenCalledOnce(); expect(s.trialSales.selected).toBe('latte');
    expect(action('repeat').disabled).toBe(true);
    const promote = action('promote'); promote.click(); promote.click();
    expect(s.onMenu).toContain('latte'); expect(s.trialSales.selected).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2); expect(action('promote').disabled).toBe(true);
    expect(s.coins).toBe(before.coins); expect(s.pantry).toEqual(before.pantry);
    expect(s.taste).toEqual(before.taste); expect(s.trialSales.last).toEqual(before.trialSales.last);
  });

  it('rejects detached controls, an obsolete report and changes after opening', () => {
    const s = withResult(), changed = vi.fn(), card = trialResultCard(s, changed)!; document.body.append(card);
    const old = action('repeat'); card.remove(); old.click(); expect(s.trialSales.selected).toBeNull();
    document.body.append(trialResultCard(s, changed)!);
    s.trialSales.last!.day = 2;
    action('repeat').click(); expect(s.trialSales.selected).toBeNull();
    document.body.replaceChildren(trialResultCard(s, changed)!); openShop(s);
    action('repeat').click(); expect(changed).not.toHaveBeenCalled();
  });

  it('shows Mina’s reserved trial place and accurately describes missing drink-order opportunities', () => {
    const s = cafe(); s.day = 1; openShop(s);
    recordRegularGuestService(s, 'mina', recordRegularGuestArrival(s, 'mina')!); finishDay(s);
    chooseMinaWish(s, 'milky'); selectTrialSale(s, 'latte');
    document.body.append(trialSaleCard(s, vi.fn())!, regularWishCard(s, vi.fn(), true)!);
    expect(document.body.textContent).toContain(t('trial.mina'));
    expect(document.body.textContent).toContain(t('trial.minaReady', { drink: t('item.latte') }));
    s.onMenu = []; document.body.replaceChildren(trialSaleCard(s, vi.fn())!);
    expect(document.body.textContent).toContain(t('trial.noDrinks'));
  });

  it('retains previous results in preparation without granting another day automatically', () => {
    const s = withResult(); showPrepare(s, vi.fn(), vi.fn());
    expect(s.trialSales.selected).toBeNull(); expect(picker().value).toBe('');
    const details = document.querySelector<HTMLDetailsElement>('.trial-history')!;
    expect(details.open).toBe(false); details.open = true;
    action('repeat').click();
    expect(picker().value).toBe('latte');
    expect(document.querySelector<HTMLDetailsElement>('.trial-history')!.open).toBe(true);
    expect(document.body.textContent).toContain(t('trial.repeatSelected'));
  });
});

it('uses safe historical custom names and respects the regular custom-menu capacity', () => {
  setLocale('en'); const s = withResult(); s.pantry.sugar = 20;
  const formulas = [{ beans: 1, milk: 1 }, { beans: 2, milk: 1 }, { beans: 1, sugar: 1 }, { beans: 2, sugar: 1 }];
  const ids = formulas.map((recipe, i) => {
    const id = makeSignatureId('coffee', recipe)!;
    trialSignature(s, 'coffee', recipe); saveSignature(s, id, `Recipe ${i}`);
    if (i < 3) setSignatureOnMenu(s, id, true);
    return id;
  });
  s.trialSales.last!.item = ids[3]; s.trialSales.last!.name = '<img src=x onerror=alert(1)>';
  document.body.append(trialResultCard(s, vi.fn())!);
  expect(document.querySelector('.trial-result img')).toBeNull();
  expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(action('promote').disabled).toBe(true);
  expect(document.body.textContent).toContain(t('trial.customFull', { n: 3 }));
  expect(action('repeat').disabled).toBe(false); action('repeat').click();
  expect(s.trialSales.selected).toBe(ids[3]);
});
