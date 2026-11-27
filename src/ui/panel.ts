import './menu-story-polish.css';
import { streetEntryLabel, showStreetMap } from './streets';
import type { AreaId } from '../game/regions';
import { demandEnabled } from '../game/customer-demand';
import { conditionTraffic } from '../game/conditions';
import { chainPriceMultiplier, menuTrafficMultiplier } from '../game/economy';
import { displayItemName, htmlItemName } from './item-name';
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
  type Category,
  type IngredientId,
  type ItemId,
  type UpgradeId,
} from '../game/data';
import { DECOR_SLOTS, comfort, decorDef, decorForSlot, ownsDecor, useDecor, type DecorSlot } from '../game/decor';
import { BUILDING_SPOTS } from '../game/building-spots';
import { FURNITURE, builtSpots, buyFurniture, furnitureDef, placedCount, storedCount, type FurnishingCategory, type Surface } from '../game/furniture';
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
  isTrafficCapped,
  neededIngredients,
  recipe,
  restock,
  restockQuote,
  restockPlan,
  serverCount,
  cookCount,
  upgradeLocked,
  upgradeMax,
  passCapacity,
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
import { formatDuration, formatTransactionMoney as formatMoney, formatNumber } from '../game/format';
import { GOALS, claimGoal, currentGoal, goalDone } from '../game/goals';
import { milestonesStarted } from '../game/milestones';
import { claimChapterWithToast, milestoneCard, showMilestoneBook } from './milestones';
import type { GameState } from '../game/state';
import { mainTableCount } from '../game/regions';
import { MANAGER_COST, MANAGER_UNLOCK_DAY, OVERFLOW_SHARE, TILL_HOURS, awayHourly, hireManager, managerUnlocked, tillSeconds, tillUpgradeCost, upgradeTill } from '../game/manager';
import { FRANCHISE_SHARE, STAR_EARNINGS, branchEarnings, nextStarAt, branchUnlocked, canOpenBranch, chainBonusPercent, collectFranchises, franchiseEarnings, franchiseHourly, starsOnBranch } from '../game/chain';
import { buildShare } from '../game/regions';
import { chainComplete, starsFree } from '../game/chain-bonuses';
import { chainPlaces, completeBonusPercent, placeBonusText, showChainPerks } from './chain-ui';
import { ORDERS, collectOrder, orderBlock, orderLeft, orderReady, quoteOrder, startOrder, type OrderKind } from '../game/orders';
import { cafeLocation, isSpecialty } from '../game/locations';
import { locationName } from './branch-map';
import { MAX_TABLES } from '../game/layout';
import { t, type MessageKey } from '../i18n';
import { toast } from './modal';
import { showTaste, tasteLabel, tasteProgressLabel } from './taste';
import { decorIcon } from '../render/decor-art';
import { furnitureIcon } from '../render/furniture-art';
import { ingredientIcon, itemArtwork, toDataURL, upgradeIcon } from '../render/sprites';
import { iconArt } from './icon-art';

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
export type PurchaseKind = 'item' | 'upgrade' | 'decor' | 'goal' | 'milestone' | 'ingredient' | 'menu' | 'recipe' | 'pet' | 'promotion';

/** How many units one tap buys in the pantry. */
const PANTRY_AMOUNTS = [10, 50, 200] as const;

interface RowRefs {
  el: HTMLElement;
  level: HTMLElement | null;
  sub: HTMLElement;
  bar: HTMLElement | null;
  pips: HTMLElement | null;
  stamp: HTMLElement | null;
  btn: HTMLButtonElement;
  btnLabel: HTMLElement;
  btnCost: HTMLElement;
  moneyDetails: HTMLButtonElement;
  toggle: HTMLButtonElement | null;
  recipeBox: HTMLElement | null;
  recipe: HTMLElement | null;
  bake: HTMLElement | null;
  taste: HTMLButtonElement | null;
  tradeoff: HTMLElement | null;
  upgradePreview: HTMLElement | null;
  cardPrice: HTMLElement | null;
  cardBadge: HTMLElement | null;
  cardStock: HTMLElement | null;
  cardUnit: HTMLElement | null;
  cardNeed: HTMLElement | null;
  details: HTMLDetailsElement | null;
}

interface TileRefs {
  el: HTMLElement;
  btn: HTMLButtonElement;
  coin: HTMLElement;
  btnText: HTMLElement;
  artKey?: string;
}

interface FurnitureTileRefs {
  el: HTMLElement;
  buy: HTMLButtonElement;
  buyText: HTMLElement;
  place: HTMLButtonElement;
  count: HTMLElement;
}

type OpsTileKind = 'manager' | 'orders' | 'chain';

/** What the Decor tab asks the café to do: start placing a piece, or rearrange what's out. */
export type ArrangeRequest = { kind: 'place'; id: string } | { kind: 'arrange' };

const iconUrls = new WeakMap<HTMLCanvasElement, Map<number, string>>();
function iconUrl(key: string, make: () => HTMLCanvasElement): string {
  const art = iconArt(key);
  if (art) return art;
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
      return t(isTrafficCapped(state) ? 'effect.marketingCapped' : 'effect.marketing', { n: Math.round(arrivalRate(state) * DAY_SECONDS) });
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
    case 'pass':
      return t('effect.pass', { n: passCapacity(state) });
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
  private managerCard: { sub: HTMLElement; away: HTMLElement; franchise: HTMLElement; hire: HTMLButtonElement; auto: HTMLButtonElement; till: HTMLButtonElement; collect: HTMLButtonElement } | null = null;
  private chainCard: {
    sub: HTMLElement; status: HTMLElement; perks: HTMLElement; gain: HTMLElement; open: HTMLButtonElement;
    handover: HTMLElement; map: HTMLElement; placesNote: HTMLElement; places: HTMLElement; complete: HTMLElement; perksButton: HTMLButtonElement; placesSig: string;
  } | null = null;
  private ordersCard: { sub: HTMLElement; status: HTMLElement; options: Map<OrderKind, HTMLButtonElement>; collect: HTMLButtonElement } | null = null;
  private signature = '';
  private rows = new Map<string, RowRefs>();
  private tiles = new Map<string, TileRefs>();
  private furnitureTiles = new Map<string, FurnitureTileRefs>();
  private slotNotes = new Map<DecorSlot, HTMLElement>();
  private comfortVal: HTMLElement | null = null;
  private comfortTip: HTMLElement | null = null;
  private decorSpotsBox: HTMLElement | null = null;
  private decorSpotsFloor: HTMLElement | null = null;
  private decorSpotsWall: HTMLElement | null = null;
  private decorCategoryBtns = new Map<FurnishingCategory, HTMLButtonElement>();
  private opsGroupHint: HTMLElement | null = null;
  private opsTiles: Record<OpsTileKind, { btn: HTMLButtonElement; icon: HTMLElement; status: HTMLElement }> | null = null;
  private opsCards: Record<OpsTileKind, HTMLElement> | null = null;
  private opsDetail: HTMLElement | null = null;
  private openOpsTile: OpsTileKind | null = null;
  private goalSig = '';
  private expandedCards = new Set<string>();
  private pantryHelpOpen = false;
  private decorHelpOpen = false;
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
    private onVisitArea?: (area: AreaId) => void,
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
      const target = e.target as HTMLElement;
      if (target.closest('button[data-milestone-book]')) { showMilestoneBook(this.state); return; }
      if (target.closest('button[data-claim-chapter]')) {
        const reward = claimChapterWithToast(this.state);
        if (reward) { this.onPurchase('milestone', reward.chapter.id); this.update(); }
        return;
      }
      if (!target.closest('button[data-claim]')) return;
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
    if (tab !== previousTab) {
      this.scrollPositions.set(previousTab, readPanelScroll(this.list, this.scroller));
      this.expandedCards.clear();
      this.pantryHelpOpen = false;
      this.decorHelpOpen = false;
      this.openOpsTile = null;
    }
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
      petBrowsing: this.petBrowsing ? { group: this.petBrowsing.group, expanded: { ...this.petBrowsing.expanded } } : null,
      focusKey: focused && this.controlKey(focused) || this.lastFocus.get(this.tab) || null,
    };
  }

  restoreBrowsingContext(context: PanelBrowsingContext, focus = true): void {
    this.clearTablePreview();
    this.amount = context.amount;
    this.pantryAmount = context.pantryAmount;
    this.category = context.category;
    this.decorCategory = context.decorCategory;
    this.petBrowsing = context.petBrowsing ? { group: context.petBrowsing.group, expanded: { ...context.petBrowsing.expanded } } : null;
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
    this.root.dataset.activeTab = tab;
    // A hidden tab must always keep a way back; otherwise leave the whole row reachable.
    const hideOthers = this.introMode && this.simplifiedTabs;
    this.root.classList.toggle('intro-mode', hideOthers);
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((o) => {
      o.hidden = hideOthers && o.dataset.tab !== 'menu' && o.dataset.tab !== 'pantry';
      o.classList.toggle('active', o.dataset.tab === tab);
      o.setAttribute('aria-selected', String(o.dataset.tab === tab));
    });
    const buyAmount = this.root.querySelector<HTMLElement>('.buy-amount')!;
    buyAmount.hidden = this.introMode || tab === 'decor' || tab === 'pantry' || tab === 'pets' || tab === 'promotion';
    const buyLabel = buyAmount.querySelector<HTMLElement>(':scope > span');
    if (buyLabel) buyLabel.hidden = tab === 'menu';
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
    const unlocking = kind === 'item' && this.state.items[id as ItemId] === 0;
    const ok =
      kind === 'item' ? buyItem(this.state, id as ItemId, this.buyAmount) : buyUpgrade(this.state, id as UpgradeId, this.buyAmount);
    if (!ok) return;
    if (kind === 'upgrade' && id === 'tables') this.clearTablePreview();
    this.pop(btn.closest('.row'));
    this.onPurchase(kind, id);
    this.update();
    if (unlocking) toast(t('menu.unlockedOff', { item: displayItemName(id as ItemId, this.state) }));
  }

  private pop(el: Element | null): void {
    if (!el) return;
    el.classList.remove('pop');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('pop');
  }

  setState(state: GameState): void {
    this.clearTablePreview();
    this.expandedCards.clear();
    this.pantryHelpOpen = false;
    this.decorHelpOpen = false;
    this.openOpsTile = null;
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
    if (this.tab === 'upgrades') {
      return [
        'ugrp:staff', 'upgrade:barista', 'upgrade:server', 'upgrade:cook',
        'ugrp:shop', 'upgrade:marketing', 'upgrade:machine', 'upgrade:tables', 'upgrade:pass', 'room-projects',
        'ugrp:ops', 'ops-grid',
      ];
    }
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
    this.comfortVal = null;
    this.comfortTip = null;
    this.decorSpotsBox = null;
    this.decorSpotsFloor = null;
    this.decorSpotsWall = null;
    this.decorCategoryBtns.clear();
    this.opsGroupHint = null;
    this.opsTiles = null;
    this.opsCards = null;
    this.opsDetail = null;
    this.pantryNote = null;
    this.restockBtn = null;
    this.managerCard = null;
    this.ordersCard = null;
    this.chainCard = null;
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
    let grid: HTMLElement | null = null;
    let gridKind = '';
    const ensureGrid = (kind: 'menu' | 'pantry') => {
      if (!grid || gridKind !== kind) {
        grid = document.createElement('div');
        grid.className = `card-grid ${kind}-grid`;
        this.list.append(grid);
        gridKind = kind;
      }
      return grid;
    };
    for (const key of keys) {
      const [kind, id] = key.split(':');
      if (kind === 'ugrp') {
        grid = null; gridKind = '';
        const h = document.createElement('h3');
        h.className = 'menu-cat ugrp-head';
        h.dataset.upgradeGroup = id;
        h.innerHTML = `<span class="ugrp-title">${t(`upgrade.group.${id}` as MessageKey)}</span>${id === 'ops' ? `<small class="ugrp-hint" hidden>${t('upgrade.group.opsHint')}</small>` : ''}`;
        if (id === 'ops') this.opsGroupHint = h.querySelector('.ugrp-hint');
        this.list.append(h);
        continue;
      }
      if (kind === 'room-projects') {
        grid = null; gridKind = '';
        const button = document.createElement('button');
        button.className = 'pixel-btn ghost projects-entry';
        button.dataset.roomProjects = '';
        button.setAttribute('aria-haspopup', 'dialog');
        button.innerHTML = `<span class="projects-icon" data-floors-icon="map" aria-hidden="true"></span><span class="projects-label"></span><span class="projects-arrow" data-floors-icon="chevron" aria-hidden="true"></span>`;
        button.addEventListener('click', () => showStreetMap(this.state, () => { this.onPurchase('upgrade', 'room-projects'); this.update(); }, this.onVisitArea));
        this.list.append(button);
        continue;
      }
      if (kind === 'ops-grid') {
        grid = null; gridKind = '';
        this.buildOpsGrid();
        continue;
      }
      if (kind === 'signature-workbench') {
        grid = null; gridKind = '';
        const button = document.createElement('button');
        button.className = 'pixel-btn small ghost signature-entry';
        button.textContent = t('signature.entry');
        button.addEventListener('click', () => showSignatureDrinks(this.state, () => { this.onPurchase('recipe', 'signature'); this.refresh(); }));
        this.list.append(button);
        continue;
      }
      if (kind === 'style-prices') {
        grid = null; gridKind = '';
        const note = document.createElement('p');
        note.className = 'menu-style-prices note';
        note.textContent = t('style.menu.prices');
        this.list.append(note);
        continue;
      }
      if (kind === 'pantry') {
        grid = null; gridKind = '';
        this.buildPantryIntro();
        continue;
      }
      if (kind === 'variety') {
        grid = null; gridKind = '';
        const box = document.createElement('div');
        box.className = 'menu-intro';
        box.innerHTML = `<div class="menu-variety note"></div><button class="pixel-btn small ghost" data-bakeall>${t('bake.all')}</button>`;
        this.varietyNote = box.querySelector('.menu-variety');
        this.bakeAllBtn = box.querySelector('button');
        this.list.append(box);
        continue;
      }
      if (kind === 'cat') {
        grid = null; gridKind = '';
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
        el.classList.add('locked', 'menu-teaser-card');
        el.innerHTML = `<div class="icon mystery">?</div><div class="info"><div class="name">???</div><div class="sub">${t('row.teaser')}</div></div>`;
        ensureGrid('menu').append(el);
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
      if (isItem) {
        const expanded = this.expandedCards.has(key);
        const recipeHtml = `<div class="recipe">${recipe(id as ItemId)
          .map(
            ([ing, n]) =>
              `<img data-ingredient="${ing}" alt="${ingredientName(ing)}" title="${ingredientName(ing)}" src="${iconUrl(`ing:${ing}`, () => ingredientIcon(ing))}" />${n > 1 ? `<span>×${n}</span>` : ''}`,
          )
          .join('')}<b class="left"></b></div>`;
        el.classList.add('menu-item-row');
        if (expanded) el.classList.add('is-expanded');
        el.innerHTML = `
          <details class="card-details"${expanded ? ' open' : ''}>
            <summary class="card-face">
              <img class="icon" alt="" src="${src}" />
              <div class="name">${name}${isSpecialty(this.state, id as ItemId) ? ` <span class="specialty-tag">${t('menu.specialty')}</span>` : ''} <span class="lv"></span></div>
              <div class="card-price"></div>
              <div class="bar"><i></i></div>
              <div class="card-badge" hidden></div>
            </summary>
            <div class="card-more">
              <div class="sub"></div>
              <p class="note menu-tradeoff" hidden></p>
              ${recipeHtml}
              <button class="taste-chip" data-taste="${id}" aria-haspopup="dialog"><span class="taste-label"></span><small class="taste-progress"></small></button>
              ${
                isBakery(id as ItemId)
                  ? `<div class="bake"><span class="bake-label"></span>
                      <button class="chip bake-btn" data-bake="${id}:-1" aria-label="−${BAKE_STEP}">−</button>
                      <b class="bake-n"></b>
                      <button class="chip bake-btn" data-bake="${id}:1" aria-label="+${BAKE_STEP}">+</button>
                      <span class="bake-note"></span></div>`
                  : ''
              }
              <div class="menu-purchase-summary">
                <p class="menu-upgrade-preview" hidden></p>
                <button type="button" class="money-details" data-price-details="item:${id}" aria-haspopup="dialog"></button>
              </div>
            </div>
          </details>
          <div class="row-actions">
            <button class="pixel-btn buy" data-buy="item:${id}">
              <span class="label"></span><span class="btn-coin" aria-hidden="true"></span><span class="cost"></span>
            </button>
          </div>
          <button class="chip menu-toggle" data-menu="${id}" data-floors-icon="check"></button>`;
        const details = el.querySelector<HTMLDetailsElement>('.card-details')!;
        details.addEventListener('toggle', () => {
          if (details.open) this.expandedCards.add(key);
          else this.expandedCards.delete(key);
          el.classList.toggle('is-expanded', details.open);
        });
        ensureGrid('menu').append(el);
        this.rows.set(key, {
          el,
          level: el.querySelector('.lv'),
          sub: el.querySelector('.sub')!,
          bar: el.querySelector('.bar i'),
          pips: null,
          stamp: null,
          btn: el.querySelector('button[data-buy]')!,
          btnLabel: el.querySelector('.label')!,
          btnCost: el.querySelector('.cost')!,
          moneyDetails: el.querySelector('[data-price-details]')!,
          toggle: el.querySelector('button[data-menu]'),
          recipeBox: el.querySelector('.recipe'),
          recipe: el.querySelector('.recipe .left'),
          bake: el.querySelector('.bake'),
          taste: el.querySelector('button[data-taste]'),
          tradeoff: el.querySelector('.menu-tradeoff'),
          upgradePreview: el.querySelector('.menu-upgrade-preview'),
          cardPrice: el.querySelector('.card-price'),
          cardBadge: el.querySelector('.card-badge'),
          cardStock: null,
          cardUnit: null,
          cardNeed: null,
          details,
        });
        continue;
      }
      if (isIng) {
        const expanded = this.expandedCards.has(key);
        el.classList.add('pantry-item-row');
        if (expanded) el.classList.add('is-expanded');
        el.innerHTML = `
          <details class="card-details"${expanded ? ' open' : ''}>
            <summary class="card-face">
              <img class="icon" alt="" src="${src}" />
              <div class="name">${name}</div>
              <div class="card-stock"></div>
              <div class="card-unit"></div>
              <div class="bar"><i></i></div>
            </summary>
            <div class="card-more">
              <div class="card-need"></div>
              <div class="sub"></div>
              <button type="button" class="money-details" data-price-details="ing:${id}" aria-haspopup="dialog"></button>
            </div>
          </details>
          <div class="row-actions">
            <button class="pixel-btn buy" data-buy="ing:${id}">
              <span class="label"></span><span class="btn-coin" aria-hidden="true"></span><span class="cost"></span>
            </button>
          </div>`;
        const details = el.querySelector<HTMLDetailsElement>('.card-details')!;
        details.addEventListener('toggle', () => {
          if (details.open) this.expandedCards.add(key);
          else this.expandedCards.delete(key);
          el.classList.toggle('is-expanded', details.open);
        });
        ensureGrid('pantry').append(el);
        this.rows.set(key, {
          el,
          level: null,
          sub: el.querySelector('.sub')!,
          bar: el.querySelector('.bar i'),
          pips: null,
          stamp: null,
          btn: el.querySelector('button[data-buy]')!,
          btnLabel: el.querySelector('.label')!,
          btnCost: el.querySelector('.cost')!,
          moneyDetails: el.querySelector('[data-price-details]')!,
          toggle: null,
          recipeBox: null,
          recipe: null,
          bake: null,
          taste: null,
          tradeoff: null,
          upgradePreview: null,
          cardPrice: null,
          cardBadge: null,
          cardStock: el.querySelector('.card-stock'),
          cardUnit: el.querySelector('.card-unit'),
          cardNeed: el.querySelector('.card-need'),
          details,
        });
        continue;
      }
      grid = null; gridKind = '';
      const expanded = this.expandedCards.has(key);
      const udef = upgradeDef(id as UpgradeId);
      const usePips = udef.max <= 6;
      el.classList.add('urow');
      if (expanded) el.classList.add('is-expanded');
      el.dataset.upgrade = id;
      el.innerHTML = `
        <details class="card-details urow-details"${expanded ? ' open' : ''}>
          <summary class="urow-face">
            <div class="uic"><img class="icon" alt="" src="${src}" /></div>
            <div class="um">
              <div class="urow-head"><span class="name">${name}</span> <span class="lv"></span></div>
              ${usePips ? '<div class="upips" aria-hidden="true"></div>' : '<div class="bar ulv" aria-hidden="true"><i></i></div>'}
              <div class="udesc">${upgradeDesc(id as UpgradeId)}</div>
            </div>
          </summary>
          <div class="card-more urow-more">
            <div class="sub"></div>
            <div class="urow-more-actions">
              <button type="button" class="money-details" data-price-details="${kind}:${id}" aria-haspopup="dialog"></button>
              ${kind === 'upgrade' && id === 'tables' ? '<button type="button" class="chip" data-table-preview aria-pressed="false"></button>' : ''}
            </div>
          </div>
        </details>
        <div class="urow-action">
          <button class="pixel-btn buy ubtn" data-buy="${kind}:${id}">
            <span class="label"></span>
            <span class="ubtn-price"><span class="btn-coin" aria-hidden="true"></span><span class="cost"></span></span>
          </button>
          <span class="urow-stamp" hidden>${t('btn.maxed')}</span>
        </div>`;
      const details = el.querySelector<HTMLDetailsElement>('.urow-details')!;
      details.addEventListener('toggle', () => {
        if (details.open) this.expandedCards.add(key);
        else this.expandedCards.delete(key);
        el.classList.toggle('is-expanded', details.open);
      });
      this.list.append(el);
      this.rows.set(key, {
        el,
        level: el.querySelector('.lv'),
        sub: el.querySelector('.sub')!,
        bar: el.querySelector('.ulv i'),
        pips: el.querySelector('.upips'),
        stamp: el.querySelector('.urow-stamp'),
        btn: el.querySelector('button[data-buy]')!,
        btnLabel: el.querySelector('.label')!,
        btnCost: el.querySelector('.cost')!,
        moneyDetails: el.querySelector('[data-price-details]')!,
        toggle: null,
        recipeBox: null,
        recipe: null,
        bake: null,
        taste: null,
        tradeoff: null,
        upgradePreview: null,
        cardPrice: null,
        cardBadge: null,
        cardStock: null,
        cardUnit: null,
        cardNeed: null,
        details,
      });
    }
  }

  /** Three compact operations tiles (manager, catering orders, café chain) with a shared collapsible detail card below. */
  private buildOpsGrid(): void {
    const section = document.createElement('section');
    section.className = 'ops-section';
    const row = document.createElement('div');
    row.className = 'ops-tiles';
    const kinds: readonly OpsTileKind[] = ['manager', 'orders', 'chain'];
    const tiles = {} as Record<OpsTileKind, { btn: HTMLButtonElement; icon: HTMLElement; status: HTMLElement }>;
    for (const kind of kinds) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ops-tile';
      btn.dataset.opsTile = kind;
      btn.setAttribute('aria-expanded', String(this.openOpsTile === kind));
      btn.innerHTML = `<span class="ops-tile-ic" aria-hidden="true"></span><span class="ops-tile-name">${t(`${kind}.name` as MessageKey)}</span><span class="ops-tile-st"></span>`;
      btn.addEventListener('click', () => {
        this.openOpsTile = this.openOpsTile === kind ? null : kind;
        this.updateOpsGrid();
        // The tiles sit at the foot of the page, so the panel they open can land below the screen.
        if (this.openOpsTile) this.opsDetail?.scrollIntoView({ block: 'nearest' });
      });
      row.append(btn);
      tiles[kind] = { btn, icon: btn.querySelector('.ops-tile-ic')!, status: btn.querySelector('.ops-tile-st')! };
    }
    const detail = document.createElement('div');
    detail.className = 'ops-detail';
    detail.hidden = this.openOpsTile === null;
    const managerEl = this.buildManagerCard(detail);
    const ordersEl = this.buildOrdersCard(detail);
    const chainEl = this.buildChainCard(detail);
    section.append(row, detail);
    this.list.append(section);
    this.opsTiles = tiles;
    this.opsDetail = detail;
    this.opsCards = { manager: managerEl, orders: ordersEl, chain: chainEl };
  }

  private updateOpsGrid(): void {
    const s = this.state;
    const now = Date.now();
    if (this.opsGroupHint) this.opsGroupHint.hidden = s.manager.hired;
    if (this.opsTiles && this.opsDetail && this.opsCards) {
      // Manager tile
      const mUnlocked = managerUnlocked(s), mHired = s.manager.hired;
      const mWaiting = s.chain.franchises.length > 0 ? franchiseEarnings(s, now).amount : 0;
      const mLocked = !mHired && !mUnlocked;
      const mOpen = (!mHired && mUnlocked && s.coins >= MANAGER_COST) || (mHired && mWaiting > 0);
      const mStatus = mLocked
        ? t('manager.tile.locked', { n: MANAGER_UNLOCK_DAY })
        : !mHired
          ? `${t('manager.hire')} ${formatMoney(MANAGER_COST)}`
          : mWaiting > 0
            ? t('manager.tile.collect', { money: formatMoney(mWaiting) })
            : t('manager.hired');
      this.applyOpsTile('manager', mLocked ? 'lock' : 'people', mStatus, mLocked, mOpen);

      // Orders tile
      const active = s.orders.active, ready = orderReady(s, now);
      const oLocked = !mHired;
      const oOpen = !oLocked && !!active && ready;
      const oStatus = oLocked
        ? t('orders.tile.locked')
        : active
          ? ready ? t('orders.tile.claim', { money: formatMoney(active.payout) }) : formatDuration(orderLeft(s, now))
          : t('orders.tile.idle');
      this.applyOpsTile('orders', oLocked ? 'lock' : 'bag', oStatus, oLocked, oOpen);

      // Chain tile
      const cUnlocked = branchUnlocked(s), cCanOpen = canOpenBranch(s);
      const cLocked = !cUnlocked;
      const cStatus = cLocked
        ? t('chain.tile.locked')
        : cCanOpen
          ? t('chain.tile.open')
          : t('chain.tile.stars', { n: s.chain.stars });
      this.applyOpsTile('chain', cLocked ? 'lock' : 'star', cStatus, cLocked, cCanOpen);

      this.opsDetail.hidden = this.openOpsTile === null;
      for (const kind of ['manager', 'orders', 'chain'] as const) {
        const expanded = this.openOpsTile === kind;
        this.opsCards[kind].hidden = !expanded;
        this.opsTiles[kind].btn.classList.toggle('active', expanded);
        this.opsTiles[kind].btn.setAttribute('aria-expanded', String(expanded));
      }
    }
    this.updateManagerCard();
    this.updateOrdersCard();
    this.updateChainCard();
  }

  private applyOpsTile(kind: OpsTileKind, iconName: string, statusText: string, locked: boolean, open: boolean): void {
    const tile = this.opsTiles![kind];
    tile.icon.dataset.floorsIcon = iconName;
    tile.status.textContent = statusText;
    tile.btn.classList.toggle('is-locked', locked);
    tile.btn.classList.toggle('open', open);
  }

  /** The shop manager: hired once, then switched on or off; the till they fill grows with upgrades. */
  private buildManagerCard(host: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'row manager-card';
    el.innerHTML = `
      <div class="info">
        <div class="name">${t('manager.name')}</div>
        <div class="sub"></div>
        <div class="note manager-away"></div>
        <div class="note manager-franchise"></div>
      </div>
      <div class="row-actions">
        <button class="pixel-btn buy" data-manager-hire></button>
        <button class="pixel-btn buy" data-manager-till></button>
        <button class="pixel-btn buy" data-manager-collect></button>
        <button class="chip" data-manager-auto aria-pressed="true"></button>
      </div>`;
    const hire = el.querySelector<HTMLButtonElement>('[data-manager-hire]')!;
    const auto = el.querySelector<HTMLButtonElement>('[data-manager-auto]')!;
    const till = el.querySelector<HTMLButtonElement>('[data-manager-till]')!;
    const collect = el.querySelector<HTMLButtonElement>('[data-manager-collect]')!;
    hire.addEventListener('click', () => {
      if (!hireManager(this.state)) return;
      this.pop(el);
      this.onPurchase('upgrade', 'manager');
      this.update();
    });
    till.addEventListener('click', () => {
      if (!upgradeTill(this.state)) return;
      this.pop(el);
      this.onPurchase('upgrade', 'till');
      this.update();
    });
    collect.addEventListener('click', () => {
      const amount = collectFranchises(this.state, Date.now());
      if (amount <= 0) return;
      this.pop(el);
      toast(t('manager.collected', { money: formatMoney(amount) }));
      this.onPurchase('upgrade', 'franchise');
      this.update();
    });
    auto.addEventListener('click', () => {
      this.state.manager.auto = !this.state.manager.auto;
      this.onPurchase('upgrade', 'manager');
      this.update();
    });
    host.append(el);
    this.managerCard = { sub: el.querySelector('.sub')!, away: el.querySelector('.manager-away')!, franchise: el.querySelector('.manager-franchise')!, hire, auto, till, collect };
    return el;
  }

  private updateManagerCard(): void {
    const card = this.managerCard;
    if (!card) return;
    const s = this.state, { hired, auto } = s.manager, unlocked = managerUnlocked(s);
    card.sub.textContent = unlocked || hired ? t('manager.desc') : t('manager.locked', { n: MANAGER_UNLOCK_DAY });
    const hours = tillSeconds(s) / 3600, next = TILL_HOURS[s.manager.till + 1], cost = tillUpgradeCost(s);
    card.away.hidden = !hired;
    card.away.textContent = `${t('manager.away', { money: formatMoney(awayHourly(s)), hours, pct: Math.round(OVERFLOW_SHARE * 100) })}${cost === null ? ` ${t('manager.till.max', { hours })}` : ''}`;
    card.hire.hidden = hired;
    card.hire.textContent = `${t('manager.hire')} ${formatMoney(MANAGER_COST)}`;
    card.hire.disabled = !unlocked || s.coins < MANAGER_COST;
    card.till.hidden = !hired || cost === null;
    if (cost !== null) {
      card.till.textContent = `${t('manager.till', { hours, next })} ${formatMoney(cost)}`;
      card.till.disabled = s.coins < cost;
    }
    // Franchise pay fills the till on screen too, so it can be collected from here.
    const franchises = s.chain.franchises.length, waiting = franchiseEarnings(s, Date.now());
    card.franchise.hidden = card.collect.hidden = franchises === 0;
    if (franchises > 0) {
      card.franchise.textContent = `${t('manager.franchise', { n: franchises, money: formatMoney(franchiseHourly(s)), waiting: formatMoney(waiting.amount) })}${waiting.full ? ` ${t('manager.franchise.full')}` : ''}`;
      card.collect.textContent = t('manager.collect', { money: formatMoney(waiting.amount) });
      card.collect.disabled = waiting.amount <= 0;
    }
    card.auto.hidden = !hired;
    card.auto.textContent = t(auto ? 'manager.auto.on' : 'manager.auto.off');
    card.auto.setAttribute('aria-pressed', String(auto));
  }

  /** Catering orders: pick one on the way out, collect it when it's done. */
  private buildOrdersCard(host: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'row manager-card orders-card';
    el.innerHTML = `
      <div class="info">
        <div class="name">${t('orders.name')}</div>
        <div class="sub"></div>
        <div class="note orders-status"></div>
      </div>
      <div class="row-actions">
        ${ORDERS.map((o) => `<button class="pixel-btn buy" data-order="${o.id}"></button>`).join('')}
        <button class="pixel-btn buy" data-order-collect></button>
      </div>`;
    const options = new Map(ORDERS.map((o) => [o.id, el.querySelector<HTMLButtonElement>(`[data-order="${o.id}"]`)!]));
    for (const [kind, button] of options) button.addEventListener('click', () => {
      const order = startOrder(this.state, kind, Date.now());
      if (!order) return;
      this.pop(el);
      toast(t('orders.started', { name: t(`orders.${kind}`), time: formatDuration(orderLeft(this.state, Date.now())) }));
      this.onPurchase('upgrade', 'order');
      this.update();
    });
    const collect = el.querySelector<HTMLButtonElement>('[data-order-collect]')!;
    collect.addEventListener('click', () => {
      const order = collectOrder(this.state, Date.now());
      if (!order) return;
      this.pop(el);
      toast(t('orders.delivered', { name: t(`orders.${order.kind}`), money: formatMoney(order.payout) }));
      this.onPurchase('upgrade', 'order');
      this.update();
    });
    host.append(el);
    this.ordersCard = { sub: el.querySelector('.sub')!, status: el.querySelector('.orders-status')!, options, collect };
    return el;
  }

  private updateOrdersCard(): void {
    const card = this.ordersCard;
    if (!card) return;
    const s = this.state, now = Date.now(), active = s.orders.active, ready = orderReady(s, now);
    card.sub.textContent = s.manager.hired ? t('orders.desc') : t('orders.locked');
    card.status.hidden = !active && (!s.manager.hired || orderBlock(s, 'office') !== 'noMenu');
    card.status.textContent = active
      ? ready ? t('orders.ready', { name: t(`orders.${active.kind}`), money: formatMoney(active.payout) })
        : t('orders.active', { name: t(`orders.${active.kind}`), n: active.servings, item: displayItemName(active.item, s), time: formatDuration(orderLeft(s, now)) })
      : t('orders.noMenu');
    for (const [kind, button] of card.options) {
      const q = quoteOrder(s, kind);
      button.hidden = !!active || !q;
      if (!q) continue;
      const def = ORDERS.find((o) => o.id === kind)!;
      button.textContent = t('orders.option', { name: t(`orders.${kind}`), time: formatDuration(def.hours * 3600), money: formatMoney(q.payout - q.cost) });
      button.title = t('orders.terms', { n: q.servings, item: displayItemName(q.item, s), cost: formatMoney(q.cost), payout: formatMoney(q.payout) });
      button.disabled = orderBlock(s, kind) !== null;
    }
    card.collect.hidden = !ready;
    if (ready && active) card.collect.textContent = t('manager.collect', { money: formatMoney(active.payout) });
  }

  /** Opening a new branch; the game swaps in the new café (see main.ts). */
  private buildChainCard(host: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'row manager-card chain-card';
    el.innerHTML = `
      <div class="info">
        <div class="name">${t('chain.name')}</div>
        <div class="sub"></div>
        <div class="note chain-status"></div>
        <div class="note chain-perks"></div>
        <div class="note chain-gain"></div>
        <div class="note chain-handover"></div>
        <div class="chain-map">
          <p class="note chain-places-note"></p>
          <div class="chain-places-host"></div>
          <p class="note chain-complete"></p>
        </div>
      </div>
      <div class="row-actions">
        <button class="pixel-btn buy" data-open-branch></button>
        <button class="pixel-btn ghost" data-chain-perks></button>
      </div>`;
    const open = el.querySelector<HTMLButtonElement>('[data-open-branch]')!;
    open.addEventListener('click', () => {
      if (canOpenBranch(this.state)) this.root.dispatchEvent(new CustomEvent('open-branch', { bubbles: true }));
    });
    const perksButton = el.querySelector<HTMLButtonElement>('[data-chain-perks]')!;
    perksButton.addEventListener('click', () => showChainPerks(this.state, () => { this.onPurchase('upgrade', 'perk'); this.update(); }));
    host.append(el);
    this.chainCard = {
      sub: el.querySelector('.sub')!, status: el.querySelector('.chain-status')!, perks: el.querySelector('.chain-perks')!, gain: el.querySelector('.chain-gain')!, open,
      handover: el.querySelector('.chain-handover')!, map: el.querySelector('.chain-map')!, placesNote: el.querySelector('.chain-places-note')!,
      places: el.querySelector('.chain-places-host')!, complete: el.querySelector('.chain-complete')!, perksButton, placesSig: '',
    };
    return el;
  }

  private updateChainCard(): void {
    const card = this.chainCard;
    if (!card) return;
    const s = this.state, unlocked = branchUnlocked(s), stars = starsOnBranch(s);
    card.sub.textContent = unlocked ? t('chain.desc', { pct: chainBonusPercent(1), share: Math.round(FRANCHISE_SHARE * 100) }) : t('chain.locked');
    card.perks.hidden = !unlocked && s.chain.branches === 0;
    card.perks.textContent = t('chain.perks', { pct: Math.round(buildShare(s.chain.branches + 1) * 100) });
    card.status.hidden = s.chain.stars === 0 && s.chain.branches === 0;
    card.status.textContent = t('chain.status', { stars: s.chain.stars, bonus: chainBonusPercent(starsFree(s)), n: s.chain.branches + 1, place: locationName(cafeLocation(s)) });
    card.gain.hidden = !unlocked;
    card.gain.textContent = stars > 0
      ? `${t('chain.gain', { stars, money: formatMoney(branchEarnings(s)) })} ${t('chain.next', { money: formatMoney(nextStarAt(s) - branchEarnings(s)) })}${s.phase === 'prep' ? '' : ` ${t('chain.closedOnly')}`}`
      : t('chain.next', { money: formatMoney(STAR_EARNINGS - branchEarnings(s)) });
    card.open.hidden = !unlocked;
    card.open.textContent = t('chain.open');
    card.open.disabled = !canOpenBranch(s);
    // What handing this café over would add: the number that decides when to do it.
    card.handover.hidden = !unlocked;
    card.handover.textContent = t('chain.handover', { money: formatMoney(awayHourly(s) * FRANCHISE_SHARE), bonus: placeBonusText(cafeLocation(s)) });
    card.map.hidden = !unlocked && s.chain.branches === 0;
    card.placesNote.textContent = t('chain.places');
    const sig = s.chain.franchises.map((f) => f.location).join(',');
    if (sig !== card.placesSig) { card.placesSig = sig; card.places.replaceChildren(chainPlaces(s)); }
    card.complete.textContent = t(chainComplete(s) ? 'chain.completeDone' : 'chain.complete', { pct: completeBonusPercent() });
    card.perksButton.hidden = s.chain.stars === 0;
    card.perksButton.textContent = `${t('chain.perksOpen')} · ${starsFree(s)}★`;
  }

  private buildPantryIntro(): void {
    const intro = document.createElement('div');
    intro.className = 'pantry-intro';
    intro.innerHTML = `
      <div class="pantry-forecast"></div>
      <button class="pixel-btn restock" data-restock aria-describedby="pantry-restock-reason"></button>
      <div id="pantry-restock-reason" class="note restock-reason" hidden></div>
      <details class="pantry-help"${this.pantryHelpOpen ? ' open' : ''}>
        <summary>${t('pantry.noteLabel')}</summary>
        <div class="note">${t(this.introMode ? 'guide.pantryIntro' : 'pantry.intro')}</div>
      </details>`;
    this.pantryNote = intro.querySelector('.pantry-forecast');
    this.restockBtn = intro.querySelector('button');
    const help = intro.querySelector<HTMLDetailsElement>('.pantry-help')!;
    help.addEventListener('toggle', () => { this.pantryHelpOpen = help.open; });
    this.list.append(intro);
  }

  private furnishingCatalog(category: FurnishingCategory) {
    // Chain rewards appear once the chain has given them.
    return FURNITURE.filter((d) => d.category === category && (!d.reward || storedCount(this.state, d.id) + placedCount(this.state, d.id) > 0))
      .sort((a, b) => a.cost - b.cost);
  }

  private buildDecor(): void {
    // Top lavender comfort card: comfort number + tip % (linear, no next-tier bar).
    const comfortCard = document.createElement('section');
    comfortCard.className = 'decor-comfort';
    comfortCard.innerHTML = `
      <div class="comfort-left"><b class="comfort-val"></b><span class="comfort-label">${t('decor.comfortLabel')}</span></div>
      <div class="comfort-right"><b class="comfort-tip"></b><span class="comfort-tip-label">${t('decor.tipLabel')}</span></div>`;
    this.comfortVal = comfortCard.querySelector('.comfort-val');
    this.comfortTip = comfortCard.querySelector('.comfort-tip');
    this.list.append(comfortCard);

    // Category filter chips + compact floor/wall spot counts on the right.
    const bar = document.createElement('div');
    bar.className = 'decor-bar';
    const filters = document.createElement('nav');
    filters.className = 'decor-filter';
    filters.setAttribute('aria-label', t('decor.categories'));
    for (const category of ['decoration', 'furniture', 'renovation'] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip${this.decorCategory === category ? ' active' : ''}`;
      btn.dataset.decorCategory = category;
      btn.setAttribute('aria-pressed', String(this.decorCategory === category));
      btn.textContent = category === 'renovation'
        ? t(`decor.category.${category}`)
        : `${t(`decor.category.${category}`)} ${this.furnishingCatalog(category).length}`;
      if (category !== 'renovation') this.decorCategoryBtns.set(category, btn);
      filters.append(btn);
    }
    bar.append(filters);
    if (this.decorCategory !== 'renovation') {
      const spotsBox = document.createElement('div');
      spotsBox.className = 'decor-spots';
      spotsBox.hidden = true;
      spotsBox.innerHTML = `<span class="decor-spot-line" data-floors-icon="ground"><span class="decor-spots-floor"></span></span><span class="decor-spot-line" data-floors-icon="wallframe"><span class="decor-spots-wall"></span></span>`;
      this.decorSpotsBox = spotsBox;
      this.decorSpotsFloor = spotsBox.querySelector('.decor-spots-floor');
      this.decorSpotsWall = spotsBox.querySelector('.decor-spots-wall');
      bar.append(spotsBox);
    }
    this.list.append(bar);

    // Collapsible help note (matches pantry-help).
    const help = document.createElement('details');
    help.className = 'pantry-help decor-help';
    help.open = this.decorHelpOpen;
    const introKey = this.decorCategory === 'decoration' ? 'decor.decorationIntro' : this.decorCategory === 'furniture' ? 'furn.intro' : 'decor.intro';
    help.innerHTML = `<summary>${t('pantry.noteLabel')}</summary><div class="note"><p>${t(introKey)}</p>${this.decorCategory !== 'renovation' ? '<p class="furniture-spots" hidden></p>' : ''}</div>`;
    help.addEventListener('toggle', () => { this.decorHelpOpen = help.open; });
    this.list.append(help);

    if (this.decorCategory !== 'renovation') {
      const catalog = this.furnishingCatalog(this.decorCategory);
      const furniture = document.createElement('section');
      furniture.className = 'decor-slot furniture';
      const fgrid = document.createElement('div');
      fgrid.className = 'decor-grid';
      for (const def of catalog) {
        const tile = document.createElement('div');
        tile.className = 'tile dc';
        tile.dataset.furnishing = def.id;
        const metaParts = [t(`furn.surface.${def.surface}`)];
        if (!this.state.decor.building) metaParts.push(`${def.w}×${def.h}`);
        if (def.comfort > 0) metaParts.push(t('decor.comfort', { n: def.comfort }));
        tile.innerHTML = `
          <img class="tile-icon" alt="" src="${iconUrl(`furniture:${def.id}`, () => furnitureIcon(def.id))}" />
          <div class="tile-name">${decorName(def.id)}</div>
          <div class="tile-meta">${metaParts.join(' · ')}</div>
          <div class="tile-count" hidden></div>
          <div class="dc-actions">
            <button class="pixel-btn tile-btn ghost dc-place" data-furniture="place:${def.id}">${t('furn.goPlace')}</button>
            <button class="pixel-btn tile-btn dc-buy" data-furniture="buy:${def.id}"><span class="btn-coin" aria-hidden="true"></span><span class="buy-text"></span></button>
          </div>`;
        fgrid.append(tile);
        const place = tile.querySelector<HTMLButtonElement>('.dc-place')!;
        const buy = tile.querySelector<HTMLButtonElement>('.dc-buy')!;
        const buyText = tile.querySelector<HTMLElement>('.buy-text')!;
        this.furnitureTiles.set(def.id, { el: tile, buy, buyText, place, count: tile.querySelector('.tile-count')! });
      }
      furniture.append(fgrid);
      this.list.append(furniture);
      const footer = document.createElement('div');
      footer.className = 'decor-footer';
      footer.innerHTML = `<button class="pixel-btn a-plank woodbtn arrange-btn" data-furniture="arrange:" data-floors-icon="brush">${t('furn.arrange')}</button>`;
      this.list.append(footer);
      return;
    }

    for (const slot of DECOR_SLOTS) {
      const section = document.createElement('section');
      section.className = 'decor-slot';
      section.innerHTML = `<h3 class="menu-cat decor-slot-head"><span>${t(`slot.${slot}` as MessageKey)}</span><small class="slot-equipped"></small></h3><div class="decor-grid"></div>`;
      this.slotNotes.set(slot, section.querySelector('small')!);
      const grid = section.querySelector('.decor-grid')!;
      for (const def of decorForSlot(slot)) {
        const tile = document.createElement('div');
        tile.className = 'tile dc';
        tile.innerHTML = `
          <img class="tile-icon" alt="" src="${iconUrl(`decor:${def.id}`, () => decorIcon(def.id,this.state.decor.equipped.tablecloth,this.state.decor.equipped.centerpiece))}" />
          <div class="tile-name">${decorName(def.id)}</div>
          ${def.comfort > 0 ? `<div class="tile-meta">${t('decor.comfort', { n: def.comfort })}</div>` : ''}
          <div class="dc-actions">
            <button class="pixel-btn tile-btn dc-use" data-decor="${def.id}"><span class="btn-coin" aria-hidden="true" hidden></span><span class="buy-text"></span></button>
          </div>`;
        grid.append(tile);
        const btn = tile.querySelector<HTMLButtonElement>('button')!;
        this.tiles.set(def.id, { el: tile, btn, coin: tile.querySelector('.btn-coin')!, btnText: tile.querySelector('.buy-text')! });
      }
      this.list.append(section);
    }
  }

  private updateGoal(): void {
    if (this.tab !== 'menu' || this.pantryTask) {
      this.goalEl.hidden = true;
      return;
    }
    const goal = currentGoal(this.state);
    if (!goal && milestonesStarted(this.state)) {
      // After the guided goals, the same tape strip follows the café milestones.
      this.goalEl.hidden = false;
      const card = milestoneCard(this.state);
      const sig = `milestone|${card.sig}`;
      if (sig === this.goalSig) return;
      this.goalSig = sig;
      this.goalEl.classList.toggle('done', card.done);
      this.goalEl.innerHTML = card.html;
      return;
    }
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
    this.goalEl.innerHTML = done
      ? `<span class="tape-leaf" data-floors-icon="leaf" aria-hidden="true"></span>
         <div class="tape-body"><div class="goal-text">${t(`goal.${goal.id}` as MessageKey)}</div></div>
         <button class="pixel-btn small claim" data-claim>${t('goal.claim', { reward: formatMoney(goal.reward) })}</button>`
      : `<span class="tape-leaf" data-floors-icon="leaf" aria-hidden="true"></span>
         <div class="tape-body">
           <div class="goal-text">${t(`goal.${goal.id}` as MessageKey)}</div>
           <div class="goal-progress">${formatNumber(Math.min(cur, target))} / ${formatNumber(target)} · ${t('goal.reward', { reward: formatMoney(goal.reward) })}</div>
           <div class="bar"><i style="width:${pct}%"></i></div>
         </div>
         <div class="goal-head">${t('goal.label', { n: this.state.goal + 1, total: GOALS.length })}</div>`;
  }

  update(): void {
    const keys = this.visibleKeys();
    const sig = this.tab + '|' + this.introMode + '|' + keys.join(',');
    const rebuilt = sig !== this.signature;
    const focused = rebuilt ? this.focusedControl() : null;
    const atTop = this.scroller.scrollTop === 0;
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
      if (atTop) this.scroller.scrollTop = 0;
      else restorePanelScroll(this.list, this.scroller, scrollPosition);
    }
  }

  private updateContents(): void {
    const s = this.state;
    const projectLabel = this.list.querySelector('[data-room-projects] .projects-label');
    if (projectLabel) projectLabel.textContent = streetEntryLabel(s, Date.now());
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
      if (this.comfortVal) this.comfortVal.textContent = String(c);
      if (this.comfortTip) this.comfortTip.textContent = `+${Math.round((tipMultiplier(s) - 1) * 100)}%`;
      for (const [category, btn] of this.decorCategoryBtns) {
        const text = `${t(`decor.category.${category}`)} ${this.furnishingCatalog(category).length}`;
        if (btn.textContent !== text) btn.textContent = text;
      }
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
        refs.coin.hidden = equipped || owned;
        refs.btnText.textContent = equipped ? t('decor.inUse') : owned ? t('decor.use') : formatMoney(def.cost);
        refs.btn.disabled = equipped || (!owned && s.coins < def.cost);
        refs.btn.classList.toggle('ghost', owned && !equipped);
      }
      const spots = this.list.querySelector<HTMLElement>('.furniture-spots');
      const showSpots = this.decorCategory !== 'renovation' && !!s.decor.building;
      if (this.decorSpotsBox) this.decorSpotsBox.hidden = !showSpots;
      if (spots) spots.hidden = !showSpots;
      if (showSpots) {
        // In the building there are so many spots on each surface, more with every storey.
        const built = builtSpots(s), out = s.decor.placed.filter((p) => p.spot !== undefined);
        const count = (surface: Surface) => ({
          used: out.filter((p) => furnitureDef(p.id)?.surface === surface).length, total: built.filter((spot) => spot.surface === surface).length });
        const floor = count('floor'), wall = count('wall');
        if (this.decorSpotsFloor) this.decorSpotsFloor.textContent = t('furn.spotsFloor', { used: floor.used, total: floor.total });
        if (this.decorSpotsWall) this.decorSpotsWall.textContent = t('furn.spotsWall', { used: wall.used, total: wall.total });
        if (spots) {
          const text = t('furn.spots', { floorUsed: floor.used, floor: floor.total, wallUsed: wall.used, wall: wall.total })
            + (built.length < BUILDING_SPOTS.length ? t('furn.spotsMore') : '');
          if (spots.textContent !== text) spots.textContent = text;
        }
      }
      for (const [id, refs] of this.furnitureTiles) {
        const def = furnitureDef(id)!;
        const placed = placedCount(s, id);
        const stored = storedCount(s, id);
        const countText = placed > 0
          ? `✓ ${stored > 0 ? t('furn.count', { placed, stored }) : t('furn.out', { n: placed })}`
          : stored > 0
            ? t('furn.count', { placed, stored })
            : '';
        refs.count.textContent = countText;
        refs.count.hidden = !countText;
        // Starter pieces can't be bought again, only moved.
        refs.buy.hidden = def.cost === 0;
        refs.buyText.textContent = t('furn.buy', { price: formatMoney(def.cost) });
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
    this.updateOpsGrid();

    const prep = s.phase === 'prep';
    if (this.bakeAllBtn) {
      this.bakeAllBtn.hidden = !prep || !menuItems(s).some((m) => isBakery(m.id));
    }
    if (this.varietyNote) {
      this.varietyNote.textContent = t(demandEnabled(s) ? 'demand.menuSummary' : 'menu.variety', {
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
        const eligible = canPrepareItem(s, def.id);
        const bakery = isBakery(def.id);
        const left = servingsLeft(s, def.id);
        const displayPrice = level > 0
          ? formatMoney(itemPrice(def, level) * tipMultiplier(s) * chainPriceMultiplier(s, def.id))
          : formatMoney(def.basePrice * tipMultiplier(s));
        if (refs.level) refs.level.textContent = level > 0 ? `Lv ${level}` : '';
        if (refs.cardPrice) refs.cardPrice.textContent = displayPrice;
        refs.sub.hidden = !eligible;
        refs.sub.textContent = !eligible
          ? ''
          : level > 0
            ? t('row.each', {
                price: displayPrice,
                time: prepTime(s, def.id).toFixed(1),
                cost: formatMoney(servingCost(def.id)),
              })
            : t('row.sellsFor', { price: displayPrice });
        const next = nextMilestone(level);
        if (refs.bar) {
          const prev = [0, ...PRICE_MILESTONES].filter((m) => m <= level).pop() ?? 0;
          refs.bar.style.width = next ? `${((level - prev) / (next - prev)) * 100}%` : '100%';
          refs.bar.parentElement!.title = next ? t('row.milestone', { level: next }) : t('row.milestonesDone');
        }
        if (refs.cardBadge) {
          const badge = !eligible
            ? t('menu.requiresKitchen')
            : level > 0 && left < 1
              ? t(bakery ? 'bake.canBake' : 'menu.left', { n: formatNumber(left) })
              : '';
          refs.cardBadge.hidden = !badge;
          refs.cardBadge.textContent = badge;
        }
        refs.btnLabel.textContent = level === 0 ? t('btn.unlock') : q.count > 1 ? `+${q.count}` : t('btn.levelUp');
        refs.btnCost.textContent = formatMoney(q.cost);
        this.updateMoneyDetails(refs, q.cost);
        refs.btn.title = t('row.after', { before: formatMoney(itemPrice(def, level) * tipMultiplier(s) * chainPriceMultiplier(s, def.id)), after: formatMoney(itemPrice(def, level + q.count) * tipMultiplier(s) * chainPriceMultiplier(s, def.id)) });
        refs.btn.disabled = !q.affordable;
        refs.el.classList.toggle('new', level === 0);
        if (refs.upgradePreview) {
          refs.upgradePreview.hidden = !eligible || (level === 0 && q.count <= 1);
          refs.upgradePreview.textContent = refs.upgradePreview.hidden ? '' : t(level > 0 ? 'row.afterUpgrade' : 'row.afterUnlock', {
            price: formatMoney(itemPrice(def, level + q.count) * tipMultiplier(s) * chainPriceMultiplier(s, def.id)),
          });
        }
        const on = eligible && s.onMenu.includes(def.id);
        refs.el.classList.toggle('off-menu', level > 0 && !on);
        if (refs.tradeoff) {
          // Preview both demand and main-dish price; a lower average need not mean lower daily earnings.
          const today = menuItems(s), before = averageDishPrice(s, today);
          const after = eligible && !on && today.length ? averageDishPrice(s, [...today, def]) : before;
          if (demandEnabled(s)) {
            refs.tradeoff.hidden = !eligible || on || !today.length;
            if (!refs.tradeoff.hidden) {
              const next = [...today, def];
              const change = Math.round((menuTrafficMultiplier(s, next) * conditionTraffic(s, next) / (menuTrafficMultiplier(s, today) * conditionTraffic(s, today)) - 1) * 100);
              refs.tradeoff.textContent = t('demand.tradeoff', { before: formatMoney(before), after: formatMoney(after), change: `${change >= 0 ? '+' : ''}${change}%` });
            }
          } else {
            refs.tradeoff.hidden = after >= before - 0.005;
            if (!refs.tradeoff.hidden) refs.tradeoff.textContent = t(level === 0 ? 'menu.tradeoffNew' : 'menu.tradeoff', { before: formatMoney(before), after: formatMoney(after) });
          }
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
        if (refs.recipeBox) refs.recipeBox.hidden = !eligible;
        if (refs.recipe) {
          refs.recipe.hidden = !eligible;
          refs.recipe.textContent = eligible ? t(bakery ? 'bake.canBake' : 'menu.left', { n: formatNumber(left) }) : '';
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
        // Servers are limited by the rooms opened so far; the card says what opens more.
        const max = upgradeMax(s, def.id), roomBound = max < def.max;
        const maxed = level >= max;
        if (refs.level) {
          const lvText = def.id === 'cook'
            ? s.kitchen ? t('upgrade.cook.stage', { n: level + 1, total: def.max + 1 }) : ''
            : `${level}/${max}`;
          refs.level.textContent = lvText;
          refs.level.hidden = !lvText;
        }
        if (refs.pips) {
          const total = def.id === 'cook' ? def.max + 1 : max;
          const filled = def.id === 'cook' ? (s.kitchen ? level + 1 : 0) : level;
          const pipSig = `${filled}/${total}`;
          if (refs.pips.dataset.sig !== pipSig) {
            refs.pips.dataset.sig = pipSig;
            refs.pips.innerHTML = Array.from({ length: total }, (_, idx) => `<i${idx < filled ? ' class="on"' : ''}></i>`).join('');
          }
        } else if (refs.bar) {
          refs.bar.style.width = `${Math.min(100, (level / Math.max(1, max)) * 100)}%`;
        }
        const after = { ...s, upgrades: { ...s.upgrades, [def.id]: Math.min(max, level + q.count) } };
        // A locked upgrade has no "after" to preview, and money is not what it is waiting for.
        const locked = upgradeLocked(s, def.id);
        const cappedMarketing = def.id === 'marketing' && isTrafficCapped(s);
        refs.sub.textContent = `${upgradeEffect(s, def.id)}${maxed || locked || cappedMarketing ? '' : ` → ${upgradeEffect(after, def.id)}`}${maxed && roomBound ? ` · ${t('upgrade.server.roomLimit')}` : ''}`;
        refs.btn.hidden = maxed;
        if (refs.stamp) refs.stamp.hidden = !maxed;
        refs.btnLabel.textContent = q.count > 1 ? `+${q.count}` : t('btn.buy');
        refs.btnCost.textContent = formatMoney(q.cost);
        this.updateMoneyDetails(refs, q.cost, maxed || locked);
        refs.btn.disabled = maxed || !q.affordable;
      }
    }
  }

  private updatePantry(): void {
    const s = this.state;
    const needs = dayNeeds(s);
    const restockQ = restockQuote(s);
    const plan = restockPlan(s);
    if (this.pantryNote) this.pantryNote.textContent = t('pantry.forecast', { n: formatNumber(expectedCustomers(s)) }) + (restockQ.cost > s.coins ? ` · ${t('prep.partial', { money: formatMoney(s.coins) })}` : '');
    if (this.restockBtn) {
      const full = restockQ.cost <= 0;
      this.restockBtn.textContent = full ? t('pantry.full') : t(plan.missingCost > 0 ? 'pantry.budgetRestock' : 'pantry.restock', { price: formatMoney(plan.cost) });
      this.restockBtn.disabled = full || plan.cost <= 0;
      this.restockBtn.classList.toggle('is-complete', full);
      const reason = this.list.querySelector<HTMLElement>('.restock-reason');
      if (reason) {
        reason.hidden = full;
        const names = (items: typeof plan.buy) => Object.entries(items).map(([id, n]) => `${ingredientName(id as IngredientId)} ×${n}`).join(t('list.sep'));
        reason.textContent = full ? '' : t('pantry.plan', { items: names(plan.buy) || t('prep.noPurchase'), balance: formatMoney(plan.balance) })
          + (plan.missingCost > 0 ? ' ' + t('pantry.unmet', { items: names(plan.missing), price: formatMoney(plan.missingCost) }) : '');
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
      if (refs.level) refs.level.textContent = '';
      if (refs.cardStock) refs.cardStock.textContent = formatNumber(stock);
      if (refs.cardUnit) refs.cardUnit.textContent = `${t('pantry.stockLabel')} · ${t('pantry.unitPrice', { price: formatMoney(def.cost) })}`;
      if (refs.cardNeed) refs.cardNeed.textContent = t('pantry.need', { n: formatNumber(need) });
      refs.sub.innerHTML = t('pantry.usedBy', {
        items: usedBy(s, id)
          .map((m) => itemName(m.id))
          .join(t('list.sep')),
      });
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
