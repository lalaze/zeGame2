import { CATS, CAT_GROUPS, CARE_SECONDS, MAX_CARE_SECONDS, MAX_PETS, adoptCat, petActive, petTraffic, refillPet, type CatGroup, type CatId } from '../game/pets';
import { formatAccountMoney, formatMoney } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { catFrames, toDataURL } from '../render/sprites';

export class PetPanel {
  private summary: HTMLElement;
  private rows;
  private mode: 'catalog' | 'owned' = 'catalog';
  private group: CatGroup | 'all' = 'all';
  private selected: CatId;
  private tiles;
  private filters: HTMLElement;
  private grid: HTMLElement;
  private empty: HTMLElement;
  private tabs: HTMLButtonElement[];

  constructor(root: HTMLElement, private state: GameState, onChange: (id: string) => void) {
    this.selected = CATS.find((cat) => !state.pets.some((pet) => pet.id === cat.id))?.id ?? CATS[0].id;
    const intro = document.createElement('div');
    intro.className = 'pet-intro';
    intro.innerHTML = `<h3>${t('pet.title')}</h3><p class="note">${t('pet.intro', { count: CATS.length, max: MAX_PETS })}</p><p class="pet-summary" role="status"></p><details class="note"><summary>${t('pet.careHelp')}</summary><p>${t('pet.accounting')}</p></details>`;
    root.append(intro);
    this.summary = intro.querySelector('.pet-summary')!;
    const nav = document.createElement('div');
    nav.className = 'pet-tabs';
    this.tabs = (['catalog', 'owned'] as const).map((mode) => {
      const btn = document.createElement('button');
      btn.className = 'chip'; btn.textContent = t(`pet.${mode}`); btn.dataset.petView = mode;
      btn.addEventListener('click', () => { this.mode = mode; this.update(); });
      nav.append(btn); return btn;
    });
    root.append(nav);
    this.filters = document.createElement('div'); this.filters.className = 'pet-filters';
    for (const group of ['all', ...CAT_GROUPS] as const) {
      const btn = document.createElement('button');
      btn.className = 'chip'; btn.textContent = t(`pet.group.${group}`); btn.dataset.petGroup = group;
      btn.addEventListener('click', () => {
        this.group = group;
        if (group !== 'all' && CATS.find((cat) => cat.id === this.selected)!.group !== group) this.selected = CATS.find((cat) => cat.group === group)!.id;
        this.update();
      });
      this.filters.append(btn);
    }
    root.append(this.filters);
    this.grid = document.createElement('div'); this.grid.className = 'pet-catalog';
    this.grid.setAttribute('aria-label', t('pet.catalog'));
    this.tiles = CATS.map((cat) => {
      const btn = document.createElement('button'); btn.className = 'pet-choice'; btn.dataset.chooseCat = cat.id;
      btn.innerHTML = `<img src="${toDataURL(catFrames(cat.id).idle, 4)}" alt="" /><b>${t(`pet.${cat.id}.name`)}</b><span>${formatMoney(cat.adoption)} · +${Math.round(cat.traffic * 100)}%</span><small></small>`;
      btn.addEventListener('click', () => {
        this.selected = cat.id; this.update();
        this.rows.find((row) => row.cat.id === cat.id)!.el.scrollIntoView({ block: 'nearest' });
      });
      this.grid.append(btn); return { cat, btn, badge: btn.querySelector('small')! };
    });
    root.append(this.grid);
    this.empty = document.createElement('p'); this.empty.className = 'note'; this.empty.textContent = t('pet.empty'); root.append(this.empty);
    this.rows = CATS.map((cat) => {
      const el = document.createElement('section');
      el.className = 'pet-card';
      el.dataset.pet = cat.id;
      el.innerHTML = `<div class="pet-heading"><img src="${toDataURL(catFrames(cat.id).idle, 4)}" alt="" /><div><h3>${t(`pet.${cat.id}.name`)}</h3><p class="note">${t(`pet.${cat.id}.desc`)}</p></div><span class="pet-bonus">+${Math.round(cat.traffic * 100)}%</span></div>
        <p class="note">${t('pet.cost', { cost: formatMoney(cat.careCost), min: CARE_SECONDS / 60 })}</p>
        <p class="pet-status"></p><progress max="${MAX_CARE_SECONDS}" value="0" aria-label="${t('pet.supplies')}"></progress>
        <div class="pet-actions"><button class="pixel-btn small" data-adopt>${t('pet.adopt', { cost: formatMoney(cat.adoption) })}</button><button class="pixel-btn small ghost" data-refill>${t('pet.refill', { cost: formatMoney(cat.careCost) })}</button></div>
        <label class="pet-auto"><input type="checkbox" /> ${t('pet.auto')}</label>`;
      root.append(el);
      const adopt = el.querySelector<HTMLButtonElement>('[data-adopt]')!;
      const refill = el.querySelector<HTMLButtonElement>('[data-refill]')!;
      const auto = el.querySelector<HTMLInputElement>('input')!;
      adopt.addEventListener('click', () => { if (adoptCat(state, cat.id)) onChange(cat.id); });
      refill.addEventListener('click', () => { if (refillPet(state, cat.id)) onChange(cat.id); });
      auto.addEventListener('change', () => {
        const pet = state.pets.find((pet) => pet.id === cat.id);
        if (pet) { pet.autoRefill = auto.checked; onChange(cat.id); }
      });
      return { cat, el, adopt, refill, auto, status: el.querySelector<HTMLElement>('.pet-status')!, progress: el.querySelector('progress')! };
    });
    this.update();
  }

  update(): void {
    const s = this.state;
    this.summary.textContent = t('pet.summary', { n: s.pets.length, max: MAX_PETS, pct: Math.round((petTraffic(s) - 1) * 100), cost: formatAccountMoney(s.today.petCost) });
    this.grid.hidden = this.filters.hidden = this.mode !== 'catalog';
    this.empty.hidden = this.mode !== 'owned' || s.pets.length > 0;
    for (const btn of this.tabs) btn.setAttribute('aria-pressed', String(btn.dataset.petView === this.mode));
    for (const btn of this.filters.querySelectorAll('button')) btn.setAttribute('aria-pressed', String(btn.dataset.petGroup === this.group));
    for (const tile of this.tiles) {
      tile.btn.hidden = this.group !== 'all' && tile.cat.group !== this.group;
      tile.btn.setAttribute('aria-pressed', String(tile.cat.id === this.selected));
      tile.badge.textContent = s.pets.some((pet) => pet.id === tile.cat.id) ? t('pet.adopted') : t('pet.choose');
    }
    for (const r of this.rows) {
      const pet = s.pets.find((pet) => pet.id === r.cat.id);
      r.el.hidden = this.mode === 'owned' ? !pet : r.cat.id !== this.selected;
      r.adopt.hidden = !!pet;
      r.adopt.disabled = s.pets.length >= MAX_PETS || s.phase !== 'prep' || s.coins < r.cat.adoption;
      r.refill.hidden = !pet;
      r.auto.parentElement!.hidden = !pet;
      r.progress.hidden = !pet;
      r.el.classList.toggle('adopted', !!pet);
      if (!pet) {
        r.status.textContent = t(s.pets.length >= MAX_PETS ? 'pet.full' : s.phase !== 'prep' ? 'pet.closedOnly' : s.coins < r.cat.adoption ? 'pet.unaffordable' : 'pet.included', { max: MAX_PETS });
        continue;
      }
      const seconds = Math.ceil(pet.careSeconds);
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      r.status.textContent = petActive(pet) ? t('pet.ready', { time }) : t('pet.resting');
      r.progress.value = pet.careSeconds;
      r.auto.checked = pet.autoRefill;
      r.refill.disabled = s.coins < r.cat.careCost || pet.careSeconds + CARE_SECONDS > MAX_CARE_SECONDS + 1e-8;
    }
  }
}
