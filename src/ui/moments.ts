import type { ItemId } from '../game/data';
import { guestTaste, itemFlavors } from '../game/flavors';
import type { Customer } from '../game/sim';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { displayItemName } from './item-name';
import { closeModal, isModalOpen, showModal } from './modal';

/**
 * A guest in line asks what to order. They say what they're in the mood for, and
 * each dish shows its flavor notes, so the choice is quick and fair. Service waits
 * while the dialog is open, like every other dialog.
 */
export function showRecommendation(state: GameState, guest: Customer, options: readonly ItemId[],
  pick: (item: ItemId) => void, skip: () => void): void {
  const { liked, avoided } = guestTaste(guest);
  const body = document.createElement('div');
  body.className = 'moment-recommend';
  const quote = document.createElement('p');
  quote.className = 'moment-quote';
  quote.textContent = t('moment.recommend.ask', {
    want: t(`moment.want.${liked}` as MessageKey), avoid: t(`moment.avoid.${avoided}` as MessageKey),
  });
  const list = document.createElement('div');
  list.className = 'moment-options';
  for (const id of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-btn ghost moment-option';
    const name = document.createElement('span');
    name.className = 'moment-option-name';
    name.textContent = displayItemName(id, state);
    const notes = document.createElement('span');
    notes.className = 'moment-option-notes';
    notes.textContent = itemFlavors(id).map((flavor) => t(`moment.flavor.${flavor}` as MessageKey)).join(' · ');
    button.append(name, notes);
    button.addEventListener('click', () => {
      if (!isModalOpen() || !button.isConnected) return;
      closeModal();
      pick(id);
    });
    list.append(button);
  }
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = t('moment.recommend.note');
  body.append(quote, list, note);
  showModal({ title: t('moment.recommend.title'), body, buttons: [{ label: t('moment.recommend.skip'), onClick: skip }] });
}
