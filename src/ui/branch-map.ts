import './branch-map.css';
import { LOCATIONS, SPECIALTY_PRICE_BONUS, cafeLocation, locationDef, type LocationId } from '../game/locations';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { paintBranchMap } from '../render/branch-map-art';
import { paintLocationPreview } from '../render/location-scenery';
import { itemArtwork, toDataURL } from '../render/sprites';
import { displayItemName } from './item-name';
import { showModal } from './modal';

export const locationName = (id: LocationId) => t(`location.${id}.name` as MessageKey);

/**
 * The branch map: pick where the next café opens. Each place previews the view from
 * its windows and lists its local specialties before `pick` is called.
 */
export function showBranchMap(state: GameState, pick: (location: LocationId) => void): void {
  const here = cafeLocation(state);
  let selected: LocationId = LOCATIONS.find((l) => l.id !== here)!.id;
  const body = document.createElement('div');
  body.className = 'branch-map-body';

  const map = document.createElement('div');
  map.className = 'branch-map';
  const canvas = document.createElement('canvas');
  canvas.className = 'branch-map-art';
  canvas.setAttribute('aria-hidden', 'true');
  paintBranchMap(canvas);
  map.append(canvas);
  const pins = new Map<LocationId, HTMLButtonElement>();
  for (const location of LOCATIONS) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'branch-pin';
    pin.dataset.location = location.id;
    pin.style.left = `${location.pin[0] * 100}%`;
    pin.style.top = `${location.pin[1] * 100}%`;
    pin.textContent = location.id === here ? `${locationName(location.id)} · ${t('map.current')}` : locationName(location.id);
    pin.addEventListener('click', () => { selected = location.id; update(); });
    pins.set(location.id, pin);
    map.append(pin);
  }

  const hint = document.createElement('p');
  hint.className = 'note';
  hint.textContent = t('map.hint');

  const detail = document.createElement('section');
  detail.className = 'branch-detail';
  detail.setAttribute('aria-live', 'polite');
  const preview = document.createElement('canvas');
  preview.className = 'branch-preview';
  preview.width = 92;
  preview.height = 76;
  preview.setAttribute('aria-hidden', 'true');
  const info = document.createElement('div');
  info.className = 'branch-info';
  const title = document.createElement('h3');
  const desc = document.createElement('p');
  const specialtyNote = document.createElement('p');
  specialtyNote.className = 'note';
  const list = document.createElement('ul');
  list.className = 'branch-specialties';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'pixel-btn';
  open.dataset.openHere = '';
  open.textContent = t('map.open');
  open.addEventListener('click', () => pick(selected));
  info.append(title, desc, specialtyNote, list, open);
  detail.append(preview, info);
  body.append(map, hint, detail);

  function update(): void {
    const def = locationDef(selected);
    for (const [id, pin] of pins) {
      pin.classList.toggle('selected', id === selected);
      pin.setAttribute('aria-pressed', String(id === selected));
    }
    paintLocationPreview(preview, selected);
    title.textContent = locationName(selected);
    desc.textContent = t(`location.${selected}.desc` as MessageKey);
    specialtyNote.textContent = def.specialties.length
      ? t('map.specialties', { pct: Math.round(SPECIALTY_PRICE_BONUS * 100) })
      : t('map.noSpecialties');
    list.replaceChildren(...def.specialties.map((id) => {
      const li = document.createElement('li');
      const icon = document.createElement('img');
      icon.alt = '';
      icon.src = toDataURL(itemArtwork(id), 1);
      li.append(icon, displayItemName(id, state));
      return li;
    }));
  }
  update();

  showModal({ title: t('map.title'), body, buttons: [{ label: t('map.back') }] });
  body.closest('.modal')?.classList.add('branch-map-modal');
}
