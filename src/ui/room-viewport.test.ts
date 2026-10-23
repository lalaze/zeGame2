// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { RoomViewport, clampRoomPan, mobileRoomZoom } from './room-viewport';
import { bindCanvasTaps, type CanvasTaps } from '../render/phaser/canvas-taps';
let view: RoomViewport, taps: CanvasTaps, canvas: HTMLCanvasElement, allowed: boolean, context: string;
const tap = vi.fn();
function pointer(type: string, x: number, id = 1, target: EventTarget = canvas, y = 120) {
  target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1,
    clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
}
beforeEach(() => {
  document.body.innerHTML = '<div id="stage"><div id="room"><canvas width="320" height="240"></canvas></div></div><button id="panel">Panel</button>';
  const stage = document.querySelector<HTMLElement>('#stage')!, room = document.querySelector<HTMLElement>('#room')!;
  canvas = document.querySelector('canvas')!;
  for (const element of [stage, room]) {
    Object.defineProperty(element, 'clientWidth', { value: 320 }); Object.defineProperty(element, 'clientHeight', { value: 240 });
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 240));
  }
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => {
    const zoom = Number(canvas.dataset.roomZoom || 1), [x,y] = (canvas.dataset.roomPan || '0,0').split(',').map(Number);
    return new DOMRect(160 - 160*zoom+x, 120-120*zoom+y, 320*zoom, 240*zoom);
  });
  allowed = true; context = 'main:browse'; tap.mockClear();
  view = new RoomViewport(canvas, stage, () => allowed, () => context);
  taps = bindCanvasTaps(canvas, { enabled: () => allowed, context: () => [context], tap, hover: vi.fn() });
});
afterEach(() => { view.destroy(); taps.destroy(); vi.restoreAllMocks(); });
it('contains the unscaled room and clamps pan without stretching', () => {
  expect(canvas.dataset.roomZoom).toBe('1'); expect(canvas.style.transform).toBe('');
  expect(clampRoomPan(999,320,320,2)).toBe(160);
  expect(clampRoomPan(-999,320,320,2)).toBe(-160);
  expect(clampRoomPan(99,240,844,2)).toBe(0);
});
it('pinches, pans and consumes neither gesture as a furniture tap', () => {
  pointer('pointerdown',120); pointer('pointerdown',200,2);
  pointer('pointermove',80); pointer('pointermove',240,2);
  pointer('pointerup',80); pointer('pointerup',240,2);
  expect(Number(canvas.dataset.roomZoom)).toBeCloseTo(2);
  expect(tap).not.toHaveBeenCalled();
  pointer('pointerdown',160); pointer('pointermove',220); pointer('pointerup',220);
  expect(Number(canvas.dataset.roomPan!.split(',')[0])).toBeGreaterThan(0);
  expect(tap).not.toHaveBeenCalled();
  pointer('pointerdown',160); pointer('pointerup',160);
  expect(tap).toHaveBeenCalledOnce();
});
it('maps a stationary tap after magnification to the original canvas buffer', () => {
  document.querySelector<HTMLButtonElement>('#room-zoom-in')!.click();
  pointer('pointerdown',160); pointer('pointerup',160);
  expect(tap).toHaveBeenCalledExactlyOnceWith(160,120);
});
it('ignores management touches and disabled interactions', () => {
  allowed = false; pointer('pointerdown',100); pointer('pointerdown',200,2); pointer('pointermove',250,2);
  expect(canvas.dataset.roomZoom).toBe('1');
  allowed = true; window.dispatchEvent(new Event('blur'));
  const panel = document.querySelector('#panel')!;
  pointer('pointerdown',100,1,panel); pointer('pointerdown',200,2,panel); pointer('pointermove',260,2,panel);
  expect(canvas.dataset.roomZoom).toBe('1');
});
it('cancels a gesture when furniture mode or room changes', () => {
  pointer('pointerdown',100); pointer('pointerdown',200,2); context='main:place';
  pointer('pointermove',250,2); pointer('pointerup',100); pointer('pointerup',250,2);
  expect(canvas.dataset.roomZoom).toBe('1'); expect(tap).not.toHaveBeenCalled();
});
it('caps zoom, resets on rotation, and permits a fresh gesture after cancellation', () => {
  for(let n=0;n<10;n++) document.querySelector<HTMLButtonElement>('#room-zoom-in')!.click();
  expect(canvas.dataset.roomZoom).toBe('3');
  window.dispatchEvent(new Event('resize')); expect(canvas.dataset.roomZoom).toBe('1');
  pointer('pointerdown',100); pointer('pointercancel',100);
  pointer('pointerdown',100); pointer('pointerup',100); expect(tap).toHaveBeenCalledOnce();
});
it('reset button restores exact full-room presentation', () => {
  document.querySelector<HTMLButtonElement>('#room-zoom-in')!.click();
  document.querySelector<HTMLButtonElement>('#room-zoom-reset')!.click();
  expect(canvas.dataset.roomZoom).toBe('1'); expect(canvas.dataset.roomPan).toBe('0,0');
  expect(canvas.style.transform).toBe('');
});

it('allows ordinary finger jitter when tapping a zoomed room', () => {
 document.querySelector<HTMLButtonElement>('#room-zoom-in')!.click();
 pointer('pointerdown',160); pointer('pointermove',163); pointer('pointerup',163);
 expect(tap).toHaveBeenCalledOnce(); expect(canvas.dataset.roomPan).toBe('0,0');
});
it('invalidates a held gesture when a dialog opens even if it closes before release', () => {
 pointer('pointerdown',100); pointer('pointerdown',200,2);
 allowed=false;view.refresh();allowed=true;
 pointer('pointermove',280,2);pointer('pointerup',280,2);pointer('pointerup',100);
 expect(canvas.dataset.roomZoom).toBe('1');
});

it('starts a phone close enough to drag, keeps tap coordinates, and restores framing after the map', () => {
  view.destroy();
  let overview = false;
  const stage = document.querySelector<HTMLElement>('#stage')!;
  view = new RoomViewport(canvas, stage, () => allowed, () => context,
    { isActive: () => overview, toggle: () => { overview = !overview; } }, () => 1.8);
  expect(canvas.dataset.roomZoom).toBe('1.8');
  pointer('pointerdown', 160); pointer('pointermove', 210); pointer('pointerup', 210);
  expect(Number(canvas.dataset.roomPan!.split(',')[0])).toBe(50);
  expect(tap).not.toHaveBeenCalled();
  pointer('pointerdown', 160); pointer('pointerup', 160);
  expect(tap).toHaveBeenCalledExactlyOnceWith(160 - 50 / 1.8, 120);
  document.querySelector<HTMLButtonElement>('#room-zoom-reset')!.click();
  expect(overview).toBe(true); expect(canvas.dataset.roomZoom).toBe('1');
  document.querySelector<HTMLButtonElement>('#room-zoom-reset')!.click();
  expect(canvas.dataset.roomZoom).toBe('1.8'); expect(canvas.dataset.roomPan).toBe('0,0');
});

it('fits the near view between phone controls and preserves the desktop and landscape fit', () => {
  expect(mobileRoomZoom(390, 844, 292.5)).toBe(1.8);
  expect(mobileRoomZoom(320, 568, 240) * 240).toBeLessThanOrEqual(568 - 176);
  expect(mobileRoomZoom(844, 390, 292.5)).toBe(1);
  expect(mobileRoomZoom(1440, 1000, 960)).toBe(1);
});
