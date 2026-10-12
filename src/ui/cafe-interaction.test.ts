// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCanvasTaps, type CanvasTaps } from '../render/phaser/canvas-taps';
import { cafeInteractionEnabled } from './cafe-interaction';

let canvas: HTMLCanvasElement;
let input: CanvasTaps;
let active: boolean;
let modal: boolean;
const tap = vi.fn();

function pointer(type: string) {
  canvas.dispatchEvent(new PointerEvent(type, {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    buttons: type === 'pointerup' ? 0 : 1, clientX: 50, clientY: 50, bubbles: true,
  }));
}

beforeEach(() => {
  document.body.innerHTML = '<canvas width="320" height="240"></canvas>';
  canvas = document.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 240));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  active = true;
  modal = false;
  tap.mockClear();
  input = bindCanvasTaps(canvas, {
    enabled: () => cafeInteractionEnabled(active, modal), context: () => ['main'], tap, hover: vi.fn(),
  });
});
afterEach(() => { input.destroy(); vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('live café interaction safety', () => {
  it.each(['modal', 'stale session', 'save notice', 'hidden tab', 'onboarding'])('blocks a captured release when %s appears before the next frame', (blocker) => {
    pointer('pointerdown');
    if (blocker === 'modal') modal = true;
    if (blocker === 'stale session') active = false;
    if (blocker === 'save notice') document.body.insertAdjacentHTML('beforeend', '<div id="save-session-notice"></div>');
    if (blocker === 'hidden tab') vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    if (blocker === 'onboarding') document.body.insertAdjacentHTML('beforeend', '<div class="onboard-overlay"></div>');
    // No frame, refresh(), pointerleave or visibility event occurs in this race.
    // Touch implicit capture still delivers the release to the original canvas.
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });

  it('accepts a fresh tap after a dialog closes, but never a press that began behind it', () => {
    modal = true;
    pointer('pointerdown');
    modal = false;
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
    pointer('pointerdown');
    pointer('pointerup');
    expect(tap).toHaveBeenCalledOnce();
  });
});
