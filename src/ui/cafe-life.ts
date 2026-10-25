import './menu-story-polish.css';
import type { DayReport } from '../game/day';
import { partnerDefinition, readPartnerChapter } from '../game/partners';
import { PARTNER_STORIES } from '../game/partner-stories';
import { regularGuestDefinition, regularGuestProgress, markRegularGuestChapterRead } from '../game/regular-guests';
import type { GameState } from '../game/state';
import { getLocale, t } from '../i18n';
import { showModal } from './modal';
import { minaWish } from '../game/regular-wishes';
import { regularWishCard } from './regular-wishes';
import { regularGuestPortrait } from './regular-guests';

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string) => {
  const el = document.createElement(tag); el.textContent = text; return el;
};

/** The same read/dismiss actions become one short invitation on a phone. */
function compactInvitation(hear: HTMLButtonElement, later: HTMLButtonElement, label: string, detail: string): void {
  hear.classList.add('life-read'); later.classList.add('life-later');
  const full = node('span', hear.textContent ?? ''); full.className = 'life-full-label';
  const compact = node('span', label); compact.className = 'life-compact-label';
  hear.replaceChildren(full, compact); hear.setAttribute('aria-label', `${label} · ${detail}`);
  const laterFull = node('span', later.textContent ?? ''); laterFull.className = 'life-full-label';
  const dismiss = node('span', '×'); dismiss.className = 'life-compact-label'; dismiss.setAttribute('aria-hidden', 'true');
  later.setAttribute('aria-label', later.textContent ?? ''); later.replaceChildren(laterFull, dismiss);
}

/** One optional unlocked conversation per day. It never pauses service by itself. */
export class CafeLife {
  readonly element = document.createElement('section');
  private offered = new Set<string>();
  private day = '';
  private dismissed = true;
  constructor(private save: () => void) {
    this.element.className = 'cafe-life'; this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
  }
  update(state: GameState, visitors: readonly { regularGuestId?: string; phase: string }[], visible: boolean): void {
    const day = `${state.createdAt}:${state.day}`;
    if (this.day && this.day !== day) { this.dismissed = true; this.element.replaceChildren(); }
    this.day = day;
    const wish = minaWish(state);
    const wishEvent = wish?.completedDay === state.day ? 'map' : wish?.rehearsedDay === state.day ? 'rehearsed' : null;
    const wishKey = `${day}:mina:${wishEvent}`;
    if (visible && state.phase === 'open' && wishEvent && !this.offered.has(wishKey)
        && visitors.some(visitor => visitor.regularGuestId === 'mina')) {
      const heading = node('b', t(`wish.mina.notice.${wishEvent}`));
      const preview = node('p', t(wishEvent === 'map' ? 'wish.mina.map.title' : 'wish.mina.return'));
      const hear = node('button', t('wish.mina.notice.read')); hear.className = 'chip';
      const later = node('button', t('life.later')); later.className = 'chip';
      compactInvitation(hear, later, heading.textContent!, preview.textContent!);
      const dismiss = () => { this.dismissed = true; this.element.hidden = true; };
      hear.addEventListener('click', () => {
        if (!hear.isConnected) return;
        dismiss();
        const body = regularWishCard(state, this.save);
        if (body) showModal({ title: t('wish.mina.title'), body, buttons: [{ label: t('regular.ui.close') }] });
      });
      later.addEventListener('click', dismiss);
      this.element.replaceChildren(heading, preview, hear, later);
      this.offered.add(wishKey); this.offered.add(day); this.dismissed = false;
    }
    if (visible && state.phase === 'open' && !this.offered.has(day)) {
      let story: { guest: NonNullable<ReturnType<typeof regularGuestDefinition>>; chapter: number } | undefined;
      for (const visitor of visitors) {
        const guest = visitor.regularGuestId && regularGuestDefinition(visitor.regularGuestId);
        if (!guest) continue;
        const progress = regularGuestProgress(state, guest.id);
        const chapter = progress?.unlockedChapters.find(i => !progress.readChapters.includes(i));
        if (chapter !== undefined) { story = { guest, chapter }; break; }
      }
      // Takeaway guests start exiting in the handoff tick that unlocks their story;
      // they remain eligible while they are still among the café's visitors.
      if (story) {
        const { guest, chapter } = story;
        const title = t('life.arrival', { name: t(guest.nameKey) });
        const heading = node('b', title), preview = node('p', t('life.preview', { title: t(guest.chapters[chapter].titleKey) }));
        const hear = node('button', t('life.read')); hear.className = 'chip';
        const later = node('button', t('life.later')); later.className = 'chip';
        compactInvitation(hear, later, t('mobile.story', { name: t(guest.nameKey) }), preview.textContent!);
        const dismiss = () => { this.dismissed = true; this.element.hidden = true; };
        later.addEventListener('click', dismiss);
        hear.addEventListener('click', () => {
          if (!hear.isConnected || !regularGuestProgress(state, guest.id)?.unlockedChapters.includes(chapter)) return;
          dismiss();
          const body = document.createElement('article');
          body.className = 'life-story';
          body.dataset.lifeRegularStory = guest.id;
          const identity = document.createElement('header'); identity.className = 'life-story-heading';
          const chapterHeading = document.createElement('div');
          chapterHeading.append(node('p', t('regular.ui.chapter', { n: chapter + 1, total: guest.chapters.length })), node('h3', t(guest.chapters[chapter].titleKey)));
          identity.append(regularGuestPortrait(guest), chapterHeading);
          body.append(identity);
          for (const paragraph of t(guest.chapters[chapter].textKey).split(/\n+/).filter(Boolean)) body.append(node('p', paragraph));
          showModal({ title, body, focusableBody: true, buttons: [
            { label: t('regular.ui.finish'), primary: true, onClick: () => {
              if (markRegularGuestChapterRead(state, guest.id, chapter)) this.save();
            } }, { label: t('life.later') },
          ] });
        });
        this.element.replaceChildren(heading, preview, hear, later);
        this.offered.add(day); this.dismissed = false;
      }
    }
    this.element.hidden = !visible || this.dismissed || state.phase !== 'open';
  }
}

/** A worked partner shares an unread chapter directly in the evening report. */
export function closingStory(state: GameState, report: DayReport, save: () => void): HTMLElement | null {
  for (const contribution of report.partners ?? []) {
    const progress = state.partners.roster[contribution.id];
    const partner = partnerDefinition(contribution.id);
    if (!progress || !partner || contribution.jobs <= 0) continue;
    const index = Array.from({ length: progress.unlocked }, (_, i) => i).find(i => !progress.read.includes(i));
    if (index === undefined) continue;
    const details = document.createElement('details'); details.className = 'closing-story';
    const title = node('summary', t('life.closing', { name: partner.name[getLocale()] }));
    const story = node('p', PARTNER_STORIES[partner.id].chapters[index][getLocale()]);
    const finished = node('button', t('regular.ui.finish')); finished.className = 'pixel-btn small';
    finished.addEventListener('click', () => {
      if (!finished.isConnected || !readPartnerChapter(state, partner.id, index)) return;
      save(); finished.disabled = true; finished.textContent = t('regular.ui.read');
    });
    details.append(title, story, finished); return details;
  }
  return null;
}
