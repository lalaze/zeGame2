import { GIFT_KINDS, giftKindsFound } from '../game/cat-gifts';
import { CATS, CAT_GROUPS, CARE_SECONDS, MAX_CARE_SECONDS, MAX_PETS, adoptCat, petActive, petTraffic, refillPet, type CatGroup, type CatId } from '../game/pets';
import { formatAccountMoney, formatNumber, formatTransactionMoney as formatMoney } from '../game/format';
import { SECONDS_PER_BUSINESS_HOUR } from '../game/business-clock';
import type { GameState } from '../game/state';
import { t } from '../i18n';
import { catFrames, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { getGeneratedCatAdapter } from '../render/generated-main-art';
import { catPortrait } from './cat-art';
import { livingCatActivity, livingCatPersonality, livingCatPreference, type LivingCatControls } from './living-cats';

/** Transient browsing choices, owned by Panel rather than the game save. */
export interface PetBrowsingState {
  group: CatGroup | 'all';
  expanded: Record<string, boolean>;
}

export function createPetBrowsingState(_state?: GameState): PetBrowsingState {
  return { group: 'all', expanded: {} };
}

export class PetPanel {
  private summaryCount: HTMLElement;
  private summaryStats: HTMLElement;
  /** The cats' treasure box: gift kinds found so far (game/cat-gifts). */
  private treasure: HTMLElement;
  private paws: { btn: HTMLButtonElement; img: HTMLImageElement; empty: HTMLElement }[];
  private rows;
  private filters: HTMLElement;
  private grid: HTMLElement;
  private portraitUrls = new WeakMap<HTMLCanvasElement, { scale: number; url: string }>();
  private catUrls = new Map<CatId, string>();

  constructor(
    root: HTMLElement,
    private state: GameState,
    onChange: (id: string) => void,
    private living: LivingCatControls = {},
    private browsing: PetBrowsingState = createPetBrowsingState(state),
  ) {
    // Top peach summary card: 3 circular slots + adopted/traffic/care stats + treasure box.
    const summary = document.createElement('section');
    summary.className = 'catsum';
    const top = document.createElement('div');
    top.className = 'catsum-top';
    const pawsEl = document.createElement('div');
    pawsEl.className = 'paws';
    this.paws = [];
    for (let i = 0; i < MAX_PETS; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paw f';
      btn.hidden = true;
      const img = document.createElement('img');
      img.alt = '';
      btn.append(img);
      btn.addEventListener('click', () => {
        const catId = btn.dataset.jumpCat as CatId | undefined;
        if (!catId) return;
        const cat = CATS.find((c) => c.id === catId);
        if (!cat) return;
        if (this.browsing.group !== 'all' && cat.group !== this.browsing.group) this.browsing.group = 'all';
        this.browsing.expanded[catId] = true;
        this.update();
        this.rows.find((row) => row.cat.id === catId)?.el.scrollIntoView({ block: 'nearest' });
      });
      const empty = document.createElement('span');
      empty.className = 'paw';
      empty.setAttribute('aria-hidden', 'true');
      pawsEl.append(btn, empty);
      this.paws.push({ btn, img, empty });
    }
    const info = document.createElement('div');
    info.className = 'catsum-info';
    this.summaryCount = document.createElement('div');
    this.summaryCount.className = 'catsum-count';
    this.summaryCount.setAttribute('role', 'status');
    this.summaryStats = document.createElement('div');
    this.summaryStats.className = 'catsum-stats';
    info.append(this.summaryCount, this.summaryStats);
    top.append(pawsEl, info);
    this.treasure = document.createElement('p');
    this.treasure.className = 'note pet-treasure';
    summary.append(top, this.treasure);
    root.append(summary);

    // Care & accounting help fold (also holds the former heading and intro copy).
    const help = document.createElement('details');
    help.className = 'pantry-help pet-help';
    help.innerHTML = `<summary>${t('pet.careHelp')}</summary><div class="note"><h4>${t('pet.title')}</h4><p>${t('pet.intro', { count: CATS.length, max: MAX_PETS })}</p><p>${t('pet.accounting')}</p></div>`;
    root.append(help);

    // Breed filter chips.
    this.filters = document.createElement('div');
    this.filters.className = 'pet-filters';
    for (const group of ['all', ...CAT_GROUPS] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = group === 'all' ? `${t('pet.group.all')} ${CATS.length}` : t(`pet.group.${group}`);
      btn.dataset.petGroup = group;
      btn.addEventListener('click', () => {
        this.browsing.group = group;
        this.update();
      });
      this.filters.append(btn);
    }
    root.append(this.filters);

    // 2-column cat card grid (tap card to expand full-width details).
    this.grid = document.createElement('div');
    this.grid.className = 'card-grid pet-grid';
    this.grid.setAttribute('aria-label', t('pet.catalog'));
    this.rows = CATS.map((cat) => {
      const el = document.createElement('section');
      el.className = 'pet-card';
      el.dataset.pet = cat.id;
      const expanded = !!this.browsing.expanded[cat.id];
      if (expanded) el.classList.add('is-expanded');
      el.innerHTML = `<span class="pet-heart" data-floors-icon="heartfill" aria-hidden="true" hidden></span>
        <details class="card-details"${expanded ? ' open' : ''}>
          <summary class="card-face">
            <div class="pet-win"><img alt="" /></div>
            <h3 class="pet-name">${t(`pet.${cat.id}.name`)}</h3>
            <span class="pet-bonus">${t('pet.cardTraffic', { pct: Math.round(cat.traffic * 100) })}</span>
          </summary>
          <div class="card-more">
            <p class="note">${t(`pet.${cat.id}.desc`)}</p>
            <p class="note">${t('pet.cost', { cost: formatMoney(cat.careCost), hours: CARE_SECONDS / SECONDS_PER_BUSINESS_HOUR })}</p>
            <p class="pet-status"></p>
            <progress max="${MAX_CARE_SECONDS}" value="0" aria-label="${t('pet.supplies')}"></progress>
            <div class="pet-actions"><button class="pixel-btn small ghost" data-refill>${t('pet.refill', { cost: formatMoney(cat.careCost) })}</button></div>
            <label class="pet-auto"><input type="checkbox" /> ${t('pet.auto')}</label>
            <div class="pet-living">
              <p class="note pet-personality"></p>
              <p class="note pet-preference"></p>
              <p class="pet-living-activity"></p>
              <div class="pet-actions">
                <button class="pixel-btn small ghost" data-locate-cat="${cat.id}">${t('pet.living.locate')}</button>
                <button class="pixel-btn small" data-pet-cat="${cat.id}" title="${t('pet.living.petHint')}">${t('pet.living.pet')}</button>
              </div>
            </div>
          </div>
        </details>
        <div class="pet-card-foot">
          <button class="pixel-btn small pet-adopt-btn" data-adopt>${t('pet.adopt', { cost: formatMoney(cat.adoption) })}</button>
          <button class="pixel-btn small ghost pet-home-btn" data-home-locate="${cat.id}">${t('pet.inShop')}</button>
        </div>`;
      const details = el.querySelector<HTMLDetailsElement>('.card-details')!;
      details.addEventListener('toggle', () => {
        if (details.open) this.browsing.expanded[cat.id] = true;
        else delete this.browsing.expanded[cat.id];
        el.classList.toggle('is-expanded', details.open);
      });
      const adopt = el.querySelector<HTMLButtonElement>('[data-adopt]')!;
      const homeLocate = el.querySelector<HTMLButtonElement>('[data-home-locate]')!;
      const refill = el.querySelector<HTMLButtonElement>('[data-refill]')!;
      const auto = el.querySelector<HTMLInputElement>('input')!;
      const locate = el.querySelector<HTMLButtonElement>('[data-locate-cat]')!;
      const interact = el.querySelector<HTMLButtonElement>('[data-pet-cat]')!;
      for (const button of [locate, interact]) { button.style.minHeight = '44px'; button.style.minWidth = '44px'; }
      adopt.addEventListener('click', () => { if (adoptCat(state, cat.id)) onChange(cat.id); });
      homeLocate.addEventListener('click', () => this.living.locate?.(cat.id));
      refill.addEventListener('click', () => { if (refillPet(state, cat.id)) onChange(cat.id); });
      locate.addEventListener('click', () => this.living.locate?.(cat.id));
      interact.addEventListener('click', () => { this.living.interact?.(cat.id); this.update(); });
      auto.addEventListener('change', () => {
        const pet = state.pets.find((pet) => pet.id === cat.id);
        if (pet) { pet.autoRefill = auto.checked; onChange(cat.id); }
      });
      this.grid.append(el);
      return {
        cat, el, frames: catFrames(cat.id), details,
        heart: el.querySelector<HTMLElement>('.pet-heart')!,
        portrait: el.querySelector<HTMLImageElement>('.pet-win img')!,
        adopt, homeLocate, refill, auto,
        life: el.querySelector<HTMLElement>('.pet-living')!,
        personality: el.querySelector<HTMLElement>('.pet-personality')!,
        preference: el.querySelector<HTMLElement>('.pet-preference')!,
        activity: el.querySelector<HTMLElement>('.pet-living-activity')!,
        locate, interact,
        status: el.querySelector<HTMLElement>('.pet-status')!,
        progress: el.querySelector('progress')!,
      };
    });
    root.append(this.grid);
    this.update();
  }

  private updatePortraits(): void {
    const adapter = getGeneratedCatAdapter();
    for (const row of this.rows) {
      // The floors view shows its painted cats (ui/cat-art.ts).
      const painted = catPortrait(row.cat.id);
      let url: string;
      if (painted) {
        url = painted;
      } else {
        const resolved = adapter?.ready ? adapter.resolve(row.cat.id, row.frames) : { frames: row.frames, generated: false };
        // Keep legacy portraits exact, but export generated pixels from their
        // detailed backing rather than upscaling the low-resolution logical frame.
        const art = resolved.generated ? fineSpriteArt(resolved.frames.idle) : { canvas: resolved.frames.idle, density: 1 };
        const scale = Math.max(1, 4 / art.density);
        let cached = this.portraitUrls.get(art.canvas);
        if (!cached || cached.scale !== scale) {
          cached = { scale, url: toDataURL(art.canvas, scale) };
          this.portraitUrls.set(art.canvas, cached);
        }
        url = cached.url;
      }
      this.catUrls.set(row.cat.id, url);
      if (row.portrait.getAttribute('src') !== url) row.portrait.src = url;
    }
  }

  update(): void {
    this.updatePortraits();
    const s = this.state;
    if (this.browsing.group !== 'all' && !CAT_GROUPS.includes(this.browsing.group)) this.browsing.group = 'all';
    if (!this.browsing.expanded || typeof this.browsing.expanded !== 'object') this.browsing.expanded = {};
    const { group } = this.browsing;

    for (let i = 0; i < this.paws.length; i++) {
      const slot = this.paws[i];
      const pet = s.pets[i];
      slot.btn.hidden = !pet;
      slot.empty.hidden = !!pet;
      if (pet) {
        slot.btn.dataset.jumpCat = pet.id;
        slot.btn.setAttribute('aria-label', t(`pet.${pet.id}.name`));
        const url = this.catUrls.get(pet.id) ?? '';
        if (url && slot.img.getAttribute('src') !== url) slot.img.src = url;
      } else {
        delete slot.btn.dataset.jumpCat;
      }
    }
    this.summaryCount.textContent = t('pet.summaryCount', { n: s.pets.length, max: MAX_PETS });
    this.summaryStats.textContent = t('pet.summaryStats', { pct: Math.round((petTraffic(s) - 1) * 100), cost: formatAccountMoney(s.today.petCost) });
    const picked = Object.values(s.catGifts.found).reduce((n, v) => n + (v ?? 0), 0);
    this.treasure.textContent = picked ? t('gift.box', { n: giftKindsFound(s), total: GIFT_KINDS.length, count: picked }) : t('gift.boxHint');
    for (const btn of this.filters.querySelectorAll('button')) {
      const active = btn.dataset.petGroup === group;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('active', active);
    }

    for (const r of this.rows) {
      const pet = s.pets.find((p) => p.id === r.cat.id);
      const foster = !!pet && !!pet.fosterUntilDay;
      const expanded = !!this.browsing.expanded[r.cat.id];
      r.el.hidden = group !== 'all' && r.cat.group !== group;
      if (r.details.open !== expanded) r.details.open = expanded;
      r.el.classList.toggle('is-expanded', expanded);
      r.el.classList.toggle('adopted', !!pet);
      r.heart.hidden = !pet;
      r.adopt.hidden = !!pet && !foster;
      r.adopt.disabled = (s.pets.length >= MAX_PETS && !foster) || s.phase !== 'prep' || s.coins < r.cat.adoption;
      const actor = pet ? this.living.getActor?.(pet.id) : undefined;
      r.homeLocate.hidden = !pet || foster;
      r.homeLocate.disabled = !this.living.locate || !actor;
      r.refill.hidden = !pet || foster;
      r.auto.parentElement!.hidden = !pet || foster;
      r.progress.hidden = !pet;
      r.life.hidden = !pet;
      if (!pet) {
        r.status.textContent = t(s.pets.length >= MAX_PETS ? 'pet.full' : s.phase !== 'prep' ? 'pet.closedOnly' : s.coins < r.cat.adoption ? 'pet.unaffordable' : 'pet.included', { max: MAX_PETS });
        continue;
      }
      r.personality.textContent = livingCatPersonality(pet);
      r.preference.textContent = livingCatPreference(pet);
      r.activity.textContent = livingCatActivity(actor);
      r.locate.disabled = !this.living.locate || !actor;
      r.interact.disabled = !this.living.interact || !actor || !petActive(pet);
      r.interact.title = t(petActive(pet) ? 'pet.living.petHint' : 'pet.living.needsCare');
      const time = formatNumber(Math.ceil(pet.careSeconds / SECONDS_PER_BUSINESS_HOUR * 10) / 10);
      r.status.textContent = foster ? t('pet.foster') : petActive(pet) ? t('pet.ready', { time }) : t('pet.resting');
      r.progress.value = pet.careSeconds;
      r.auto.checked = pet.autoRefill;
      r.refill.disabled = s.coins < r.cat.careCost || pet.careSeconds + CARE_SECONDS > MAX_CARE_SECONDS + 1e-8;
    }
  }
}
