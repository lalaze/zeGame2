import './chain-ui.css';
import {
  COMPLETE_BONUS, PERKS, PERK_AWAY_SHARE, PERK_BUILD_SHARE, PERK_CATERING_SHARE, PERK_GIFT_SHARE, PERK_TILL_HOURS, PLACE_BONUS,
  buyPerk, franchisesIn, perkBlock, placeStrength, starsFree, type PerkId,
} from '../game/chain-bonuses';
import { CHAIN_STAR_BONUS } from '../game/data';
import { GIFT_INTERVAL_MS } from '../game/cat-gifts';
import { LOCATION_IDS, type LocationId } from '../game/locations';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { showModal, toast } from './modal';

const ART = `${import.meta.env.BASE_URL}art/generated/cozy-idle-v1/`;
/** The little storefront that stands for a place on the map and in the chain card. */
export const shopImage = (place: LocationId) => `${ART}shop-${place}.gif`;
export const perkImage = (id: PerkId) => `${ART}perk-${id}.gif`;

const pct = (share: number) => Math.round(share * 100);
const hours = (h: number) => Math.round(h * 10) / 10;

/** What a place's franchises add, at the strength `count` franchises there give (one by default). */
export function placeBonusText(place: LocationId, count = 1): string {
  const bonus = PLACE_BONUS[place], strength = placeStrength(Math.max(1, count));
  if (bonus.kind === 'till') return t('place.bonus.town', { hours: hours(bonus.hours * strength) });
  return t(`place.bonus.${place}` as MessageKey, { pct: pct(bonus.share * strength) });
}

/** The five places in the chain card: storefront, franchises there and what they add. */
export function chainPlaces(state: GameState): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'chain-places';
  for (const place of LOCATION_IDS) {
    const count = franchisesIn(state, place);
    const li = document.createElement('li');
    li.className = count ? 'owned' : '';
    li.dataset.place = place;
    li.innerHTML = `<img alt="" src="${shopImage(place)}" /><span class="chain-place-name"></span><span class="chain-place-bonus"></span>`;
    li.querySelector('.chain-place-name')!.textContent = count ? `${t(`location.${place}.name` as MessageKey)} ×${count}` : t(`location.${place}.name` as MessageKey);
    li.querySelector('.chain-place-bonus')!.textContent = placeBonusText(place, count);
    list.append(li);
  }
  return list;
}

export const completeBonusPercent = () => pct(COMPLETE_BONUS);

function perkEffect(id: PerkId): string {
  switch (id) {
    case 'till': return t('perk.till.desc', { hours: PERK_TILL_HOURS });
    case 'cats': return t('perk.cats.desc', { hours: hours(GIFT_INTERVAL_MS * PERK_GIFT_SHARE / 3_600_000) });
    case 'kitchen': return t('perk.kitchen.desc');
    case 'builders': return t('perk.builders.desc', { pct: pct(1 - PERK_BUILD_SHARE) });
    case 'catering': return t('perk.catering.desc', { pct: pct(PERK_CATERING_SHARE - 1) });
    case 'manager': return t('perk.manager.desc', { pct: pct(PERK_AWAY_SHARE - 1) });
  }
}

/**
 * Chain perks: free stars raise prices, spent ones buy a convenience for good. Spending
 * takes a second tap on the same button, since stars never come back.
 */
export function showChainPerks(state: GameState, changed: () => void): void {
  const body = document.createElement('div');
  body.className = 'chain-perks-body';
  const intro = document.createElement('p');
  intro.className = 'note';
  const list = document.createElement('ul');
  list.className = 'chain-perk-list';
  let arming: PerkId | null = null;
  const rows = new Map<PerkId, { li: HTMLLIElement; button: HTMLButtonElement }>();
  for (const perk of PERKS) {
    const li = document.createElement('li');
    li.dataset.perk = perk.id;
    li.innerHTML = `<img alt="" src="${perkImage(perk.id)}" /><div><h4></h4><p class="note"></p></div><button type="button" class="pixel-btn small"></button>`;
    li.querySelector('h4')!.textContent = t(`perk.${perk.id}.name` as MessageKey);
    li.querySelector('p')!.textContent = perkEffect(perk.id);
    const button = li.querySelector('button')!;
    button.addEventListener('click', () => {
      if (perkBlock(state, perk.id)) return;
      if (arming !== perk.id) { arming = perk.id; update(); return; }
      arming = null;
      if (!buyPerk(state, perk.id)) return;
      toast(t('perk.bought', { name: t(`perk.${perk.id}.name` as MessageKey) }));
      changed();
      update();
    });
    rows.set(perk.id, { li, button });
    list.append(li);
  }
  body.append(intro, list);

  function update(): void {
    intro.textContent = t('perk.intro', { stars: state.chain.stars, free: starsFree(state), pct: pct(CHAIN_STAR_BONUS) });
    for (const perk of PERKS) {
      const { li, button } = rows.get(perk.id)!, block = perkBlock(state, perk.id);
      li.classList.toggle('owned', block === 'owned');
      button.disabled = block !== null;
      button.textContent = block === 'owned' ? t('perk.owned')
        : arming === perk.id ? t('perk.confirm', { n: perk.cost }) : t('perk.buy', { n: perk.cost });
      button.title = block === 'stars' ? t('perk.short') : '';
    }
  }
  update();
  showModal({ title: t('perk.title'), body, buttons: [{ label: t('map.back') }] });
  body.closest('.modal')?.classList.add('chain-perks-modal');
}
