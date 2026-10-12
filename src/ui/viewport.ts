/** Keep dialogs inside the visual viewport when the OS keyboard covers layout
 * viewport space. CSS dvh remains the fallback on browsers without this API. */
export function trackVisualViewport(win: Window = window, doc: Document = document): () => void {
  const viewport = win.visualViewport;
  if (!viewport) return () => {};
  const style = doc.documentElement.style;
  const update = () => {
    // Do not fight a user's pinch zoom. At normal scale this also tracks address
    // bar and orientation changes without persisting device-specific geometry.
    if (viewport.scale !== 1) {
      style.removeProperty('--usable-viewport-height');
      style.removeProperty('--usable-viewport-top');
      return;
    }
    style.setProperty('--usable-viewport-height', `${Math.max(1, viewport.height)}px`);
    style.setProperty('--usable-viewport-top', `${Math.max(0, viewport.offsetTop)}px`);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  win.addEventListener('resize', update);
  update();
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    win.removeEventListener('resize', update);
    style.removeProperty('--usable-viewport-height');
    style.removeProperty('--usable-viewport-top');
  };
}
