import { CUSTOMER_CAST } from '../game/customer-cast';
import { menuItems, readyServings } from '../game/economy';
import type { GuestMemory } from '../game/guest-memories';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { character, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { displayItemName } from './item-name';

const text = <K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') => {
  const el = document.createElement(tag); el.textContent = value; el.className = className; return el;
};
const entries = (s: GameState) => Object.entries(s.guestMemories).map(([id, memory]) => [Number(id), memory!] as const)
  .sort((a, b) => b[1].learnedDay - a[1].learnedDay || a[0] - b[0]);
const name = (s: GameState, m: GuestMemory) => m.item.startsWith('sig:') && !s.signatureDrinks.recipes.some(r => r.id === m.item)
  ? m.name || displayItemName(m.item, s) : displayItemName(m.item, s);

/** Familiar faces become visible here only after an actual loved drink was delivered. */
export function guestMemoryNotes(s: GameState, day?: number): HTMLElement | null {
  const memories = entries(s).filter(([, m]) => day === undefined || m.lastServedDay === day);
  if (!memories.length) return null;
  const root = document.createElement('details'); root.className = 'guest-memories';
  root.append(text('summary', t(day === undefined ? 'memory.journalTitle' : 'memory.reportTitle', { n: memories.length })));
  root.append(text('p', t('memory.journalNote'), 'note'));
  for (const [id, memory] of memories) {
    const card = document.createElement('article'); card.className = 'guest-memory'; card.dataset.memoryGuest = String(id);
    const cast = CUSTOMER_CAST[id], frame = character(cast.look, 'customer', id).stand, art = fineSpriteArt(frame);
    const portrait = document.createElement('img'); portrait.src = toDataURL(art.canvas, 3 / art.density); portrait.alt = '';
    portrait.width = 48; portrait.height = 78;
    const body = document.createElement('div');
    body.append(text('h4', name(s, memory)), text('p', t(`memory.learned.${memory.source}`, { day: memory.learnedDay }), 'note'));
    if (memory.returns) body.append(text('p', t('memory.returned', { n: memory.returns }), 'note'));
    const available = menuItems(s).some(item => item.id === memory.item) && readyServings(s, memory.item) > 0;
    body.append(text('p', t(available ? 'memory.available' : 'memory.unavailable'), 'note'));
    card.append(portrait, body); root.append(card);
  }
  return root;
}

export function guestMemoryReport(s: GameState, day: number): HTMLElement | null {
  const today = entries(s).filter(([, m]) => m.lastServedDay === day);
  if (!today.length) return null;
  const learned = today.filter(([, m]) => m.learnedDay === day).length;
  const returning = today.filter(([, m]) => m.learnedDay < day && m.returns > 0).length;
  const root = document.createElement('section'); root.className = 'memory-report';
  root.append(text('h3', t('memory.reportHeading')));
  if (learned) root.append(text('p', t('memory.reportLearned', { n: learned })));
  if (returning) root.append(text('p', t('memory.reportReturned', { n: returning })));
  root.append(guestMemoryNotes(s, day)!);
  return root;
}
