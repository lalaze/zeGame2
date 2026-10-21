import { formatMoney, formatNumber } from '../game/format';
import { GOALS } from '../game/goals';
import {
  CHAPTERS, OPEN_AFTER, cafeTitleChapter, chapterClaimed, chapterDone, claimChapter, claimableChapter, milestoneDone, milestonesStarted,
  openChapters, type ChapterDef, type ChapterReward, type MilestoneDef,
} from '../game/milestones';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { showModal, toast } from './modal';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
export const chapterTitle = (chapter: ChapterDef) => t(`milestone.chapter.${chapter.id}` as MessageKey);
export const milestoneName = (id: string) => t(`milestone.${id}` as MessageKey);
const finishName = (chapter: ChapterDef) => t(`decor.${chapter.finish}` as MessageKey);
const value = (m: MilestoneDef, n: number) => m.decimal ? n.toFixed(1) : formatNumber(n);
function progress(s: GameState, m: MilestoneDef) {
  const [current, target] = m.progress(s);
  const done = milestoneDone(s, m.id);
  // A milestone held back by its extra condition (too few reviews) says so, rather than looking done.
  const waiting = !done && current >= target && !(m.ready?.(s) ?? true);
  return { done, current, target, share: done ? 1 : Math.max(0, Math.min(waiting ? 0.99 : 1, current / target)),
    text: `${value(m, Math.min(current, target))} / ${value(m, target)}${waiting ? ` · ${t('milestone.needsReviews', { n: 50 })}` : ''}` };
}

/** The café's title, for the header and settings. Empty before the first chapter. */
export function cafeTitle(s: GameState): string {
  const chapter = cafeTitleChapter(s);
  return chapter ? chapterTitle(chapter) : '';
}

/**
 * The goal card once the guided goals are done: a ready chapter to claim, otherwise the
 * open chapter's closest milestone. Returns a signature to skip identical repaints.
 */
export function milestoneCard(s: GameState): { html: string; done: boolean; sig: string } {
  const book = `<button type="button" class="chip milestone-book-btn" data-milestone-book>${escape(t('milestone.card.book'))}</button>`;
  const ready = claimableChapter(s);
  if (ready !== null) {
    const chapter = CHAPTERS[ready];
    return { done: true, sig: `ready:${ready}`, html: `
      <div class="goal-head">${escape(t('milestone.card.chapter', { n: ready + 1, total: CHAPTERS.length, title: chapterTitle(chapter) }))}</div>
      <div class="goal-text">${escape(t('milestone.card.ready'))}</div>
      <div class="goal-actions">
        <button type="button" class="pixel-btn small claim" data-claim-chapter>${escape(t('milestone.card.claim', { title: chapterTitle(chapter), finish: finishName(chapter) }))}</button>
        ${book}
      </div>` };
  }
  // The unfinished milestone closest to done across the open chapters; ties keep the listed order.
  const rows = CHAPTERS.slice(0, openChapters(s)).flatMap((chapter, index) => chapter.milestones.map((m) => ({ m, index, ...progress(s, m) })));
  const next = rows.filter((r) => !r.done).sort((a, b) => b.share - a.share)[0];
  if (!next) {
    const title = cafeTitle(s);
    return { done: false, sig: `finished:${title}`, html: `
      <div class="goal-head">${escape(title)}</div>
      <div class="goal-main"><div class="goal-text">${escape(t('milestone.card.finished'))}</div>${book}</div>` };
  }
  const index = next.index, chapter = CHAPTERS[index];
  const count = chapter.milestones.filter((m) => milestoneDone(s, m.id)).length;
  return { done: false, sig: `open:${index}:${count}:${next.m.id}:${next.text}`, html: `
    <div class="goal-head">${escape(t('milestone.card.chapter', { n: index + 1, total: CHAPTERS.length, title: chapterTitle(chapter) }))}</div>
    <div class="goal-main"><div class="goal-text">${escape(milestoneName(next.m.id))}</div>${book}</div>
    <div class="bar"><i style="width:${next.share * 100}%"></i></div>
    <div class="goal-progress">${escape(next.text)} · ${escape(t('milestone.card.progress', { n: count, total: chapter.milestones.length }))}</div>` };
}

/** Claims the ready chapter and says what the café got. */
export function claimChapterWithToast(s: GameState): ChapterReward | null {
  const reward = claimChapter(s);
  if (!reward) return null;
  const title = chapterTitle(reward.chapter), finish = finishName(reward.chapter);
  toast(reward.coins > 0
    ? t('milestone.toast.claimedCoins', { title, finish, money: formatMoney(reward.coins) })
    : t('milestone.toast.claimed', { title, finish }));
  return reward;
}

/** The milestone book: every opened chapter, the next one's name, and titles earned. */
export function showMilestoneBook(s: GameState): void {
  const open = openChapters(s);
  const titles = CHAPTERS.filter((_, i) => chapterClaimed(s, i)).map(chapterTitle);
  const chapters = CHAPTERS.map((chapter, i) => {
    const heading = `<h3>${escape(t('milestone.card.chapter', { n: i + 1, total: CHAPTERS.length, title: chapterTitle(chapter) }))}</h3>`;
    if (i >= open) {
      // The next chapter's name is a promise; its milestones stay a surprise.
      return i === open
        ? `<section class="milestone-chapter locked">${heading}<p class="note">${escape(milestonesStarted(s) ? t('milestone.book.locked', { n: i, k: OPEN_AFTER }) : t('milestone.book.notStarted', { n: GOALS.length }))}</p></section>`
        : '';
    }
    const status = chapterClaimed(s, i) ? t('milestone.book.claimed') : chapterDone(s, i) ? t('milestone.book.ready') : '';
    const rows = chapter.milestones.map((m) => {
      const p = progress(s, m);
      return `<li class="${p.done ? 'done' : ''}"><span class="milestone-mark" aria-hidden="true">${p.done ? '✓' : '·'}</span>
        <span class="milestone-name">${escape(milestoneName(m.id))}</span>
        <span class="milestone-progress">${escape(p.done ? t('milestone.book.done') : p.text)}</span>
        ${p.done ? '' : `<span class="bar" aria-hidden="true"><i style="width:${p.share * 100}%"></i></span>`}</li>`;
    }).join('');
    return `<section class="milestone-chapter${chapterDone(s, i) ? ' done' : ''}">${heading}
      ${status ? `<p class="milestone-status">${escape(status)}</p>` : ''}
      <ul class="milestone-list">${rows}</ul>
      <p class="note">${escape(t('milestone.book.reward', { title: chapterTitle(chapter), finish: finishName(chapter) }))}</p></section>`;
  }).join('');
  const body = document.createElement('div');
  body.className = 'milestone-book';
  body.innerHTML = `<p>${escape(t('milestone.book.intro'))}</p>
    <p class="note milestone-titles">${escape(titles.length ? t('milestone.book.titles', { titles: titles.join(t('list.sep')) }) : t('milestone.book.noTitles'))}</p>
    ${chapters}`;
  showModal({ title: t('milestone.book.title'), body, focusableBody: true, buttons: [{ label: t('milestone.book.close'), primary: true }] });
}
