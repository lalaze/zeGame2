// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU, INGREDIENTS } from '../game/data';
import { openShop } from '../game/day';
import { restockPlan, servingsLeft } from '../game/economy';
import { operationStatus } from '../game/operations';
import { makeSignatureId, saveSignature, setSignatureOnMenu, trialSignature } from '../game/signature-drinks';
import { Sim } from '../game/sim';
import { createInitialState, serialize } from '../game/state';
import { getLocale, setLocale, t } from '../i18n';
import { cafeInteractionEnabled } from './cafe-interaction';
import { displayItemName } from './item-name';
import { closeModal, showModal, isModalOpen } from './modal';
import { Panel, type PanelTab } from './panel';
import { readPanelScroll } from './panel-scroll';
import { PlayFlow } from './play-flow';

vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'), itemArtwork: () => document.createElement('canvas'),
  upgradeIcon: () => document.createElement('canvas'), catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: () => 'data:image/png;base64,',
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));
const tabs: PanelTab[] = ['menu', 'pantry', 'upgrades', 'decor', 'pets', 'promotion'];
const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const button = (selector: string) => q<HTMLButtonElement>(selector);
const flows: PlayFlow[] = [];

function fixture(state = createInitialState(0), mobile = false) {
  document.body.innerHTML = `<div id="app"><button id="opener">Stock warning</button><button id="other">Other</button><section id="management-panel">
    <nav class="tabs" role="tablist">${tabs.map(tab => `<button role="tab" data-tab="${tab}">${tab}</button>`).join('')}</nav>
    <div class="panel-scroll"><div id="goal"></div>
    <div class="buy-amount"><button data-amount="1">1</button><button data-amount="10">10</button><button data-amount="max">Max</button></div>
    <div class="pantry-amount" hidden><button data-pantry-amount="10">10</button><button data-pantry-amount="50">50</button><button data-pantry-amount="200">200</button></div>
    <div class="menu-filter"><button data-cat="all">All</button><button data-cat="coffee">Coffee</button><button data-cat="tea">Tea</button></div>
    <div id="list"></div></div></section></div><div id="modal-root"></div><div id="toast" hidden></div>`;
  const root = q('#management-panel'), list = q('#list'), wrapper = q('.panel-scroll');
  root.classList.toggle('mobile-panel', mobile);
  const prefix = () => q('#goal').hidden ? 40 : 110;
  vi.spyOn(wrapper, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 390, 400));
  vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0,
    root.classList.contains('mobile-panel') ? prefix() - wrapper.scrollTop : 0, 390, 1000));
  const purchased = vi.fn();
  const panel = new Panel(root, list, q('#goal'), state, purchased, vi.fn());
  panel.showTab('menu');
  let collapsed = false, active = true, sceneAllowed = true;
  const collapse = vi.fn((value: boolean) => {
    if (value && !collapsed) panel.captureBrowsingContext();
    collapsed = value; root.hidden = value;
  });
  const sim = new Sim(() => .5);
  const help = vi.fn(() => sim.boost());
  const flow = new PlayFlow({
    panel, state: () => state, canInteract: () => sceneAllowed && cafeInteractionEnabled(active, isModalOpen()),
    help, isPanelCollapsed: () => collapsed, setPanelCollapsed: collapse,
    labels: () => getLocale() === 'zh' ? {
      title: '服务操作', help: '帮忙制作', helpHint: '员工会自动服务。每游戏秒最多一次。', pantry: '食材', back: '返回',
      returnTo: (tab) => tab ? `返回${t(`tab.${tab}`)}` : '返回咖啡馆',
    } : {
      title: 'Service actions', help: 'Help brew', helpHint: 'Optional. Staff keep serving automatically. Once per game second.', pantry: 'Pantry', back: 'Back',
      returnTo: (tab) => tab ? `Return to ${t(`tab.${tab}`)}` : 'Return to café',
    },
    pantryContext: (shortage) => {
      const status = operationStatus(state, sim);
      return { title: t('tab.pantry'), detail: !shortage ? '' : status.kind === 'ingredients'
        ? `${displayItemName(status.item!, state)} · ${status.ingredients!.map(id => t(`ing.${id}`)).join(', ')}` : 'Stock is available',
      ingredients: shortage && status.kind === 'ingredients' ? status.ingredients! : [] };
    },
  });
  q('#app').append(flow.element); flows.push(flow);
  return { state, panel, flow, root, list, wrapper, sim, help, purchased, collapse, prefix,
    setCollapsed: collapse, setActive: (v: boolean) => { active = v; }, setSceneAllowed: (v: boolean) => { sceneAllowed = v; } };
}
function liveState() { const state = createInitialState(0); state.phase = 'open'; state.coins = 10000; return state; }
beforeEach(() => { setLocale('en'); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {}); });
afterEach(() => { closeModal(); for (const flow of flows.splice(0)) flow.destroy(); vi.restoreAllMocks(); document.body.replaceChildren(); setLocale('en'); });

describe('reversible service Pantry task', () => {
  it.each(tabs)('returns to %s with original amounts, scroll and stable focus, without spending', (tab) => {
    const s = liveState(); for (const item of MENU) s.items[item.id] = 1;
    const f = fixture(s);
    button('[data-amount="max"]').click(); button('[data-cat="tea"]').click();
    f.panel.showTab('pantry'); button('[data-pantry-amount="200"]').click(); f.list.scrollTop = 177;
    f.panel.showTab(tab); f.list.scrollTop = 438;
    const origin = button(`[data-tab="${tab}"]`); origin.focus();
    const before = serialize(s);
    f.flow.pantryButton.focus(); // Native focus has already left the original panel.
    f.flow.pantryButton.click();
    expect(f.panel.currentTab).toBe('pantry'); expect(q('.tabs').hidden).toBe(true); expect(q('#goal').hidden).toBe(true);
    expect(document.activeElement).toBe(q('.pantry-task-context'));
    button('[data-pantry-amount="50"]').click(); f.list.scrollTop = 777;
    f.flow.pantryButton.click();
    expect(f.panel.currentTab).toBe(tab); expect(f.list.scrollTop).toBe(438);
    expect(button('[data-amount="max"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-cat="tea"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-pantry-amount="200"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(button(`[data-tab="${tab}"]`));
    expect(q('.tabs').hidden).toBe(false); expect(f.flow.pantryOpen).toBe(false); expect(serialize(s)).toBe(before);
    f.panel.showTab('pantry'); expect(f.list.scrollTop).toBe(tab === 'pantry' ? 438 : 177);
  });

  it('restores a recreated action rather than its stale DOM reference', () => {
    const f = fixture(liveState()); f.panel.showTab('menu');
    const origin = button('[data-buy="item:americano"]'); origin.focus(); f.list.scrollTop = 240;
    f.flow.openPantry(); f.flow.returnToPrevious();
    expect(button('[data-buy="item:americano"]')).not.toBe(origin);
    expect(document.activeElement).toBe(button('[data-buy="item:americano"]')); expect(f.list.scrollTop).toBe(240);
  });

  it('falls back to the active tab if the original action becomes disabled', () => {
    const f = fixture(liveState()); button('[data-buy="item:americano"]').focus();
    f.flow.openPantry(); f.state.coins = 0; f.flow.returnToPrevious();
    expect(document.activeElement).toBe(button('[data-tab="menu"]'));
  });

  it('restores a collapsed origin and its external launcher without storing a preference', () => {
    const f = fixture(liveState()); f.panel.showTab('decor'); f.list.scrollTop = 666; f.setCollapsed(true);
    const storage = vi.spyOn(Storage.prototype, 'setItem'); q('#opener').focus();
    f.flow.openPantry(true, q('#opener')); expect(f.root.hidden).toBe(false);
    f.flow.returnToPrevious(); expect(f.root.hidden).toBe(true); expect(f.panel.currentTab).toBe('decor');
    expect(f.list.scrollTop).toBe(666); expect(document.activeElement).toBe(q('#opener')); expect(storage).not.toHaveBeenCalled();
  });

  it('uses the last visible mobile offset when a collapsed panel has zero geometry', () => {
    const f = fixture(liveState(), true); f.panel.showTab('decor'); f.wrapper.scrollTop = f.prefix() + 674;
    f.wrapper.dispatchEvent(new Event('scroll')); f.panel.captureBrowsingContext(); f.setCollapsed(true);
    vi.mocked(f.list.getBoundingClientRect).mockImplementation(() => f.root.hidden ? new DOMRect() : new DOMRect(0, f.prefix() - f.wrapper.scrollTop, 390, 1000));
    f.flow.openPantry(true); f.flow.returnToPrevious(); expect(f.root.hidden).toBe(true);
    f.setCollapsed(false); expect(readPanelScroll(f.list, f.wrapper)).toBe(674);
  });

  it('preserves Cats owned/catalog choices and furnishing category through rebuilding', () => {
    const f = fixture(liveState()); f.state.pets = [{ id: 'ginger', careSeconds: 120, autoRefill: true }];
    f.panel.showTab('pets'); button('[data-pet-group="longhair"]').click(); button('[data-choose-cat="persian"]').click();
    button('[data-pet-view="owned"]').click(); button('[data-pet-view="owned"]').focus(); f.list.scrollTop = 306;
    f.flow.openPantry(); f.flow.returnToPrevious(); expect(f.list.scrollTop).toBe(306);
    expect(button('[data-pet-view="owned"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-pet-group="longhair"]').getAttribute('aria-pressed')).toBe('true');
    expect(button('[data-choose-cat="persian"]').getAttribute('aria-pressed')).toBe('true');
    f.panel.showTab('decor'); button('[data-decor-category="furniture"]').click(); f.list.scrollTop = 710;
    f.flow.openPantry(); f.flow.returnToPrevious(); expect(f.list.scrollTop).toBe(710);
    expect(button('[data-decor-category="furniture"]').classList.contains('active')).toBe(true);
  });

  it('keeps catalog-relative positions across mobile/desktop and restored goal prefixes', () => {
    const f = fixture(liveState(), true); f.panel.showTab('decor'); f.wrapper.scrollTop = f.prefix() + 512;
    f.flow.openPantry(true); expect(readPanelScroll(f.list, f.wrapper)).toBe(0);
    f.root.classList.remove('mobile-panel'); f.flow.returnToPrevious(); expect(f.list.scrollTop).toBe(512);
    f.flow.openPantry(true); f.root.classList.add('mobile-panel'); f.flow.returnToPrevious();
    expect(readPanelScroll(f.list, f.wrapper)).toBe(512); expect(f.wrapper.scrollTop).toBe(f.prefix() + 512);
  });

  it('does not rebuild, repeat scrolling, or overwrite the origin on repeated entry and updates', () => {
    const f = fixture(liveState()); f.panel.showTab('decor'); f.list.scrollTop = 555;
    f.flow.openPantry(true); const buy = button('[data-buy="ing:beans"]'); buy.focus(); f.list.scrollTop = 128;
    const rebuild = vi.spyOn(f.list, 'replaceChildren');
    for (let i = 0; i < 10; i++) { f.flow.openPantry(true); f.panel.update(); f.flow.update(); }
    expect(f.list.scrollTop).toBe(128); expect(document.activeElement).toBe(buy); expect(rebuild).not.toHaveBeenCalled();
    f.flow.returnToPrevious(); expect(f.panel.currentTab).toBe('decor'); expect(f.list.scrollTop).toBe(555);
  });

  it('lets newer navigation win before its destination scroll geometry is restored', () => {
    const f = fixture(liveState(), true); f.panel.showTab('decor'); f.wrapper.scrollTop = f.prefix() + 603;
    f.panel.showTab('menu'); f.flow.openPantry(true); f.panel.showTab('decor');
    expect(f.flow.pantryOpen).toBe(false); expect(q('.tabs').hidden).toBe(false);
    expect(readPanelScroll(f.list, f.wrapper)).toBe(603); expect(f.flow.returnToPrevious()).toBe(false);
    expect(f.panel.currentTab).toBe('decor');
  });

  it('cleans up a checkpoint when the café state is replaced', () => {
    const f = fixture(liveState()); f.flow.openPantry(); f.panel.setState(createInitialState(9));
    expect(f.flow.pantryOpen).toBe(false); expect(q('.pantry-task-context').hidden).toBe(true);
  });

  it('retains real purchases but restores the original quantity after return', () => {
    const f = fixture(liveState()); f.panel.showTab('pantry'); button('[data-pantry-amount="200"]').click(); f.list.scrollTop = 163;
    f.state.pantry.beans = 0; const cash = f.state.coins;
    f.flow.openPantry(true); button('[data-pantry-amount="10"]').click(); button('[data-buy="ing:beans"]').click();
    f.flow.returnToPrevious(); expect(f.state.pantry.beans).toBe(10); expect(f.state.coins).toBe(cash - 10);
    expect(f.purchased).toHaveBeenCalledWith('ingredient', 'beans'); expect(f.list.scrollTop).toBe(163);
    expect(button('[data-pantry-amount="200"]').getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['en', 'zh'] as const)('keeps a literal signature-only shortage and existing whole-unit restock flow in %s', (locale) => {
    setLocale(locale); const s = createInitialState(0); s.items.latte = 1;
    s.pantry.beans = s.pantry.milk = 10; const formula = { beans: 1, milk: 2 };
    expect(trialSignature(s, 'coffee', formula).ok).toBe(true); const id = makeSignatureId('coffee', formula)!;
    saveSignature(s, id, '<b>莓 & 雲</b>'); setSignatureOnMenu(s, id, true); s.onMenu = [];
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 0; s.pantry.milk = .75; s.coins = 5; s.phase = 'open';
    const f = fixture(s); const before = serialize(s), quote = restockPlan(s);
    f.flow.openPantry(true); expect(serialize(s)).toBe(before);
    expect(q('.pantry-task-context').textContent).toContain('<b>莓 & 雲</b>'); expect(q('.pantry-task-context').querySelector('b')).toBeNull();
    expect(document.querySelectorAll('.pantry-shortfall')).toHaveLength(2);
    expect(button('[data-restock]').textContent).toContain(String(quote.cost));
    button('[data-restock]').click(); f.flow.update(); expect(servingsLeft(s, id)).toBe(1); expect(s.coins).toBe(0);
    expect(s.pantry.beans).toBe(1); expect(s.pantry.milk).toBe(2.75); expect(f.purchased).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('.pantry-shortfall')).toHaveLength(0);
    expect(button('[data-restock]').disabled).toBe(true); button('[data-restock]').click(); expect(f.purchased).toHaveBeenCalledOnce();
    f.flow.returnToPrevious(); expect(s.coins).toBe(0); expect(servingsLeft(s, id)).toBe(1);
  });

  it('handles a recovered stale warning without buying or announcing obsolete ingredients', () => {
    const f = fixture(liveState()); const before = serialize(f.state); f.flow.openPantry(true);
    expect(q('.pantry-task-context').textContent).toContain('Stock is available');
    expect(document.querySelectorAll('.pantry-shortfall')).toHaveLength(0); expect(serialize(f.state)).toBe(before);
  });

  it('survives locale refresh with the same task and restores the original control', () => {
    const f = fixture(liveState()); button('[data-buy="item:americano"]').focus(); f.list.scrollTop = 141;
    f.flow.openPantry(true); const before = serialize(f.state); setLocale('zh'); f.panel.refresh(); f.flow.update();
    expect(f.flow.helpButton.textContent).toBe('帮忙制作'); expect(f.flow.pantryButton.textContent).toBe('返回');
    f.flow.returnToPrevious(); expect(f.list.scrollTop).toBe(141); expect(document.activeElement).toBe(button('[data-buy="item:americano"]'));
    expect(serialize(f.state)).toBe(before);
  });
});

describe('service action gating, modal interruption and shared help', () => {
  it.each(['prep', 'modal', 'hidden', 'inactive', 'notice', 'onboard', 'scene'] as const)('rechecks %s at activation before a new frame', (blocker) => {
    const f = fixture(liveState()); const before = serialize(f.state);
    if (blocker === 'prep') f.state.phase = 'prep';
    if (blocker === 'modal') showModal({ title: 'Paused', body: '', buttons: [{ label: 'Back' }] });
    if (blocker === 'hidden') vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    if (blocker === 'inactive') f.setActive(false);
    if (blocker === 'notice') document.body.insertAdjacentHTML('beforeend', '<div id="save-session-notice"></div>');
    if (blocker === 'onboard') document.body.insertAdjacentHTML('beforeend', '<div class="onboard-overlay"></div>');
    if (blocker === 'scene') f.setSceneAllowed(false);
    f.flow.helpButton.click(); f.flow.pantryButton.click(); expect(f.help).not.toHaveBeenCalled(); expect(f.flow.pantryOpen).toBe(false);
    if (blocker !== 'prep') expect(serialize(f.state)).toBe(before);
  });

  it('uses the actual shared Sim cooldown with no queued or held-repeat boost', () => {
    const s = createInitialState(0); const f = fixture(s); openShop(s); f.flow.update();
    for (let i = 0; i < 2000 && !f.sim.baristas.some(b => b.remaining > 1); i++) f.sim.update(s, .05);
    const b = f.sim.baristas.find(b => b.remaining > 1)!; expect(b).toBeDefined(); const before = b.remaining;
    f.flow.helpButton.click(); expect(b.remaining).toBeCloseTo(before - .3);
    expect(f.sim.boost()).toBe(false); // Same underlying action used by the scene.
    for (let i = 0; i < 10; i++) f.flow.helpButton.click(); expect(b.remaining).toBeCloseTo(before - .3);
    const repeated = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, cancelable: true, bubbles: true });
    f.flow.helpButton.dispatchEvent(repeated); expect(repeated.defaultPrevented).toBe(true);
    f.sim.update(s, 1.01); const afterTime = b.remaining; f.flow.update(); expect(b.remaining).toBe(afterTime);
  });

  it('does not create any service work if a help callback returns false', () => {
    const f = fixture(liveState()); const before = serialize(f.state);
    f.flow.helpButton.click(); expect(f.help).toHaveReturnedWith(false); expect(serialize(f.state)).toBe(before);
  });

  it('keeps a Pantry task through a modal, then lets Escape return it', () => {
    const f = fixture(liveState()); f.flow.openPantry(); f.flow.pantryButton.focus();
    showModal({ title: 'Details', body: 'Paused', buttons: [{ label: 'Back' }] });
    expect(f.flow.handleEscape(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))).toBe(false);
    closeModal(); expect(f.flow.pantryOpen).toBe(true);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    expect(f.flow.handleEscape(escape)).toBe(true); expect(escape.defaultPrevented).toBe(true); expect(f.flow.pantryOpen).toBe(false);
  });

  it('does not take Escape from editing or composition', () => {
    const f = fixture(liveState()); f.flow.openPantry();
    const input = document.createElement('input'); q('#app').append(input);
    input.addEventListener('keydown', event => { expect(f.flow.handleEscape(event)).toBe(false); });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(f.flow.handleEscape(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }))).toBe(false);
    expect(f.flow.pantryOpen).toBe(true);
  });

  it('cleans up at settlement without stealing dialog focus or retaining Back in prep', () => {
    const f = fixture(liveState()); f.state.phase = 'closing'; f.flow.update(); f.flow.openPantry();
    showModal({ title: 'Day report', body: '', buttons: [{ label: 'Next day' }] }); const modalFocus = document.activeElement;
    f.state.phase = 'prep'; f.flow.update(); expect(f.flow.element.hidden).toBe(true); expect(f.flow.pantryOpen).toBe(false);
    expect(document.activeElement).toBe(modalFocus); expect(q('.pantry-task-context').hidden).toBe(true);
  });

  it('keeps menu editing gated throughout the temporary navigation', () => {
    const f = fixture(liveState()); const before = [...f.state.onMenu];
    expect(button('[data-menu="espresso"]').disabled).toBe(true);
    f.flow.openPantry(); f.flow.returnToPrevious(); button('[data-menu="espresso"]').click();
    expect(f.state.onMenu).toEqual(before); expect(button('[data-menu="espresso"]').disabled).toBe(true);
  });

  it('makes destroyed controls and callbacks harmless', () => {
    const f = fixture(liveState()); f.flow.openPantry(); f.flow.destroy();
    expect(f.flow.element.isConnected).toBe(false); f.flow.helpButton.click(); expect(f.help).not.toHaveBeenCalled();
    expect(f.flow.openPantry()).toBe(false); f.panel.showTab('decor'); expect(f.panel.currentTab).toBe('decor');
  });
});

/** Model native button defaults explicitly: happy-dom does not synthesize the
 * Enter-keydown / Space-keyup click that a browser does. */
function nativeKey(type: 'keydown' | 'keyup', key: string, repeat = false): KeyboardEvent {
  const target = document.activeElement as HTMLElement;
  const event = new KeyboardEvent(type, { key, repeat, cancelable: true, bubbles: true });
  target.dispatchEvent(event);
  if (!event.defaultPrevented && target instanceof HTMLButtonElement && !target.disabled
    && (key === 'Enter' && type === 'keydown' || key === ' ' && type === 'keyup')) target.click();
  return event;
}

describe('one complete keyboard activation before returning purchase focus', () => {
  it('waits for Enter release before Back restores purchase focus, then accepts a fresh key', () => {
    const f = fixture(liveState()); button('[data-buy="item:americano"]').focus();
    f.flow.openPantry(); f.flow.pantryButton.focus(); const cash = f.state.coins;
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(true);
    expect(f.flow.pantryOpen).toBe(true); expect(document.activeElement).toBe(f.flow.pantryButton);
    for (let i = 0; i < 5; i++) expect(nativeKey('keydown', 'Enter', true).defaultPrevented).toBe(true);
    // An extra keyboard-shaped click cannot cause early return during this press.
    f.flow.pantryButton.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    expect(f.flow.pantryOpen).toBe(true); expect(f.purchased).not.toHaveBeenCalled(); expect(f.state.coins).toBe(cash);
    nativeKey('keyup', 'Enter'); expect(f.flow.pantryOpen).toBe(false);
    expect(document.activeElement).toBe(button('[data-buy="item:americano"]')); expect(f.state.coins).toBe(cash);
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(false);
    expect(f.purchased).toHaveBeenCalledOnce(); expect(f.state.coins).toBeLessThan(cash);
  });

  it('uses the same release boundary for Enter on the ordinary Pantry shortcut', () => {
    const f = fixture(liveState()); f.flow.pantryButton.focus();
    nativeKey('keydown', 'Enter'); expect(f.flow.pantryOpen).toBe(false);
    nativeKey('keydown', 'Enter', true); expect(f.flow.pantryOpen).toBe(false);
    nativeKey('keyup', 'Enter'); expect(f.flow.pantryOpen).toBe(true);
    expect(document.activeElement).toBe(q('.pantry-task-context')); expect(f.purchased).not.toHaveBeenCalled();
  });

  it('retains Space keyup and assistive-technology click activation without a stale lock', () => {
    const f = fixture(liveState()); button('[data-buy="item:americano"]').focus(); f.flow.openPantry();
    f.flow.pantryButton.focus(); nativeKey('keydown', ' '); nativeKey('keydown', ' ', true);
    expect(f.flow.pantryOpen).toBe(true); nativeKey('keyup', ' '); expect(f.flow.pantryOpen).toBe(false);
    expect(f.purchased).not.toHaveBeenCalled();
    f.flow.pantryButton.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true })); expect(f.flow.pantryOpen).toBe(true);
    f.flow.pantryButton.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true })); expect(f.flow.pantryOpen).toBe(false);
    expect(f.purchased).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button('[data-buy="item:americano"]'));
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(false); expect(f.purchased).toHaveBeenCalledOnce();
  });

  it('does not let an Enter repeat activate a modal that interrupted the press', () => {
    const f = fixture(liveState()); f.flow.openPantry(); f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    const action = vi.fn(); showModal({ title: 'Other task', body: '', buttons: [{ label: 'Continue', onClick: action }] });
    expect(nativeKey('keydown', 'Enter', true).defaultPrevented).toBe(true); expect(action).not.toHaveBeenCalled();
    nativeKey('keyup', 'Enter'); expect(f.flow.pantryOpen).toBe(true); expect(isModalOpen()).toBe(true);
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(false); expect(action).toHaveBeenCalledOnce();
  });

  it.each([false, true])('permanently cancels a held Enter intent after a modal opens and closes (Back: %s)', (back) => {
    const f = fixture(liveState());
    if (back) f.flow.openPantry();
    f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    showModal({ title: 'Interrupt', body: '', buttons: [{ label: 'Back' }] });
    closeModal(); expect(document.activeElement).toBe(f.flow.pantryButton);
    expect(nativeKey('keydown', 'Enter', true).defaultPrevented).toBe(true);
    nativeKey('keyup', 'Enter'); expect(f.flow.pantryOpen).toBe(back); expect(f.purchased).not.toHaveBeenCalled();
    // A genuinely new complete activation is still accepted.
    nativeKey('keydown', 'Enter'); nativeKey('keyup', 'Enter'); expect(f.flow.pantryOpen).toBe(!back);
  });

  it.each([false, true])('does not revive an Enter intent when focus leaves and returns (Back: %s)', (back) => {
    const f = fixture(liveState());
    if (back) f.flow.openPantry();
    f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    q('#other').focus(); expect(nativeKey('keydown', 'Enter', true).defaultPrevented).toBe(true);
    f.flow.pantryButton.focus(); nativeKey('keyup', 'Enter');
    expect(f.flow.pantryOpen).toBe(back); expect(f.purchased).not.toHaveBeenCalled();
    f.flow.pantryButton.click(); expect(f.flow.pantryOpen).toBe(!back);
  });

  it('does not return to an old task after newer navigation during the held key', () => {
    const f = fixture(liveState()); f.flow.openPantry(); f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    f.panel.showTab('upgrades'); button('[data-buy="upgrade:machine"]').focus();
    nativeKey('keydown', 'Enter', true); expect(f.purchased).not.toHaveBeenCalled(); nativeKey('keyup', 'Enter');
    expect(f.panel.currentTab).toBe('upgrades'); expect(f.flow.pantryOpen).toBe(false);
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(false); expect(f.purchased).toHaveBeenCalledOnce();
  });

  it.each(['tab', 'cancel'] as const)('does not open a delayed Pantry task after newer %s intent', (intent) => {
    const f = fixture(liveState()); f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    if (intent === 'tab') f.panel.showTab('upgrades');
    else f.flow.cancelPantry();
    expect(document.activeElement).toBe(f.flow.pantryButton); nativeKey('keyup', 'Enter');
    expect(f.flow.pantryOpen).toBe(false); expect(f.panel.currentTab).toBe(intent === 'tab' ? 'upgrades' : 'menu');
  });

  it('keeps Escape immediate but guards the still-held Enter until its own release', () => {
    const f = fixture(liveState()); button('[data-buy="item:americano"]').focus(); f.flow.openPantry();
    f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    expect(f.flow.handleEscape(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))).toBe(true);
    expect(document.activeElement).toBe(button('[data-buy="item:americano"]'));
    nativeKey('keydown', 'Enter', true); expect(f.purchased).not.toHaveBeenCalled(); nativeKey('keyup', 'Enter');
    expect(f.flow.pantryOpen).toBe(false); expect(f.purchased).not.toHaveBeenCalled();
  });

  it.each(['blur', 'hidden', 'destroy'] as const)('releases the short guard on %s without a delayed action', (interruption) => {
    const f = fixture(liveState()); f.flow.openPantry(); f.flow.pantryButton.focus(); nativeKey('keydown', 'Enter');
    if (interruption === 'blur') window.dispatchEvent(new Event('blur'));
    if (interruption === 'hidden') {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    }
    if (interruption === 'destroy') f.flow.destroy();
    const target = document.createElement('button'); document.body.append(target); const activated = vi.fn(); target.addEventListener('click', activated); target.focus();
    nativeKey('keyup', 'Enter'); expect(activated).not.toHaveBeenCalled();
    expect(nativeKey('keydown', 'Enter').defaultPrevented).toBe(false); expect(activated).toHaveBeenCalledOnce();
    expect(f.flow.pantryOpen).toBe(interruption !== 'destroy');
  });
});
