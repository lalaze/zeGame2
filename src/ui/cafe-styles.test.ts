/// <reference types="node" />
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, deserialize, serialize } from '../game/state';
import { STYLE_IDS, nextStyleGoal, setCafeStyle, styleStages } from '../game/styles';
import { messagesFor, setLocale, t, type MessageKey } from '../i18n';
import { cafeStyleName, showCafeStyles, updateCafeStyleButton } from './cafe-styles';
import { closeModal, isModalOpen } from './modal';
import { dockMobileControls } from './mobile-layout';
import { showPrepare } from './prepare';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));
const select = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const click = (selector: string) => select<HTMLButtonElement>(selector).click();
const styles = readFileSync('src/style.css', 'utf8');
beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<main><button id="cafe-style-btn" aria-haspopup="dialog">Style</button></main><div id="modal-root"></div>';
  select('#cafe-style-btn').focus();
});
afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('coffee UI first-route gate', () => {
  it.each([
    ['header', null], ['header', 'coffee'],
    ['preparation', null], ['preparation', 'coffee'],
  ] as const)('scrolls the first preview into view from %s with initial focus %s', (entry, initialFocus) => {
    const state = createInitialState(0); setCafeStyle(state, initialFocus);
    const before = serialize(state); const save = vi.fn();
    if (entry === 'header') showCafeStyles(state, save);
    else { showPrepare(state, vi.fn(), save); click('[data-prep-style]'); }
    select<HTMLDetailsElement>('.style-picker').open = true;
    const body = select('.modal-body');
    for (const id of ['community', 'garden'] as const) {
      body.scrollTop = 480;
      click(`[data-style-choice="${id}"]`);
      expect(body.scrollTop).toBe(0);
      expect(document.activeElement).toBe(select('.style-current h3'));
      expect(select('.style-current').dataset.styleView).toBe(id);
      expect(select<HTMLButtonElement>(`[data-style-apply="${id}"]`).disabled).toBe(false);
    }
    expect(serialize(state)).toBe(before); expect(save).not.toHaveBeenCalled();
    select('.cafe-styles-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (entry === 'header') {
      expect(isModalOpen()).toBe(false);
      expect(document.activeElement).toBe(select('#cafe-style-btn'));
    } else expect(document.querySelector('[data-prep-style]')).not.toBeNull();
  });

  it.each(['en', 'zh'] as const)('browses and chooses coffee in %s without rewriting the café or menu', locale => {
    setLocale(locale);
    const state = createInitialState(0);
    const before = structuredClone(state);
    const save = vi.fn();
    showCafeStyles(state, save);
    expect(select<HTMLDetailsElement>('.style-picker').open).toBe(true);
    expect(select<HTMLDetailsElement>('.style-details').open).toBe(false);
    click('[data-style-choice="coffee"]');
    expect(state).toEqual(before);
    expect(select('.style-current').textContent).toContain(t('style.coffee.intro'));
    expect(select('.style-next').textContent).toContain(t('style.goal.espresso5'));
    expect(select('.style-next').textContent).not.toContain(t('style.goal.kitchen'));
    expect(select('.style-details').textContent).toContain('12%');
    expect(select('.style-details').textContent).toContain('4%');
    click('[data-style-apply="coffee"]');
    expect(state.cafeStyle.focus).toBe('coffee');
    expect({ ...state, cafeStyle: before.cafeStyle }).toEqual(before);
    expect(save).toHaveBeenCalledOnce();
    expect(select<HTMLDetailsElement>('.style-picker').open).toBe(false);
    expect(select<HTMLButtonElement>('[data-style-apply="coffee"]').disabled).toBe(true);
    expect(document.activeElement).toBe(select('.style-current h3'));
    expect(select('#cafe-style-btn').getAttribute('aria-label')).toContain(cafeStyleName('coffee'));
    expect(select('.style-keep').textContent).toBe(t('style.ui.keep'));
    expect(select('.style-details').textContent).toContain(t('style.ui.progressNote'));
  });

  it('shows early, mid, late and fully established coffee from real progress', () => {
    const state = createInitialState(0);
    setCafeStyle(state, 'coffee');
    showCafeStyles(state, vi.fn());
    expect(select('.style-stage').textContent).toContain(t('style.stage.early'));
    closeModal();
    state.items.espresso = 5; state.upgrades.machine = 1; state.taste.served.espresso = 30;
    showCafeStyles(state, vi.fn());
    expect(select('.style-stage').textContent).toContain(t('style.stage.mid'));
    expect(select('.style-next').textContent).toContain(t('style.goal.latte5'));
    closeModal();
    state.items.latte = 5; state.upgrades.barista = 1; state.taste.served.espresso = 100; state.taste.signature = ['espresso'];
    showCafeStyles(state, vi.fn());
    expect(select('.style-stage').textContent).toContain(t('style.stage.late'));
    expect(select('.style-next').textContent).toContain(t('style.goal.flatwhite10'));
    closeModal();
    state.items.flatwhite = 10; state.upgrades.machine = 4; state.taste.signature.push('latte'); state.taste.served.latte = 100;
    const before = structuredClone(state);
    const save = vi.fn();
    showCafeStyles(state, save);
    expect(nextStyleGoal(state, 'coffee')).toBeNull();
    expect(select('.style-next').textContent).toContain(t('style.ui.established'));
    expect(document.querySelectorAll('[data-style-stage]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-style-goal].done')).toHaveLength(9);
    expect(state).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['open', 'closing'] as const)('allows reading while %s but cannot choose another style', phase => {
    const state = createInitialState(0); setCafeStyle(state, 'coffee'); state.phase = phase;
    const before = structuredClone(state); const save = vi.fn();
    showCafeStyles(state, save); click('[data-style-choice="mixed"]');
    expect(select<HTMLButtonElement>('[data-style-apply="mixed"]').disabled).toBe(true);
    expect(select('.style-closed-only').textContent).toBe(t('style.ui.closeOnly'));
    click('[data-style-apply="mixed"]');
    expect(state).toEqual(before); expect(save).not.toHaveBeenCalled();
  });

  it('returns to preparation with its menu unchanged and refreshed direction', () => {
    const state = createInitialState(0); const save = vi.fn(); const start = vi.fn();
    showPrepare(state, start, save);
    expect(select('.prep-style').textContent).toContain(cafeStyleName(null));
    click('[data-prep-style]'); click('[data-style-choice="coffee"]'); click('[data-style-apply="coffee"]');
    click('.modal-actions button');
    expect(select('.prep-style').textContent).toContain(cafeStyleName('coffee'));
    expect(select('.prep-style').textContent).toContain(t('style.goal.espresso5'));
    expect(select<HTMLInputElement>('[data-dish="espresso"]').checked).toBe(true);
    expect(state.onMenu).toEqual(['espresso']);
    expect(save).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled();
    click('[data-start]'); expect(start).toHaveBeenCalledOnce();
  });

  it('ignores detached buttons and rechecks the phase at the moment of applying', () => {
    const state = createInitialState(0); const save = vi.fn();
    showCafeStyles(state, save); click('[data-style-choice="coffee"]');
    const old = select<HTMLButtonElement>('[data-style-apply="coffee"]');
    state.phase = 'open'; old.click(); expect(state.cafeStyle.focus).toBeNull();
    state.phase = 'prep'; closeModal(); old.click();
    expect(state.cafeStyle.focus).toBeNull(); expect(save).not.toHaveBeenCalled(); expect(isModalOpen()).toBe(false);
  });

  it('restores discovery focus on Escape and keeps IME Escape within the dialog', () => {
    const state = createInitialState(0); showCafeStyles(state, vi.fn());
    select('.cafe-styles-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
    expect(isModalOpen()).toBe(true);
    select('.cafe-styles-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isModalOpen()).toBe(false); expect(document.activeElement).toBe(select('#cafe-style-btn'));
  });
});

describe('six directions and responsive structure', () => {
  it.each(['en', 'zh'] as const)('provides every direction, goal and effect in %s', locale => {
    setLocale(locale);
    const state = createInitialState(0);
    showCafeStyles(state, vi.fn());
    expect(document.querySelectorAll('[data-style-choice]')).toHaveLength(7);
    for (const id of STYLE_IDS) {
      click(`[data-style-choice="${id}"]`);
      expect(select('.style-current h3').textContent).toBe(cafeStyleName(id));
      expect(select('.style-details').textContent).toContain(t(`style.${id}.effects`));
      for (const stage of styleStages(state, id)) for (const goal of stage.goals) {
        const key = `style.goal.${goal.id}` as MessageKey;
        expect(messagesFor(locale)[key], key).toBeTruthy();
        expect(select(`[data-style-goal="${goal.id}"]`).textContent).toContain(t(key));
      }
      expect(select('.cafe-styles').textContent).not.toMatch(/undefined|NaN|style\.goal\./);
    }
  });

  it.each(STYLE_IDS)('saves %s, reloads it, then returns to a free mix without losing investments', id => {
    const state = createInitialState(0);
    state.coins = 1234; state.kitchen = true; state.items.espresso = 5; state.items.roll = 3; state.onMenu = ['espresso', 'roll'];
    state.upgrades.machine = 2; state.taste.served.espresso = 125; state.taste.signature = ['espresso'];
    state.cafeStyle.handoffs.tableServed = 37;
    const before = structuredClone(state); const save = vi.fn();
    showCafeStyles(state, save); click(`[data-style-choice="${id}"]`); click(`[data-style-apply="${id}"]`);
    expect(save).toHaveBeenCalledOnce();
    const reloaded = deserialize(serialize(state), 0)!;
    expect(reloaded.cafeStyle.focus).toBe(id);
    closeModal(); showCafeStyles(reloaded, save);
    expect(select('.style-current h3').textContent).toBe(cafeStyleName(id));
    click('[data-style-choice="mixed"]'); click('[data-style-apply="mixed"]');
    expect(reloaded.cafeStyle.focus).toBeNull();
    expect(reloaded.items).toEqual(before.items); expect(reloaded.upgrades).toEqual(before.upgrades);
    expect(reloaded.coins).toBe(before.coins); expect(reloaded.onMenu).toEqual(before.onMenu);
    expect(reloaded.cafeStyle.handoffs).toEqual(before.cafeStyle.handoffs); expect(reloaded.taste).toEqual(before.taste);
    expect(reloaded.decor).toEqual(before.decor); expect(reloaded.kitchen).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each(['en', 'zh'] as const)('explains the first kitchen and bread budget for bakery in %s', locale => {
    setLocale(locale); const state = createInitialState(0); state.items.espresso = 5;
    setCafeStyle(state, 'bakery'); showCafeStyles(state, vi.fn());
    expect(select('.style-next').textContent).toContain(t('style.hint.bakeryKitchen'));
    expect(select('.style-next').textContent).toContain('$800');
    expect(select('.style-next').textContent).toContain('$30');
  });

  it('keeps the fractional rating target visible instead of truncating it', () => {
    const state = createInitialState(0); setCafeStyle(state, 'community');
    state.reputation.recent = Array.from({ length: 20 }, () => ({ stars: 4.1, reason: 'steady', day: 1 }));
    showCafeStyles(state, vi.fn());
    expect(select('[data-style-goal="reliable"]').textContent).toContain('/4.2');
    expect(select('[data-style-goal="reliable"]').classList.contains('done')).toBe(false);
  });

  it('keeps desktop style access opposite the clock and hides it during scene transitions', () => {
    expect(styles).toContain('.cafe-style-button { position: absolute; top: 8px; right: 8px; left: auto; bottom: auto;');
    expect(styles).toContain('.scene-wrap.is-overview .cafe-style-button,');
    expect(styles).toContain('.scene-wrap.is-panning .cafe-style-button,');
    expect(styles).toContain('.scene-wrap.arranging .cafe-style-button { display: none; }');
    expect(styles).toContain('.mobile-stage-controls .cafe-style-button { position: static;');
    expect(styles).toContain('.mobile-stage-controls:has(.arrange-bar:not([hidden])) .cafe-style-button { display: none; }');
  });

  it('budgets mobile first service for full-width day controls and a shared style/status row', async () => {
    expect(styles).toContain('.mobile-stage-controls:not(:has(#open-btn:not([hidden]))) .day-hud { flex: 1 0 100%; width: 100%; }');
    expect(styles).toContain('.mobile-stage-controls .operation-status { flex: 1 1 200px;');
    expect(styles).toContain('.has-guide .stage { height: min(350px, 43dvh); }');
    expect(readFileSync('src/main.ts', 'utf8')).toContain('mobileDock?.contains(operation) ? 0');
    const media = Object.assign(new EventTarget(), { matches: true });
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
    document.body.innerHTML = '<section id="stage"><div id="scene-area"><canvas></canvas><div id="day-hud"></div><button id="cafe-style-btn"></button><button id="open-btn"></button><div id="arrange-bar"></div></div><button id="operation-status"></button></section>';
    const stage = select('#stage'); const scene = select('#scene-area');
    const controls = ['day-hud', 'cafe-style-btn', 'open-btn', 'arrange-bar', 'operation-status'].map(id => select(`#${id}`));
    const stop = dockMobileControls(stage, scene, controls, vi.fn());
    await Promise.resolve();
    expect(select('.mobile-stage-controls').contains(select('#operation-status'))).toBe(true);
    expect(select('.mobile-stage-controls').contains(select('#cafe-style-btn'))).toBe(true);
    media.matches = false; media.dispatchEvent(new Event('change'));
    expect(select('#cafe-style-btn').parentElement).toBe(scene);
    expect(select('#operation-status').parentElement).toBe(stage);
    stop();
  });

  it('uses bounded wrapping controls and leaves the status strip alone', () => {
    expect(styles).toContain('.style-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(styles).toContain('.cafe-styles-modal { width: min(540px, 100%); }');
    expect(styles).toContain('.mobile-stage-controls .cafe-style-button { position: static;');
    const html = readFileSync('index.html', 'utf8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    expect(select('#cafe-style-btn').closest('.cafe-status-bar')).toBeNull();
    expect(select('#cafe-style-btn').getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('updates the main control in both languages without inventing stage rewards', () => {
    const state = createInitialState(0); setCafeStyle(state, 'coffee');
    updateCafeStyleButton(state);
    expect(select('#cafe-style-btn').textContent).toBe(t('style.ui.button'));
    setLocale('zh'); updateCafeStyleButton(state);
    expect(select('#cafe-style-btn').getAttribute('aria-label')).toBe(t('style.ui.entry', { name: cafeStyleName('coffee') }));
  });
});
