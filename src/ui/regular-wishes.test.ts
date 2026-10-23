// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { finishDay, openShop } from '../game/day';
import { recordRegularGuestArrival, recordRegularGuestService } from '../game/regular-guests';
import { chooseMinaWish, minaReservedTable, minaWish } from '../game/regular-wishes';
import { setLocale, t } from '../i18n';
import { regularWishCard, regularWishReportHtml } from './regular-wishes';
import { showPrepare } from './prepare';
import { CafeLife } from './cafe-life';
import { closeModal, isModalOpen } from './modal';

vi.mock('../render/sprites', () => ({
  itemArtwork: () => document.createElement('canvas'),
  toDataURL: () => 'data:image/png;base64,',
}));
function metCafe() {
  const s = createInitialState(0); openShop(s);
  recordRegularGuestService(s, 'mina', recordRegularGuestArrival(s, 'mina')!);
  finishDay(s); return s;
}
const action = (key: string) => document.querySelector<HTMLButtonElement>(`[data-wish-action="${key}"]`)!;
beforeEach(() => { document.body.innerHTML = '<div id="modal-root"></div>'; });
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); });

describe.each(['en', 'zh'] as const)('Mina’s wish in %s', locale => {
  beforeEach(() => setLocale(locale));

  it('is discovered after a first service, with no automatic acceptance or purchases', () => {
    expect(regularWishCard(createInitialState(0), vi.fn())).toBeNull();
    const s = metCafe(), before = structuredClone(s), change = vi.fn();
    document.body.append(regularWishCard(s, change)!);
    expect(document.body.textContent).toContain(t('wish.mina.ask'));
    expect(document.body.textContent).toContain(t('wish.mina.optional'));
    expect(s).toEqual(before); expect(change).not.toHaveBeenCalled();
    document.querySelector('summary')!.click();
    action('quiet').focus(); action('quiet').click();
    expect(minaReservedTable(s)).toBe(0);
    expect(change).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(document.querySelector('.wish-plan summary'));
    expect(document.querySelector<HTMLDetailsElement>('.wish-plan')!.open).toBe(false);
    expect(action('quiet').getAttribute('aria-pressed')).toBe('true');
    action('pause').click();
    expect(minaReservedTable(s)).toBeNull();
    expect(document.body.textContent).toContain(t('wish.mina.paused'));
    expect(s.coins).toBe(before.coins); expect(s.pantry).toEqual(before.pantry);
  });

  it('explains missing milk drinks and forbids changes during service or from stale buttons', () => {
    const s = metCafe(), changed = vi.fn();
    const card = regularWishCard(s, changed)!; document.body.append(card);
    action('milky').click();
    expect(document.body.textContent).toContain(t('wish.mina.milky.missing'));
    const old = action('quiet'); card.remove(); old.click();
    expect(minaWish(s)!.choice).toBe('milky');
    openShop(s); document.body.append(regularWishCard(s, changed)!);
    expect(action('quiet').disabled).toBe(true);
    expect(action('pause').disabled).toBe(true);
    expect(document.body.textContent).toContain(t('wish.mina.closedOnly'));
  });

  it('preparation preserves its menu and focus while changing a wish, and still permits opening', () => {
    const s = metCafe(), changed = vi.fn();
    showPrepare(s, vi.fn(), changed);
    document.querySelector<HTMLElement>('.wish-plan summary')!.click();
    action('milky').focus(); action('milky').click();
    expect(minaWish(s)!.choice).toBe('milky');
    expect(document.activeElement).toBe(document.querySelector('.wish-plan summary'));
    expect(document.querySelector<HTMLDetailsElement>('.wish-plan')!.open).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-start]')!.disabled).toBe(false);
    expect(s.onMenu).toEqual(['espresso']);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('shows choice-specific rehearsal, keeps original chapter reading separate, and reports the later map', () => {
    const s = metCafe(); chooseMinaWish(s, 'quiet'); openShop(s);
    recordRegularGuestService(s, 'mina', recordRegularGuestArrival(s, 'mina')!, { seat: 0, items: ['espresso'] });
    const read = [...s.regularGuests.guests.mina!.readChapters];
    const life = new CafeLife(vi.fn()); document.body.append(life.element);
    life.update(s, [{ regularGuestId: 'mina', phase: 'sitting' }], true);
    expect(life.element.textContent).toContain(t('wish.mina.notice.rehearsed'));
    expect(isModalOpen()).toBe(false);
    life.element.querySelector('button')!.click();
    expect(isModalOpen()).toBe(true);
    expect(document.body.textContent).toContain(t('wish.mina.rehearsed.quiet'));
    expect(s.regularGuests.guests.mina!.readChapters).toEqual(read);
    closeModal();
    const report = finishDay(s);
    expect(regularWishReportHtml(s, report.day)).toContain(t('wish.mina.rehearsed.quiet'));
    openShop(s);
    recordRegularGuestService(s, 'mina', recordRegularGuestArrival(s, 'mina')!, { seat: -1, items: ['espresso'] });
    const mapReport = finishDay(s);
    expect(regularWishReportHtml(s, mapReport.day)).toContain(t('wish.mina.memory.quiet'));
    document.body.append(regularWishCard(s, vi.fn())!);
    expect(document.querySelector('.wish-map')?.getAttribute('aria-label')).toBe(t('wish.mina.map.alt'));
    action('map').click();
    expect(minaWish(s)!.displayed).toBe(false);
    expect(regularWishReportHtml(s, mapReport.day)).toContain(t('wish.mina.map.stored'));
    expect(regularWishReportHtml(s, mapReport.day + 1)).toBe('');
    expect(document.body.textContent).toContain(t('wish.mina.memory.quiet'));
    expect(document.body.textContent).not.toContain(t('wish.mina.memory.milky'));
    const compact = regularWishCard(s, vi.fn(), true)!;
    expect(compact.textContent).toContain(t('wish.mina.map.short'));
    expect(compact.textContent).not.toContain(t('wish.mina.memory.quiet'));
    expect(compact.querySelector('canvas')).toBeNull();
  });
});
