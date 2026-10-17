// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ManagementShortcuts } from './management-shortcuts';
describe('management shortcuts', () => {
  let shortcuts: ManagementShortcuts, media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn> };
  let menu: HTMLElement, toggle: HTMLButtonElement, first: HTMLButtonElement, outside: HTMLButtonElement;
  let changed: () => void, onChange: Mock<() => void>;
  const escape = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = '<button id="toggle">Manage</button><nav id="menu"><button id="first">Menu</button><button id="last">Promote</button></nav><button id="outside">Settings</button>';
    media = { matches: false, addEventListener: vi.fn((_, cb) => { changed = cb; }) };
    vi.stubGlobal('matchMedia', () => media);
    menu = document.getElementById('menu')!;
    toggle = document.getElementById('toggle') as HTMLButtonElement;
    first = document.getElementById('first') as HTMLButtonElement;
    outside = document.getElementById('outside') as HTMLButtonElement;
    onChange = vi.fn<() => void>();
    shortcuts = new ManagementShortcuts(menu, toggle, onChange);
  });
  it('starts folded and unfolds only on desktop', () => {
    expect(menu.hidden).toBe(true);
    shortcuts.setOpen(true);
    expect(shortcuts.expanded).toBe(true); expect(menu.hidden).toBe(false);
    expect(document.body.classList.contains('shortcuts-open')).toBe(true);
    expect(onChange).toHaveBeenCalledOnce();
    shortcuts.setOpen(false); media.matches = true; shortcuts.setOpen(true);
    expect(shortcuts.available).toBe(false); expect(menu.hidden).toBe(true);
  });
  it('folds on an outside press but not on the menu or its toggle', () => {
    shortcuts.setOpen(true);
    first.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    toggle.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(false);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.body.classList.contains('shortcuts-open')).toBe(false);
  });
  it('Escape folds and returns focus to Manage; other keys pass through', () => {
    expect(shortcuts.handleEscape(escape())).toBe(false);
    shortcuts.setOpen(true); first.focus();
    expect(shortcuts.handleEscape(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
    const event = escape();
    expect(shortcuts.handleEscape(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(menu.hidden).toBe(true); expect(document.activeElement).toBe(toggle);
  });
  it('never drops focus onto the page when folding around a focused shortcut', () => {
    shortcuts.setOpen(true); first.focus();
    shortcuts.setOpen(false);
    expect(document.activeElement).toBe(toggle);
  });
  it('folds when focus leaves for another control, not within or on window blur', () => {
    shortcuts.setOpen(true);
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.getElementById('last') }));
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: toggle }));
    toggle.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(menu.hidden).toBe(false);
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    expect(menu.hidden).toBe(true);
  });
  it('folds and refreshes labels when the layout becomes a phone', () => {
    shortcuts.setOpen(true); onChange.mockClear();
    media.matches = true; changed();
    expect(menu.hidden).toBe(true); expect(shortcuts.expanded).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });
});
