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
let openStreet = vi.fn<() => void>();
const button = (id: string) => document.querySelector<HTMLButtonElement>(id)!;

beforeEach(() => {
  setLocale('zh'); allowed = true; camera = new CafeView(); openStreet = vi.fn();
  document.body.innerHTML = '<main id="stage"><div id="room"><canvas id="scene"></canvas></div></main><div id="edges"></div><div id="card"></div>';
  const state = createInitialState(0);
  regions = new RegionsUI(document.querySelector('#edges')!, document.querySelector('#card')!, () => state,
    area => { viewport?.reset(); camera.moveToArea(area, true); }, vi.fn(),
    () => { openStreet(); allowed = false; });
  viewport = new RoomViewport(document.querySelector('canvas')!, document.querySelector('#stage')!, () => allowed,
    () => `${camera.area}:${camera.overview}`, { isActive: () => camera.overview, toggle: () => regions.toggleOverview() });
  regions.select('main');
});
afterEach(() => { viewport.destroy(); document.body.replaceChildren(); setLocale('en'); });

describe('street entry and interior camera', () => {
  it.each([0, 1, 4])('opens the street map after %i magnification clicks without exposing connected interiors', clicks => {
    for (let i = 0; i < clicks; i++) button('#room-zoom-in').click();
    button('#room-zoom-reset').click(); viewport.refresh();
    expect(openStreet).toHaveBeenCalledOnce();
    expect(camera.overview).toBe(false); expect(camera.area).toBe('main');
    expect(camera.zoom).toBe(1);
    expect(document.querySelector('canvas')!.dataset.roomZoom).toBe('1');
    expect(button('#room-zoom-reset').textContent).toBe('街道');
    expect(button('#room-zoom-reset').getAttribute('aria-haspopup')).toBe('dialog');
    expect(button('#room-zoom-in').disabled).toBe(true);
    allowed = true; viewport.refresh();
    expect(button('#room-zoom-reset').disabled).toBe(false);
  });

  it('redirects legacy room links while keeping the main café camera in place', () => {
    regions.select('reading');
    expect(openStreet).toHaveBeenCalledOnce();
    expect(camera.area).toBe('main'); expect(camera.overview).toBe(false);
    allowed = true; regions.select('kitchen'); viewport.refresh();
    expect(camera.area).toBe('kitchen');
    expect(button('#room-zoom-reset').textContent).toBe('街道');
  });

  it('blocks street actions during another dialog or camera transition', () => {
    allowed = false; viewport.refresh(); button('#room-zoom-reset').click();
    expect(openStreet).not.toHaveBeenCalled();
    allowed = true; viewport.refresh(); button('#room-zoom-reset').click();
    expect(openStreet).toHaveBeenCalledOnce();
  });

  it('opens the street from a view that cannot be magnified', () => {
    viewport.destroy();
    viewport = new RoomViewport(document.querySelector('canvas')!, document.querySelector('#stage')!, () => allowed,
      () => 'building', { isActive: () => camera.overview, toggle: () => regions.toggleOverview() }, () => 1, () => false);
    expect(button('#room-zoom-in').disabled).toBe(true);
    expect(button('#room-zoom-out').disabled).toBe(true);
    expect(button('#room-zoom-reset').disabled).toBe(false);
    button('#room-zoom-in').click();
    const canvas = document.querySelector('canvas')!;
    for (const [type, id, x] of [['pointerdown', 1, 10], ['pointerdown', 2, 60], ['pointermove', 2, 200]] as const) {
      canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: 10, bubbles: true }));
    }
    expect(canvas.dataset.roomZoom).toBe('1');
    button('#room-zoom-reset').click();
    expect(openStreet).toHaveBeenCalledOnce();
  });

  it('viewing properties does not purchase or unlock them', () => {
    const state = createInitialState(0), before = serialize(state);
    const controls = new RegionsUI(document.createElement('div'), document.createElement('div'),
      () => state, vi.fn(), vi.fn(), vi.fn());
    controls.toggleOverview(); controls.select('reading'); controls.toggleOverview();
    expect(serialize(state)).toBe(before);
  });
});
