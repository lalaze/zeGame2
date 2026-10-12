// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { bindCanvasTaps, TAP_SLOP, type CanvasTaps } from './canvas-taps';

let canvas: HTMLCanvasElement;
let input: CanvasTaps;
let enabled: boolean;
let context: unknown[];
let rect: DOMRect;
let tap: Mock<(x: number, y: number) => void>;
let hover: Mock<(x: number, y: number) => void>;

function pointer(type: string, options: PointerEventInit = {}, target: EventTarget = canvas): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    clientX: 100, clientY: 100, bubbles: true, cancelable: true, ...options,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = '<canvas width="960" height="720"></canvas><button>Other control</button>';
  canvas = document.querySelector('canvas')!;
  // A 3x drawing buffer must not shrink the user's CSS-pixel gesture threshold.
  rect = new DOMRect(20, 30, 320, 240);
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => rect);
  enabled = true;
  context = ['main', false, null];
  tap = vi.fn();
  hover = vi.fn();
  input = bindCanvasTaps(canvas, { enabled: () => enabled, context: () => context, tap, hover });
});
afterEach(() => { input.destroy(); vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('the canvas tap event registrations', () => {
  it.each(['touch', 'mouse', 'pen'])('acts exactly once on a completed %s tap, never pointerdown', (pointerType) => {
    pointer('pointerdown', { pointerType });
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerup', { pointerType });
    expect(tap).toHaveBeenCalledExactlyOnceWith(240, 210);
    pointer('pointerup', { pointerType });
    expect(tap).toHaveBeenCalledOnce();
  });

  it('allows small touch jitter and resolves the final release position in buffer pixels', () => {
    pointer('pointerdown');
    pointer('pointermove', { clientX: 104, clientY: 103 });
    pointer('pointerup', { clientX: 104, clientY: 103 });
    expect(tap).toHaveBeenCalledExactlyOnceWith(252, 219);
    expect(hover).not.toHaveBeenCalled();
  });

  it('keeps mouse hover preview, including over a held piece, without activating it', () => {
    pointer('pointermove', { pointerType: 'mouse', buttons: 0 });
    expect(hover).toHaveBeenCalledExactlyOnceWith(240, 210);
    pointer('pointerdown', { pointerType: 'mouse' });
    pointer('pointermove', { pointerType: 'mouse', clientX: 102 });
    expect(hover).toHaveBeenLastCalledWith(246, 210);
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerup', { pointerType: 'mouse', clientX: 102 });
    expect(tap).toHaveBeenCalledOnce();
  });

  it.each(['touch', 'mouse'])('rejects a %s drag even after it returns to the initial point', (pointerType) => {
    pointer('pointerdown', { pointerType });
    pointer('pointermove', { pointerType, clientX: 100 + TAP_SLOP + 1 });
    pointer('pointermove', { pointerType });
    pointer('pointerup', { pointerType });
    expect(tap).not.toHaveBeenCalled();
  });

  it('checks movement on release even if no pointermove was delivered', () => {
    pointer('pointerdown');
    pointer('pointerup', { clientY: 100 + TAP_SLOP + 1 });
    expect(tap).not.toHaveBeenCalled();
  });

  it('measures radial slop in CSS pixels rather than canvas pixels', () => {
    pointer('pointerdown');
    pointer('pointerup', { clientX: 100 + TAP_SLOP });
    expect(tap).toHaveBeenCalledOnce();
    pointer('pointerdown');
    pointer('pointerup', { clientX: 106, clientY: 106 });
    expect(tap).toHaveBeenCalledOnce();
  });

  it('rejects an outside release even with the canvas as the implicit touch-capture target', () => {
    pointer('pointerdown', { clientX: 21 });
    pointer('pointerup', { clientX: 19 });
    expect(tap).not.toHaveBeenCalled();
  });

  it('rejects leaving and returning to the canvas, even within the tap slop', () => {
    pointer('pointerdown', { clientX: 21 });
    pointer('pointermove', { clientX: 19 });
    pointer('pointerup', { clientX: 21 });
    expect(tap).not.toHaveBeenCalled();
  });

  it('never acts on a press that began elsewhere or ends on another control', () => {
    const other = document.querySelector('button')!;
    pointer('pointerdown', {}, other);
    pointer('pointerup');
    pointer('pointerdown');
    pointer('pointerup', {}, other);
    expect(tap).not.toHaveBeenCalled();
  });

  it('cancels pointercancel and permits a fresh subsequent tap', () => {
    pointer('pointerdown');
    pointer('pointercancel');
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerdown');
    pointer('pointerup');
    expect(tap).toHaveBeenCalledOnce();
  });

  it.each(['canvas', 'other'])('rejects both fingers when a second touch begins on the %s', (target) => {
    pointer('pointerdown');
    pointer('pointerdown', { pointerId: 2 }, target === 'canvas' ? canvas : document.querySelector('button')!);
    pointer('pointerup', { pointerId: 2 });
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerdown');
    pointer('pointerup');
    expect(tap).toHaveBeenCalledOnce();
  });

  it('does not accept a canvas tap while another finger is held elsewhere', () => {
    pointer('pointerdown', { pointerId: 2 }, document.querySelector('button')!);
    pointer('pointerdown');
    pointer('pointerup');
    pointer('pointerup', { pointerId: 2 });
    expect(tap).not.toHaveBeenCalled();
  });

  it('rejects a non-primary finger even when its first finger began outside this document', () => {
    pointer('pointerdown', { isPrimary: false });
    pointer('pointerup', { isPrimary: false });
    expect(tap).not.toHaveBeenCalled();
  });

  it('keeps all remaining fingers blocked after a touch ends and emits pointerout', () => {
    pointer('pointerdown');
    pointer('pointerdown', { pointerId: 2 });
    pointer('pointerup');
    pointer('pointerout', { relatedTarget: null });
    pointer('pointerdown', { pointerId: 3 });
    pointer('pointerup', { pointerId: 3 });
    pointer('pointerup', { pointerId: 2 });
    expect(tap).not.toHaveBeenCalled();
  });

  it.each([1, 2])('ignores non-primary mouse button %s', (button) => {
    pointer('pointerdown', { pointerType: 'mouse', button });
    pointer('pointerup', { pointerType: 'mouse', button });
    expect(tap).not.toHaveBeenCalled();
  });

  it('rejects a chorded mouse gesture', () => {
    pointer('pointerdown', { pointerType: 'mouse' });
    pointer('pointermove', { pointerType: 'mouse', button: 2, buttons: 3 });
    pointer('pointermove', { pointerType: 'mouse', button: 2, buttons: 1 });
    pointer('pointerup', { pointerType: 'mouse' });
    expect(tap).not.toHaveBeenCalled();
  });

  it.each(['room', 'overview', 'furniture mode'])('rejects a held press if its %s context changes', (change) => {
    pointer('pointerdown');
    if (change === 'room') context[0] = 'reading';
    if (change === 'overview') context[1] = true;
    if (change === 'furniture mode') context[2] = { mode: 'browse' };
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('rejects transitions that start and finish while the pointer is held', () => {
    pointer('pointerdown');
    enabled = false;
    input.refresh();
    enabled = true;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerdown');
    context[1] = true;
    input.refresh();
    context[1] = false;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('ignores presses during pan, pause or a dialog even when enabled by release time', () => {
    enabled = false;
    pointer('pointerdown');
    enabled = true;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('rejects a press if a pan, pause or dialog starts before release', () => {
    pointer('pointerdown');
    enabled = false;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it.each(['scroll', 'resize', 'buffer'])('rejects a press if the canvas geometry changes through %s', (change) => {
    pointer('pointerdown');
    if (change === 'scroll') rect = new DOMRect(20, 29, 320, 240);
    if (change === 'resize') rect = new DOMRect(20, 30, 321, 240);
    if (change === 'buffer') canvas.width = 1280;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it.each(['blur', 'pointerleave', 'pointerout'])('cancels when %s interrupts the gesture', (event) => {
    pointer('pointerdown');
    if (event === 'blur') window.dispatchEvent(new Event('blur'));
    else pointer(event, { relatedTarget: null });
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('cancels backgrounded input', () => {
    pointer('pointerdown');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('recovers after the mouse was released outside the window without pointerup', () => {
    pointer('pointerdown', { pointerType: 'mouse' });
    pointer('pointerout', { pointerType: 'mouse', relatedTarget: null });
    pointer('pointermove', { pointerType: 'mouse', buttons: 0 });
    pointer('pointerdown', { pointerType: 'mouse' });
    pointer('pointerup', { pointerType: 'mouse' });
    expect(tap).toHaveBeenCalledOnce();
  });

  it('does not consume normal pointer or keyboard defaults', () => {
    const down = pointer('pointerdown');
    const move = pointer('pointermove', { clientY: 160 });
    const up = pointer('pointerup', { clientY: 160 });
    const key = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    canvas.dispatchEvent(key);
    expect([down, move, up, key].every((event) => !event.defaultPrevented)).toBe(true);
    expect(tap).not.toHaveBeenCalled();
  });

  it('removes every input listener when the scene shuts down', () => {
    pointer('pointerdown');
    input.destroy();
    pointer('pointerup');
    pointer('pointerdown');
    pointer('pointerup');
    pointer('pointermove', { pointerType: 'mouse', buttons: 0 });
    expect(tap).not.toHaveBeenCalled();
    expect(hover).not.toHaveBeenCalled();
  });
});
