import { htmlItemName } from './item-name';
import { showSignatureDrinks } from './signature-drinks';
import { readPanelScroll, restorePanelScroll } from './panel-scroll';
import { showMoneyDetails } from './money-details';
import { PromotionPanel } from './promotion';
import { PetPanel, createPetBrowsingState, type PetBrowsingState } from './pets';
import type { LivingCatControls } from './living-cats';
import {
  BAKE_STEP,
  CATEGORIES,
  DAY_SECONDS,
  MENU,
  PRICE_MILESTONES,
  UPGRADES,
  type Category,
  type IngredientId,
  type ItemId,
  type UpgradeId,
} from '../game/data';
import { DECOR_SLOTS, comfort, decorDef, decorForSlot, ownsDecor, useDecor, type DecorSlot } from '../game/decor';
import { FURNITURE, buyFurniture, furnitureDef, placedCount, storedCount, type FurnishingCategory } from '../game/furniture';
import {
  arrivalRate,
  averageDishPrice,
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
  cookCount,
  upgradeLocked,
  servingsLeft,
  setBakePlan,
  setOnMenu,
  suggestedBake,
  servingCost,
  usedBy,
  varietyBonus,
  isBakery,
  isItemAvailable,
  canPrepareItem,
  previousInCategory,
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
import { formatTransactionMoney as formatMoney, formatNumber } from '../game/format';
import { GOALS, claimGoal, currentGoal, goalDone } from '../game/goals';
import type { GameState } from '../game/state';
import { mainTableCount } from '../game/regions';
import { MAX_TABLES } from '../game/layout';
import { t, type MessageKey } from '../i18n';
import { toast } from './modal';
import { showTaste, tasteLabel, tasteProgressLabel } from './taste';
import { decorIcon } from '../render/decor-art';
import { furnitureIcon } from '../render/furniture-art';
import { ingredientIcon, itemArtwork, toDataURL, upgradeIcon } from '../render/sprites';

export type PanelTab = 'menu' | 'pantry' | 'upgrades' | 'decor' | 'pets' | 'promotion';
type Tab = PanelTab;
/** A transient navigation checkpoint, never part of GameState or a save. */
export interface PanelBrowsingContext {
  readonly tab: PanelTab;
  readonly scroll: ReadonlyMap<PanelTab, number>;
  readonly amount: BuyAmount;
  readonly pantryAmount: number;
  readonly category: Category | 'all';
  readonly decorCategory: FurnishingCategory | 'renovation';
  readonly petBrowsing: Readonly<PetBrowsingState> | null;
  readonly focusKey: string | null;
}
export interface PantryTaskContext {
  title: string;
  /** Plain text, including any player-assigned drink name. */
  detail: string;
  ingredients: readonly IngredientId[];
}
export type PurchaseKind = 'item' | 'upgrade' | 'decor' | 'goal' | 'ingredient' | 'menu' | 'recipe' | 'pet' | 'promotion';

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
  moneyDetails: HTMLButtonElement;
  toggle: HTMLButtonElement | null;
  recipe: HTMLElement | null;
  bake: HTMLElement | null;
  taste: HTMLButtonElement | null;
  tradeoff: HTMLElement | null;
}

interface TileRefs {
  el: HTMLElement;
  btn: HTMLButtonElement;
  artKey?: string;
}

interface FurnitureTileRefs {
  el: HTMLElement;
  buy: HTMLButtonElement;
  place: HTMLButtonElement;
  count: HTMLElement;
}

/** What the Decor tab asks the café to do: start placing a piece, or rearrange what's out. */
export type ArrangeRequest = { kind: 'place'; id: string } | { kind: 'arrange' };

const iconUrls = new WeakMap<HTMLCanvasElement, Map<number, string>>();
function iconUrl(key: string, make: () => HTMLCanvasElement): string {
  const canvas = make(), scale = key.startsWith('item:') ? 1 : 4;
  let urls = iconUrls.get(canvas);
  if (!urls) { urls = new Map(); iconUrls.set(canvas, urls); }
  let url = urls.get(scale);
  if (!url) {
    url = toDataURL(canvas, scale);
    urls.set(scale, url);
  }
  return url;
}

function upgradeEffect(state: GameState, id: UpgradeId): string {
  switch (id) {
    case 'marketing':
      return t('effect.marketing', { n: Math.round(arrivalRate(state) * DAY_SECONDS) });
    case 'machine':
      return t('effect.machine', { n: (1 / prepMultiplier(state)).toFixed(2) });
    case 'barista':
      return t('effect.barista', { n: baristaCount(state) });
    case 'server':
      return t('effect.server', { n: serverCount(state) });
    case 'cook':
      return upgradeLocked(state, id) ? t('effect.cookLocked') : t('effect.cook', { n: cookCount(state) });
    case 'tables':
      return t('effect.tables', { n: mainTableCount(state) });
  }
}

export const itemName = (id: ItemId, state?: GameState) => htmlItemName(id, state);
export const ingredientName = (id: IngredientId) => t(`ing.${id}` as MessageKey);
const upgradeName = (id: UpgradeId) => t(`upgrade.${id}.name` as MessageKey);
const upgradeDesc = (id: UpgradeId) => {
  if (id === 'cook') {
    const def = upgradeDef(id);
    return t('upgrade.cook.desc', {
      first: formatMoney(def.baseCost),
      second: formatMoney(def.baseCost * def.growth),
    });
  }
  return t(`upgrade.${id}.desc` as MessageKey);
};
export const decorName = (id: string) => t(`decor.${id}` as MessageKey);

export class Panel {
  private tab: Tab = 'menu';
  private tablePreview = false;
  get tablePreviewRequested(): boolean { return this.tablePreview; }
  clearTablePreview(): void {
    this.tablePreview = false;
    const button = this.list.querySelector<HTMLButtonElement>('[data-table-preview]');
    if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = t('upgrade.tables.preview'); }
  }
  private scrollPositions = new Map<Tab, number>();
  private introMode = false;
  /** The first-shift view hides the other tabs only where a shortcut rail can reveal them. */
  private simplifiedTabs = true;
  private promotionPanel: PromotionPanel | null = null;
  private petPanel: PetPanel | null = null;
  // Keep browsing choices across DOM rebuilds without adding them to GameState.
  private petBrowsing: PetBrowsingState | null = null;
  private amount: BuyAmount = 1;
  private pantryAmount: number = PANTRY_AMOUNTS[0];
  private category: Category | 'all' = 'all';
  private decorCategory: FurnishingCategory | 'renovation' = 'decoration';
  private varietyNote: HTMLElement | null = null;
  private bakeAllBtn: HTMLButtonElement | null = null;
  private pantryNote: HTMLElement | null = null;
  private restockBtn: HTMLButtonElement | null = null;
  private signature = '';
  private rows = new Map<string, RowRefs>();
  private tiles = new Map<string, TileRefs>();
  private furnitureTiles = new Map<string, FurnitureTileRefs>();
  private slotNotes = new Map<DecorSlot, HTMLElement>();
  private comfortNote: HTMLElement | null = null;
  private goalSig = '';
  private lastFocus = new Map<Tab, string>();
  private navigationListeners = new Set<(tab: PanelTab) => void>();
  private suppressFocus = false;
  private pantryTask: PantryTaskContext | null = null;
  private pantryTaskNotice: HTMLElement;
  private pantryTaskTitle: HTMLElement;
  private pantryTaskDetail: HTMLElement;

  constructor(
    private root: HTMLElement,
    private list: HTMLElement,
    private goalEl: HTMLElement,
    private state: GameState,
    private onPurchase: (kind: PurchaseKind, id: string) => void,
    private onArrange: (request: ArrangeRequest) => void,
    private livingCats: LivingCatControls = {},
    private onTablePreview: () => void = () => {},
  ) {
    this.pantryTaskNotice = document.createElement('section');
    this.pantryTaskNotice.className = 'pantry-task-context';
    this.pantryTaskNotice.tabIndex = -1;
    this.pantryTaskNotice.hidden = true;
    this.pantryTaskTitle = document.createElement('h3');
    this.pantryTaskDetail = document.createElement('p');
    this.pantryTaskDetail.setAttribute('role', 'status');
    this.pantryTaskDetail.setAttribute('aria-live', 'polite');
    this.pantryTaskNotice.append(this.pantryTaskTitle, this.pantryTaskDetail);
    (root.querySelector('.panel-scroll') ?? list).before(this.pantryTaskNotice);
    root.addEventListener('focusin', (event) => {
      if (this.suppressFocus || !(event.target instanceof HTMLElement)) return;
      const key = this.controlKey(event.target);
      if (key) this.lastFocus.set(this.tab, key);
    });
    root.addEventListener('scroll', (event) => {
      if (event.target === this.scroller && !root.closest('[hidden]')) {
        this.scrollPositions.set(this.tab, readPanelScroll(this.list, this.scroller));
      }
    }, true);
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.showTab(b.dataset.tab as Tab)),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-amount]').forEach((b) =>
      b.addEventListener('click', () => {
        const v = b.dataset.amount!;
        this.amount = v === 'max' ? 'max' : (Number(v) as 1 | 10);
        this.updateChoices();
        this.update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-pantry-amount]').forEach((b) =>
      b.addEventListener('click', () => {
        this.pantryAmount = Number(b.dataset.pantryAmount);
        this.updateChoices();
        this.update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => {
        const category = b.dataset.cat as Category | 'all';
        if (category === this.category) return;
        this.category = category;
        this.updateChoices();
        this.scroller.scrollTop = 0;
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
    this.updateControls();
  }

  /** A temporary first-shift view; saved progress and the full-view choices stay untouched. */
  setIntroMode(enabled: boolean): void {
    if (this.introMode === enabled) return;
    const focused = this.focusedControl();
    this.introMode = enabled;
    this.clearTablePreview();
    const previousTab = this.tab;
    if (enabled && this.simplifiedTabs && this.tab !== 'menu' && this.tab !== 'pantry') {
      this.scrollPositions.set(this.tab, readPanelScroll(this.list, this.scroller));
      this.tab = 'menu';
    }
    this.updateControls();
    this.update();
    if (previousTab !== this.tab) this.restoreTabScroll(this.tab);
    this.restoreVisibleFocus(focused);
  }

  /**
   * Whether the first-shift view may hide the other four tabs. On phones the only way
   * in is the drawer itself (there is no shortcut rail to reveal them), so the tabs
   * stay available or the player could never reach upgrades, décor, cats or promotion.
   */
  setSimplifiedTabs(available: boolean): void {
    if (this.simplifiedTabs === available) return;
    this.simplifiedTabs = available;
    this.updateControls();
  }

  showTab(tab: Tab): void {
    this.clearTablePreview();
    // Clear temporary presentation before measuring/restoring the destination.
    for (const listener of this.navigationListeners) listener(tab);
    const focused = this.focusedControl();
    const previousTab = this.tab;
    if (tab !== previousTab) this.scrollPositions.set(previousTab, readPanelScroll(this.list, this.scroller));
    // Direct navigation, including scene shortcuts, must always reach every tool.
    if (tab !== 'menu' && tab !== 'pantry') this.introMode = false;
    this.tab = tab;
    this.updateControls();
    this.update();
    if (tab !== previousTab) this.restoreTabScroll(tab);
    this.restoreVisibleFocus(focused);
  }

  get currentTab(): PanelTab { return this.tab; }

  /** Explicit newer navigation wins over a temporary task's return destination. */
  onNavigate(listener: (tab: PanelTab) => void): () => void {
    this.navigationListeners.add(listener);
    return () => { this.navigationListeners.delete(listener); };
  }

  captureBrowsingContext(): PanelBrowsingContext {
    // A hidden mobile wrapper has zero geometry. Reuse its last visible offset;
    // callers also capture immediately before explicitly collapsing management.
    if (!this.root.closest('[hidden]')) this.scrollPositions.set(this.tab, readPanelScroll(this.list, this.scroller));
    const scroll = new Map(this.scrollPositions);
    if (!scroll.has(this.tab)) scroll.set(this.tab, 0);
    const focused = this.focusedControl();
    return {
      tab: this.tab, scroll, amount: this.amount, pantryAmount: this.pantryAmount,
      category: this.category, decorCategory: this.decorCategory,
      petBrowsing: this.petBrowsing ? { ...this.petBrowsing } : null,
      focusKey: focused && this.controlKey(focused) || this.lastFocus.get(this.tab) || null,
    };
  }

  restoreBrowsingContext(context: PanelBrowsingContext, focus = true): void {
    this.clearTablePreview();
    this.amount = context.amount;
    this.pantryAmount = context.pantryAmount;
    this.category = context.category;
    this.decorCategory = context.decorCategory;
    this.petBrowsing = context.petBrowsing ? { ...context.petBrowsing } : null;
    this.scrollPositions = new Map(context.scroll);
    this.tab = context.tab;
    this.suppressFocus = true;
    try {
      this.updateControls();
      this.update();
      this.restoreTabScroll(this.tab);
    } finally { this.suppressFocus = false; }
    if (focus) this.restoreBrowsingFocus(context);
  }

  restoreBrowsingFocus(context: PanelBrowsingContext): void {
    const available = (control: HTMLElement) => !control.closest('[hidden], [inert]') && !control.matches(':disabled');
    const matching = context.focusKey && Array.from(this.root.querySelectorAll<HTMLElement>('button, input, select, textarea'))
      .find((control) => this.controlKey(control) === context.focusKey && available(control));
    const fallback = this.root.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`);
    const next = matching || fallback;
    if (next && available(next)) next.focus({ preventScroll: true });
  }

  /** Presentation only: the original Pantry quote, buttons and handlers stay live. */
  setPantryTaskContext(context: PantryTaskContext | null): void {
    const layoutChanged = !!context !== !!this.pantryTask;
    const scroll = layoutChanged ? readPanelScroll(this.list, this.scroller) : 0;
    this.pantryTask = context;
    this.root.classList.toggle('pantry-task', !!context);
    const nav = this.root.querySelector<HTMLElement>('[role="tablist"], .tabs');
    if (nav) nav.hidden = !!context;
    this.pantryTaskNotice.hidden = !context;
    const title = context?.title ?? '';
    const detail = context?.detail ?? '';
    if (this.pantryTaskTitle.textContent !== title) this.pantryTaskTitle.textContent = title;
    if (this.pantryTaskDetail.textContent !== detail) this.pantryTaskDetail.textContent = detail;
    this.pantryTaskNotice.setAttribute('aria-label', title);
    this.pantryTaskDetail.hidden = !detail;
    this.updateGoal();
    this.updatePantryHighlights();
    if (layoutChanged) restorePanelScroll(this.list, this.scroller, scroll);
  }

  focusPantryTask(targetRestock: boolean): void {
    if (!this.pantryTask || this.tab !== 'pantry') return;
    if (targetRestock) restorePanelScroll(this.list, this.scroller, 0);
    this.pantryTaskNotice.focus({ preventScroll: true });
  }

  private updatePantryHighlights(): void {
    for (const [key, refs] of this.rows) {
      const id = key.startsWith('ing:') ? key.slice(4) as IngredientId : null;
      refs.el.classList.toggle('pantry-shortfall', !!id && !!this.pantryTask?.ingredients.includes(id));
    }
  }

  private restoreTabScroll(tab: Tab): void {
    const position = this.scrollPositions.get(tab);
    if (position === undefined) this.scroller.scrollTop = 0;
    else restorePanelScroll(this.list, this.scroller, position);
  }

  private updateControls(): void {
    const tab = this.tab;
    // A hidden tab must always keep a way back; otherwise leave the whole row reachable.
    const hideOthers = this.introMode && this.simplifiedTabs;
    this.root.classList.toggle('intro-mode', hideOthers);
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((o) => {
      o.hidden = hideOthers && o.dataset.tab !== 'menu' && o.dataset.tab !== 'pantry';
      o.classList.toggle('active', o.dataset.tab === tab);
      o.setAttribute('aria-selected', String(o.dataset.tab === tab));
    });
    this.root.querySelector<HTMLElement>('.buy-amount')!.hidden = this.introMode || tab === 'decor' || tab === 'pantry' || tab === 'pets' || tab === 'promotion';
    this.root.querySelector<HTMLElement>('.pantry-amount')!.hidden = this.introMode || tab !== 'pantry';
    this.root.querySelector<HTMLElement>('.menu-filter')!.hidden = this.introMode || tab !== 'menu';
    this.updateChoices();
  }

  private updateChoices(): void {
    for (const [attribute, value] of [
      ['data-amount', this.amount],
      ['data-pantry-amount', this.pantryAmount],
      ['data-cat', this.category],
    ] as const) {
      this.root.querySelectorAll<HTMLButtonElement>(`button[${attribute}]`).forEach((button) => {
        const active = button.getAttribute(attribute) === String(value);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
  }

  /** Mobile keeps the filters and goal in the same scroll area as the catalog. */
  private get scroller(): HTMLElement {
    return this.root.classList.contains('mobile-panel')
      ? this.root.querySelector<HTMLElement>('.panel-scroll') ?? this.list
      : this.list;
  }

  private focusedControl(): HTMLElement | null {
    const active = this.root.ownerDocument.activeElement;
    return active instanceof HTMLElement && this.root.contains(active) ? active : null;
  }

  /** Existing action data identifies a control even when an unlock rebuilds its row. */
  private controlKey(control: HTMLElement): string | null {
    const action = Object.entries(control.dataset).sort(([a], [b]) => a.localeCompare(b));
    const pet = control.closest<HTMLElement>('[data-pet]')?.dataset.pet;
    // Pet care actions repeat per card; its checkbox has no action data of its own.
    if (!action.length && !(pet && control.matches('input[type="checkbox"]'))) return null;
    return JSON.stringify([control.tagName, pet, action]);
  }

  private restoreVisibleFocus(previous: HTMLElement | null): void {
    if (!previous || this.suppressFocus) return;
    const available = (control: HTMLElement) => this.root.contains(control) && !control.closest('[hidden]') && !control.matches(':disabled');
    if (available(previous)) return;
    const key = this.controlKey(previous);
    const replacement = key && Array.from(this.root.querySelectorAll<HTMLElement>('button, input, select, textarea'))
      .find((control) => this.controlKey(control) === key && available(control));
    const next = replacement || this.root.querySelector<HTMLButtonElement>(`[data-tab="${this.tab}"]`);
    if (next && this.root.ownerDocument.activeElement !== next) next.focus({ preventScroll: true });
  }

  private get buyAmount(): BuyAmount {
    return this.introMode ? 1 : this.amount;
  }

  private get ingredientAmount(): number {
    return this.introMode ? PANTRY_AMOUNTS[0] : this.pantryAmount;
  }

  private onListClick(e: Event): void {
    const target = e.target as HTMLElement;
    const preview = target.closest<HTMLButtonElement>('button[data-table-preview]');
    if (preview && !preview.disabled) {
      this.tablePreview = !this.tablePreview;
      if (this.tablePreview) this.onTablePreview();
      this.update();
      return;
    }
    const categoryButton = target.closest<HTMLButtonElement>('button[data-decor-category]');
    if (categoryButton) {
      const category = categoryButton.dataset.decorCategory as typeof this.decorCategory;
      if (category !== this.decorCategory) {
        this.decorCategory = category;
        this.scroller.scrollTop = 0;
        this.update();
      }
      this.list.querySelector<HTMLButtonElement>(`[data-decor-category="${this.decorCategory}"]`)?.focus({ preventScroll: true });
      return;
    }
    const taste = target.closest<HTMLButtonElement>('button[data-taste]');
    if (taste) {
      const id = taste.dataset.taste as ItemId;
      showTaste(this.state, id, () => { this.onPurchase('recipe', id); this.update(); });
      return;
    }
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
      const before = { ...this.state.pantry };
      if (restock(this.state)) {
        const bought = Object.entries(this.state.pantry).filter(([id, n]) => n > before[id as IngredientId]).map(([id, n]) => `${ingredientName(id as IngredientId)} ×${n - before[id as IngredientId]}`).join(t('list.sep'));
        toast(t('prep.bought', { items: bought }));
        this.onPurchase('ingredient', 'restock');
        this.update();
      }
      return;
    }
    const btn = target.closest<HTMLButtonElement>('button[data-buy]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.buy!.startsWith('ing:')) {
      const id = btn.dataset.buy!.slice(4) as IngredientId;
      if (buyIngredient(this.state, id, this.ingredientAmount)) {
        this.pop(btn.closest('.row'));
        this.onPurchase('ingredient', id);
        this.update();
      }
      return;
    }
    const [kind, id] = btn.dataset.buy!.split(':') as ['item' | 'upgrade', string];
    const ok =
      kind === 'item' ? buyItem(this.state, id as ItemId, this.buyAmount) : buyUpgrade(this.state, id as UpgradeId, this.buyAmount);
    if (!ok) return;
    if (kind === 'upgrade' && id === 'tables') this.clearTablePreview();
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
    this.clearTablePreview();
    this.state = state;
    for (const listener of this.navigationListeners) listener(this.tab);
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
    if (this.tab === 'promotion') return ['promotion'];
    if (this.tab === 'pets') return ['pets'];
    if (this.tab === 'upgrades') return UPGRADES.map((u) => `upgrade:${u.id}`);
    if (this.tab === 'decor') return ['decor', this.decorCategory];
    if (this.tab === 'pantry') return ['pantry', ...neededIngredients(this.state).map((i) => `ing:${i.id}`)];
    const stylePriceNote = ['signature-workbench', ...(this.state.cafeStyle.focus ? ['style-prices'] : [])];
    if (this.introMode) {
      // Show every owned recipe, even if a full-view filter was previously selected.
      // Older/purchased food remains available, with its existing kitchen gates intact.
      return [...stylePriceNote, ...CATEGORIES.flatMap((cat) => {
        const owned = MENU.filter((m) => m.category === cat && this.state.items[m.id] > 0);
        return owned.length ? [`cat:${cat}`, ...owned.map((m) => `item:${m.id}`)] : [];
      })];
    }
    const keys: string[] = [...stylePriceNote, 'variety'];
    const cats = this.category === 'all' ? CATEGORIES : [this.category];
    for (const cat of cats) {
      keys.push(`cat:${cat}`);
      // Each category: what's unlocked, the one you can unlock next, then a mystery row.
      for (const m of MENU.filter((d) => d.category === cat)) {
        if (this.state.items[m.id] > 0 || isItemAvailable(this.state, m.id) || !canPrepareItem(this.state, m.id) && (!previousInCategory(m.id) || this.state.items[previousInCategory(m.id)!.id] > 0)) keys.push(`item:${m.id}`);
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
    this.petPanel = null;
    this.promotionPanel = null;
    this.rows.clear();
    this.tiles.clear();
    this.furnitureTiles.clear();
    this.slotNotes.clear();
    this.comfortNote = null;
    this.pantryNote = null;
    this.restockBtn = null;
    this.varietyNote = null;
    this.bakeAllBtn = null;
    if (this.tab === 'promotion') {
      this.promotionPanel = new PromotionPanel(this.list, this.state, () => { this.onPurchase('promotion', 'campaign'); this.update(); });
      return;
    }
    if (this.tab === 'pets') {
      this.petBrowsing ??= createPetBrowsingState(this.state);
      this.petPanel = new PetPanel(this.list, this.state, (id) => {
        const focused = this.focusedControl();
        this.onPurchase('pet', id);
        this.update();
        this.restoreVisibleFocus(focused);
      }, this.livingCats, this.petBrowsing);
      return;
    }
    if (this.tab === 'decor') {
      this.buildDecor();
      return;
    }
    for (const key of keys) {
      const [kind, id] = key.split(':');
      if (kind === 'signature-workbench') {
        const button = document.createElement('button');
        button.className = 'pixel-btn small ghost signature-entry';
        button.textContent = t('signature.entry');
        button.addEventListener('click', () => showSignatureDrinks(this.state, () => { this.onPurchase('recipe', 'signature'); this.refresh(); }));
        this.list.append(button);
        continue;
      }
      if (kind === 'style-prices') {
        const note = document.createElement('p');
        note.className = 'menu-style-prices note';
        note.textContent = t('style.menu.prices');
        this.list.append(note);
        continue;
      }
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
        h.innerHTML = `${t(`cat.${cat}` as MessageKey)}${this.introMode ? '' : ` <small>${owned}/${chain.length}</small>`}`;
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
        ? iconUrl(`item:${id}`, () => itemArtwork(id as ItemId))
        : isIng
          ? iconUrl(`ing:${id}`, () => ingredientIcon(id as IngredientId))
          : iconUrl(`upgrade:${id}`, () => upgradeIcon(id as UpgradeId));
      // Unlocked dishes show their recipe and can be taken on or off today's menu.
      const recipeHtml = isItem
        ? `<div class="recipe">${recipe(id as ItemId)
            .map(
              ([ing, n]) =>
                `<img data-ingredient="${ing}" alt="${ingredientName(ing)}" title="${ingredientName(ing)}" src="${iconUrl(`ing:${ing}`, () => ingredientIcon(ing))}" />${n > 1 ? `<span>×${n}</span>` : ''}`,
            )
            .join('')}<b class="left"></b></div>`
        : '';
      el.innerHTML = `
        <img class="icon" alt="" src="${src}" />
        <div class="info">
          <div class="name">${name} <span class="lv"></span></div>
          <div class="sub"></div>
          ${isItem ? '<p class="note menu-tradeoff" hidden></p>' : ''}
          <button type="button" class="money-details" data-price-details="${kind}:${id}" aria-haspopup="dialog"></button>
          ${recipeHtml}
          ${isItem ? `<button class="taste-chip" data-taste="${id}" aria-haspopup="dialog"><span class="taste-label"></span><small class="taste-progress"></small></button>` : ''}
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
          ${kind === 'upgrade' && id === 'tables' ? '<button type="button" class="chip" data-table-preview aria-pressed="false"></button>' : ''}
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
        moneyDetails: el.querySelector('[data-price-details]')!,
        toggle: el.querySelector('button[data-menu]'),
        recipe: el.querySelector('.recipe .left'),
        bake: el.querySelector('.bake'),
        taste: el.querySelector('button[data-taste]'),
        tradeoff: el.querySelector('.menu-tradeoff'),
      });
    }
  }

  private buildPantryIntro(): void {
    const intro = document.createElement('div');
    intro.className = 'pantry-intro';
    intro.innerHTML = `
      <div class="pantry-forecast"></div>
      <div class="note">${t(this.introMode ? 'guide.pantryIntro' : 'pantry.intro')}</div>
      <button class="pixel-btn restock" data-restock aria-describedby="pantry-restock-reason"></button>
      <div id="pantry-restock-reason" class="note restock-reason" hidden></div>`;
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

    const filters = document.createElement('nav');
    filters.className = 'decor-filter';
    filters.setAttribute('aria-label', t('decor.categories'));
    filters.innerHTML = (['decoration', 'furniture', 'renovation'] as const).map((category) =>
      `<button class="chip${this.decorCategory === category ? ' active' : ''}" data-decor-category="${category}" aria-pressed="${this.decorCategory === category}">${t(`decor.category.${category}`)}</button>`,
    ).join('');
    this.list.append(filters);

    if (this.decorCategory !== 'renovation') {
      const catalog = FURNITURE.filter((d) => d.category === this.decorCategory).sort((a, b) => a.cost - b.cost);
      // Buy into storage, then choose a free wall or floor position.
      const furniture = document.createElement('section');
      furniture.className = 'decor-slot furniture';
      furniture.innerHTML = `
        <h3 class="menu-cat">${t(`decor.category.${this.decorCategory}`)} <small>${t('decor.catalogCount', { n: catalog.length })}</small></h3>
        <div class="decor-intro note">${t(this.decorCategory === 'decoration' ? 'decor.decorationIntro' : 'furn.intro')}</div>
        <button class="pixel-btn small ghost arrange-btn" data-furniture="arrange:">${t('furn.arrange')}</button>
        <div class="decor-grid"></div>`;
      const fgrid = furniture.querySelector('.decor-grid')!;
      for (const def of catalog) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.furnishing = def.id;
        tile.innerHTML = `
          <img class="tile-icon" alt="" src="${iconUrl(`furniture:${def.id}`, () => furnitureIcon(def.id))}" />
          <div class="tile-name">${decorName(def.id)}</div>
          <div class="tile-footprint">${t(`furn.surface.${def.surface}`)} · ${def.w}×${def.h}</div>
          <div class="tile-comfort">${def.comfort > 0 ? t('decor.comfort', { n: def.comfort }) : '&nbsp;'}</div>
          <div class="tile-count"></div>
          <button class="pixel-btn tile-btn" data-furniture="buy:${def.id}"></button>
          <button class="pixel-btn tile-btn ghost" data-furniture="place:${def.id}">${t('furn.place')}</button>`;
        fgrid.append(tile);
        const [buy, place] = tile.querySelectorAll('button');
        this.furnitureTiles.set(def.id, { el: tile, buy, place, count: tile.querySelector('.tile-count')! });
      }
      this.list.append(furniture);
      return;
    }

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
          <img class="tile-icon" alt="" src="${iconUrl(`decor:${def.id}`, () => decorIcon(def.id,this.state.decor.equipped.tablecloth,this.state.decor.equipped.centerpiece))}" />
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
    if (!goal || this.pantryTask) {
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
    const keys = this.visibleKeys();
    const sig = this.tab + '|' + this.introMode + '|' + keys.join(',');
    const rebuilt = sig !== this.signature;
    const focused = rebuilt ? this.focusedControl() : null;
    const scrollPosition = rebuilt ? readPanelScroll(this.list, this.scroller) : 0;
    this.updateGoal();
    if (rebuilt) {
      this.signature = sig;
      this.build(keys);
    }
    this.updateContents();
    if (rebuilt) {
      // Restore only after hidden/disabled states and row heights are up to date.
      this.restoreVisibleFocus(focused);
      restorePanelScroll(this.list, this.scroller, scrollPosition);
    }
  }

  private updateContents(): void {
    const s = this.state;
    const preview = this.list.querySelector<HTMLButtonElement>('[data-table-preview]');
    const previewAvailable = this.tab === 'upgrades' && s.phase === 'prep' && mainTableCount(s) < MAX_TABLES;
    if (!previewAvailable) this.tablePreview = false;
    if (preview) {
      preview.hidden = !previewAvailable;
      preview.setAttribute('aria-pressed', String(this.tablePreview));
      preview.textContent = t(this.tablePreview ? 'upgrade.tables.hidePreview' : 'upgrade.tables.preview');
    }
    if (this.tab === 'promotion') { this.promotionPanel?.update(); return; }
    if (this.tab === 'pets') { this.petPanel?.update(); return; }

    if (this.tab === 'decor') {
      const c = comfort(s);
      if (this.comfortNote) this.comfortNote.textContent = t('decor.summary', { n: c, pct: Math.round((tipMultiplier(s) - 1) * 100) });
      for (const [slot, note] of this.slotNotes) note.textContent = decorName(s.decor.equipped[slot]);
      for (const [id, refs] of this.tiles) {
        const def = decorDef(id)!;
        if(def.slot==='tablecloth'||def.slot==='centerpiece'){
          const artKey=s.decor.equipped.tablecloth+':'+s.decor.equipped.centerpiece;
          if(refs.artKey!==artKey){
            refs.el.querySelector<HTMLImageElement>('.tile-icon')!.src=iconUrl(`decor:${id}:${artKey}`,()=>decorIcon(id,s.decor.equipped.tablecloth,s.decor.equipped.centerpiece));
            refs.artKey=artKey;
          }
        }
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
        refs.buy.textContent = t('furn.buy', { price: formatMoney(def.cost) });
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
        price: formatMoney(averageDishPrice(s)),
      });
    }
    for (const [key, refs] of this.rows) {
      const [kind, id] = key.split(':');
      if (kind === 'item') {
        const icon = refs.el.querySelector<HTMLImageElement>('img.icon');
        const source = iconUrl(`item:${id}`, () => itemArtwork(id as ItemId));
        if (icon && icon.getAttribute('src') !== source) icon.src = source;
        for (const image of refs.el.querySelectorAll<HTMLImageElement>('img[data-ingredient]')) {
          const ingredient = image.dataset.ingredient as IngredientId;
          const ingredientSource = iconUrl(`ing:${ingredient}`, () => ingredientIcon(ingredient));
          if (image.getAttribute('src') !== ingredientSource) image.src = ingredientSource;
        }
        const def = MENU.find((m) => m.id === id)!;
        const level = s.items[def.id];
        const q = quoteItem(s, def.id, this.buyAmount);
        refs.level.textContent = level > 0 ? `Lv ${level}` : '';
        refs.sub.textContent =
          level > 0
            ? t('row.each', {
                price: formatMoney(itemPrice(def, level) * tipMultiplier(s)),
                time: prepTime(s, def.id).toFixed(1),
                cost: formatMoney(servingCost(def.id)),
              })
            : t('row.sellsFor', { price: formatMoney(def.basePrice * tipMultiplier(s)) });
        refs.sub.textContent += ` · ${t('row.after', { before: formatMoney(itemPrice(def, level) * tipMultiplier(s)), after: formatMoney(itemPrice(def, level + q.count) * tipMultiplier(s)) })}`;
        const next = nextMilestone(level);
        if (refs.bar) {
          const prev = [0, ...PRICE_MILESTONES].filter((m) => m <= level).pop() ?? 0;
          refs.bar.style.width = next ? `${((level - prev) / (next - prev)) * 100}%` : '100%';
          refs.bar.parentElement!.title = next ? t('row.milestone', { level: next }) : t('row.milestonesDone');
        }
        refs.btnLabel.textContent = level === 0 ? t('btn.unlock') : q.count > 1 ? `+${q.count}` : t('btn.levelUp');
        refs.btnCost.textContent = formatMoney(q.cost);
        this.updateMoneyDetails(refs, q.cost);
        refs.btn.title = t('row.after', { before: formatMoney(itemPrice(def, level) * tipMultiplier(s)), after: formatMoney(itemPrice(def, level + q.count) * tipMultiplier(s)) });
        refs.btn.disabled = !q.affordable;
        refs.el.classList.toggle('new', level === 0);
        const eligible = canPrepareItem(s, def.id);
        const on = eligible && s.onMenu.includes(def.id);
        if (!eligible) refs.sub.textContent = t('menu.requiresKitchen');
        refs.el.classList.toggle('off-menu', level > 0 && !on);
        if (refs.tradeoff) {
          // Guests pick dishes evenly, so a cheap new dish quietly lowers the average order.
          const today = menuItems(s), before = averageDishPrice(s, today);
          const after = eligible && !on && today.length ? averageDishPrice(s, [...today, def]) : before;
          refs.tradeoff.hidden = after >= before - 0.005;
          if (!refs.tradeoff.hidden) refs.tradeoff.textContent = t(level === 0 ? 'menu.tradeoffNew' : 'menu.tradeoff', { before: formatMoney(before), after: formatMoney(after) });
        }
        if (refs.toggle) {
          refs.toggle.hidden = level === 0;
          refs.toggle.textContent = on ? t('menu.on') : t('menu.off');
          refs.toggle.classList.toggle('active', on);
          refs.toggle.setAttribute('aria-pressed', String(on));
          refs.toggle.disabled = !prep || !eligible;
          refs.toggle.title = !eligible ? t('menu.requiresKitchen') : prep ? '' : t('menu.lockedOpen');
        }
        if (refs.taste) {
          refs.taste.hidden = level === 0;
          refs.taste.querySelector('.taste-label')!.textContent = tasteLabel(s, def.id);
          refs.taste.querySelector('.taste-progress')!.textContent = tasteProgressLabel(s, def.id);
          refs.taste.setAttribute('aria-label', `${itemName(def.id)} · ${tasteLabel(s, def.id)} · ${tasteProgressLabel(s, def.id)}`);
        }
        const bakery = isBakery(def.id);
        if (refs.recipe) {
          refs.recipe.hidden = !eligible;
          const left = servingsLeft(s, def.id);
          refs.recipe.textContent = eligible ? t(bakery ? 'bake.canBake' : 'menu.left', { n: formatNumber(left) }) : t('menu.requiresKitchen');
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
            note.textContent = t('bake.suggested', { n: suggestedBake(s, def.id) });
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
        const q = quoteUpgrade(s, def.id, this.buyAmount);
        const maxed = level >= def.max;
        refs.level.textContent = def.id === 'cook'
          ? s.kitchen ? t('upgrade.cook.stage', { n: level + 1, total: def.max + 1 }) : ''
          : `${level}/${def.max}`;
        const after = { ...s, upgrades: { ...s.upgrades, [def.id]: Math.min(def.max, level + q.count) } };
        // A locked upgrade has no "after" to preview, and money is not what it is waiting for.
        const locked = upgradeLocked(s, def.id);
        refs.sub.textContent = `${upgradeDesc(def.id)} · ${upgradeEffect(s, def.id)}${maxed || locked ? '' : ` → ${upgradeEffect(after, def.id)}`}`;
        refs.btnLabel.textContent = maxed ? t('btn.maxed') : q.count > 1 ? `+${q.count}` : t('btn.buy');
        refs.btnCost.textContent = maxed ? '' : formatMoney(q.cost);
        this.updateMoneyDetails(refs, q.cost, maxed || locked);
        refs.btn.disabled = maxed || !q.affordable;
      }
    }
  }

  private updatePantry(): void {
    const s = this.state;
    const needs = dayNeeds(s);
    const restockQ = restockQuote(s);
    if (this.pantryNote) this.pantryNote.textContent = t('pantry.forecast', { n: formatNumber(expectedCustomers(s)) }) + (restockQ.cost > s.coins ? ` · ${t('prep.partial', { money: formatMoney(s.coins) })}` : '');
    if (this.restockBtn) {
      const full = restockQ.cost <= 0;
      this.restockBtn.textContent = full ? t('pantry.full') : t('pantry.restock', { price: formatMoney(restockQ.cost) });
      this.restockBtn.disabled = full || s.coins <= 0;
      this.restockBtn.classList.toggle('is-complete', full);
      const reason = this.list.querySelector<HTMLElement>('.restock-reason');
      if (reason) {
        reason.hidden = full || s.coins > 0;
        reason.textContent = reason.hidden ? '' : t('money.short', { money: formatMoney(restockQ.cost - s.coins) });
      }
    }
    for (const [key, refs] of this.rows) {
      const id = key.split(':')[1] as IngredientId;
      const icon = refs.el.querySelector<HTMLImageElement>('img.icon');
      const source = iconUrl(`ing:${id}`, () => ingredientIcon(id));
      if (icon && icon.getAttribute('src') !== source) icon.src = source;
      const def = ingredientDef(id);
      const stock = s.pantry[id];
      const need = needs[id] ?? 0;
      const cost = def.cost * this.ingredientAmount;
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
      refs.btnLabel.textContent = t('pantry.buy', { n: this.ingredientAmount });
      refs.btnCost.textContent = formatMoney(cost);
      this.updateMoneyDetails(refs, cost);
      refs.btn.disabled = cost > s.coins;
    }
    this.updatePantryHighlights();
  }

  private updateMoneyDetails(refs: RowRefs, cost: number, hidden = false): void {
    refs.moneyDetails.hidden = hidden;
    refs.moneyDetails.textContent = cost > this.state.coins
      ? t('money.short', { money: formatMoney(cost - this.state.coins) })
      : t('money.details');
    refs.moneyDetails.onclick = () => {
      // Max can change between the throttled UI refresh and this click as sales arrive.
      // Use the same live quote that the purchase handler would use now.
      const [kind, id] = refs.btn.dataset.buy!.split(':');
      const currentCost = kind === 'item' ? quoteItem(this.state, id as ItemId, this.buyAmount).cost
        : kind === 'upgrade' ? quoteUpgrade(this.state, id as UpgradeId, this.buyAmount).cost
        : ingredientDef(id as IngredientId).cost * this.ingredientAmount;
      showMoneyDetails(this.state.coins, currentCost);
    };
  }
}
