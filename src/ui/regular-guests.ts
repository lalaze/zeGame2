import { CUSTOMER_CAST } from '../game/customer-cast';
import { REGULAR_GUESTS, type RegularGuestDefinition } from '../game/regular-guests-content';
import { markRegularGuestChapterRead, regularGuestChapterRequirement, regularGuestProgress, regularGuestUnreadCount } from '../game/regular-guests';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { character, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { isComposingKey } from './keyboard';
import { closeModal, showModal } from './modal';
import { regularWishCard } from './regular-wishes';

/** Quiet HUD discovery: a numeric badge, never a toast or automatic pause. */
export function updateRegularGuestsButton(state: GameState): void {
  const button = document.getElementById('regular-guests-btn');
  if (!button) return;
  const label = button.querySelector<HTMLElement>('[data-regular-label]');
  const badge = button.querySelector<HTMLElement>('[data-regular-unread]');
  const unread = regularGuestUnreadCount(state);
  const name = t('regular.ui.button');
  if (label && label.textContent !== name) label.textContent = name;
  if (badge) {
    const count = String(unread);
    if (badge.textContent !== count) badge.textContent = count;
    badge.hidden = unread === 0;
  }
  const description = t('regular.ui.title') + (unread ? ` · ${t('regular.ui.unread', { n: unread })}` : '');
  if (button.getAttribute('aria-label') !== description) button.setAttribute('aria-label', description);
  if (button.title !== description) button.title = description;
}

const portraits = new Map<number, { frame: HTMLCanvasElement; source: string }>();
function portrait(guest: RegularGuestDefinition): HTMLImageElement {
  const design = CUSTOMER_CAST[guest.appearanceId];
  const frame = character(design.look, 'customer', guest.appearanceId).stand;
  let cached = portraits.get(guest.appearanceId);
  if (!cached || cached.frame !== frame) {
    const art = fineSpriteArt(frame);
    cached = { frame, source: toDataURL(art.canvas, 3 / art.density) };
    portraits.set(guest.appearanceId, cached);
  }
  const source = cached.source;
  const image = document.createElement('img');
  image.className = 'regular-portrait';
  image.src = source;
  image.alt = ''; // The adjacent heading already names this guest.
  image.width = 48;
  image.height = 78;
  return image;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, content: string, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = content;
  node.className = className;
  return node;
}

/** One shared modal stays mounted across every page, keeping simulation and focus paused. */
export function showRegularGuests(state: GameState, saveRead: () => void): void {
  const root = document.createElement('div');
  root.className = 'regular-journal';

  function button(label: string, action: () => void, primary = false): HTMLButtonElement {
    const node = text('button', label, `pixel-btn${primary ? '' : ' ghost'}`);
    node.type = 'button';
    node.addEventListener('click', () => {
      // Detached buttons cannot change progress or revive a dismissed/replaced page.
      if (root.isConnected && node.isConnected && root.contains(node)) action();
    });
    return node;
  }

  function page(...nodes: Node[]): void {
    root.replaceChildren(...nodes);
    const scroll = root.closest<HTMLElement>('.modal-body');
    if (scroll) {
      scroll.scrollTop = 0;
      const heading = root.querySelector<HTMLElement>('h3');
      if (heading) { heading.tabIndex = -1; heading.focus(); }
      else scroll.focus();
    }
  }

  function profile(guest: RegularGuestDefinition, full = true): HTMLElement {
    const progress = regularGuestProgress(state, guest.id)!;
    const card = document.createElement('section');
    card.className = 'regular-profile';
    card.dataset.regularGuest = guest.id;
    const identity = document.createElement('div');
    identity.className = 'regular-identity';
    identity.append(text('h3', t(guest.nameKey)), text('p', t(guest.roleKey), 'regular-role'));
    const heading = document.createElement('div');
    heading.className = 'regular-heading';
    heading.append(portrait(guest), identity);
    card.append(heading);
    if (full) {
      card.append(
        text('p', t(guest.personalityKey)),
        text('p', t('regular.ui.preference', { drink: t(`item.${guest.preferredDrink}`) }), 'regular-preference'),
        text('p', `${t('regular.ui.served', { n: progress.served })} · ${t('regular.ui.progress', { n: progress.unlockedChapters.length, total: guest.chapters.length })}`, 'note'),
      );
      if (guest.id === 'mina') {
        const wish = regularWishCard(state, saveRead);
        if (wish) card.append(wish);
      }
    }
    return card;
  }

  function showList(): void {
    const met = REGULAR_GUESTS.filter(guest => regularGuestProgress(state, guest.id));
    const intro = document.createElement('div');
    intro.className = 'regular-intro';
    intro.append(text('h3', t('regular.ui.met', { n: met.length, total: REGULAR_GUESTS.length })), text('p', t('regular.ui.quiet'), 'note'));
    const cards = document.createElement('div');
    cards.className = 'regular-cards';
    for (const guest of met) {
      const card = profile(guest);
      const unread = regularGuestUnreadCount(state, guest.id);
      const view = button(t('regular.ui.stories') + (unread ? ` · ${t('regular.ui.unread', { n: unread })}` : ''), () => showChapters(guest));
      view.dataset.regularOpen = guest.id;
      view.setAttribute('aria-label', `${t(guest.nameKey)} · ${view.textContent}`);
      card.append(view);
      cards.append(card);
    }
    if (!met.length) cards.append(text('p', t('regular.ui.empty'), 'regular-empty'));
    const unknown = REGULAR_GUESTS.length - met.length;
    // Unknown identities, portraits, roles and chapter titles never enter the DOM.
    if (unknown) cards.append(text('p', t('regular.ui.unknown', { n: unknown }), 'regular-unknown'));
    page(intro, cards);
  }

  function showChapters(guest: RegularGuestDefinition): void {
    const progress = regularGuestProgress(state, guest.id);
    if (!progress) { showList(); return; }
    const back = button(t('regular.ui.back'), showList);
    back.dataset.regularBack = '';
    const card = profile(guest);
    const chapters = document.createElement('ol');
    chapters.className = 'regular-chapters';
    for (const index of progress.unlockedChapters) {
      const chapter = guest.chapters[index];
      if (!chapter) continue;
      const item = document.createElement('li');
      const entry = button('', () => showChapter(guest, index));
      entry.dataset.regularChapter = String(index);
      entry.className += ' regular-chapter-choice';
      entry.append(
        text('span', t('regular.ui.chapter', { n: index + 1, total: guest.chapters.length }), 'note'),
        text('strong', t(chapter.titleKey)),
        text('span', t(progress.readChapters.includes(index) ? 'regular.ui.read' : 'regular.ui.new'), progress.readChapters.includes(index) ? 'regular-read' : 'regular-new'),
      );
      item.append(entry);
      chapters.append(item);
    }
    const notes = document.createElement('div');
    if (!progress.unlockedChapters.length) notes.append(text('p', t('regular.ui.noStories'), 'note'));
    const nextRequirement = regularGuestChapterRequirement(guest.id, progress.unlockedChapters.length);
    if (nextRequirement) {
      notes.append(text('p', t('regular.ui.nextRequirement', nextRequirement), 'regular-next-requirement'));
      notes.append(text('p', t('regular.ui.dailyLimit'), 'note'));
    }
    page(back, card, chapters, notes);
  }

  function showChapter(guest: RegularGuestDefinition, index: number): void {
    const progress = regularGuestProgress(state, guest.id);
    const chapter = guest.chapters[index];
    if (!progress?.unlockedChapters.includes(index) || !chapter) { showChapters(guest); return; }
    const read = progress.readChapters.includes(index);
    const back = button(t('regular.ui.chapters'), () => showChapters(guest));
    const story = document.createElement('article');
    story.className = 'regular-story';
    story.dataset.regularReading = String(index);
    story.append(text('p', `${t('regular.ui.chapter', { n: index + 1, total: guest.chapters.length })} · ${t(read ? 'regular.ui.read' : 'regular.ui.new')}`, 'note'));
    const heading = text('h3', t(chapter.titleKey));
    story.append(heading);
    for (const paragraph of t(chapter.textKey).split(/\n+/).filter(Boolean)) story.append(text('p', paragraph));
    const actions = document.createElement('div');
    actions.className = 'regular-reading-actions';
    const finished = button(t(read ? 'regular.ui.chapters' : 'regular.ui.finish'), () => {
      if (markRegularGuestChapterRead(state, guest.id, index)) {
        saveRead();
        updateRegularGuestsButton(state);
      }
      showChapters(guest);
    }, true);
    finished.dataset.regularFinish = '';
    actions.append(finished);
    if (!read) {
      const later = button(t('regular.ui.later'), () => showChapters(guest));
      later.dataset.regularLater = '';
      actions.append(later);
    }
    const navigation = document.createElement('nav');
    navigation.className = 'regular-page-nav';
    navigation.setAttribute('aria-label', t('regular.ui.stories'));
    const unlocked = progress.unlockedChapters.filter(i => guest.chapters[i]).slice().sort((a, b) => a - b);
    const position = unlocked.indexOf(index);
    const previous = button(t('regular.ui.previous'), () => showChapter(guest, unlocked[position - 1]));
    previous.disabled = position <= 0;
    previous.dataset.regularPrevious = '';
    const next = button(t('regular.ui.next'), () => showChapter(guest, unlocked[position + 1]));
    next.disabled = position >= unlocked.length - 1;
    next.dataset.regularNext = '';
    navigation.append(previous, next);
    page(back, profile(guest, false), story, actions, navigation, text('p', t('regular.ui.readHint'), 'note regular-read-hint'));
    // Focus the chapter rather than repeating the guest's name on each page turn.
    heading.tabIndex = -1;
    heading.focus();
  }

  showList();
  showModal({ title: t('regular.ui.title'), body: root, focusableBody: true, buttons: [{ label: t('regular.ui.close') }] });
  const dialog = root.closest<HTMLElement>('[role="dialog"]')!;
  dialog.classList.add('regular-journal-modal');
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || isComposingKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    closeModal();
  });
}
