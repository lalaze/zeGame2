/** Mobile furnishing temporarily hides management. Wait for the room transition
 * and final panel update before moving focus into, or back out of, that workspace. */
export class ArrangeFocus {
  private returnTo: HTMLElement | null = null;
  private pending = false;
  constructor(private panel: HTMLElement, private done: HTMLElement) {}
  capture(): void {
    if (!this.panel.classList.contains('mobile-panel')) return;
    const active = this.panel.ownerDocument.activeElement;
    this.returnTo = active instanceof HTMLElement && this.panel.contains(active) ? active : null;
    this.pending = true;
  }
  update(arranging: boolean, ready: boolean): void {
    if (!ready) return;
    if (arranging) {
      if (this.pending) { this.done.focus({ preventScroll: true }); this.pending = false; }
      return;
    }
    this.pending = false;
    if (!this.returnTo) return;
    const visible = this.returnTo.isConnected && !this.returnTo.closest('[hidden]') && this.returnTo.getClientRects().length > 0;
    const enabled = !(this.returnTo instanceof HTMLButtonElement && this.returnTo.disabled);
    const target = visible && enabled ? this.returnTo : this.panel.querySelector<HTMLElement>('[data-tab="decor"]');
    target?.focus({ preventScroll: true });
    this.returnTo = null;
  }
}
