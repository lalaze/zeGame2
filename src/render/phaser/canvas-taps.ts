/** Small hand jitter is allowed, in screen CSS pixels, independent of art zoom or DPR. */
export const TAP_SLOP = 8;

interface TapHooks {
  enabled(): boolean;
  /** Identity of the interaction and view that a press began in. */
  context(): readonly unknown[];
  /** Coordinates use the canvas drawing buffer, ready for the scene camera. */
  tap(x: number, y: number): void;
  hover(x: number, y: number): void;
}

export interface CanvasTaps {
  /** Call each frame to invalidate a press even if a transition later finishes. */
  refresh(): void;
  destroy(): void;
}

/**
 * Recognize completed single-pointer taps rather than acting on the initial press.
 * Native PointerEvents let us see every finger, even when Phaser only allocates one
 * touch pointer. Window listeners observe releases and extra fingers off the canvas;
 * they do not capture pointers or prevent normal page scrolling and button clicks.
 */
export function bindCanvasTaps(canvas: HTMLCanvasElement, hooks: TapHooks): CanvasTaps {
  const document = canvas.ownerDocument;
  const window = document.defaultView!;
  const pointers = new Set<number>();
  let press: { id: number; x: number; y: number; context: readonly unknown[]; bounds: readonly number[] } | null = null;
  const bounds = () => {
    const r = canvas.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height, canvas.width, canvas.height] as const;
  };
  const inside = (e: PointerEvent) => {
    const [x, y, w, h] = bounds();
    return w > 0 && h > 0 && e.clientX >= x && e.clientX < x + w && e.clientY >= y && e.clientY < y + h;
  };
  const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const cancel = () => { press = null; };
  const reset = () => { cancel(); pointers.clear(); };
  const refresh = () => {
    if (press && (!hooks.enabled() || !same(press.context, hooks.context()) || !same(press.bounds, bounds()))) cancel();
  };
  const point = (e: PointerEvent) => {
    const [x, y, w, h, width, height] = bounds();
    return { x: (e.clientX - x) * width / w, y: (e.clientY - y) * height / h };
  };
  const checkMotion = (e: PointerEvent) => {
    refresh();
    if (press?.id === e.pointerId && (!inside(e) || Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP)) cancel();
  };
  const down = (e: PointerEvent) => {
    // A second button/finger cancels the whole gesture, including its final release.
    const alreadyDown = pointers.size > 0;
    pointers.add(e.pointerId);
    if (alreadyDown) { cancel(); return; }
    if (e.target !== canvas || !e.isPrimary || e.button !== 0 || !inside(e) || !hooks.enabled()) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, context: [...hooks.context()], bounds: bounds() };
  };
  const move = (e: PointerEvent) => {
    // A mouse may be released outside this window without delivering pointerup.
    if (e.pointerType === 'mouse' && e.buttons === 0 && pointers.has(e.pointerId)) {
      cancel();
      pointers.delete(e.pointerId);
    }
    // Native PointerEvents report extra mouse buttons as moves, not new downs.
    if (e.pointerType === 'mouse' && e.buttons > 1) cancel();
    checkMotion(e);
    if (e.pointerType !== 'touch' && e.target === canvas && inside(e) && hooks.enabled()) {
      const p = point(e);
      hooks.hover(p.x, p.y);
    }
  };
  const up = (e: PointerEvent) => {
    checkMotion(e);
    const tap = press?.id === e.pointerId && e.button === 0 && e.target === canvas && pointers.size === 1;
    cancel();
    pointers.delete(e.pointerId);
    if (tap) {
      const p = point(e);
      hooks.tap(p.x, p.y);
    }
  };
  const pointerCancel = (e: PointerEvent) => { cancel(); pointers.delete(e.pointerId); };
  const leaveWindow = (e: PointerEvent) => { if (e.relatedTarget === null) cancel(); };
  const visibility = () => { if (document.hidden) reset(); };

  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', pointerCancel, true);
  window.addEventListener('pointerout', leaveWindow, true);
  window.addEventListener('blur', reset);
  canvas.addEventListener('pointerleave', cancel);
  document.addEventListener('visibilitychange', visibility);
  return {
    refresh,
    destroy() {
      reset();
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      window.removeEventListener('pointerout', leaveWindow, true);
      window.removeEventListener('blur', reset);
      canvas.removeEventListener('pointerleave', cancel);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
