import { t } from '../i18n';
import type { Customer } from '../game/sim';
import { character, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { closeModal, isModalOpen, showModal, toast } from './modal';
import './service-help.css';

export interface ServiceHelpOption {
  title: string;
  detail: string;
  guest?: Customer;
  perform: () => boolean;
}

/** One useful action is immediate; only genuine choices interrupt the room. */
export function requestServiceHelp(options: readonly ServiceHelpOption[], allowed: () => boolean): boolean {
  if (!allowed()) return false;
  const perform = (option: ServiceHelpOption) => {
    if (!allowed()) return false;
    if (option.perform()) return true;
    toast(t('flow.helpUnavailable'));
    return false;
  };
  if (options.length === 0) {
    toast(t('flow.helpEmpty'));
    return false;
  }
  if (options.length === 1) return perform(options[0]);

  const body = document.createElement('div');
  body.className = 'service-help-menu';
  const detail = document.createElement('p');
  detail.className = 'note'; detail.textContent = t('flow.helpDetail');
  body.append(detail);
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pixel-btn ghost service-help-option';
    const heading = document.createElement('strong'); heading.textContent = option.title;
    const copy = document.createElement('span'); copy.textContent = option.detail;
    const text = document.createElement('span'); text.className = 'service-help-copy'; text.append(heading, copy);
    if (option.guest) {
      const frames = character(option.guest.look, 'customer', option.guest.appearanceId);
      const art = fineSpriteArt(frames.stand);
      const portrait = document.createElement('img');
      portrait.src = toDataURL(art.canvas, 2 / art.density);
      portrait.alt = ''; portrait.className = 'service-help-portrait';
      portrait.width = 32; portrait.height = 52;
      button.append(portrait);
    }
    button.append(text);
    button.addEventListener('click', () => {
      if (!button.isConnected || !isModalOpen()) return;
      closeModal();
      perform(option);
    });
    body.append(button);
  }
  showModal({ title: t('flow.helpTitle'), body, buttons: [{ label: t('flow.helpCancel') }] });
  return true;
}
