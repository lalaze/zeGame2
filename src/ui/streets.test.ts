// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { buyStreetPlot, fitOutStreetPlot } from '../game/streets';
import { setLocale } from '../i18n';
import { closeModal } from './modal';
import { showStreetMap, updateStreetMap } from './streets';
import { streetSceneryArt, streetShopArt } from '../render/street-art';
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => ({ toDataURL: () => 'data:,' }) }));
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); vi.useRealTimers(); });
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
function pay(selector: string) {
  vi.advanceTimersByTime(650); button(selector).click();
  vi.advanceTimersByTime(650); button('[data-street-confirm-accept]').click();
}
function open() {
  vi.useFakeTimers(); vi.setSystemTime(0); setLocale('zh');
  document.body.innerHTML = '<div id="modal-root"></div>';
  const state = createInitialState(0); state.day = 3; state.coins = 1_000_000;
  const changed = vi.fn(), visit = vi.fn();
  showStreetMap(state, changed, visit);
  return { state, changed, visit };
}
describe('street selection and property management', () => {
  it('keeps pixel icons decorative, buttons named and the business selector native', () => {
    open();
    const home=button('[data-street-home]'); expect(home.textContent).toContain('回到咖啡馆');
    for (const icon of document.querySelectorAll('.street-ui-icon')) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
    }
    expect(button('[data-street-prev]').getAttribute('aria-label')).toBeTruthy();
    expect(button('[data-street-next]').getAttribute('aria-label')).toBeTruthy();
    button('[data-plot="01"]').click();
    expect(document.querySelector('#street-business')?.tagName).toBe('SELECT');
    expect(button('[data-street-detail-close]').getAttribute('aria-label')).toContain('关闭');
  });
  it('exposes lock markers and written requirements while allowing street previews', () => {
    const {state}=open();const flowers=button('[data-street="flowers"]');
    expect(flowers.dataset.locked).toBe('true');expect(flowers.textContent).toContain('2');
    expect(flowers.disabled).toBe(false);flowers.click();expect(flowers.getAttribute('aria-pressed')).toBe('true');
    for (const id of ['town:01','town:02'] as const) state.streets.lots[id]={business:null,level:1,mode:'short',readyAt:0,since:0};
    updateStreetMap();expect(flowers.dataset.locked).toBe('false');expect(flowers.textContent).toContain('可以选址');
  });
  it('rejects immediate pointer and detail-zero activation after a shop opens', () => {
    const { state } = open(); button('[data-plot="03"]').click();
    for (const detail of [0, 1, 2]) button('[data-street-buy]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
    expect(state.coins).toBe(1_000_000); expect(state.streets.lots['town:03']).toBeUndefined();
    expect(button('[data-street-confirm]').hidden).toBe(true);
  });
  it('requires separate guarded confirmations for land and renovation, including keyboard clicks', () => {
    const { state } = open(); button('[data-plot="03"]').click();
    vi.advanceTimersByTime(650); button('[data-street-buy]').click();
    expect(state.coins).toBe(1_000_000); expect(button('[data-street-confirm]').hidden).toBe(false);
    button('[data-street-confirm-accept]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(state.coins).toBe(1_000_000);
    vi.advanceTimersByTime(650); button('[data-street-confirm-accept]').click();button('[data-street-confirm-accept]').click();
    expect(state.coins).toBe(991_000); expect(state.streets.lots['town:03']?.business).toBeNull();
    button('[data-street-fitout]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(button('[data-street-confirm]').hidden).toBe(true);
    vi.advanceTimersByTime(650);button('[data-street-fitout]').click();
    expect(state.streets.lots['town:03']?.business).toBeNull();
    const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    button('[data-street-confirm-accept]').dispatchEvent(repeat); expect(repeat.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(650);button('[data-street-confirm-accept]').click();
    expect(state.coins).toBe(990_400); expect(state.streets.lots['town:03']?.business).toBe('reading');
  });
  it('cancels a pending payment on Escape and street navigation without spending', () => {
    const { state } = open();button('[data-plot="01"]').click();vi.advanceTimersByTime(650);button('[data-street-buy]').click();
    button('[data-street-confirm-cancel]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button('[data-street-confirm]').hidden).toBe(true);expect(button('.street-detail').hidden).toBe(false);
    vi.advanceTimersByTime(650);button('[data-street-buy]').click();button('[data-street="seaside"]').click();
    vi.advanceTimersByTime(650);button('[data-street-confirm-accept]').click();
    expect(state.coins).toBe(1_000_000);expect(state.streets.lots).toEqual({});
  });
  it('moves keyboard focus between storefronts without opening them or changing the business selector', () => {
    open();const first = button('[data-plot="01"]');first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(button('[data-plot="02"]'));expect(button('.street-detail').hidden).toBe(true);
    button('[data-plot="02"]').click();const select = document.querySelector<HTMLSelectElement>('#street-business')!;select.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });select.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);expect(document.activeElement).toBe(select);
  });
  it('Escape still closes only the detail when a disabled click has blurred focus outside the street', () => {
    open();button('[data-plot="03"]').click();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button('.street-detail').hidden).toBe(true);expect(document.querySelector('.street-view')).not.toBeNull();
    expect(document.activeElement).toBe(button('[data-plot="03"]'));
  });
  it('uses document-absolute sprite URLs in CSS variables for production stylesheets', () => {
    open();
    expect(streetSceneryArt()).toMatch(/--guest:url\('http[^']+\/art\/street-scene\/guest-0.webp'\)/);
    expect(button('[data-plot="01"]').style.getPropertyValue('--guest')).toMatch(/url\("http.*\/art\/street-scene\/guest-2.webp"\)/);
  });
  it('starts at the top, previews locked streets, and separates land purchase from fitting out', () => {
    const { state, changed } = open();
    expect(document.activeElement).toBe(document.querySelector('.street-panorama'));
    expect(button('.street-detail').hidden).toBe(true);
    expect(document.querySelectorAll('[data-street]')).toHaveLength(5);
    button('[data-street="seaside"]').click(); button('[data-plot="01"]').click();
    expect(button('[data-street-buy]').disabled).toBe(true);
    expect(document.querySelector('.street-reason')!.textContent).toContain('再拥有 4 间铺位');
    button('[data-street="town"]').click(); button('[data-plot="02"]').click();
    pay('[data-street-buy]');
    expect(state.coins).toBe(996_400);
    expect(state.streets.lots['town:02']?.business).toBeNull();
    expect(button('[data-street-fitout]').hidden).toBe(false);
    pay('[data-street-fitout]');
    expect(state.streets.lots['town:02']?.business).toBe('reading');
    expect(state.coins).toBe(995_800);
    expect(document.querySelector('[data-street-status]')!.textContent).toContain('装修中');
    expect(state.regions).toEqual([]);
    expect(changed).toHaveBeenCalled();
  });
  it('updates in-place after renovation, collects once and preserves keyboard focus', () => {
    const { state } = open();
    buyStreetPlot(state, 'town', '01', 0); fitOutStreetPlot(state, 'town:01', 'reading', 0);
    vi.setSystemTime(40 * 60_000); updateStreetMap(); button('[data-plot="01"]').click();
    const mode = button('[data-street-mode="long"]'); mode.focus(); updateStreetMap();
    expect(document.activeElement).toBe(mode);
    const collect = button('[data-street-collect]'); expect(collect.disabled).toBe(false); collect.click(); collect.click();
    expect(state.roomProjects.inspiration).toBe(2);
    expect(collect.disabled).toBe(true);
    closeModal(); updateStreetMap();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('uses approved complete storefronts, stable vacant variants and onsite renovation', () => {
    const book = streetShopArt('town', 'reading', 'open'), tea = streetShopArt('town', 'observatory', 'open');
    for (const art of [book, tea]) { expect(art).toContain('/art/street-art-v2/'); expect(art).not.toContain('<svg'); expect(art).not.toContain('street-window'); }
    expect(book).toContain('bookshop.webp'); expect(tea).toContain('tea-shop.webp');
    expect(streetShopArt('town', 'reading', 'building')).toContain('street-hoarding');
    expect(streetShopArt('town', null, 'sale')).toContain('vacant-brick.webp');
    expect(streetShopArt('town', null, 'vacant', '02')).toContain('vacant-blue.webp');
    expect(streetShopArt('seaside', 'reading', 'open')).toContain('bookshop.webp');
    open(); expect(button('[data-plot="01"]').dataset.storefront).toBe('vacant-brick');
    expect(button('[data-plot="02"]').dataset.storefront).toBe('vacant-blue');
  });
  it('keeps browsing free of purchase controls until a property is selected and restores focus on Escape', () => {
    open(); const plot = button('[data-plot="02"]'); plot.click();
    expect(button('.street-detail').hidden).toBe(false);
    expect(document.activeElement).toBe(button('[data-street-detail-close]'));
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button('.street-detail').hidden).toBe(true); expect(document.activeElement).toBe(plot);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('shows land and fit-out quotes and never buys while dragging across a shop', () => {
    const { state } = open(), panorama = button('.street-panorama');
    panorama.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, pointerId: 1, button: 0, bubbles: true }));
    panorama.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, pointerId: 1, bubbles: true }));
    panorama.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    button('[data-plot="01"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(button('.street-detail').hidden).toBe(true); expect(state.streets.lots).toEqual({});
    button('[data-plot="01"]').click();
    expect(document.querySelector('[data-street-prices]')!.textContent).toContain('$1200');
    expect(document.querySelector('[data-street-prices]')!.textContent).toContain('$600');
    pay('[data-street-buy]'); expect(state.streets.lots['town:01']?.business).toBeNull();
  });
  it('allows keyboard activation after dragging and returns focus after purchase', () => {
    open(); const panorama = button('.street-panorama');
    panorama.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, pointerId: 1, button: 0, bubbles: true }));
    panorama.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, pointerId: 1, bubbles: true }));
    panorama.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    button('[data-plot="01"]').click();
    expect(button('.street-detail').hidden).toBe(false);
    pay('[data-street-buy]');
    expect(document.activeElement).toBe(document.querySelector('#street-business'));
    pay('[data-street-fitout]');
    expect(document.activeElement).toBe(button('[data-street-detail-close]'));
  });
  it('preserves separate property states across streets and closes details on navigation', () => {
    const { state } = open();
    buyStreetPlot(state, 'town', '01', 0); buyStreetPlot(state, 'town', '02', 0);
    button('[data-street="flowers"]').click();
    expect(button('.street-detail').hidden).toBe(true);
    button('[data-plot="01"]').click(); pay('[data-street-buy]');
    expect(state.streets.lots['flowers:01']?.business).toBeNull();
    expect(Object.keys(state.streets.lots)).toHaveLength(3);
    button('[data-street="town"]').click(); expect(button('[data-plot="01"]').dataset.status).toBe('vacant');
    expect(document.querySelectorAll('.street-home')).toHaveLength(1);
  });
  it('returns to the main café and never enters an extension room', () => {
    const { visit } = open(); button('.street-home').click();
    expect(visit).toHaveBeenCalledWith('main');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
