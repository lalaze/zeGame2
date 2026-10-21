import type { IngredientId, ItemId, UpgradeId } from './data';
import { CHAPTERS, claimableChapter } from './milestones';
import type { DayReport } from './day';
import { canPrepareItem, ingredientDef, isBakery, menuItems, prepTime, quoteUpgrade, recipe, restock, restockQuote, servingCost, servingsLeft, unlockedItems } from './economy';
import { currentGoal, goalDone } from './goals';
import { canEmergencyRestock } from './recovery';
import type { GameState } from './state';

export type SettlementTab = 'menu' | 'pantry' | 'upgrades' | 'decor' | 'pets' | 'promotion';
export type SettlementReasonKind = 'stock' | 'lowStock' | 'counter' | 'table' | 'stale' | 'promotion' | 'pets' | 'unfinished' | 'unfinishedBake' | 'unrecovered' | 'loss' | 'healthy' | 'empty';
export interface SettlementReason {
  kind: SettlementReasonKind;
  count?: number;
  extra?: number;
  amount?: number;
}
export type SettlementActionKind = 'claimGoal' | 'claimChapter' | 'restock' | 'useStock' | 'switchMenu' | 'restartRecipe' | 'emergency' | 'dayGoal' | 'ownedDecor' | 'reduceBake' | 'reviewBake' | 'pausePromotion' | 'skipPromotion' | 'petRefill' | 'keepPetRefillOff' | 'finishService' | 'watchPass' | 'upgrade' | 'helpCounter' | 'watchService' | 'keepGoing';
export interface SettlementAction {
  kind: SettlementActionKind;
  tab: SettlementTab;
  cost: number;
  item?: ItemId;
  ingredients?: Partial<Record<IngredientId, number>>;
  upgrade?: UpgradeId;
  amount?: number;
  goal?: string;
  reward?: number;
}
export interface SettlementAdvice {
  reasons: SettlementReason[];
  action: SettlementAction;
  /** The actual current forecast reserve, never an invented fixed cash cushion. */
  ingredientReserve: number;
  totalCost: number;
  /** Ingredient ledger remainder; includes work discarded without a completed sale. */
  unrecoveredIngredientCost: number;
  claimableGoal: { id: string; reward: number } | null;
}

const EPSILON = 1e-6;

/** Read-only guidance. It neither buys anything nor changes goals, saves or the economy. */
export function settlementAdvice(report: DayReport, state: GameState): SettlementAdvice {
  const totalCost = report.ingredientCost + report.petCost + report.promotionCost;
  const soldCost = (Object.entries(report.sales) as [ItemId, number][])
    .reduce((sum, [id, n]) => sum + servingCost(id) * n, 0);
  const unrecoveredIngredientCost = Math.max(0, report.ingredientCost - soldCost - report.staleCost);
  const staleCount = Object.values(report.stale).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  const cancelled = report.reviews.reasons.cancelled ?? 0;
  const onMenu = menuItems(state);
  const completedBakeCost = (Object.entries(report.baked) as [ItemId, number][])
    .reduce((sum, [id, n]) => sum + servingCost(id) * n, 0);
  const soldDrinkCost = (Object.entries(report.sales) as [ItemId, number][])
    .filter(([id]) => !isBakery(id))
    .reduce((sum, [id, n]) => sum + servingCost(id) * n, 0);
  // Batches are paid for at their start and recorded in `baked` only when
  // finished. Attribute the remainder to unfinished baking only when unpaid
  // drinks cannot explain it. With mixed menus and lost/cancelled orders the
  // ledger cannot distinguish a discarded drink from an unfinished batch.
  const noUnpaidDrinks = onMenu.every(({ id }) => isBakery(id)) || (!cancelled && !report.tableLost);
  const unfinishedBakeCost = state.kitchen && onMenu.some(({ id }) => isBakery(id)) && noUnpaidDrinks
    ? Math.max(0, report.ingredientCost - completedBakeCost - soldDrinkCost) : 0;
  const reasons: SettlementReason[] = [];
  if (report.profit < -EPSILON) reasons.push({ kind: 'loss', amount: -report.profit });
  if (report.soldOut || report.extraLost) reasons.push({ kind: 'stock', count: report.soldOut, extra: report.extraLost });
  else if (report.outOfStock.length) reasons.push({ kind: 'lowStock', count: report.outOfStock.length });
  if (report.queueLost || report.doorLost) reasons.push({ kind: 'counter', count: report.queueLost, extra: report.doorLost });
  if (report.tableLost) reasons.push({ kind: 'table', count: report.tableLost });
  if (staleCount) reasons.push({ kind: 'stale', count: staleCount, amount: report.staleCost });
  if (report.profit < -EPSILON) {
    if (report.promotionCost > EPSILON) reasons.push({ kind: 'promotion', amount: report.promotionCost });
    if (report.petCost > EPSILON) reasons.push({ kind: 'pets', amount: report.petCost });
  }
  if (cancelled) reasons.push({ kind: 'unfinished', count: cancelled });
  if (unfinishedBakeCost > EPSILON) reasons.push({ kind: 'unfinishedBake', amount: unfinishedBakeCost });
  if (unrecoveredIngredientCost > EPSILON) reasons.push({ kind: 'unrecovered', amount: unrecoveredIngredientCost });
  if (!reasons.length) reasons.push({ kind: report.served ? 'healthy' : 'empty' });

  const quote = restockQuote(state);
  const goal = currentGoal(state);
  const claimableGoal = goal && goalDone(state) ? { id: goal.id, reward: goal.reward } : null;
  const stocked = unlockedItems(state).filter(({ id }) => canPrepareItem(state, id) && servingsLeft(state, id) > 0)
    .sort((a, b) => prepTime(state, a.id) - prepTime(state, b.id));

  function nextAction(): SettlementAction {
    if (claimableGoal) return { kind: 'claimGoal', tab: 'menu', cost: 0, goal: claimableGoal.id, reward: claimableGoal.reward };
    const chapter = claimableChapter(state);
    if (chapter !== null) return { kind: 'claimChapter', tab: 'menu', cost: 0, goal: CHAPTERS[chapter].id };

    // Reproduce the existing affordable restock calculation on a private pantry.
    // A full forecast is never promised when only a partial top-up can be bought.
    if (quote.cost > EPSILON) {
      const projected = { ...state, pantry: { ...state.pantry } };
      if (restock(projected)) {
        const ingredients = Object.fromEntries((Object.keys(state.pantry) as IngredientId[])
          .map((id) => [id, projected.pantry[id] - state.pantry[id]])
          .filter(([, n]) => (n as number) > 0)) as Partial<Record<IngredientId, number>>;
        return { kind: 'restock', tab: 'pantry', cost: state.coins - projected.coins, ingredients };
      }
      const available = stocked.find(({ id }) => onMenu.some((m) => m.id === id)) ?? stocked[0];
      if (available) return { kind: onMenu.some((m) => m.id === available.id) ? 'useStock' : 'switchMenu', tab: 'menu', cost: 0, item: available.id };
    }

    // An empty menu or exhausted unaffordable recipe can still have a free or
    // cheaper route back to service. Do not direct a penniless café to upgrades.
    if (!onMenu.length || !onMenu.some(({ id }) => servingsLeft(state, id) > 0)) {
      if (stocked[0]) return { kind: 'switchMenu', tab: 'menu', cost: 0, item: stocked[0].id };
      const affordable = unlockedItems(state).filter(({ id }) => canPrepareItem(state, id)).map(({ id }) => ({
        id, cost: recipe(id).reduce((sum, [ing, n]) => sum + Math.max(0, Math.ceil(n - state.pantry[ing])) * ingredientDef(ing).cost, 0),
      })).filter(({ cost }) => cost > 0 && cost <= state.coins).sort((a, b) => a.cost - b.cost)[0];
      if (affordable) return { kind: 'restartRecipe', tab: 'menu', cost: affordable.cost, item: affordable.id };
      if (canEmergencyRestock(state)) return { kind: 'emergency', tab: 'pantry', cost: 0 };
      if (goal?.id === 'firstDay' || goal?.id === 'days5') return { kind: 'dayGoal', tab: 'menu', cost: 0, goal: goal.id, reward: goal.reward };
      if (goal?.id === 'comfort') return { kind: 'ownedDecor', tab: 'decor', cost: 0, reward: goal.reward };
    }

    if (cancelled || unfinishedBakeCost > EPSILON) return { kind: 'finishService', tab: 'menu', cost: 0 };
    if (staleCount) {
      // A dish that also ran short was baked at the wrong time, not too much: a smaller
      // batch would only add stock-outs, so it gets the schedule review instead.
      const short = (id: ItemId) => (report.shortages[id] ?? 0) > 0;
      const item = (Object.keys(report.stale) as ItemId[]).find((id) => state.onMenu.includes(id) && isBakery(id) && (state.bakePlan[id] ?? 0) > 0 && !short(id));
      const mistimed = (Object.keys(report.stale) as ItemId[]).find((id) => state.onMenu.includes(id) && isBakery(id) && short(id));
      if (!item && mistimed) return { kind: 'reviewBake', tab: 'menu', cost: 0, item: mistimed };
      if (item) return { kind: 'reduceBake', tab: 'menu', cost: 0, item, amount: Math.max(0, (state.bakePlan[item] ?? 0) - Math.max(1, report.stale[item] ?? 0)) };
      const bakery = onMenu.find(({ id }) => isBakery(id));
      return bakery ? { kind: 'reviewBake', tab: 'menu', cost: 0, item: bakery.id } : { kind: 'watchService', tab: 'menu', cost: 0 };
    }
    if (report.profit < -EPSILON && report.promotionCost > EPSILON) {
      return { kind: state.promotion && !state.promotion.paused ? 'pausePromotion' : 'skipPromotion', tab: state.promotion ? 'promotion' : 'menu', cost: 0 };
    }
    if (report.profit < -EPSILON && report.petCost > EPSILON) {
      return { kind: state.pets.some((pet) => pet.autoRefill) ? 'petRefill' : 'keepPetRefillOff', tab: 'pets', cost: 0 };
    }
    if (report.soldOut || report.extraLost) {
      const item = onMenu.find(({ id }) => isBakery(id) && (report.shortages[id] ?? 0) > 0);
      if (item) return { kind: 'reviewBake', tab: 'menu', cost: 0, item: item.id };
    }
    // Table losses alone do not prove a shortage of servers: production and
    // walkways can be responsible too. Ask for the free observation first.
    if (report.tableLost) return { kind: 'watchPass', tab: 'menu', cost: 0 };
    if (report.queueLost || report.doorLost) {
      const faster = stocked.find(({ id }) => onMenu.some((m) => prepTime(state, m.id) > prepTime(state, id)));
      if (faster) return { kind: 'switchMenu', tab: 'menu', cost: 0, item: faster.id };
      for (const upgrade of ['machine', 'barista'] as const) {
        const q = quoteUpgrade(state, upgrade, 1);
        if (q.affordable && q.count > 0 && q.cost + quote.cost <= state.coins) return { kind: 'upgrade', tab: 'upgrades', cost: q.cost, upgrade };
      }
      return { kind: 'helpCounter', tab: 'menu', cost: 0 };
    }
    if (unrecoveredIngredientCost > EPSILON) return { kind: 'watchService', tab: 'menu', cost: 0 };
    return { kind: 'keepGoing', tab: 'menu', cost: 0 };
  }

  return { reasons, action: nextAction(), ingredientReserve: quote.cost, totalCost, unrecoveredIngredientCost, claimableGoal };
}
