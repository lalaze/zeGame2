/// <reference types="node" />
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from '../game/state';
import { REGULAR_GUESTS } from '../game/regular-guests-content';
import { recordRegularGuestArrival, recordRegularGuestService, regularGuestProgress, regularGuestUnreadCount } from '../game/regular-guests';
import { messagesFor, setLocale, t } from '../i18n';
import { closeModal, isModalOpen, showModal } from './modal';
import { showRegularGuests, updateRegularGuestsButton } from './regular-guests';

vi.mock('../render/sprites', () => ({
  character: (_look: unknown, _role: unknown, appearanceId: number) => ({ stand: appearanceId }),
  toDataURL: (appearanceId: number) => `data:image/png;base64,portrait-${appearanceId}`,
}));

const styles = readFileSync('src/style.css', 'utf8');
const guest = REGULAR_GUESTS[0];
const select = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const click = (selector: string) => select<HTMLButtonElement>(selector).click();
const press = (key: string, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  document.activeElement!.dispatchEvent(event);
  return event;
};
function unlock(state: GameState, count: number, target = guest): void {
  state.phase = 'open';
  for (let index = 0; index < count; index++) {
    state.day = target.debutDay + index * 2;
    const visit = recordRegularGuestArrival(state, target.id)!;
    recordRegularGuestService(state, target.id, visit);
  }
}
function openChapter(state: GameState, save = vi.fn(), index = 0): void {
  showRegularGuests(state, save);
  click(`[data-regular-open="${guest.id}"]`);
  click(`[data-regular-chapter="${index}"]`);
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '<main><button id="regular-guests-btn" aria-haspopup="dialog"><span data-regular-label></span><span data-regular-unread aria-hidden="true" hidden></span></button></main><div id="modal-root"></div>';
  select('#regular-guests-btn').focus();
});
afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('regular journal discovery and privacy', () => {
  it('reveals only an unknown total until a real encounter, without mutating the save', () => {
    const state = createInitialState(0);
    const before = JSON.stringify(state);
    const save = vi.fn();
    showRegularGuests(state, save);
    expect(select('.regular-journal').textContent).toContain(t('regular.ui.met', { n: 0, total: REGULAR_GUESTS.length }));
    expect(select('.regular-unknown').textContent).toBe(t('regular.ui.unknown', { n: REGULAR_GUESTS.length }));
    expect(document.querySelector('[data-regular-guest]')).toBeNull();
    expect(document.querySelector('.regular-portrait')).toBeNull();
    for (const unknown of REGULAR_GUESTS) {
      const html = select('.regular-journal').innerHTML;
      expect(html).not.toContain(t(unknown.nameKey));
      expect(html).not.toContain(t(unknown.roleKey));
      for (const chapter of unknown.chapters) expect(html).not.toContain(t(chapter.titleKey));
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('shows an encountered profile and fixed portrait before service, but no chapter titles', () => {
    const state = createInitialState(0);
    state.phase = 'open'; state.day = guest.debutDay;
    recordRegularGuestArrival(state, guest.id);
    showRegularGuests(state, vi.fn());
    const card = select(`[data-regular-guest="${guest.id}"]`);
    expect(card.textContent).toContain(t(guest.nameKey));
    expect(card.textContent).toContain(t(guest.roleKey));
    expect(card.textContent).toContain(t(guest.personalityKey));
    expect(card.textContent).toContain(t('regular.ui.preference', { drink: t(`item.${guest.preferredDrink}`) }));
    expect(card.textContent).toContain(t('regular.ui.served', { n: 0 }));
    expect(select<HTMLImageElement>('.regular-portrait').src).toBe(`data:image/png;base64,portrait-${guest.appearanceId}`);
    expect(select<HTMLImageElement>('.regular-portrait').alt).toBe('');
    click(`[data-regular-open="${guest.id}"]`);
    expect(document.querySelectorAll('[data-regular-chapter]')).toHaveLength(0);
    for (const chapter of guest.chapters) expect(select('.regular-journal').textContent).not.toContain(t(chapter.titleKey));
    expect(select('.regular-journal').textContent).toContain(t('regular.ui.noStories'));
    expect(select('.regular-next-requirement').textContent).toBe(t('regular.ui.nextRequirement', { day: guest.debutDay, served: 1 }));
  });

  it('lists only unlocked titles and never exposes other guests in attributes or text', () => {
    const state = createInitialState(0); unlock(state, 1);
    showRegularGuests(state, vi.fn());
    for (const unknown of REGULAR_GUESTS.slice(1)) {
      expect(select('.regular-journal').innerHTML).not.toContain(t(unknown.nameKey));
      expect(document.querySelector(`[data-regular-guest="${unknown.id}"]`)).toBeNull();
    }
    click(`[data-regular-open="${guest.id}"]`);
    expect(document.querySelectorAll('[data-regular-chapter]')).toHaveLength(1);
    expect(select('.regular-next-requirement').textContent).toBe(t('regular.ui.nextRequirement', { day: guest.debutDay + 2, served: 2 }));
    expect(select('[data-regular-chapter="0"]').textContent).toContain(t(guest.chapters[0].titleKey));
    for (const locked of guest.chapters.slice(1)) expect(select('.regular-journal').innerHTML).not.toContain(t(locked.titleKey));
  });
});

describe('intentional reads and uninterrupted paging', () => {
  it('keeps the same paused modal for chapter navigation and later, without marking read', () => {
    const state = createInitialState(0); unlock(state, 3);
    const before = JSON.stringify(state);
    const save = vi.fn();
    openChapter(state, save);
    const overlay = select('.modal-overlay');
    expect(select<HTMLButtonElement>('[data-regular-previous]').disabled).toBe(true);
    click('[data-regular-next]');
    expect(select('[data-regular-reading]').dataset.regularReading).toBe('1');
    expect(select('.modal-overlay')).toBe(overlay); expect(isModalOpen()).toBe(true);
    click('[data-regular-next]');
    expect(select<HTMLButtonElement>('[data-regular-next]').disabled).toBe(true);
    click('[data-regular-previous]'); click('[data-regular-later]');
    expect(document.querySelector('[data-regular-reading]')).toBeNull();
    expect(select('.modal-overlay')).toBe(overlay); expect(isModalOpen()).toBe(true);
    expect(JSON.stringify(state)).toBe(before); expect(save).not.toHaveBeenCalled();
    expect(regularGuestUnreadCount(state)).toBe(3);
  });

  it('saves one explicit read, updates the badge and makes rereads idempotent', () => {
    const state = createInitialState(0); unlock(state, 3);
    const save = vi.fn(); const progress = regularGuestProgress(state, guest.id)!;
    const before = structuredClone(state);
    updateRegularGuestsButton(state); expect(select('[data-regular-unread]').textContent).toBe('3');
    openChapter(state, save, 1);
    const finish = select<HTMLButtonElement>('[data-regular-finish]');
    finish.click(); finish.click(); // The old detached button cannot double-apply a read.
    expect(progress.readChapters).toEqual([1]); expect(save).toHaveBeenCalledOnce();
    expect(select('[data-regular-unread]').textContent).toBe('2');
    before.regularGuests.guests[guest.id]!.readChapters = [1];
    expect(state).toEqual(before);
    click('[data-regular-chapter="1"]');
    expect(document.querySelector('[data-regular-later]')).toBeNull();
    expect(select('[data-regular-finish]').textContent).toBe(t('regular.ui.chapters'));
    click('[data-regular-finish]');
    expect(save).toHaveBeenCalledOnce(); expect(state).toEqual(before);
    expect(progress.unlockedChapters).toEqual([0, 1, 2]);
  });

  it('ignores read and navigation controls from a dismissed or replaced dialog', () => {
    const state = createInitialState(0); unlock(state, 2);
    const save = vi.fn(); openChapter(state, save);
    const finish = select<HTMLButtonElement>('[data-regular-finish]');
    const next = select<HTMLButtonElement>('[data-regular-next]');
    showModal({ title: 'Other task', body: 'Unrelated', buttons: [{ label: 'Close' }] });
    finish.click(); next.click();
    expect(select('[role="dialog"]').textContent).toContain('Other task');
    expect(regularGuestUnreadCount(state)).toBe(2); expect(save).not.toHaveBeenCalled();
  });
});

describe('journal keyboard and quiet HUD', () => {
  it('traps focus after page changes and restores the opener on Escape without marking read', () => {
    const state = createInitialState(0); unlock(state, 2);
    const save = vi.fn(); const opener = document.activeElement;
    openChapter(state, save);
    expect(document.activeElement?.textContent).toBe(t(guest.chapters[0].titleKey));
    expect(select('main').inert).toBe(true);
    expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(select('.modal-actions button'));
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(select('.modal-body'));
    expect(press('Escape', { isComposing: true }).defaultPrevented).toBe(false);
    expect(isModalOpen()).toBe(true);
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(isModalOpen()).toBe(false); expect(select('main').inert).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(regularGuestUnreadCount(state)).toBe(2); expect(save).not.toHaveBeenCalled();
  });

  it('leaves Enter and Space to native buttons and closes by its persistent close action', () => {
    const state = createInitialState(0); unlock(state, 1); const save = vi.fn();
    openChapter(state, save);
    select('[data-regular-later]').focus();
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(press(' ').defaultPrevented).toBe(false);
    click('.modal-actions button');
    expect(isModalOpen()).toBe(false); expect(document.activeElement?.id).toBe('regular-guests-btn');
    expect(save).not.toHaveBeenCalled();
  });

  it('updates translated numeric badges without opening a modal or live-announcing every tick', () => {
    const state = createInitialState(0);
    updateRegularGuestsButton(state); expect(select('[data-regular-unread]').hidden).toBe(true);
    unlock(state, 2); updateRegularGuestsButton(state);
    expect(isModalOpen()).toBe(false);
    expect(select('[data-regular-unread]').hidden).toBe(false);
    expect(select('#regular-guests-btn').getAttribute('aria-label')).toContain(t('regular.ui.unread', { n: 2 }));
    const html = select('main').innerHTML; updateRegularGuestsButton(state); expect(select('main').innerHTML).toBe(html);
    expect(document.querySelector('[aria-live], [role="alert"]')).toBeNull();
    setLocale('zh'); updateRegularGuestsButton(state);
    expect(select('[data-regular-label]').textContent).toBe('熟客');
    expect(select('#regular-guests-btn').getAttribute('aria-label')).toContain('2 段新故事');
  });
});

describe('bilingual and long journal construction', () => {
  it.each(['en', 'zh'] as const)('renders all seen profiles and stories in %s with no missing text', locale => {
    const state = createInitialState(0);
    for (const regular of REGULAR_GUESTS) unlock(state, 5, regular);
    setLocale(locale); showRegularGuests(state, vi.fn());
    expect(document.querySelectorAll('[data-regular-guest]')).toHaveLength(REGULAR_GUESTS.length);
    expect(document.querySelector('.regular-unknown')).toBeNull();
    expect(select('.regular-journal').textContent).not.toMatch(/undefined|regular\.(ui|guest)\.|\{\w+\}/);
    for (const regular of REGULAR_GUESTS) {
      click(`[data-regular-open="${regular.id}"]`);
      expect(document.querySelectorAll('[data-regular-chapter]')).toHaveLength(5);
      expect(document.querySelector('.regular-next-requirement')).toBeNull();
      for (let index = 0; index < 5; index++) {
        click(`[data-regular-chapter="${index}"]`);
        expect(select('.regular-story').textContent).toContain(t(regular.chapters[index].textKey).split('\n')[0]);
        expect(select('.regular-journal').textContent).not.toMatch(/undefined|regular\.(ui|guest)\.|\{\w+\}/);
        click('[data-regular-later]');
      }
      click('[data-regular-back]');
    }
    expect(regularGuestUnreadCount(state)).toBe(REGULAR_GUESTS.length * 5);
  });

  it('keeps long text in a keyboard-scrollable body with an independent close row and wrap-safe CSS', () => {
    const state = createInitialState(0); unlock(state, 1);
    const messages = messagesFor('en'); const key = guest.chapters[0].textKey; const original = messages[key];
    const longLine = `A${'verylongword'.repeat(80)} <img src=x onerror=alert(1)>`;
    try {
      messages[key] = Array.from({ length: 120 }, () => longLine).join('\n');
      openChapter(state);
      const dialog = select('.regular-journal-modal'); const body = select('.modal-body');
      expect(body.tabIndex).toBe(0); expect(body.getAttribute('role')).toBe('region');
      expect(body.parentElement).toBe(dialog);
      expect(select('.modal-actions').parentElement).toBe(dialog);
      expect(select('.regular-story').querySelectorAll('p')).toHaveLength(121);
      expect(select('.regular-story').querySelector('img')).toBeNull();
      expect(select('.regular-story').textContent).toContain(longLine);
      expect(styles).toContain('.modal-body { min-height: 0; overflow-y: auto;');
      expect(styles).toContain('.regular-journal { overflow-wrap: anywhere; }');
      expect(styles).toContain('.regular-journal-modal { width: min(580px, 100%); }');
      expect(styles).toContain('max-height: calc(var(--usable-viewport-height, 100dvh) - 48px)');
      expect(styles).toContain('.regular-journal-modal .modal-actions .pixel-btn { min-height: 44px;');
      expect(isModalOpen()).toBe(true);
      click('.modal-actions button'); expect(isModalOpen()).toBe(false);
    } finally { messages[key] = original; }
  });
});
