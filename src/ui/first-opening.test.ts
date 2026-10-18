// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, serialize } from '../game/state';
import { openShop } from '../game/day';
import { GuardedStorage } from '../game/storage';
import { setLocale } from '../i18n';
import { showFirstOpening } from './first-opening';
import { FirstServiceGuide } from './first-service';
import { closeModal } from './modal';

vi.mock('../render/sprites', () => ({ itemArtwork: () => document.createElement('canvas'), toDataURL: () => 'data:image/png;base64,' }));
const next = () => document.querySelector<HTMLButtonElement>('[data-opening-next]')!;
const step = () => document.querySelector<HTMLElement>('[data-opening-step]')?.dataset.openingStep;
const later = () => [...document.querySelectorAll<HTMLButtonElement>('.modal-actions button')].at(-1)!.click();
beforeEach(() => { closeModal(); document.body.innerHTML = '<div id="modal-root"></div>'; localStorage.clear(); setLocale('en'); });
afterEach(() => { closeModal(); vi.restoreAllMocks(); setLocale('en'); });

function fixture() {
  const state = createInitialState(123), storage = new GuardedStorage(() => localStorage);
  const onStart = vi.fn(() => { openShop(state); guide.update(); });
  const onChange = vi.fn(), advanced = vi.fn();
  const open = () => showFirstOpening(state, onStart, onChange, { step: guide.openingStep ?? 'stock', confirmStock: () => guide.confirmStock(), advanced });
  const actions = { prepare: open, close: vi.fn(), status: vi.fn(), allTools: vi.fn() };
  const guide = new FirstServiceGuide(() => state, storage, actions);
  state.profile = { cafeName: 'Test', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  document.body.append(guide.element); guide.update();
  return { state, storage, guide, actions, onStart, onChange, advanced, open };
}

describe('first-day opening walkthrough', () => {
  it.each(['en', 'zh'] as const)('leads a fresh café from stock to the actual opening in %s without buying anything', locale => {
    setLocale(locale);
    const f = fixture(), before = serialize(f.state);
    f.open(); expect(step()).toBe('stock'); expect(document.activeElement).toBe(next());
    expect(document.querySelector('.opening-stock b')!.textContent).toBe('50');
    next().click(); expect(step()).toBe('menu'); expect(f.guide.openingStep).toBe('menu');
    expect(document.querySelector<HTMLInputElement>('[data-opening-menu]')!.checked).toBe(true);
    next().click(); expect(step()).toBe('open');
    expect(f.onStart).not.toHaveBeenCalled(); expect(serialize(f.state)).toBe(before);
    next().click(); expect(f.onStart).toHaveBeenCalledOnce(); expect(f.state.phase).toBe('open');
    expect(f.state.coins).toBe(0); expect(f.state.pantry.beans).toBe(50); expect(f.guide.openingStep).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not skip checking stock on exit, and resumes confirmed stock after reload', () => {
    const f = fixture(); f.open(); later(); expect(f.guide.openingStep).toBe('stock');
    f.open(); next().click(); later(); expect(f.state.phase).toBe('prep');
    const resumed = new FirstServiceGuide(() => f.state, f.storage, f.actions);
    expect(resumed.openingStep).toBe('menu');
    f.open(); expect(step()).toBe('menu'); expect(f.onStart).not.toHaveBeenCalled();
  });

  it('requires an explicit menu selection and revalidates it before opening', () => {
    const f = fixture(); f.open(); next().click();
    document.querySelector<HTMLInputElement>('[data-opening-menu]')!.click();
    expect(next().disabled).toBe(true); expect(f.state.onMenu).not.toContain('espresso');
    document.querySelector<HTMLInputElement>('[data-opening-menu]')!.click(); next().click();
    f.state.onMenu = []; next().click();
    expect(step()).toBe('menu'); expect(f.onStart).not.toHaveBeenCalled();
  });

  it('blocks an empty pantry, offers full preparation, and never grants supplies', () => {
    const f = fixture(); f.state.pantry.beans = 0; const before = serialize(f.state);
    f.open(); expect(next().disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-opening-advanced]')!.click();
    expect(f.advanced).toHaveBeenCalledOnce(); expect(serialize(f.state)).toBe(before);
    expect(f.onStart).not.toHaveBeenCalled();
  });

  it('rejects stale controls and stock changes instead of opening twice or opening empty', () => {
    const f = fixture(); f.open(); const stale = next(); later(); stale.click();
    expect(f.guide.openingStep).toBe('stock');
    f.open(); next().click(); next().click(); f.state.pantry.beans = 0; next().click();
    expect(step()).toBe('stock'); expect(next().disabled).toBe(true); expect(f.onStart).not.toHaveBeenCalled();
  });
});
