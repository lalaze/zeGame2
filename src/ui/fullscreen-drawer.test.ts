// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenDrawer } from './fullscreen-drawer';
describe('fullscreen drawer', () => {
  let drawer: FullscreenDrawer, media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn> };
  let panel: HTMLElement, toggle: HTMLButtonElement, close: HTMLButtonElement, backdrop: HTMLElement;
  let changed: () => void;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><header id="hud"><button id="toggle">Manage</button></header><main id="layout"><section id="stage"></section><button id="backdrop" hidden></button><aside id="panel" hidden><button id="close">Close</button><small class="drawer-pause"></small><button id="last">Last</button></aside></main></div><div id="modal-root"></div>';
    media = { matches: false, addEventListener: vi.fn((_, cb) => { changed = cb; }) };
    vi.stubGlobal('matchMedia', () => media);
    panel = document.getElementById('panel')!;
    toggle = document.getElementById('toggle') as HTMLButtonElement;
    close = document.getElementById('close') as HTMLButtonElement;
    backdrop = document.getElementById('backdrop')!;
    for (const element of [toggle, close, document.getElementById('last')!]) {
      Object.defineProperty(element, 'getClientRects', { value: () => [{ width: 44, height: 44 }] });
    }
    drawer = new FullscreenDrawer(panel, toggle, close, backdrop, () => drawer.setOpen(false));
  });
  it('starts closed and desktop drawer does not pause', () => {
    toggle.focus(); drawer.setOpen(true);
    expect(drawer.paused).toBe(false); expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(backdrop.hidden).toBe(true);
    drawer.handleKey(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(panel.hidden).toBe(true); expect(document.activeElement).toBe(toggle);
  });
  it('mobile pause is derived and removes only its own inert state', () => {
    document.getElementById('stage')!.inert = true;
    media.matches = true; drawer.setOpen(true);
    expect(drawer.paused).toBe(true);
    expect(document.getElementById('hud')!.inert).toBe(true);
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(backdrop.hidden).toBe(false);
    drawer.setOpen(false);
    expect(drawer.paused).toBe(false);
    expect(document.getElementById('stage')!.inert).toBe(true);
    expect(document.getElementById('hud')!.inert).toBe(false);
    expect(panel.hasAttribute('aria-modal')).toBe(false);
  });
  it('resizing recomputes pause without mutating an external pause reason or speed', () => {
    const game = { paused: true, speed: 4 };
    drawer.setOpen(true); media.matches = true; changed();
    expect(drawer.paused || game.paused).toBe(true);
    media.matches = false; changed();
    expect(drawer.paused).toBe(false); expect(game).toEqual({ paused: true, speed: 4 });
    expect(backdrop.hidden).toBe(true);
  });
  it('repeated opening retains original return target; backdrop closes', () => {
    toggle.focus(); drawer.setOpen(true); drawer.setOpen(true);
    backdrop.click(); expect(document.activeElement).toBe(toggle);
  });
  it('traps Tab only for mobile and preserves scene keyboard isolation', () => {
    media.matches = true; drawer.setOpen(true);
    const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    drawer.handleKey(reverse); expect(reverse.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
    const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    drawer.handleKey(forward); expect(document.activeElement).toBe(close);
    expect(drawer.handleKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe(true);
  });
});
