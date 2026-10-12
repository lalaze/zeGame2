import { readPanelScroll, restorePanelScroll } from './panel-scroll';

/** Dock small-screen service/furnishing controls outside the tappable café.
 * Desktop retains the original DOM positions. This is presentation only.
 */
export function dockMobileControls(stage: HTMLElement, scene: HTMLElement, controls: HTMLElement[], onResize: () => void): () => void {
  const media = window.matchMedia('(max-width: 860px)');
  const homes = controls.map((element) => ({ element, marker: document.createComment(`home:${element.id}`) }));
  for (const { element, marker } of homes) element.before(marker);
  const dock = document.createElement('div');
  dock.className = 'mobile-stage-controls';
  let synced = false;
  let contentOffset = 0;
  const rememberScroll = (event: Event) => {
    const panel = document.getElementById('management-panel');
    const list = panel?.querySelector<HTMLElement>('#list');
    const scroller = panel?.classList.contains('mobile-panel') ? panel.querySelector<HTMLElement>('.panel-scroll') : list;
    if (list && scroller && event.target === scroller) {
      contentOffset = readPanelScroll(list, scroller);
    }
  };
  document.addEventListener('scroll', rememberScroll, true);
  const sync = () => {
    const panel = document.getElementById('management-panel');
    const list = panel?.querySelector<HTMLElement>('#list');
    const wrapper = panel?.querySelector<HTMLElement>('.panel-scroll');
    const wasMobile = panel?.classList.contains('mobile-panel');
    panel?.classList.toggle('mobile-panel', media.matches);
    if (media.matches) {
      scene.before(dock);
      dock.append(...controls);
    } else {
      for (const { element, marker } of homes) marker.after(element);
      dock.remove();
    }
    if (synced && wasMobile !== media.matches && list && wrapper) {
      const next = media.matches ? wrapper : list;
      restorePanelScroll(list, next, contentOffset);
    }
    synced = true;
    onResize();
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(dock);
  const operation = stage.querySelector<HTMLElement>('#operation-status');
  if (operation) observer.observe(operation);
  media.addEventListener('change', sync);
  // The caller's renderer is constructed later in the same task.
  queueMicrotask(sync);
  return () => {
    observer.disconnect();
    document.removeEventListener('scroll', rememberScroll, true);
    media.removeEventListener('change', sync);
    for (const { element, marker } of homes) { marker.after(element); marker.remove(); }
    dock.remove();
  };
}
