/** A catalog-relative position survives switching between the desktop list
 * scroller and the mobile wrapper (which also contains goals and filters). */
export function panelListOffset(list: HTMLElement, scroller: HTMLElement): number {
  return scroller === list ? 0
    : list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

export function readPanelScroll(list: HTMLElement, scroller: HTMLElement): number {
  return scroller.scrollTop - panelListOffset(list, scroller);
}

export function restorePanelScroll(list: HTMLElement, scroller: HTMLElement, position: number): void {
  // The browser clamps to the available range when the new catalog is shorter.
  scroller.scrollTop = Math.max(0, panelListOffset(list, scroller) + position);
}
