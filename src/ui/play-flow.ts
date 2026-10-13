import type { GameState } from '../game/state';
import { isComposingKey } from './keyboard';
import type { Panel, PanelBrowsingContext, PanelTab, PantryTaskContext } from './panel';

export interface PlayFlowLabels {
  title: string;
  help: string;
  helpHint: string;
  pantry: string;
  back: string;
  returnTo: (tab: PanelTab | null) => string;
}

export interface PlayFlowOptions {
  panel: Panel;
  state: () => GameState;
  /** Check current modal/session/visibility/scene state, not a render-time cache. */
  canInteract: () => boolean;
  /** The same guarded Sim.boost entry used by scene assistance. */
  help: () => boolean;
  isPanelCollapsed: () => boolean;
  /** A transient reveal/restore. Do not persist the collapse preference here. */
  setPanelCollapsed: (collapsed: boolean) => void;
  labels: () => PlayFlowLabels;
  /** Return current plain-text shortage context, including signature recipes. */
  pantryContext: (shortage: boolean) => PantryTaskContext;
}

interface ReturnPoint {
  browsing: PanelBrowsingContext;
  collapsed: boolean;
  launcher: HTMLElement;
  shortage: boolean;
}

/** Optional service actions and one reversible Pantry detour. No buying logic. */
export class PlayFlow {
  readonly element: HTMLElement;
  readonly helpButton: HTMLButtonElement;
  readonly pantryButton: HTMLButtonElement;
  private readonly helpHint: HTMLElement;
  private readonly stopNavigation: () => void;
  private returnPoint: ReturnPoint | null = null;
  private releaseNavigationKey: (() => void) | null = null;
  private navigationEpoch = 0;
  private destroyed = false;

  constructor(private options: PlayFlowOptions) {
    this.element = document.createElement('nav');
    this.element.className = 'play-flow-actions';
    this.element.setAttribute('aria-label', options.labels().title);
    this.helpButton = document.createElement('button');
    this.helpButton.type = 'button';
    this.helpButton.className = 'chip';
    this.helpButton.dataset.playHelp = '';
    this.pantryButton = document.createElement('button');
    this.pantryButton.type = 'button';
    this.pantryButton.className = 'chip';
    this.pantryButton.dataset.playPantry = '';
    this.pantryButton.setAttribute('aria-controls', 'management-panel');
    this.helpHint = document.createElement('span');
    this.helpHint.className = 'play-flow-help-hint';
    this.helpHint.id = 'play-flow-help-hint';
    this.helpButton.setAttribute('aria-describedby', this.helpHint.id);
    this.element.append(this.helpButton, this.pantryButton, this.helpHint);
    this.helpButton.addEventListener('click', () => {
      if (this.allowed()) this.options.help();
    });
    this.helpButton.addEventListener('keydown', (event) => {
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
    });
    this.pantryButton.addEventListener('click', () => {
      // Enter clicks on keydown; defer its focus-changing navigation until keyup.
      // Pointer and assistive-technology clicks without a physical key keep their
      // normal behavior. Space already produces its native click on key release.
      if (!this.releaseNavigationKey) this.activatePantry();
    });
    this.pantryButton.addEventListener('keydown', (event) => this.deferPantryEnter(event));
    // showTab() also covers guide/settlement/scene navigation, not only tab clicks.
    this.stopNavigation = options.panel.onNavigate(() => this.cancelPantry());
    this.update();
  }

  get pantryOpen(): boolean { return this.returnPoint !== null; }

  private allowed(): boolean {
    return !this.destroyed && this.options.state().phase !== 'prep' && this.options.canInteract();
  }

  private activatePantry(): void {
    if (!this.allowed()) return;
    if (this.returnPoint) this.returnToPrevious();
    else this.openPantry(false, this.pantryButton);
  }

  private deferPantryEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || isComposingKey(event)) return;
    event.preventDefault();
    if (event.repeat || this.releaseNavigationKey || !this.allowed()) return;
    const expectedReturn = this.returnPoint;
    const expectedEpoch = this.navigationEpoch;
    let focusInterrupted = false;
    const doc = this.element.ownerDocument;
    const view = doc.defaultView;
    const finish = () => {
      doc.removeEventListener('keydown', repeated, true);
      doc.removeEventListener('keyup', released, true);
      doc.removeEventListener('visibilitychange', visibility);
      this.pantryButton.removeEventListener('blur', interrupted);
      view?.removeEventListener('blur', finish);
      this.releaseNavigationKey = null;
    };
    const repeated = (key: KeyboardEvent) => {
      if (key.key !== 'Enter') return;
      // This guard lasts for this one physical press only. If a dialog or newer
      // navigation moves focus meanwhile, repeat must not reach its action.
      key.preventDefault();
      key.stopImmediatePropagation();
    };
    const released = (key: KeyboardEvent) => {
      if (key.key !== 'Enter') return;
      key.preventDefault();
      key.stopImmediatePropagation();
      const sameIntent = !focusInterrupted && this.returnPoint === expectedReturn && this.navigationEpoch === expectedEpoch
        && doc.activeElement === this.pantryButton;
      finish();
      if (sameIntent) this.activatePantry();
    };
    const visibility = () => { if (doc.hidden) finish(); };
    // Losing and regaining focus does not revive an interrupted physical press.
    // Keep the repeat guard until release so it cannot activate the new target.
    const interrupted = () => { focusInterrupted = true; };
    this.releaseNavigationKey = finish;
    doc.addEventListener('keydown', repeated, true);
    doc.addEventListener('keyup', released, true);
    doc.addEventListener('visibilitychange', visibility);
    this.pantryButton.addEventListener('blur', interrupted);
    view?.addEventListener('blur', finish);
  }

  openPantry(shortage = false, launcher = this.pantryButton as HTMLElement): boolean {
    if (!this.allowed()) return false;
    if (this.returnPoint) {
      // A refreshed warning may update the same task, but never replaces its origin.
      this.returnPoint.shortage ||= shortage;
      this.update();
      return true;
    }
    const point: ReturnPoint = {
      browsing: this.options.panel.captureBrowsingContext(),
      collapsed: this.options.isPanelCollapsed(),
      launcher,
      shortage,
    };
    this.options.setPanelCollapsed(false);
    // Do this before setting returnPoint so our own transition is not newer intent.
    this.options.panel.showTab('pantry');
    this.returnPoint = point;
    this.options.panel.setPantryTaskContext(this.options.pantryContext(shortage));
    this.options.panel.focusPantryTask(shortage);
    this.update();
    return true;
  }

  returnToPrevious(focus = true): boolean {
    const point = this.returnPoint;
    if (!point) return false;
    this.returnPoint = null;
    this.options.panel.setPantryTaskContext(null);
    this.options.panel.restoreBrowsingContext(point.browsing, false);
    this.options.setPanelCollapsed(point.collapsed);
    if (focus && this.allowed()) {
      if (!point.collapsed) this.options.panel.restoreBrowsingFocus(point.browsing);
      else {
        const usable = point.launcher.isConnected && !point.launcher.closest('[hidden], [inert]')
          && !point.launcher.matches(':disabled');
        (usable ? point.launcher : this.pantryButton).focus({ preventScroll: true });
      }
    }
    this.update();
    return true;
  }

  /** Discard an old return route when an explicit newer navigation owns the UI. */
  cancelPantry(): void {
    // Also invalidate a pending Enter release before Pantry has opened at all.
    this.navigationEpoch++;
    if (!this.returnPoint) return;
    this.returnPoint = null;
    this.options.panel.setPantryTaskContext(null);
    this.update();
  }

  /** Call only after the application's modal Escape branch. */
  handleEscape(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || event.defaultPrevented || isComposingKey(event)
      || !this.returnPoint || !this.allowed()) return false;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
    event.preventDefault();
    return this.returnToPrevious();
  }

  update(): void {
    if (this.destroyed) return;
    if (this.options.state().phase === 'prep' && this.returnPoint) {
      // Settlement owns focus; never keep a hidden Back route in the next day.
      this.returnToPrevious(false);
      return;
    }
    const labels = this.options.labels();
    this.element.hidden = this.options.state().phase === 'prep';
    this.element.setAttribute('aria-label', labels.title);
    this.helpButton.textContent = labels.help;
    this.helpButton.title = labels.helpHint;
    this.helpHint.textContent = labels.helpHint;
    this.helpButton.disabled = this.pantryButton.disabled = !this.allowed();
    this.pantryButton.textContent = this.returnPoint ? labels.back : labels.pantry;
    this.pantryButton.setAttribute('aria-expanded', String(!!this.returnPoint));
    this.pantryButton.setAttribute('aria-label', this.returnPoint
      ? labels.returnTo(this.returnPoint.collapsed ? null : this.returnPoint.browsing.tab)
      : labels.pantry);
    if (this.returnPoint) this.options.panel.setPantryTaskContext(this.options.pantryContext(this.returnPoint.shortage));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.returnToPrevious(false);
    this.releaseNavigationKey?.();
    this.destroyed = true;
    this.stopNavigation();
    this.element.remove();
  }
}
