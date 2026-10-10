import {
  BAKE_STEP,
  CATEGORIES,
  MENU,
  PRICE_MILESTONES,
  UPGRADES,
  type Category,
  type IngredientId,
  type ItemId,
  type UpgradeId,
} from '../game/data';
import { DECOR_SLOTS, comfort, decorDef, decorForSlot, ownsDecor, useDecor } from '../game/decor';
import { FURNITURE, buyFurniture, furnitureDef, placedCount, storedCount } from '../game/furniture';
import {
  arrivalRate,
  awayCapSeconds,
  awayEfficiency,
  bakeForForecast,
  baristaCount,
  buyIngredient,
  buyItem,
  buyUpgrade,
  dayNeeds,
  expectedCustomers,
  ingredientDef,
  neededIngredients,
  recipe,
  restock,
  restockQuote,
  serverCount,
  servingsLeft,
  setBakePlan,
  setOnMenu,
  suggestedBake,
  usedBy,
  varietyBonus,
  isBakery,
  isItemAvailable,
  itemPrice,
  menuItems,
  nextMilestone,
  prepMultiplier,
  prepTime,
  quoteItem,
  quoteUpgrade,
  tipMultiplier,
  upgradeDef,
  type BuyAmount,
} from '../game/economy';
import { formatMoney, formatNumber } from '../game/format';
import { GOALS, claimGoal, currentGoal, goalDone } from '../game/goals';
import type { GameState } from '../game/state';
import { mainTableCount } from '../game/regions';
import { t, type MessageKey } from '../i18n';
import { decorIcon } from '../render/decor-art';
import { furnitureIcon } from '../render/furniture-art';
import { ingredientIcon, itemIcon, toDataURL, upgradeIcon } from '../render/sprites';

type Tab = 'menu' | 'pantry' | 'upgrades' | 'decor';
export type PurchaseKind = 'item' | 'upgrade' | 'decor' | 'goal' | 'ingredient' | 'menu';

/** How many units one tap buys in the pantry. */
const PANTRY_AMOUNTS = [10, 50, 200] as const;

interface RowRefs {
  el: HTMLElement;
  level: HTMLElement;
  sub: HTMLElement;
  bar: HTMLElement | null;
  btn: HTMLButtonElement;
  btnLabel: HTMLElement;
  btnCost: HTMLElement;
  toggle: HTMLButtonElement | null;
  recipe: HTMLElement | null;
  bake: HTMLElement | null;
}

interface TileRefs {
  el: HTMLElement;
  btn: HTMLButtonElement;
}

interface FurnitureTileRefs {
  el: HTMLElement;
  buy: HTMLButtonElement;
  place: HTMLButtonElement;
  count: HTMLElement;
}

/** What the Decor tab asks the café to do: start placing a piece, or rearrange what's out. */
export type ArrangeRequest = { kind: 'place'; id: string } | { kind: 'arrange' };

const iconUrls = new Map<string, string>();
function iconUrl(key: string, make: () => HTMLCanvasElement): string {
  let url = iconUrls.get(key);
  if (!url) {
    url = toDataURL(make(), 4);
    iconUrls.set(key, url);
  }
  return url;
}

function upgradeEffect(state: GameState, id: UpgradeId): string {
  switch (id) {
    case 'marketing':
      return t('effect.marketing', { n: (arrivalRate(state) * 60).toFixed(1) });
    case 'machine':
      return t('effect.machine', { n: (1 / prepMultiplier(state)).toFixed(2) });
    case 'barista':
      return t('effect.barista', { n: baristaCount(state) });
    case 'server':
      return t('effect.server', { n: serverCount(state) });
    case 'tables':
      return t('effect.tables', { n: mainTableCount(state) });
    case 'manager':
      return t('effect.manager', {
        pct: Math.round(awayEfficiency(state) * 100),
        hours: awayCapSeconds(state) / 3600,
      });
  }
}

export const itemName = (id: ItemId) => t(`item.${id}` as MessageKey);
export const ingredientName = (id: IngredientId) => t(`ing.${id}` as MessageKey);
const upgradeName = (id: UpgradeId) => t(`upgrade.${id}.name` as MessageKey);
const upgradeDesc = (id: UpgradeId) => t(`upgrade.${id}.desc` as MessageKey);
export const decorName = (id: string) => t(`decor.${id}` as MessageKey);

export class Panel {
  private tab: Tab = 'menu';
  private amount: BuyAmount = 1;
  private pantryAmount: number = PANTRY_AMOUNTS[0];
  private category: Category | 'all' = 'all';
  private varietyNote: HTMLElement | null = null;
  private bakeAllBtn: HTMLButtonElement | null = null;
  private pantryNote: HTMLElement | null = null;
  private restockBtn: HTMLButtonElement | null = null;
  private signature = '';
  private rows = new Map<string, RowRefs>();
  private tiles = new Map<string, TileRefs>();
  private furnitureTiles = new Map<string, FurnitureTileRefs>();
  private slotNotes = new Map<string, HTMLElement>();
  private comfortNote: HTMLElement | null = null;
  private goalSig = '';

  constructor(
    private root: HTMLElement,
    private list: HTMLElement,
    private goalEl: HTMLElement,
    private state: GameState,
    private onPurchase: (kind: PurchaseKind, id: string) => void,
    private onArrange: (request: ArrangeRequest) => void,
  ) {
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.showTab(b.dataset.tab as Tab)),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-amount]').forEach((b) =>
      b.addEventListener('click', () => {
        const v = b.dataset.amount!;
        this.amount = v === 'max' ? 'max' : (Number(v) as 1 | 10);
        root.querySelectorAll('[data-amount]').forEach((o) => o.classList.toggle('active', o === b));
        this.update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-pantry-amount]').forEach((b) =>
      b.addEventListener('click', () => {
        this.pantryAmount = Number(b.dataset.pantryAmount);
        root.querySelectorAll('[data-pantry-amount]').forEach((o) => o.classList.toggle('active', o === b));
        this.update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => {
        this.category = b.dataset.cat as Category | 'all';
        root.querySelectorAll('[data-cat]').forEach((o) => o.classList.toggle('active', o === b));
        this.list.scrollTop = 0;
        this.update();
      }),
    );
    list.addEventListener('click', (e) => this.onListClick(e));
    goalEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button[data-claim]')) return;
      const reward = claimGoal(this.state);
      if (reward > 0) {
        this.onPurchase('goal', String(reward));
        this.update();
      }
    });
  }

  showTab(tab: Tab): void {
    this.tab = tab;
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((o) => o.classList.toggle('active', o.dataset.tab === tab));
    this.root.querySelector<HTMLElement>('.buy-amount')!.hidden = tab === 'decor' || tab === 'pantry';
    this.root.querySelector<HTMLElement>('.pantry-amount')!.hidden = tab !== 'pantry';
    this.root.querySelector<HTMLElement>('.menu-filter')!.hidden = tab !== 'menu';
    this.list.scrollTop = 0;
    this.update();
  }

  private onListClick(e: Event): void {
    const target = e.target as HTMLElement;
    const furniture = target.closest<HTMLButtonElement>('button[data-furniture]');
    if (furniture && !furniture.disabled) {
      const [action, id] = furniture.dataset.furniture!.split(':');
      if (action === 'buy') {
        if (!buyFurniture(this.state, id)) return;
        this.pop(furniture.closest('.tile'));
        this.onPurchase('decor', id);
        this.onArrange({ kind: 'place', id });
      } else if (action === 'place') this.onArrange({ kind: 'place', id });
      else this.onArrange({ kind: 'arrange' });
      this.update();
      return;
    }
    const decorBtn = target.closest<HTMLButtonElement>('button[data-decor]');
    if (decorBtn && !decorBtn.disabled) {
      const id = decorBtn.dataset.decor!;
      if (useDecor(this.state, id)) {
        this.pop(decorBtn.closest('.tile'));
        this.onPurchase('decor', id);
        this.update();
      }
      return;
    }
    const toggle = target.closest<HTMLButtonElement>('button[data-menu]');
    if (toggle && !toggle.disabled) {
      const id = toggle.dataset.menu as ItemId;
      setOnMenu(this.state, id, !this.state.onMenu.includes(id));
      this.onPurchase('menu', id);
      this.update();
      return;
    }
    const bake = target.closest<HTMLButtonElement>('button[data-bake]');
    if (bake && !bake.disabled) {
      const [id, step] = bake.dataset.bake!.split(':') as [ItemId, string];
      setBakePlan(this.state, id, (this.state.bakePlan[id] ?? 0) + Number(step) * BAKE_STEP);
      this.onPurchase('menu', id);
      this.update();
      return;
    }
    if (target.closest('button[data-bakeall]')) {
      bakeForForecast(this.state);
      this.onPurchase('menu', 'bake');
      this.update();
      return;
    }
    if (target.closest('button[data-restock]')) {
      if (restock(this.state)) {
        this.onPurchase('ingredient', 'restock');
        this.update();
      }
      return;
    }
    const btn = target.closest<HTMLButtonElement>('button[data-buy]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.buy!.startsWith('ing:')) {
      const id = btn.dataset.buy!.slice(4) as IngredientId;
      if (buyIngredient(this.state, id, this.pantryAmount)) {
        this.pop(btn.closest('.row'));
        this.onPurchase('ingredient', id);
        this.update();
      }
      return;
    }
    const [kind, id] = btn.dataset.buy!.split(':') as ['item' | 'upgrade', string];
    const ok =
      kind === 'item' ? buyItem(this.state, id as ItemId, this.amount) : buyUpgrade(this.state, id as UpgradeId, this.amount);
    if (!ok) return;
    this.pop(btn.closest('.row'));
    this.onPurchase(kind, id);
    this.update();
  }

  private pop(el: Element | null): void {
    if (!el) return;
    el.classList.remove('pop');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('pop');
  }

  setState(state: GameState): void {
    this.state = state;
    this.refresh();
  }

  /** Rebuilds everything, e.g. after the language changes. */
  refresh(): void {
    this.signature = '';
    this.goalSig = '';
    this.update();
  }

  /** Which rows are visible; the DOM is rebuilt only when this changes. */
  private visibleKeys(): string[] {
    if (this.tab === 'upgrades') return UPGRADES.map((u) => `upgrade:${u.id}`);
    if (this.tab === 'decor') return ['decor'];
    if (this.tab === 'pantry') return ['pantry', ...neededIngredients(this.state).map((i) => `ing:${i.id}`)];
    const keys: string[] = ['variety'];
    const cats = this.category === 'all' ? CATEGORIES : [this.category];
    for (const cat of cats) {
      keys.push(`cat:${cat}`);
      // Each category: what's unlocked, the one you can unlock next, then a mystery row.
      for (const m of MENU.filter((d) => d.category === cat)) {
        if (this.state.items[m.id] > 0 || isItemAvailable(this.state, m.id)) keys.push(`item:${m.id}`);
        else {
          keys.push(`teaser:${m.id}`);
          break;
        }
      }
    }
    return keys;
  }

  private build(keys: string[]): void {
    this.list.replaceChildren();
    this.rows.clear();
    this.tiles.clear();
    this.furnitureTiles.clear();
    this.slotNotes.clear();
    this.comfortNote = null;
    this.pantryNote = null;
    this.restockBtn = null;
    this.varietyNote = null;
    this.bakeAllBtn = null;
    if (this.tab === 'decor') {
      this.buildDecor();
      return;
    }
    for (const key of keys) {
      const [kind, id] = key.split(':');
      if (kind === 'pantry') {
        this.buildPantryIntro();
        continue;
      }
      if (kind === 'variety') {
        const box = document.createElement('div');
        box.className = 'menu-intro';
        box.innerHTML = `<div class="menu-variety note"></div><button class="pixel-btn small ghost" data-bakeall>${t('bake.all')}</button>`;
        this.varietyNote = box.querySelector('.menu-variety');
        this.bakeAllBtn = box.querySelector('button');
        this.list.append(box);
        continue;
      }
      if (kind === 'cat') {
        const cat = id as Category;
        const chain = MENU.filter((m) => m.category === cat);
        const owned = chain.filter((m) => this.state.items[m.id] > 0).length;
        const h = document.createElement('h3');
        h.className = 'menu-cat';
        h.innerHTML = `${t(`cat.${cat}` as MessageKey)} <small>${owned}/${chain.length}</small>`;
        this.list.append(h);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'row';
      if (kind === 'teaser') {
        el.classList.add('locked');
        el.innerHTML = `<div class="icon mystery">?</div><div class="info"><div class="name">???</div><div class="sub">${t('row.teaser')}</div></div>`;
        this.list.append(el);
        continue;
      }
      const isItem = kind === 'item';
      const isIng = kind === 'ing';
      const name = isItem
        ? itemName(id as ItemId)
        : isIng
          ? ingredientName(id as IngredientId)
          : upgradeName(id as UpgradeId);
      const src = isItem
        ? iconUrl(`item:${id}`, () => itemIcon(id as ItemId))
        : isIng
          ? iconUrl(`ing:${id}`, () => ingredientIcon(id as IngredientId))
          : iconUrl(`upgrade:${id}`, () => upgradeIcon(id as UpgradeId));
      // Unlocked dishes show their recipe and can be taken on or off today's menu.
      const recipeHtml = isItem
        ? `<div class="recipe">${recipe(id as ItemId)
            .map(
              ([ing, n]) =>
                `<img alt="${ingredientName(ing)}" title="${ingredientName(ing)}" src="${iconUrl(`ing:${ing}`, () => ingredientIcon(ing))}" />${n > 1 ? `<span>×${n}</span>` : ''}`,
            )
            .join('')}<b class="left"></b></div>`
        : '';
      el.innerHTML = `
        <img class="icon" alt="" src="${src}" />
        <div class="info">
          <div class="name">${name} <span class="lv"></span></div>
          <div class="sub"></div>
          ${recipeHtml}
          ${
            isItem && isBakery(id as ItemId)
              ? `<div class="bake"><span class="bake-label"></span>
                  <button class="chip bake-btn" data-bake="${id}:-1" aria-label="−${BAKE_STEP}">−</button>
                  <b class="bake-n"></b>
                  <button class="chip bake-btn" data-bake="${id}:1" aria-label="+${BAKE_STEP}">+</button>
                  <span class="bake-note"></span></div>`
              : ''
          }
          ${isItem || isIng ? '<div class="bar"><i></i></div>' : ''}
        </div>
        <div class="row-actions">
          ${isItem ? `<button class="chip menu-toggle" data-menu="${id}"></button>` : ''}
          <button class="pixel-btn buy" data-buy="${kind}:${id}">
            <span class="label"></span><span class="cost"></span>
          </button>
        </div>`;
      this.list.append(el);
      this.rows.set(key, {
        el,
        level: el.querySelector('.lv')!,
        sub: el.querySelector('.sub')!,
        bar: el.querySelector('.bar i'),
        btn: el.querySelector('button[data-buy]')!,
        btnLabel: el.querySelector('.label')!,
        btnCost: el.querySelector('.cost')!,
        toggle: el.querySelector('button[data-menu]'),
        recipe: el.querySelector('.recipe .left'),
        bake: el.querySelector('.bake'),
      });
    }
  }

  private buildPantryIntro(): void {
    const intro = document.createElement('div');
    intro.className = 'pantry-intro';
    intro.innerHTML = `
      <div class="pantry-forecast"></div>
      <div class="note">${t('pantry.intro')}</div>
      <button class="pixel-btn restock" data-restock></button>`;
    this.pantryNote = intro.querySelector('.pantry-forecast');
    this.restockBtn = intro.querySelector('button');
    this.list.append(intro);
  }

  private buildDecor(): void {
    const intro = document.createElement('div');
    intro.className = 'decor-intro';
    intro.innerHTML = `<div class="comfort"></div>`;
    this.comfortNote = intro.querySelector('.comfort');
    this.list.append(intro);

    // Furniture: buy pieces, then place them anywhere free in the café.
    const furniture = document.createElement('section');
    furniture.className = 'decor-slot furniture';
    furniture.innerHTML = `
      <h3 class="menu-cat">${t('furn.title')}</h3>
      <div class="decor-intro note">${t('furn.intro')}</div>
      <button class="pixel-btn small ghost arrange-btn" data-furniture="arrange:">${t('furn.arrange')}</button>
      <div class="decor-grid"></div>`;
    const fgrid = furniture.querySelector('.decor-grid')!;
    for (const def of FURNITURE) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML = `
        <img class="tile-icon" alt="" src="${iconUrl(`furniture:${def.id}`, () => furnitureIcon(def.id))}" />
        <div class="tile-name">${decorName(def.id)}</div>
        <div class="tile-comfort">${def.comfort > 0 ? t('decor.comfort', { n: def.comfort }) : '&nbsp;'}</div>
        <div class="tile-count"></div>
        <button class="pixel-btn tile-btn" data-furniture="buy:${def.id}"></button>
        <button class="pixel-btn tile-btn ghost" data-furniture="place:${def.id}">${t('furn.place')}</button>`;
      fgrid.append(tile);
      const [buy, place] = tile.querySelectorAll('button');
      this.furnitureTiles.set(def.id, { el: tile, buy, place, count: tile.querySelector('.tile-count')! });
    }
    this.list.append(furniture);

    const room = document.createElement('div');
    room.className = 'decor-intro';
    room.innerHTML = `<h3 class="menu-cat">${t('decor.room')}</h3><div class="note">${t('decor.intro')}</div>`;
    this.list.append(room);

    for (const slot of DECOR_SLOTS) {
      const section = document.createElement('section');
      section.className = 'decor-slot';
      section.innerHTML = `<h3>${t(`slot.${slot}` as MessageKey)} <small></small></h3><div class="decor-grid"></div>`;
      this.slotNotes.set(slot, section.querySelector('small')!);
      const grid = section.querySelector('.decor-grid')!;
      for (const def of decorForSlot(slot)) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.innerHTML = `
          <img class="tile-icon" alt="" src="${iconUrl(`decor:${def.id}`, () => decorIcon(def.id))}" />
          <div class="tile-name">${decorName(def.id)}</div>
          <div class="tile-comfort">${def.comfort > 0 ? t('decor.comfort', { n: def.comfort }) : '&nbsp;'}</div>
          <button class="pixel-btn tile-btn" data-decor="${def.id}"></button>`;
        grid.append(tile);
        this.tiles.set(def.id, { el: tile, btn: tile.querySelector('button')! });
      }
      this.list.append(section);
    }
  }

  private updateGoal(): void {
    const goal = currentGoal(this.state);
    if (!goal) {
      this.goalEl.hidden = true;
      return;
    }
    this.goalEl.hidden = false;
    const [cur, target] = goal.progress(this.state);
    const done = goalDone(this.state);
    const sig = `${this.state.goal}|${done}|${Math.min(cur, target)}`;
    if (sig === this.goalSig) return;
    this.goalSig = sig;
    const pct = Math.min(1, cur / target) * 100;
    this.goalEl.classList.toggle('done', done);
    this.goalEl.innerHTML = `
      <div class="goal-head">${t('goal.label', { n: this.state.goal + 1, total: GOALS.length })}</div>
      <div class="goal-main">
        <div class="goal-text">${t(`goal.${goal.id}` as MessageKey)}</div>
        ${
          done
            ? `<button class="pixel-btn small claim" data-claim>${t('goal.claim', { reward: formatMoney(goal.reward) })}</button>`
            : `<div class="goal-reward">${t('goal.reward', { reward: formatMoney(goal.reward) })}</div>`
        }
      </div>
      ${done ? '' : `<div class="bar"><i style="width:${pct}%"></i></div><div class="goal-progress">${formatNumber(Math.min(cur, target))} / ${formatNumber(target)}</div>`}`;
  }

  update(): void {
    this.updateGoal();
    const keys = this.visibleKeys();
    const sig = this.tab + '|' + keys.join(',');
    if (sig !== this.signature) {
      this.signature = sig;
      this.build(keys);
    }
    const s = this.state;

    if (this.tab === 'decor') {
      const c = comfort(s);
      if (this.comfortNote) this.comfortNote.textContent = t('decor.summary', { n: c, pct: Math.round((tipMultiplier(s) - 1) * 100) });
      for (const slot of DECOR_SLOTS) this.slotNotes.get(slot)!.textContent = decorName(s.decor.equipped[slot]);
      for (const [id, refs] of this.tiles) {
        const def = decorDef(id)!;
        const equipped = s.decor.equipped[def.slot] === id;
        const owned = ownsDecor(s, id);
        refs.el.classList.toggle('equipped', equipped);
        refs.btn.textContent = equipped ? t('decor.inUse') : owned ? t('decor.use') : formatMoney(def.cost);
        refs.btn.disabled = equipped || (!owned && s.coins < def.cost);
        refs.btn.classList.toggle('ghost', owned && !equipped);
      }
      for (const [id, refs] of this.furnitureTiles) {
        const def = furnitureDef(id)!;
        const placed = placedCount(s, id);
        const stored = storedCount(s, id);
        refs.count.textContent =
          stored > 0 ? t('furn.count', { placed, stored }) : placed > 0 ? t('furn.out', { n: placed }) : '';
        // Starter pieces can't be bought again, only moved.
        refs.buy.hidden = def.cost === 0;
        refs.buy.textContent = formatMoney(def.cost);
        refs.buy.disabled = s.coins < def.cost;
        refs.place.hidden = stored === 0;
        refs.el.classList.toggle('equipped', placed > 0);
      }
      return;
    }

    if (this.tab === 'pantry') {
      this.updatePantry();
      return;
    }

    const prep = s.phase === 'prep';
    if (this.bakeAllBtn) {
      this.bakeAllBtn.hidden = !prep || !menuItems(s).some((m) => isBakery(m.id));
    }
    if (this.varietyNote) {
      this.varietyNote.textContent = t('menu.variety', {
        n: menuItems(s).length,
        pct: Math.round(varietyBonus(s) * 100),
      });
    }
    for (const [key, refs] of this.rows) {
      const [kind, id] = key.split(':');
      if (kind === 'item') {
        const def = MENU.find((m) => m.id === id)!;
        const level = s.items[def.id];
        const q = quoteItem(s, def.id, this.amount);
        refs.level.textContent = level > 0 ? `Lv ${level}` : '';
        refs.sub.textContent =
          level > 0
            ? t('row.each', {
                price: formatMoney(itemPrice(def, level) * tipMultiplier(s)),
                time: prepTime(s, def.id).toFixed(1),
              })
            : t('row.sellsFor', { price: formatMoney(def.basePrice * tipMultiplier(s)) });
        const next = nextMilestone(level);
        if (refs.bar) {
          const prev = [0, ...PRICE_MILESTONES].filter((m) => m <= level).pop() ?? 0;
          refs.bar.style.width = next ? `${((level - prev) / (next - prev)) * 100}%` : '100%';
          refs.bar.parentElement!.title = next ? t('row.milestone', { level: next }) : t('row.milestonesDone');
        }
        refs.btnLabel.textContent = level === 0 ? t('btn.unlock') : q.count > 1 ? `+${q.count}` : t('btn.levelUp');
        refs.btnCost.textContent = formatMoney(q.cost);
        refs.btn.disabled = !q.affordable;
        refs.el.classList.toggle('new', level === 0);
        const on = s.onMenu.includes(def.id);
        refs.el.classList.toggle('off-menu', level > 0 && !on);
        if (refs.toggle) {
          refs.toggle.hidden = level === 0;
          refs.toggle.textContent = on ? t('menu.on') : t('menu.off');
          refs.toggle.classList.toggle('active', on);
          refs.toggle.disabled = !prep;
          refs.toggle.title = prep ? '' : t('menu.lockedOpen');
        }
        const bakery = isBakery(def.id);
        if (refs.recipe) {
          const left = servingsLeft(s, def.id);
          refs.recipe.textContent = t(bakery ? 'bake.canBake' : 'menu.left', { n: formatNumber(left) });
          refs.recipe.classList.toggle('empty', left < 1);
        }
        if (refs.bake) {
          // Morning bake: set while closed; during the day it shows what's left on the shelf.
          refs.bake.hidden = level === 0 || !on;
          const label = refs.bake.querySelector('.bake-label')!;
          const n = refs.bake.querySelector('.bake-n')!;
          const note = refs.bake.querySelector('.bake-note')!;
          refs.bake.querySelectorAll<HTMLButtonElement>('.bake-btn').forEach((b) => (b.hidden = !prep));
          if (prep) {
            const plan = s.bakePlan[def.id] ?? 0;
            label.textContent = t('bake.label');
            n.textContent = String(plan);
            note.textContent = t('bake.forecast', { n: suggestedBake(s, def.id) });
            refs.bake.classList.toggle('short', plan > servingsLeft(s, def.id));
          } else {
            const left = s.shelf[def.id] ?? 0;
            label.textContent = t('bake.shelf');
            n.textContent = `${left}/${s.today.baked[def.id] ?? 0}`;
            note.textContent = '';
            refs.bake.classList.toggle('short', left === 0);
          }
        }
      } else {
        const def = upgradeDef(id as UpgradeId);
        const level = s.upgrades[def.id];
        const q = quoteUpgrade(s, def.id, this.amount);
        const maxed = level >= def.max;
        refs.level.textContent = `${level}/${def.max}`;
        refs.sub.textContent = `${upgradeDesc(def.id)} · ${upgradeEffect(s, def.id)}`;
        refs.btnLabel.textContent = maxed ? t('btn.maxed') : q.count > 1 ? `+${q.count}` : t('btn.buy');
        refs.btnCost.textContent = maxed ? '' : formatMoney(q.cost);
        refs.btn.disabled = maxed || !q.affordable;
      }
    }
  }

  private updatePantry(): void {
    const s = this.state;
    const needs = dayNeeds(s);
    const restockQ = restockQuote(s);
    if (this.pantryNote) this.pantryNote.textContent = t('pantry.forecast', { n: formatNumber(expectedCustomers(s)) });
    if (this.restockBtn) {
      const full = restockQ.cost <= 0;
      this.restockBtn.textContent = full ? t('pantry.full') : t('pantry.restock', { price: formatMoney(restockQ.cost) });
      this.restockBtn.disabled = full || s.coins <= 0;
    }
    for (const [key, refs] of this.rows) {
      const id = key.split(':')[1] as IngredientId;
      const def = ingredientDef(id);
      const stock = s.pantry[id];
      const need = needs[id] ?? 0;
      const cost = def.cost * this.pantryAmount;
      refs.level.textContent = '';
      refs.sub.innerHTML = `${t('pantry.stock', { n: formatNumber(stock), price: formatMoney(def.cost) })}<br />${t('pantry.usedBy', {
        items: usedBy(s, id)
          .map((m) => itemName(m.id))
          .join(t('list.sep')),
      })}`;
      if (refs.bar) {
        refs.bar.style.width = need > 0 ? `${Math.min(1, stock / need) * 100}%` : '100%';
        refs.bar.parentElement!.title = t('pantry.need', { n: formatNumber(need) });
      }
      refs.el.classList.toggle('low', need > 0 && stock < need);
      refs.btnLabel.textContent = t('pantry.buy', { n: this.pantryAmount });
      refs.btnCost.textContent = formatMoney(cost);
      refs.btn.disabled = cost > s.coins;
    }
  }
}
