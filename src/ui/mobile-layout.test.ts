// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dockMobileControls } from './mobile-layout';
import { trackVisualViewport } from './viewport';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); document.documentElement.removeAttribute('style'); });

describe('responsive control docking', () => {
  it('moves the same live controls outside the canvas, and restores their desktop order', async () => {
    const media = new EventTarget() as EventTarget & { matches: boolean };
    media.matches = true;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
    document.body.innerHTML = '<section id="stage"><div id="scene-wrap"><canvas></canvas><div id="day"></div><button id="open"></button><div id="arrange"></div></div><button id="operation-status"></button></section>';
    const stage = document.querySelector<HTMLElement>('#stage')!;
    const scene = document.querySelector<HTMLElement>('#scene-wrap')!;
    const controls = ['day', 'open', 'arrange'].map(id => document.getElementById(id)!);
    const click = vi.fn(); controls[1].addEventListener('click', click);
    const resized = vi.fn();
    const stop = dockMobileControls(stage, scene, controls, resized);
    await Promise.resolve();
    expect(stage.firstElementChild?.className).toBe('mobile-stage-controls');
    expect([...stage.firstElementChild!.children]).toEqual(controls);
    controls[1].click(); expect(click).toHaveBeenCalledOnce();
    media.matches = false; media.dispatchEvent(new Event('change'));
    expect(scene.children[0].tagName).toBe('CANVAS');
    expect([...scene.children].slice(1)).toEqual(controls);
    expect(stage.querySelector('.mobile-stage-controls')).toBeNull();
    media.matches = true; media.dispatchEvent(new Event('change'));
    expect(controls[0].parentElement?.className).toBe('mobile-stage-controls');
    stop(); expect([...scene.children].slice(1)).toEqual(controls);
  });
});

describe('visual viewport dialog bounds', () => {
  it('tracks keyboard-sized height, pan offset and restored orientation without fighting zoom', () => {
    const viewport = new EventTarget() as EventTarget & { height: number; offsetTop: number; scale: number };
    Object.assign(viewport, { height: 720, offsetTop: 0, scale: 1 });
    const win = Object.assign(new EventTarget(), { visualViewport: viewport }) as unknown as Window;
    const stop = trackVisualViewport(win);
    const css = document.documentElement.style;
    expect(css.getPropertyValue('--usable-viewport-height')).toBe('720px');
    viewport.height = 320; viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event('resize'));
    expect(css.getPropertyValue('--usable-viewport-height')).toBe('320px');
    expect(css.getPropertyValue('--usable-viewport-top')).toBe('40px');
    viewport.height = 430; viewport.offsetTop = 0; win.dispatchEvent(new Event('resize'));
    expect(css.getPropertyValue('--usable-viewport-height')).toBe('430px');
    viewport.scale = 2; viewport.dispatchEvent(new Event('resize'));
    expect(css.getPropertyValue('--usable-viewport-height')).toBe('');
    stop(); viewport.scale = 1; viewport.dispatchEvent(new Event('resize'));
    expect(css.getPropertyValue('--usable-viewport-height')).toBe('');
  });
  it('retains CSS fallback when visualViewport is unavailable', () => {
    const win = Object.assign(new EventTarget(), { visualViewport: null }) as unknown as Window;
    expect(() => trackVisualViewport(win)()).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--usable-viewport-height')).toBe('');
  });
});
