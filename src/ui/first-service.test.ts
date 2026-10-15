// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { GuardedStorage } from '../game/storage';
import { setLocale } from '../i18n';
import { FirstServiceGuide } from './first-service';
import { closeModal } from './modal';

beforeEach(() => { closeModal(); document.body.innerHTML = '<main></main><div id="modal-root"></div>'; localStorage.clear(); setLocale('en'); });
function setup() {
  const s = createInitialState(123);
  const storage = new GuardedStorage(() => localStorage);
  const actions = { pantry: vi.fn(), prepare: vi.fn(), close: vi.fn(), status: vi.fn(), allTools: vi.fn() };
  const guide = new FirstServiceGuide(() => s, storage, actions);
  s.profile = { cafeName: 'Test', ownerName: '', look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } };
  document.querySelector('main')!.append(guide.element); guide.update();
  const click = (action: string) => guide.element.querySelector<HTMLButtonElement>(`[data-guide-action="${action}"]`)!.click();
  return { s, storage, actions, guide, click };
}
describe('compact guidance', () => {
  it('returns focus to the visible summary when the primary action disappears', () => {
    const { s, guide } = setup();
    s.phase = 'open'; s.dayTime = 45; guide.update();
    guide.element.querySelector<HTMLElement>('[data-guide-action="next"]')!.focus();
    s.phase = 'closing'; guide.update();
    expect(document.activeElement).toBe(guide.element.querySelector('summary'));
    expect(guide.element.querySelector<HTMLDetailsElement>('details')!.open).toBe(false);
  });
  it('starts folded, preserves expansion and focus through a step change', () => {
    const { guide, click, actions } = setup();
    const details = guide.element.querySelector<HTMLDetailsElement>('details')!;
    expect(details.open).toBe(false);
    const primary = guide.element.querySelector<HTMLButtonElement>('[data-guide-action="next"]')!;
    expect(primary.closest('details')).toBeNull();
    details.open = true;
    primary.focus(); click('next');
    expect(actions.pantry).toHaveBeenCalledOnce();
    expect(guide.element.querySelector<HTMLDetailsElement>('details')!.open).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.guideAction).toBe('next');
    guide.element.querySelector<HTMLDetailsElement>('details')!.open = false;
    guide.update();
    expect(guide.element.querySelector<HTMLDetailsElement>('details')!.open).toBe(false);
  });
});
describe('skippable and replayable first service guidance', () => {
  it('checks existing stock, prepares, observes and closes only after explicit actions', () => {
    const { s, actions, guide, click } = setup();
    expect(guide.simplify).toBe(true);
    expect(guide.element.textContent).toContain('50 starter beans');
    click('next'); expect(actions.pantry).toHaveBeenCalledOnce();
    click('next'); expect(actions.prepare).toHaveBeenCalledOnce();
    s.phase = 'open'; guide.update(); click('next'); expect(actions.status).toHaveBeenCalledOnce();
    s.dayTime = 45; guide.update();
    expect(actions.close).not.toHaveBeenCalled();
    click('next'); expect(actions.close).toHaveBeenCalledOnce();
    expect(s.phase).toBe('open');
  });
  it('persists progress and skip separately from the game save; help is always replayable', () => {
    const { s, storage, actions, guide, click } = setup();
    click('next');
    const resumed = new FirstServiceGuide(() => s, storage, actions); resumed.update();
    expect(resumed.element.textContent).toContain('Choose today');
    click('skip'); expect(guide.element.hidden).toBe(true); expect(guide.simplify).toBe(false);
    const skipped = new FirstServiceGuide(() => s, storage, actions); skipped.update();
    expect(skipped.element.hidden).toBe(true);
    const before = JSON.stringify(s); skipped.showHelp();
    expect(document.querySelector('[role=dialog]')!.textContent).toContain('Stock for ~3 minutes');
    expect(JSON.stringify(s)).toBe(before);
  });
  it('does not rebuild or steal focus on repeated ticks and restores all tools on reopen', () => {
    const { s, actions, guide } = setup();
    const btn = guide.element.querySelector<HTMLButtonElement>('button')!; btn.focus(); guide.update();
    expect(guide.element.querySelector('button')).toBe(btn); expect(document.activeElement).toBe(btn);
    s.day = 2; s.phase = 'open'; guide.update();
    expect(guide.simplify).toBe(false); expect(actions.allTools).toHaveBeenCalledOnce();
    guide.update(); expect(actions.allTools).toHaveBeenCalledOnce();
  });
  it.each([false, true])('keeps completion through later service and reload (tools already expanded: %s)', (expanded) => {
    const { s, storage, actions, guide, click } = setup();
    if (expanded) click('tools');
    s.day = 2; s.phase = 'open'; guide.update();
    const complete = guide.element.textContent;
    expect(complete).toContain('6/6');
    s.phase = 'closing'; guide.update();
    expect(guide.element.textContent).toBe(complete);
    const resumed = new FirstServiceGuide(() => s, storage, actions); resumed.update();
    expect(resumed.element.textContent).toBe(complete);
    s.day = 3; s.phase = 'prep'; resumed.update();
    expect(resumed.element.textContent).toBe(complete);
    s.phase = 'open'; resumed.update();
    expect(resumed.element.textContent).toBe(complete);
    resumed.dismiss();
    const dismissed = new FirstServiceGuide(() => s, storage, actions); dismissed.update();
    expect(dismissed.element.hidden).toBe(true);
  });
  it('preserves action toasts in-flow, including after revealing tools, then restores normal placement', () => {
    const { guide, click } = setup();
    const toast = document.createElement('div'); toast.id = 'toast'; toast.textContent = 'Bought beans';
    document.body.append(toast); guide.update();
    expect(guide.element.nextElementSibling).toBe(toast);
    click('tools');
    expect(guide.element.nextElementSibling).toBe(toast);
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toBe('Bought beans');
    click('skip');
    expect(toast.parentElement).toBe(document.body);
  });
  it('keeps dismissed-guide mobile receipts in flow, and restores desktop placement', () => {
    const { guide, click } = setup();
    const app = document.createElement('div'); app.id = 'app';
    app.innerHTML = '<main class="layout"><aside id="management-panel" class="mobile-panel"></aside></main>';
    document.body.append(app);
    const toast = document.createElement('div'); toast.id = 'toast'; toast.textContent = 'Bakery is open';
    document.body.append(toast); guide.update(); click('skip');
    expect(app.querySelector('.layout')!.previousElementSibling).toBe(toast);
    expect(toast.textContent).toBe('Bakery is open'); expect(toast.hidden).toBe(false);
    document.getElementById('management-panel')!.classList.remove('mobile-panel'); guide.update();
    expect(toast.parentElement).toBe(document.body);
  });
  it('includes the help scroll region in the keyboard focus loop', () => {
    const { guide } = setup(); guide.showHelp();
    const body = document.querySelector<HTMLElement>('.modal-body')!;
    const back = document.querySelector<HTMLButtonElement>('.modal-actions button')!;
    expect(body.tabIndex).toBe(0); expect(body.getAttribute('role')).toBe('region');
    expect(document.activeElement).toBe(body);
    back.focus(); back.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(body);
    body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(back);
  });
  it('localizes help and survives unavailable preference storage', () => {
    const s = createInitialState(4);
    const storage = new GuardedStorage(() => { throw new Error('denied'); });
    const guide = new FirstServiceGuide(() => s, storage, { pantry: vi.fn(), prepare: vi.fn(), close: vi.fn(), status: vi.fn(), allTools: vi.fn() });
    setLocale('zh'); guide.showHelp();
    expect(document.querySelector('[role=dialog]')!.textContent).toContain('烘焙数量');
  });
});
