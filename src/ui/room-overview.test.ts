// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, serialize } from '../game/state';
import { CafeView } from '../render/cafe-view';
import { setLocale } from '../i18n';
import { RegionsUI } from './regions';
import { RoomViewport } from './room-viewport';

let viewport: RoomViewport;
let camera: CafeView;
let regions: RegionsUI;
let allowed: boolean;
const button = (id: string) => document.querySelector<HTMLButtonElement>(id)!;

beforeEach(() => {
  setLocale('zh'); allowed = true; camera = new CafeView();
  document.body.innerHTML = '<main id="stage"><div id="room"><canvas id="scene"></canvas></div></main><div id="edges"></div><div id="card"></div>';
  const state = createInitialState(0);
  regions = new RegionsUI(document.querySelector('#edges')!, document.querySelector('#card')!, () => state,
    area => { viewport?.reset(); camera.moveToArea(area, true); }, vi.fn(),
    show => { viewport?.reset(); camera.setOverview(show, true); });
  viewport = new RoomViewport(document.querySelector('canvas')!, document.querySelector('#stage')!, () => allowed,
    () => `${camera.area}:${camera.overview}`, { isActive: () => camera.overview, toggle: () => regions.toggleOverview() });
  regions.select('main');
});
afterEach(() => { viewport.destroy(); document.body.replaceChildren(); setLocale('en'); });

describe('panorama control and building camera', () => {
  it.each([0, 1, 4])('opens the entire café after %i magnification clicks and returns to the room', clicks => {
    for (let i = 0; i < clicks; i++) button('#room-zoom-in').click();
    button('#room-zoom-reset').click();
    expect(camera.overview).toBe(true);
    expect(camera.zoom).toBeCloseTo(1 / 3);
    expect(document.querySelector('canvas')!.dataset.roomZoom).toBe('1');
    expect(button('#room-zoom-reset').textContent).toBe('返回房间');
    expect(button('#room-zoom-reset').getAttribute('aria-pressed')).toBe('true');
    expect(button('#room-zoom-in').disabled).toBe(true);
    button('#room-zoom-reset').click();
    expect(camera.overview).toBe(false); expect(camera.zoom).toBe(1);
    expect(button('#room-zoom-reset').textContent).toBe('全景');
  });

  it('provides one overview entry and returns to a selected room', () => {
    expect(document.querySelector('.area-plan-toggle')).toBeNull();
    expect(document.querySelectorAll('button[aria-pressed]')).toHaveLength(1);
    button('#room-zoom-reset').click(); viewport.refresh();
    expect(button('#room-zoom-reset').textContent).toBe('返回房间');
    regions.select('reading'); viewport.refresh();
    expect(camera.area).toBe('reading'); expect(camera.overview).toBe(false);
    expect(button('#room-zoom-reset').getAttribute('aria-pressed')).toBe('false');
    button('#room-zoom-reset').click(); button('#room-zoom-reset').click();
    expect(camera.area).toBe('reading'); expect(camera.overview).toBe(false);
  });

  it('blocks panorama actions during a dialog or camera transition', () => {
    allowed = false; viewport.refresh();
    button('#room-zoom-reset').click();
    expect(camera.overview).toBe(false);
    allowed = true; viewport.refresh(); button('#room-zoom-reset').click();
    expect(camera.overview).toBe(true);
  });

  it('viewing locked rooms does not purchase or unlock them', () => {
    const state = createInitialState(0), before = serialize(state);
    const controls = new RegionsUI(document.createElement('div'), document.createElement('div'),
      () => state, vi.fn(), vi.fn(), vi.fn());
    controls.toggleOverview(); controls.select('reading'); controls.toggleOverview();
    expect(serialize(state)).toBe(before);
  });
});
