import { CATS, CAT_GROUPS, CARE_SECONDS, MAX_CARE_SECONDS, MAX_PETS, adoptCat, petActive, petTraffic, refillPet, type CatGroup, type CatId } from '../game/pets';
import { formatAccountMoney, formatTransactionMoney as formatMoney } from '../game/format';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { catFrames, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { getGeneratedCatAdapter } from '../render/generated-main-art';
import { livingCatActivity, livingCatPersonality, livingCatPreference, type LivingCatControls } from './living-cats';

/** Transient browsing choices, owned by Panel rather than the game save. */
export interface PetBrowsingState {
  mode: 'catalog' | 'owned';
  group: CatGroup | 'all';
  selected: CatId;
}

export function createPetBrowsingState(state: GameState): PetBrowsingState {
  return {
    mode: 'catalog',
    group: 'all',
    selected: CATS.find((cat) => !state.pets.some((pet) => pet.id === cat.id))?.id ?? CATS[0].id,
  };
}

export class PetPanel {
  private summary: HTMLElement;
  private rows;
  private tiles;
  private filters: HTMLElement;
  private grid: HTMLElement;
  private empty: HTMLElement;
  private tabs: HTMLButtonElement[];
  private portraitUrls = new WeakMap<HTMLCanvasElement, { scale: number; url: string }>();

  constructor(
    root: HTMLElement,
    private state: GameState,
    onChange: (id: string) => void,
    private living: LivingCatControls = {},
    private browsing: PetBrowsingState = createPetBrowsingState(state),
  ) {
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
      btn.addEventListener('click', () => { this.browsing.mode = mode; this.update(); });
      nav.append(btn); return btn;
    });
    root.append(nav);
    this.filters = document.createElement('div'); this.filters.className = 'pet-filters';
    for (const group of ['all', ...CAT_GROUPS] as const) {
      const btn = document.createElement('button');
      btn.className = 'chip'; btn.textContent = t(`pet.group.${group}`); btn.dataset.petGroup = group;
      btn.addEventListener('click', () => {
        this.browsing.group = group;
        this.update();
      });
      this.filters.append(btn);
    }
    root.append(this.filters);
    this.grid = document.createElement('div'); this.grid.className = 'pet-catalog';
    this.grid.setAttribute('aria-label', t('pet.catalog'));
    this.tiles = CATS.map((cat) => {
      const btn = document.createElement('button'); btn.className = 'pet-choice'; btn.dataset.chooseCat = cat.id;
      btn.innerHTML = `<img alt="" /><b>${t(`pet.${cat.id}.name`)}</b><span>${formatMoney(cat.adoption)} · +${Math.round(cat.traffic * 100)}%</span><small></small>`;
      btn.addEventListener('click', () => {
        this.browsing.selected = cat.id; this.update();
        this.rows.find((row) => row.cat.id === cat.id)!.el.scrollIntoView({ block: 'nearest' });
      });
      this.grid.append(btn); return { cat, btn, frames: catFrames(cat.id), portrait: btn.querySelector('img')!, badge: btn.querySelector('small')! };
    });
    root.append(this.grid);
    this.empty = document.createElement('p'); this.empty.className = 'note'; this.empty.textContent = t('pet.empty'); root.append(this.empty);
    this.rows = CATS.map((cat) => {
      const el = document.createElement('section');
      el.className = 'pet-card';
      el.dataset.pet = cat.id;
      el.innerHTML = `<div class="pet-heading"><img alt="" /><div><h3>${t(`pet.${cat.id}.name`)}</h3><p class="note">${t(`pet.${cat.id}.desc`)}</p></div><span class="pet-bonus">+${Math.round(cat.traffic * 100)}%</span></div>
        <p class="note">${t('pet.cost', { cost: formatMoney(cat.careCost), min: CARE_SECONDS / 60 })}</p>
        <p class="pet-status"></p><progress max="${MAX_CARE_SECONDS}" value="0" aria-label="${t('pet.supplies')}"></progress>
        <div class="pet-actions"><button class="pixel-btn small" data-adopt>${t('pet.adopt', { cost: formatMoney(cat.adoption) })}</button><button class="pixel-btn small ghost" data-refill>${t('pet.refill', { cost: formatMoney(cat.careCost) })}</button></div>
        <label class="pet-auto"><input type="checkbox" /> ${t('pet.auto')}</label>`;
      const life = document.createElement('div');
      life.className = 'pet-living';
      const personality = document.createElement('p'); personality.className = 'note';
      const preference = document.createElement('p'); preference.className = 'note';
      const activity = document.createElement('p'); activity.className = 'pet-living-activity';
      const actions = document.createElement('div'); actions.className = 'pet-actions';
      const locate = document.createElement('button');
      locate.className = 'pixel-btn small ghost'; locate.dataset.locateCat = cat.id;
      locate.textContent = t('pet.living.locate');
      const interact = document.createElement('button');
      interact.className = 'pixel-btn small'; interact.dataset.petCat = cat.id;
      interact.textContent = t('pet.living.pet'); interact.title = t('pet.living.petHint');
      for (const button of [locate, interact]) { button.style.minHeight = '44px'; button.style.minWidth = '44px'; }
      locate.addEventListener('click', () => this.living.locate?.(cat.id));
      interact.addEventListener('click', () => { this.living.interact?.(cat.id); this.update(); });
      actions.append(locate, interact);
      life.append(personality, preference, activity, actions);
      el.append(life);
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
      return { cat, el, portrait: el.querySelector('img')!, adopt, refill, auto, life, personality, preference, activity, locate, interact, status: el.querySelector<HTMLElement>('.pet-status')!, progress: el.querySelector('progress')! };
    });
    this.update();
  }

  private updatePortraits(): void {
    const adapter = getGeneratedCatAdapter();
    this.tiles.forEach((tile, index) => {
      const resolved = adapter?.ready ? adapter.resolve(tile.cat.id, tile.frames) : { frames: tile.frames, generated: false };
      // Keep legacy portraits exact, but export generated pixels from their
      // detailed backing rather than upscaling the low-resolution logical frame.
      const art = resolved.generated ? fineSpriteArt(resolved.frames.idle) : { canvas: resolved.frames.idle, density: 1 };
      const scale = Math.max(1, 4 / art.density);
      let cached = this.portraitUrls.get(art.canvas);
      if (!cached || cached.scale !== scale) {
        cached = { scale, url: toDataURL(art.canvas, scale) };
        this.portraitUrls.set(art.canvas, cached);
      }
      // Readiness can change after construction or a Scene reload. Only a new
      // backing needs encoding; both views reuse its URL on ordinary updates.
      for (const portrait of [tile.portrait, this.rows[index].portrait]) {
        if (portrait.src !== cached.url) portrait.src = cached.url;
      }
    });
  }

  update(): void {
    this.updatePortraits();
    const s = this.state;
    // A catalog change or stale selection must never leave the detail pane empty.
    // Adoption does not invalidate a catalog entry: keep showing that cat's care.
    if (this.browsing.mode !== 'catalog' && this.browsing.mode !== 'owned') this.browsing.mode = 'catalog';
    if (this.browsing.group !== 'all' && !CAT_GROUPS.includes(this.browsing.group)) this.browsing.group = 'all';
    const candidates = CATS.filter((cat) => this.browsing.group === 'all' || cat.group === this.browsing.group);
    if (!candidates.some((cat) => cat.id === this.browsing.selected)) this.browsing.selected = candidates[0].id;
    const { mode, group, selected } = this.browsing;
    this.summary.textContent = t('pet.summary', { n: s.pets.length, max: MAX_PETS, pct: Math.round((petTraffic(s) - 1) * 100), cost: formatAccountMoney(s.today.petCost) });
    this.grid.hidden = this.filters.hidden = mode !== 'catalog';
    this.empty.hidden = mode !== 'owned' || s.pets.length > 0;
    for (const btn of this.tabs) btn.setAttribute('aria-pressed', String(btn.dataset.petView === mode));
    for (const btn of this.filters.querySelectorAll('button')) btn.setAttribute('aria-pressed', String(btn.dataset.petGroup === group));
    for (const tile of this.tiles) {
      tile.btn.hidden = group !== 'all' && tile.cat.group !== group;
      tile.btn.setAttribute('aria-pressed', String(tile.cat.id === selected));
      tile.badge.textContent = s.pets.some((pet) => pet.id === tile.cat.id) ? t('pet.adopted') : t('pet.choose');
    }
    for (const r of this.rows) {
      const pet = s.pets.find((pet) => pet.id === r.cat.id);
      r.el.hidden = mode === 'owned' ? !pet : r.cat.id !== selected;
      r.adopt.hidden = !!pet;
      r.adopt.disabled = s.pets.length >= MAX_PETS || s.phase !== 'prep' || s.coins < r.cat.adoption;
      r.refill.hidden = !pet;
      r.auto.parentElement!.hidden = !pet;
      r.progress.hidden = !pet;
      r.el.classList.toggle('adopted', !!pet);
      r.life.hidden = !pet;
      r.el.querySelector('h3')!.textContent = `${pet ? `${s.pets.indexOf(pet) + 1}. ` : ''}${t(`pet.${r.cat.id}.name`)}`;
      if (!pet) {
        r.status.textContent = t(s.pets.length >= MAX_PETS ? 'pet.full' : s.phase !== 'prep' ? 'pet.closedOnly' : s.coins < r.cat.adoption ? 'pet.unaffordable' : 'pet.included', { max: MAX_PETS });
        continue;
      }
      const actor = this.living.getActor?.(pet.id);
      r.personality.textContent = livingCatPersonality(pet);
      r.preference.textContent = livingCatPreference(pet);
      r.activity.textContent = livingCatActivity(actor);
      r.locate.disabled = !this.living.locate || !actor;
      r.interact.disabled = !this.living.interact || !actor || !petActive(pet);
      r.interact.title = t(petActive(pet) ? 'pet.living.petHint' : 'pet.living.needsCare');
      const seconds = Math.ceil(pet.careSeconds);
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      r.status.textContent = petActive(pet) ? t('pet.ready', { time }) : t('pet.resting');
      r.progress.value = pet.careSeconds;
      r.auto.checked = pet.autoRefill;
      r.refill.disabled = s.coins < r.cat.careCost || pet.careSeconds + CARE_SECONDS > MAX_CARE_SECONDS + 1e-8;
    }
  }
}
