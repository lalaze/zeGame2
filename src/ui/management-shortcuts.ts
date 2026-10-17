import { MOBILE_MANAGEMENT_QUERY } from './fullscreen-drawer';

/**
 * The six desktop management shortcuts, folded into the Manage button until asked for.
 * Transient overlay state: never pauses service or writes saved data.
 */
export class ManagementShortcuts {
  private open = false;
  /** Phones never show the shortcuts; Manage opens the drawer directly there. */
  readonly media: MediaQueryList;
  constructor(private menu: HTMLElement, private toggle: HTMLButtonElement, private onChange: () => void) {
    this.media = window.matchMedia(MOBILE_MANAGEMENT_QUERY);
    this.menu.hidden = true;
    document.addEventListener('pointerdown', (event) => {
      if (this.open && !this.owns(event.target)) this.setOpen(false);
    }, true);
    const leave = (event: FocusEvent) => {
      if (this.open && event.relatedTarget instanceof Node && !this.owns(event.relatedTarget)) this.setOpen(false);
    };
    this.menu.addEventListener('focusout', leave);
    this.toggle.addEventListener('focusout', leave);
    this.media.addEventListener('change', () => { this.setOpen(false); this.onChange(); });
  }
  get available(): boolean { return !this.media.matches; }
  get expanded(): boolean { return this.open; }
  setOpen(open: boolean, focusToggle = false): void {
    open &&= this.available;
    // Never drop focus onto the page by hiding the shortcut that holds it.
    if (focusToggle || (!open && this.menu.contains(document.activeElement))) this.toggle.focus({ preventScroll: true });
    if (open === this.open) return;
    this.open = open;
    this.menu.hidden = !open;
    document.body.classList.toggle('shortcuts-open', open);
    this.onChange();
  }
  handleEscape(event: KeyboardEvent): boolean {
    if (!this.open || event.key !== 'Escape') return false;
    event.preventDefault();
    this.setOpen(false, true);
    return true;
  }
  private owns(target: EventTarget | null): boolean {
    return target instanceof Node && (this.menu.contains(target) || this.toggle.contains(target));
  }
}
