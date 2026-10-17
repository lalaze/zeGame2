export const MOBILE_MANAGEMENT_QUERY = '(max-width: 860px), (max-height: 500px) and (pointer: coarse)';

/** Transient overlay state. Never writes speed, game phase or saved data. */
export class FullscreenDrawer {
  private open = false;
  private returnTo: HTMLElement | null = null;
  private inertBefore = new Map<HTMLElement, boolean>();
  readonly media: MediaQueryList;
  constructor(
    private panel: HTMLElement,
    private toggle: HTMLButtonElement,
    private close: HTMLButtonElement,
    private backdrop: HTMLElement,
    private onClose: () => void,
  ) {
    this.media = window.matchMedia(MOBILE_MANAGEMENT_QUERY);
    this.panel.classList.add('mobile-panel');
    this.close.addEventListener('click', onClose);
    this.backdrop.addEventListener('click', onClose);
    this.media.addEventListener('change', () => this.syncMode());
  }
  get paused(): boolean { return this.open && this.media.matches; }
  setOpen(open: boolean, restoreFocus = true): void {
    const changed = open !== this.open;
    if (changed && open) {
      const active = document.activeElement;
      this.returnTo = active instanceof HTMLElement && !this.panel.contains(active) ? active : this.toggle;
    }
    this.open = open;
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
    this.syncMode();
    if (changed && open) this.close.focus({ preventScroll: true });
    if (changed && !open && restoreFocus) {
      const target = this.returnTo;
      (target?.isConnected && !target.closest('[hidden], [inert]') && target.getClientRects().length ? target : this.toggle).focus({ preventScroll: true });
    }
  }
  private syncMode(): void {
    const mobile = this.paused;
    document.body.classList.toggle('mobile-drawer-open', mobile);
    this.backdrop.hidden = !mobile;
    this.panel.setAttribute('role', mobile ? 'dialog' : 'complementary');
    if (mobile) this.panel.setAttribute('aria-modal', 'true');
    else this.panel.removeAttribute('aria-modal');
    const badge = this.panel.querySelector<HTMLElement>('.drawer-pause');
    if (badge) badge.hidden = !mobile;
    if (mobile) {
      const app = document.getElementById('app');
      const layout = this.panel.parentElement;
      const blocked = [...(app?.children ?? []), ...(layout?.children ?? [])]
        .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== layout && el !== this.panel && el !== this.backdrop);
      for (const el of blocked) {
        if (!this.inertBefore.has(el)) this.inertBefore.set(el, el.inert);
        el.inert = true;
      }
      if (!this.panel.contains(document.activeElement) && !document.querySelector('#modal-root:not(:empty), .onboard-overlay')) this.close.focus({ preventScroll: true });
    } else {
      for (const [el, inert] of this.inertBefore) el.inert = inert;
      this.inertBefore.clear();
    }
  }
  handleKey(event: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (event.key === 'Escape') {
      event.preventDefault(); this.onClose(); return true;
    }
    if (event.key === 'Tab' && this.paused) {
      const controls = [...this.panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
        .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
      const first = controls[0] ?? this.close, last = controls.at(-1) ?? this.close;
      if (event.shiftKey && (document.activeElement === first || !this.panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !this.panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    // Keep scene shortcuts away from management content.
    return this.paused || (event.target instanceof Node && this.panel.contains(event.target));
  }
}
