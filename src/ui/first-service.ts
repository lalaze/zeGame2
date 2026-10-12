import { firstServiceStep, isFirstCafe, type FirstServiceStep } from '../game/first-service';
import type { GameState } from '../game/state';
import type { GuardedStorage } from '../game/storage';
import { getLocale, t } from '../i18n';
import { showModal } from './modal';

type Actions = { pantry: () => void; prepare: () => void; close: () => void; status: () => void; allTools: () => void };
/** A small in-flow card, never a simulation-pausing overlay. */
export class FirstServiceGuide {
  readonly element = document.createElement('section');
  private active = false;
  private checkedStock = false;
  private expandedTools = false;
  private completed = false;
  private signature = '';
  private key = '';
  constructor(private state: () => GameState, private storage: GuardedStorage, private actions: Actions) {
    this.element.className = 'first-service';
    this.element.setAttribute('aria-label', t('guide.title'));
    this.element.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-guide-action]')?.dataset.guideAction;
      if (action === 'skip') this.dismiss();
      if (action === 'help') this.showHelp();
      if (action === 'tools') { this.expandedTools = true; this.persist(); this.actions.allTools(); this.update(); }
      if (action === 'next') this.advance();
    });
    this.reset();
  }
  reset(): void {
    this.key = `tiny-bean-cafe/first-service/${this.state().createdAt}`;
    const saved = this.storage.preference(this.key);
    this.active = saved?.startsWith('active') ?? isFirstCafe(this.state());
    this.checkedStock = saved?.includes('stock') ?? false;
    this.expandedTools = saved?.includes('tools') ?? false;
    this.completed = saved?.includes('complete') ?? false;
    this.signature = '';
    if (this.active) this.persist();
  }
  get simplify(): boolean { return this.active && !this.expandedTools; }
  private persist(): void {
    this.storage.setPreference(this.key, this.active ? `active${this.checkedStock ? ':stock' : ''}${this.expandedTools ? ':tools' : ''}${this.completed ? ':complete' : ''}` : 'done');
  }
  dismiss(): void {
    const hadFocus = this.element.contains(document.activeElement);
    this.active = false; this.persist(); this.actions.allTools(); this.update();
    if (hadFocus) document.querySelector<HTMLElement>('#open-btn:not([hidden]), #close-btn:not([hidden]), #settings-btn')?.focus();
  }
  private advance(): void {
    const step = this.completed ? 'complete' : firstServiceStep(this.state(), this.checkedStock);
    if (step === 'stock') { this.checkedStock = true; this.persist(); this.actions.pantry(); }
    else if (step === 'prepare' || step === 'reopen') this.actions.prepare();
    else if (step === 'close') this.actions.close();
    else if (step === 'observe') this.actions.status();
    else if (step === 'complete') this.dismiss();
    this.update();
  }
  update(): void {
    const step = this.completed ? 'complete' : firstServiceStep(this.state(), this.checkedStock);
    // Reopening is the end of the introductory focus, but keep the success card
    // until dismissed so the user gets a clear finish rather than a vanishing UI.
    if (this.active && step === 'complete' && !this.completed) {
      this.completed = true;
      if (!this.expandedTools) { this.expandedTools = true; this.actions.allTools(); }
      this.persist();
    }
    this.element.hidden = !this.active || !this.state().profile;
    // Keep every confirmation/error toast, but give it its own layout row while
    // the guide is present. It must not float over guidance or mobile controls.
    const toast = document.getElementById('toast');
    if (toast) {
      if (this.element.hidden) {
        const layout = document.querySelector<HTMLElement>('#app > .layout');
        const mobile = document.getElementById('management-panel')?.classList.contains('mobile-panel');
        if (mobile && layout) { if (layout.previousElementSibling !== toast) layout.before(toast); }
        else if (toast.parentElement !== document.body) document.body.append(toast);
      }
      else if (!this.element.hidden && this.element.parentElement && this.element.nextElementSibling !== toast) this.element.after(toast);
    }
    const signature = `${this.element.hidden}:${step}:${getLocale()}:${this.expandedTools}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const focused = (document.activeElement as HTMLElement | null)?.dataset.guideAction;
    const hadFocus = this.element.contains(document.activeElement);
    const number: Record<FirstServiceStep, number> = { stock: 1, prepare: 2, observe: 3, close: 4, closing: 4, reopen: 5, complete: 6 };
    this.element.setAttribute('aria-label', t('guide.title'));
    this.element.innerHTML = `<div class="guide-copy"><b>${t('guide.progress', { n: number[step] })} · ${t(`guide.${step}.title`)}</b><p>${t(`guide.${step}.body`)}</p></div>
      <div class="guide-actions">${step !== 'closing' ? `<button class="pixel-btn small" data-guide-action="next">${t(`guide.${step}.action`)}</button>` : ''}
      <button class="chip" data-guide-action="help">${t('guide.help')}</button>
      ${!this.expandedTools ? `<button class="chip" data-guide-action="tools">${t('guide.tools')}</button>` : ''}
      <button class="chip" data-guide-action="skip">${t(step === 'complete' ? 'guide.done' : 'guide.skip')}</button></div>`;
    if (hadFocus) (this.element.querySelector<HTMLElement>(`[data-guide-action="${focused}"]`) ?? this.element.querySelector<HTMLElement>('button'))?.focus();
  }
  showHelp(): void {
    showModal({ focusableBody: true, title: t('guide.helpTitle'), body: `<div class="guide-reference">${['stock', 'menu', 'bake', 'open', 'close', 'next'].map((topic) => `<h3>${t(`guide.reference.${topic}.title` as Parameters<typeof t>[0])}</h3><p>${t(`guide.reference.${topic}.body` as Parameters<typeof t>[0])}</p>`).join('')}</div>`, buttons: [{ label: t('settings.back'), primary: true }] });
  }
}
