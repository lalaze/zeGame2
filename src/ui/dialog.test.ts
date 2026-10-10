// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeModal, isModalOpen, showModal } from './modal';
import { showOnboarding } from './onboarding';
import { containDialogFocus } from './dialog-focus';
import { isComposingKey, usesNativeKeyboard } from './keyboard';

vi.mock('../render/sprites', () => ({
  HAIRS: ['brown'], HEAD_ROWS: [], SHIRTS: ['red'], SKINS: ['tan'],
  character: () => ({ stand: document.createElement('canvas') }),
}));

beforeEach(() => {
  document.body.innerHTML = '<main><button id="opener">Open</button></main><aside inert>Already inert</aside><div id="modal-root"></div>';
  document.querySelector<HTMLButtonElement>('#opener')!.focus();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  closeModal();
  if (document.querySelector('.onboard-overlay')) {
    showOnboarding({ mode: 'edit', onLocale: vi.fn(), onDone: vi.fn() });
    document.querySelector<HTMLButtonElement>('[data-back]')!.click();
  }
  vi.restoreAllMocks();
});
const modal = () => showModal({ title: 'Test', body: '<p>Body</p>', buttons: [{ label: 'Cancel' }, { label: 'Confirm' }] });
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  target.dispatchEvent(event);
  return event;
};

describe('dialog focus ownership', () => {
  it('labels, initially focuses, isolates background, wraps Tab, and restores the opener', () => {
    const opener = document.activeElement;
    modal();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = dialog.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Test');
    expect(document.querySelector('main')!.inert).toBe(true);
    expect(press(buttons[0], 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[1]);
    expect(press(buttons[1], 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    closeModal();
    expect(document.activeElement).toBe(opener);
    expect(document.querySelector('main')!.inert).toBe(false);
    expect(document.querySelector('aside')!.inert).toBe(true);
  });

  it('redirects programmatic outside focus and supports repeated replacement/closure', () => {
    for (let n = 0; n < 3; n++) {
      modal();
      document.querySelector<HTMLButtonElement>('#opener')!.focus();
      expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    }
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    closeModal();
    closeModal();
    expect(isModalOpen()).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
    expect(document.querySelector('main')!.inert).toBe(false);
  });

  it('skips hidden and disabled fields when selecting initial focus', () => {
    showModal({ title: 'Fields', body: '<input type="hidden"><input disabled><div style="display:none"><button>Hidden</button></div>', buttons: [{ label: 'Close' }] });
    expect(document.activeElement?.textContent).toBe('Close');
  });

  it('ignores detached action buttons from a replaced modal', () => {
    const callback = vi.fn();
    showModal({ title: 'Old', body: '', buttons: [{ label: 'Old', onClick: callback }] });
    const old = document.querySelector<HTMLButtonElement>('.modal button')!;
    modal();
    old.click();
    expect(callback).not.toHaveBeenCalled();
    expect(isModalOpen()).toBe(true);
  });

  it('preserves return focus when lower dialogs close before the top one', () => {
    modal();
    const overlay = document.createElement('div');
    overlay.innerHTML = '<section><button>Nested</button></section>';
    document.body.append(overlay);
    const release = containDialogFocus(overlay.firstElementChild as HTMLElement, overlay);
    closeModal();
    overlay.remove();
    release();
    expect(document.activeElement?.id).toBe('opener');
    expect(document.querySelector('main')!.inert).toBe(false);
  });

  it('handles a dialog with no focusable controls', () => {
    showModal({ title: 'Empty', body: '', buttons: [] });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(dialog);
    expect(press(dialog, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it('restores lower dialog ownership after a nested scope closes', () => {
    modal();
    const lower = document.activeElement;
    const overlay = document.createElement('div');
    overlay.innerHTML = '<section><button>Nested</button></section>';
    document.body.append(overlay);
    const release = containDialogFocus(overlay.firstElementChild as HTMLElement, overlay);
    expect(document.getElementById('modal-root')!.inert).toBe(true);
    overlay.remove();
    release();
    release();
    expect(document.activeElement).toBe(lower);
    expect(document.getElementById('modal-root')!.inert).toBe(false);
    expect(document.querySelector('main')!.inert).toBe(true);
  });
});

describe('onboarding keyboard', () => {
  const start = () => showOnboarding({ mode: 'edit', onLocale: vi.fn(), onDone: vi.fn() });
  it.each([{ isComposing: true }, { keyCode: 229 }, { repeat: true }])('does not advance Enter with %j', (extra) => {
    start();
    const name = document.querySelector<HTMLInputElement>('#cafe-name')!;
    expect(document.activeElement).toBe(name);
    press(name, 'Enter', extra);
    expect(document.querySelector('#cafe-name')).toBe(name);
    expect(document.querySelector('#owner-name')).toBeNull();
  });
  it('puts initial welcome focus on a control and restores it after a nested modal', () => {
    showOnboarding({ mode: 'new', onLocale: vi.fn(), onDone: vi.fn() });
    expect(document.activeElement?.matches('[data-locale]')).toBe(true);
    const initial = document.activeElement;
    modal();
    expect(press(document.activeElement!, 'Enter').defaultPrevented).toBe(false);
    expect(document.querySelector('.ob-logo')).not.toBeNull();
    closeModal();
    expect(document.activeElement).toBe(initial);
  });

  it('does not call completion again from a stale button after finishing', () => {
    const done = vi.fn();
    showOnboarding({ mode: 'edit', onLocale: vi.fn(), onDone: done });
    document.querySelector<HTMLButtonElement>('[data-next]')!.click();
    const save = document.querySelector<HTMLButtonElement>('[data-next]')!;
    save.click();
    save.click();
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.onboard-overlay')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('advances a normal Enter in the name field and keeps focus inside the new step', () => {
    start();
    press(document.querySelector('#cafe-name')!, 'Enter');
    expect(document.querySelector('#owner-name')).not.toBeNull();
    expect(document.querySelector('.onboard')!.contains(document.activeElement)).toBe(true);
  });
  it('leaves button Enter to native activation, including Cancel and random-name', () => {
    start();
    for (const selector of ['[data-random]', '[data-back]', '[data-next]']) {
      const button = document.querySelector<HTMLButtonElement>(selector)!;
      button.focus();
      expect(press(button, 'Enter').defaultPrevented).toBe(false);
      expect(document.querySelector('#cafe-name')).not.toBeNull();
    }
    document.querySelector<HTMLButtonElement>('[data-back]')!.click();
    expect(document.querySelector('.onboard-overlay')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });
  it('replaces repeated openings and restores focus on cancel without lingering isolation', () => {
    start();
    start();
    expect(document.querySelectorAll('.onboard-overlay')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-back]')!.click();
    expect(document.querySelector('main')!.inert).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
  });
});

describe('game shortcut guard', () => {
  it.each(['button', 'input', 'textarea', 'select', 'a href="#"', 'summary', 'div contenteditable="true"', 'div role="button"'])('leaves %s keys alone', (markup) => {
    const holder = document.createElement('div');
    const tag = markup.split(' ')[0];
    holder.innerHTML = `<${markup}></${tag}>`;
    expect(usesNativeKeyboard(holder.firstElementChild)).toBe(true);
  });
  it('recognizes nested button children but allows game/background shortcuts', () => {
    const holder = document.createElement('div');
    holder.innerHTML = '<button><span>Buy</span></button><canvas></canvas>';
    expect(usesNativeKeyboard(holder.querySelector('span'))).toBe(true);
    expect(usesNativeKeyboard(holder.querySelector('canvas'))).toBe(false);
    expect(usesNativeKeyboard(null)).toBe(false);
    expect(isComposingKey(new KeyboardEvent('keydown', { keyCode: 229 }))).toBe(true);
  });
});
