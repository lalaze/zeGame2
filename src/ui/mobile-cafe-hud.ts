import { gameIcon } from './game-chrome';
import { t } from '../i18n';
import type { ConditionId } from '../game/conditions';
import type { Speed } from '../game/data';
import { MOBILE_MANAGEMENT_QUERY } from './fullscreen-drawer';

interface HudElements {
  money: HTMLElement;
  day: HTMLElement;
  status: HTMLElement;
  people: HTMLElement;
  style: HTMLElement;
  settings: HTMLButtonElement;
  pantry: HTMLButtonElement;
  help: HTMLButtonElement;
  open: HTMLButtonElement;
  manage: HTMLButtonElement;
  zoom: HTMLElement;
  overview: HTMLButtonElement;
  wall?: HTMLButtonElement | null;
}

const CONDITION_ICON: Record<ConditionId, string> = {
  fair: 'sun', rain: 'rain', hot: 'sun', crisp: 'leaf', market: 'bag', quiet: 'cloud',
};

/** Reuse the actual controls and listeners; restore their desktop homes on rotation. */
export class MobileCafeHud {
  readonly element = document.createElement('div');
  readonly media = window.matchMedia(MOBILE_MANAGEMENT_QUERY);
  private header = document.createElement('header');
  private clock = document.createElement('button');
  private name = document.createElement('span');
  private time = document.createElement('strong');
  private dayText = document.createElement('span');
  private speed = document.createElement('span');
  private condition = document.createElement('span');
  private dayBar = document.createElement('span');
  private dayBarFill = document.createElement('i');
  private wxDisc = document.createElement('span');
  private dock = document.createElement('nav');
  private shelfBoard = document.createElement('div');
  private primary = document.createElement('div');
  private more = document.createElement('button');
  private moreLabel = document.createElement('span');
  private moreDot = document.createElement('span');
  private sheet = document.createElement('section');
  private sheetScroll = document.createElement('div');
  private backdrop = document.createElement('button');
  private title = document.createElement('strong');
  private closeButton = document.createElement('button');
  private service = document.createElement('div');
  private links = document.createElement('div');
  private view = document.createElement('div');
  private hint = document.createElement('p');
  private homes = new Map<HTMLElement, Comment>();
  private abort = new AbortController();
  private active = false;
  private open = false;
  private unreadCount = 0;

  constructor(root: HTMLElement, private controls: HudElements) {
    this.element.className = 'mobile-cafe-hud';
    this.header.className = 'mobile-cafe-header';
    this.clock.className = 'mobile-cafe-clock';
    const ropeL = document.createElement('span'); ropeL.className = 'mobile-sign-rope mobile-sign-rope-l'; ropeL.setAttribute('aria-hidden', 'true');
    const ropeR = document.createElement('span'); ropeR.className = 'mobile-sign-rope mobile-sign-rope-r'; ropeR.setAttribute('aria-hidden', 'true');
    this.name.className = 'mobile-cafe-name';
    this.dayText.className = 'mobile-cafe-day';
    this.speed.className = 'mobile-cafe-speed';
    this.speed.hidden = true;
    this.speed.setAttribute('aria-hidden', 'true');
    this.condition.className = 'mobile-cafe-condition';
    this.dayBar.className = 'mobile-daybar'; this.dayBar.hidden = true; this.dayBar.setAttribute('aria-hidden', 'true');
    this.dayBarFill.className = 'mobile-daybar-fill';
    this.dayBar.append(this.dayBarFill);
    this.wxDisc.className = 'mobile-sign-wx'; this.wxDisc.setAttribute('aria-hidden', 'true');
    this.wxDisc.dataset.floorsIcon = 'sun'; this.wxDisc.dataset.condition = 'fair';
    this.time.append(this.dayText, this.speed, this.condition);
    this.clock.append(ropeL, ropeR, this.name, this.time, this.dayBar, this.wxDisc);
    this.header.append(this.clock);
    this.dock.className = 'mobile-cafe-dock';
    this.shelfBoard.className = 'mobile-shelf-board'; this.shelfBoard.setAttribute('aria-hidden', 'true');
    this.primary.className = 'mobile-cafe-primary';
    this.more.id = 'mobile-cafe-more'; this.more.className = 'pixel-btn ghost';
    this.moreLabel.className = 'mobile-more-label';
    this.moreDot.className = 'mobile-more-dot a-dot'; this.moreDot.setAttribute('aria-hidden', 'true'); this.moreDot.hidden = true;
    this.more.append(this.moreLabel, this.moreDot);
    gameIcon(this.more, 'more');
    this.sheet.id = 'mobile-cafe-tools'; this.sheet.className = 'mobile-cafe-tools';
    this.sheet.setAttribute('aria-labelledby', 'mobile-cafe-tools-title');
    this.backdrop.className = 'mobile-tools-backdrop'; this.backdrop.type = 'button'; this.backdrop.tabIndex = -1;
    const tape = document.createElement('span'); tape.className = 'mobile-tools-tape'; tape.setAttribute('aria-hidden', 'true');
    const tail = document.createElement('span'); tail.className = 'mobile-tools-tail'; tail.setAttribute('aria-hidden', 'true');
    this.sheetScroll.className = 'mobile-tools-scroll';
    this.title.id = 'mobile-cafe-tools-title';
    const heading = document.createElement('div'); heading.className = 'mobile-tools-heading';
    this.closeButton.textContent = '×'; this.closeButton.className = 'pixel-btn ghost';
    heading.append(this.title, this.closeButton);
    this.service.className = 'mobile-service-tools'; this.links.className = 'mobile-cafe-links';
    this.view.className = 'mobile-view-tools'; this.hint.className = 'mobile-view-hint';
    this.sheetScroll.append(heading, this.service, this.links, this.view, this.hint);
    this.sheet.append(tape, this.sheetScroll, tail);
    this.dock.append(this.shelfBoard, this.primary, this.more);
    this.element.append(this.backdrop, this.header, this.sheet, this.dock);
    root.append(this.element);
    for (const button of [this.clock, this.more, this.closeButton]) button.type = 'button';
    for (const button of [this.clock, this.more]) button.setAttribute('aria-controls', this.sheet.id);
    const signal = this.abort.signal;
    this.clock.addEventListener('click', () => this.setOpen(!this.open), { signal });
    this.more.addEventListener('click', () => this.setOpen(!this.open), { signal });
    this.closeButton.addEventListener('click', () => this.close(), { signal });
    this.backdrop.addEventListener('click', () => this.close(), { signal });
    this.dock.addEventListener('click', event => {
      if (event.target instanceof Node && !this.more.contains(event.target)) this.close(false);
    }, { signal });
    // Dismiss on release, so the same touch cannot also activate the canvas.
    window.addEventListener('click', event => {
      if (this.open && event.target instanceof Node && !this.element.contains(event.target)
        && !(event.target instanceof Element && event.target.closest('.modal-overlay, .onboard-overlay'))
        && !document.querySelector('.modal-overlay, .onboard-overlay')) this.close(false);
    }, { signal });
    this.media.addEventListener('change', this.sync, { signal });
    this.sync();
  }

  get expanded(): boolean { return this.active && this.open; }

  private move(element: HTMLElement, destination: HTMLElement): void {
    const home = document.createComment('desktop control');
    element.before(home); this.homes.set(element, home); destination.append(element);
  }

  private sync = () => {
    const mobile = this.media.matches;
    if (mobile === this.active) { this.element.hidden = !mobile; return; }
    this.close(false); this.active = mobile;
    document.body.classList.toggle('mobile-cafe-layout', mobile);
    this.element.hidden = !mobile;
    const c = this.controls;
    if (mobile) {
      this.move(c.money, this.header);
      this.move(c.day, this.service); this.move(c.status, this.service); this.move(c.pantry, this.service);
      this.move(c.people, this.links); this.move(c.style, this.links); this.move(c.settings, this.links);
      this.move(c.zoom, this.view);
      // Five shelf slots: Streets, Ledger, Primary, Walls (floors view), More.
      this.move(c.overview, this.dock); this.primary.before(c.overview);
      this.move(c.manage, this.dock); this.primary.before(c.manage);
      this.move(c.open, this.primary); this.move(c.help, this.primary);
      if (c.wall) { this.move(c.wall, this.dock); this.more.before(c.wall); }
    } else {
      // Restore inner controls before restoring their outer container.
      for (const [element, home] of [...this.homes].reverse()) { home.replaceWith(element); }
      this.homes.clear(); c.help.hidden = false; c.settings.textContent = t('hud.settings');
    }
    this.labels();
  };

  update(name: string, time: string, preparing: boolean, fullLabel: string, condition = '', speed: Speed = 1,
    progress = 0, conditionId: ConditionId = 'fair', moreUnread = 0): void {
    this.name.textContent = name; this.dayText.textContent = time;
    this.speed.textContent = `${speed}×`; this.speed.hidden = preparing;
    this.condition.textContent = condition; this.condition.hidden = !condition;
    this.dayBar.hidden = preparing;
    this.dayBarFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    this.wxDisc.dataset.floorsIcon = CONDITION_ICON[conditionId];
    this.wxDisc.dataset.condition = conditionId;
    this.service.hidden = preparing;
    this.unreadCount = moreUnread;
    this.moreDot.hidden = this.open || moreUnread <= 0;
    this.clock.setAttribute('aria-label', `${fullLabel}${preparing ? '' : ` · ${t('day.speed')} ${speed}×`} · ${t('mobile.controls')}`);
    if (this.active) this.controls.help.hidden = preparing;
    this.labels();
  }

  private labels(): void {
    this.moreLabel.textContent = this.open ? t('mobile.less') : t('mobile.more');
    this.more.dataset.floorsIcon = this.open ? 'close' : 'more';
    this.moreDot.hidden = this.open || this.unreadCount <= 0;
    this.title.textContent = t('mobile.controls');
    this.dock.setAttribute('aria-label', t('mobile.actions'));
    this.closeButton.setAttribute('aria-label', t('mobile.close'));
    this.backdrop.setAttribute('aria-label', t('mobile.close'));
    this.hint.textContent = t('mobile.viewHint');
    if (this.active) this.controls.settings.textContent = t('hud.settings');
  }

  private setOpen(open: boolean): void {
    this.open = this.active && open;
    this.sheet.hidden = !this.open;
    this.backdrop.hidden = !this.open;
    document.body.classList.toggle('mobile-tools-open', this.open);
    for (const button of [this.clock, this.more]) button.setAttribute('aria-expanded', String(this.open));
    this.labels();
    if (this.open) this.closeButton.focus({ preventScroll: true });
  }
  close(restoreFocus = true): void {
    const heldFocus = this.sheet.contains(document.activeElement) || document.activeElement === this.backdrop;
    this.setOpen(false);
    if (restoreFocus && heldFocus && this.active) this.more.focus({ preventScroll: true });
  }
  handleKey(event: KeyboardEvent): boolean {
    if (!this.expanded) return false;
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    // Scene shortcuts must not run while browsing these controls.
    return true;
  }
  destroy(): void {
    this.close(false); this.abort.abort();
    for (const [element, home] of [...this.homes].reverse()) home.replaceWith(element);
    this.controls.help.hidden = false; this.controls.settings.textContent = t('hud.settings');
    document.body.classList.remove('mobile-cafe-layout'); this.element.remove();
  }
}
