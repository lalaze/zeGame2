import { formatNumber } from '../game/format';
import type { GameState } from '../game/state';
import { STYLE_IDS, currentStyleStage, nextStyleGoal, setCafeStyle, startStyleWelcome, styleStages, type CafeStyleId, type StyleGoal } from '../game/styles';
import { t, type MessageKey } from '../i18n';
import { isComposingKey } from './keyboard';
import { closeModal, showModal } from './modal';

export const cafeStyleName = (id: CafeStyleId | null): string => t(`style.${id ?? 'mixed'}.name`);
const goalNumber = (n: number): string => Number.isInteger(n) ? formatNumber(n) : String(Math.floor(n * 100) / 100);
export const styleGoalLabel = (goal: StyleGoal): string => t(`style.goal.${goal.id}` as MessageKey);

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  element.className = className;
  return element;
}

function goalHint(goal: StyleGoal, focus: CafeStyleId): string {
  const id = goal.id;
  const hint = /Welcome$/.test(id) ? 'welcome' : /Signature|^signature/.test(id) ? 'taste'
    : /^(machine|barista|server|cook)/.test(id) ? 'upgrade'
    : /^fastServed/.test(id) ? 'fastService'
    : /^teaPairs/.test(id) ? 'teaPairs' : /^catServed/.test(id) ? 'catService' : /^tableServed/.test(id) ? 'tableService'
    : id === 'planted' ? 'planted' : id === 'bookshelf' ? 'bookshelf'
    : /^cats/.test(id) ? 'cats' : /^comfort/.test(id) ? 'comfort'
    : /^(reading|greenhouse|terrace)$/.test(id) ? 'rooms'
    : id === 'kitchen' ? focus === 'bakery' ? 'bakeryKitchen' : 'kitchen' : id === 'reliable' ? 'reliable'
    : /^(coffee30|tea30|bakery100|served|tableServed|catServed|teaPairs)/.test(id) ? 'service' : 'menu';
  return t(`style.hint.${hint}`);
}

export function updateCafeStyleButton(state: GameState): void {
  const button = document.getElementById('cafe-style-btn');
  if (!button) return;
  const name = t('style.ui.button');
  if (button.textContent !== name) button.textContent = name;
  const description = t('style.ui.entry', { name: cafeStyleName(state.cafeStyle.focus) });
  if (button.title !== description) button.title = description;
  if (button.getAttribute('aria-label') !== description) button.setAttribute('aria-label', description);
}

/** A brief reminder, deliberately independent of the optional kitchen tutorial. */
export function prepStyleSummary(state: GameState, openPicker: () => void): HTMLElement {
  const root = document.createElement('section');
  root.className = 'prep-style';
  const focus = state.cafeStyle.focus;
  const copy = document.createElement('div');
  copy.append(text('b', t('style.prep.current', { name: cafeStyleName(focus) })));
  if (focus) {
    const goal = nextStyleGoal(state, focus);
    copy.append(text('p', goal ? t('style.prep.next', {
      goal: styleGoalLabel(goal), current: goalNumber(goal.current), target: goalNumber(goal.target),
    }) : t('style.ui.established'), 'note'));
  }
  const button = text('button', t(focus ? 'style.prep.edit' : 'style.prep.choose'), 'chip');
  button.type = 'button';
  button.dataset.focus = 'cafe-style';
  button.dataset.prepStyle = '';
  button.addEventListener('click', () => { if (root.isConnected) openPicker(); });
  root.append(copy, button);
  return root;
}

/** One paused modal; browsing never mutates state, choosing is closed-shop only. */
export function showCafeStyles(state: GameState, onChange: () => void, onBack?: () => void): void {
  const root = document.createElement('div');
  root.className = 'cafe-styles';
  let viewed: CafeStyleId | null = state.cafeStyle.focus;
  let browseOpen = viewed === null;
  let detailsOpen = false;

  const live = () => root.isConnected;
  function render(restoreFocus?: string): void {
    const scroll = root.closest<HTMLElement>('.modal-body');
    const scrollTop = scroll?.scrollTop ?? 0;
    root.replaceChildren();
    root.append(text('p', t('style.ui.intro'), 'style-intro'));
    const card = document.createElement('section');
    card.className = `style-current style-${viewed ?? 'mixed'}`;
    card.dataset.styleView = viewed ?? 'mixed';
    card.append(text('p', t(viewed === state.cafeStyle.focus ? 'style.ui.current' : 'style.ui.preview'), 'style-eyebrow'));
    card.append(text('h3', cafeStyleName(viewed)), text('p', t(`style.${viewed ?? 'mixed'}.intro`)));
    if (viewed) {
      const stage = currentStyleStage(state, viewed);
      card.append(text('p', t('style.ui.stage', {
        stage: t(`style.stage.${stage.id}`), done: stage.goals.filter(goal => goal.done).length, total: stage.goals.length,
      }), 'style-stage'));
      const goal = nextStyleGoal(state, viewed);
      const next = document.createElement('div');
      next.className = 'style-next';
      next.append(text('b', goal ? t('style.ui.next') : t('style.ui.done')));
      if (goal) {
        next.append(text('p', `${styleGoalLabel(goal)} · ${t('style.ui.progress', { current: goalNumber(goal.current), target: goalNumber(goal.target) })}`));
        next.append(text('p', goalHint(goal, viewed), 'note'));
      } else next.append(text('p', t('style.ui.established')));
      card.append(next);
    }
    const active = viewed === state.cafeStyle.focus;
    const choose = text('button', t(active ? 'style.ui.selected' : 'style.ui.select'), 'pixel-btn small');
    choose.type = 'button';
    choose.dataset.styleApply = viewed ?? 'mixed';
    choose.disabled = active || state.phase !== 'prep';
    choose.addEventListener('click', () => {
      if (!live() || !choose.isConnected || viewed === state.cafeStyle.focus) return;
      if (!setCafeStyle(state, viewed)) return;
      onChange();
      updateCafeStyleButton(state);
      browseOpen = false;
      render('style-heading');
    });
    card.append(choose);
    if ((viewed === 'cats' || viewed === 'bakery') && active) {
      const id = viewed;
      const activeTrial = id === 'cats' ? state.pets.some(p => p.fosterUntilDay === state.day) : state.cafeStyle.bakeryTrialDay === state.day;
      const eligible = !state.cafeStyle.introductions?.includes(id) && (id === 'cats' ? state.pets.length === 0 : !state.kitchen);
      if (activeTrial) card.append(text('p', t(id === 'cats' ? 'style.welcome.catActive' : 'style.welcome.bakeryActive'), 'style-welcome-status'));
      else if (eligible) {
        const welcome = text('button', t(id === 'cats' ? 'style.welcome.startCats' : 'style.welcome.startBakery'), 'pixel-btn');
        welcome.type = 'button'; welcome.dataset.styleWelcome = id;
        welcome.disabled = state.phase !== 'prep';
        welcome.addEventListener('click', () => {
          if (!live() || !welcome.isConnected || !startStyleWelcome(state, id)) return;
          onChange(); render('style-heading');
        });
        card.append(text('p', t(`style.welcome.${id}`), 'note'), welcome);
      }
    }
    if (state.phase !== 'prep') card.append(text('p', t('style.ui.closeOnly'), 'note style-closed-only'));
    card.querySelector('h3')!.dataset.styleFocus = 'style-heading';
    card.querySelector('h3')!.tabIndex = -1;
    root.append(card);

    const browse = document.createElement('details');
    browse.className = 'style-picker';
    browse.open = browseOpen;
    browse.append(text('summary', t('style.ui.browse')));
    browse.querySelector('summary')!.dataset.styleFocus = 'style-browse';
    browse.addEventListener('toggle', () => { if (browse.isConnected) browseOpen = browse.open; });
    const choices = document.createElement('div');
    choices.className = 'style-choices';
    for (const id of [...STYLE_IDS, null]) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = `style-choice style-${id ?? 'mixed'}`;
      choice.dataset.styleChoice = id ?? 'mixed';
      choice.dataset.styleFocus = id ?? 'mixed';
      choice.setAttribute('aria-pressed', String(viewed === id));
      choice.append(text('b', cafeStyleName(id)), text('small', t(`style.${id ?? 'mixed'}.short`)));
      if (state.cafeStyle.focus === id) choice.append(text('small', t('style.ui.current'), 'style-active-label'));
      choice.addEventListener('click', () => {
        if (!live() || !choice.isConnected) return;
        viewed = id;
        browseOpen = true;
        detailsOpen = false;
        render('style-heading');
        // The initial render runs before the modal is mounted.
        const body = root.closest<HTMLElement>('.modal-body');
        if (body) body.scrollTop = 0;
      });
      choices.append(choice);
    }
    browse.append(choices);
    root.append(browse);

    const details = document.createElement('details');
    details.className = 'style-details';
    details.open = detailsOpen;
    details.append(text('summary', t('style.ui.details')));
    details.addEventListener('toggle', () => { if (details.isConnected) detailsOpen = details.open; });
    details.append(text('h4', t('style.ui.effects')), text('p', t(`style.${viewed ?? 'mixed'}.effects`)));
    details.append(text('h4', t('style.ui.cost')), text('p', t(`style.${viewed ?? 'mixed'}.cost`)));
    if (viewed) {
      for (const stage of styleStages(state, viewed)) {
        const section = document.createElement('section');
        section.className = 'style-stage-details';
        section.dataset.styleStage = stage.id;
        section.append(text('h4', `${t(`style.stage.${stage.id}`)}${stage.done ? ` · ${t('style.ui.done')}` : ''}`));
        const list = document.createElement('ul');
        for (const goal of stage.goals) {
          const row = text('li', `${styleGoalLabel(goal)} · ${t('style.ui.progress', { current: goalNumber(goal.current), target: goalNumber(goal.target) })}${goal.done ? ` · ${t('style.ui.done')}` : ''}`, goal.done ? 'done' : '');
          row.dataset.styleGoal = goal.id;
          list.append(row);
        }
        section.append(list);
        details.append(section);
      }
    }
    details.append(text('p', t('style.ui.stacking'), 'note'), text('p', t('style.ui.progressNote'), 'note'));
    root.append(details, text('p', t('style.ui.keep'), 'note style-keep'));
    if (restoreFocus) root.querySelector<HTMLElement>(`[data-style-focus="${restoreFocus}"]`)?.focus({ preventScroll: true });
    if (scroll) scroll.scrollTop = scrollTop;
  }
  render();
  showModal({ title: t('style.ui.title'), body: root, focusableBody: true, buttons: [
    { label: t(onBack ? 'style.ui.backPrep' : 'style.ui.close'), onClick: onBack },
  ] });
  const dialog = root.closest<HTMLElement>('[role="dialog"]')!;
  dialog.classList.add('cafe-styles-modal');
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || isComposingKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    onBack?.();
  });
}
