import { parseSignatureDrinks, signatureDefinition } from './signature-drinks';
import { INGREDIENTS, MENU, UPGRADES } from './data';
import { DECOR_SLOTS, decorDef } from './decor';
import { canPrepareItem, ingredientDef, recipe, servingsLeft, unlockedItems } from './economy';
import { CELL, COLS, FLOOR_ROWS, WALL_ROWS, canPlace, furnitureDef } from './furniture';
import { currentGoal, goalDone, GOALS } from './goals';
import { REGIONS, mainTableCount, regionOffset } from './regions';
import type { GameState } from './state';

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Fail closed on malformed state; this is a recovery aid, not a save repair. */
function finiteTree(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((child) => finiteTree(child, seen));
  seen.delete(value);
  return valid;
}

function validState(state: GameState): boolean {
  // Trial portions use quarters. Keep malformed/non-finite quantities rejected.
  const pantryAmount = (n: unknown) => amount(n) && Number.isSafeInteger(n * 4);
  const sig = state.signatureDrinks;
  if (!sig || !Array.isArray(sig.recipes) || !Array.isArray(sig.tested) || !sig.served || typeof sig.served !== 'object' || Array.isArray(sig.served)) return false;
  const parsed = parseSignatureDrinks(sig);
  if (parsed.recipes.length !== sig.recipes.length || parsed.tested.length !== sig.tested.length ||
    parsed.tested.some((id, index) => id !== sig.tested[index]) ||
    parsed.recipes.some((recipe, index) => recipe.id !== sig.recipes[index]?.id || recipe.name !== sig.recipes[index]?.name || recipe.onMenu !== sig.recipes[index]?.onMenu) ||
    Object.keys(parsed.served).length !== Object.keys(sig.served).length ||
    Object.entries(parsed.served).some(([id, n]) => n !== sig.served[id])) return false;
  if (!finiteTree(state) || !amount(state.coins) || !amount(state.totalEarned) || !count(state.served) ||
    !count(state.day) || state.day < 1 || !count(state.goal) || state.goal > GOALS.length ||
    typeof state.kitchen !== 'boolean' || !MENU.every(({ id }) => count(state.items[id])) || state.items.espresso < 1 ||
    !INGREDIENTS.every(({ id }) => pantryAmount(state.pantry[id])) ||
    !UPGRADES.every(({ id, max }) => count(state.upgrades[id]) && state.upgrades[id] <= max)) return false;
  const menuIds = new Set<string>(MENU.map(({ id }) => id));
  const ingredientIds = new Set(INGREDIENTS.map(({ id }) => id));
  if (Object.entries(state.items).some(([id, n]) => !menuIds.has(id) && !(signatureDefinition(id) && sig.tested.includes(id) && n === 1)) ||
    Object.keys(state.pantry).some((id) => !ingredientIds.has(id as typeof INGREDIENTS[number]['id'])) ||
    !Array.isArray(state.onMenu) || new Set(state.onMenu).size !== state.onMenu.length ||
    state.onMenu.some((id) => !menuIds.has(id) || state.items[id] < 1)) return false;
  for (const stock of [state.shelf, state.inProduction, state.bakePlan]) {
    if (!stock || typeof stock !== 'object' || Array.isArray(stock) ||
      Object.entries(stock).some(([id, n]) => !menuIds.has(id as typeof MENU[number]['id']) || !count(n))) return false;
  }
  if (!Array.isArray(state.regions) || state.regions.some((id, i) => id !== REGIONS[i]?.id)) return false;
  const decor = state.decor;
  if (!Array.isArray(decor.owned) || decor.owned.some((id) => !decorDef(id)) ||
    !DECOR_SLOTS.every((slot) => decor.owned.includes(decor.equipped[slot]) && decorDef(decor.equipped[slot])?.slot === slot) ||
    !Array.isArray(decor.placed) || decor.placed.some((p) => !p || !furnitureDef(p.id) || !count(p.col) || !count(p.row)) ||
    !decor.stored || typeof decor.stored !== 'object' || Array.isArray(decor.stored) ||
    Object.entries(decor.stored).some(([id, n]) => !furnitureDef(id) || !count(n))) return false;
  return true;
}

// Pure reachability results only. All live validity/stock/goal gates run before
// this cache. Counts and locations collapse to distinct ownership because every
// owned piece can be stored/moved freely; styles collapse to required comfort.
const comfortReachability = new Map<string, boolean>();

/** Prove a free comfort goal route using only actual legal furniture placements. */
function canReachOwnedComfort(state: GameState, target: number): boolean {
  const room = DECOR_SLOTS.reduce((sum, slot) => sum + Math.max(0,
    ...state.decor.owned.map((id) => decorDef(id)!).filter((d) => d.slot === slot).map((d) => d.comfort)), 0);
  const needed = target - room;
  if (needed <= 0) return true;
  const furniture = new Set([...state.decor.placed.map((p) => p.id),
    ...Object.entries(state.decor.stored).filter(([, n]) => n > 0).map(([id]) => id)]);
  const kinds = [...furniture].map((id) => furnitureDef(id)!).filter((d) => d.comfort > 0).sort((a, b) => a.id.localeCompare(b.id));
  if (kinds.reduce((sum, d) => sum + d.comfort, 0) < needed) return false;
  const tables = mainTableCount(state);
  const key = JSON.stringify([needed, tables, state.regions, kinds.map((d) => [d.id, d.surface, d.w, d.h, d.comfort])]);
  const cached = comfortReachability.get(key);
  if (cached !== undefined) return cached;
  const result = searchComfortLayout(state, needed, tables, kinds);
  // Bounded cache size is eviction only, never a limit on the exact search.
  if (comfortReachability.size >= 32) comfortReachability.delete(comfortReachability.keys().next().value!);
  comfortReachability.set(key, result);
  return result;
}

function searchComfortLayout(state: GameState, needed: number, tables: number, kinds: NonNullable<ReturnType<typeof furnitureDef>>[]): boolean {
  const empty = { ...state, decor: { ...state.decor, placed: [] } };
  // Identical footprints share placement choices. Choosing lower-comfort kinds
  // without the higher ones never helps; their positions may be swapped freely.
  const shapes = new Map<string, { def: typeof kinds[number]; comforts: number[] }>();
  for (const def of kinds) {
    const key = `${def.surface}:${def.w}:${def.h}`;
    const shape = shapes.get(key) ?? { def, comforts: [] };
    shape.comforts.push(def.comfort); shapes.set(key, shape);
  }
  const groups = [...shapes.values()];
  for (const group of groups) group.comforts.sort((a, b) => b - a);
  groups.sort((a, b) => b.comforts[0] - a.comforts[0]);
  const width = COLS * (REGIONS.length + 1);
  const candidates: { comfort: number; masks: bigint[]; groupEnd: number }[] = [];
  for (const { def, comforts } of groups) {
    const masks: bigint[] = [];
    const rows = def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
    const band = def.surface === 'wall' ? FLOOR_ROWS : 0;
    for (const area of ['main', ...state.regions] as const) {
      const start = regionOffset(area) / CELL;
      for (let col = start; col + def.w <= start + COLS; col++) {
        for (let row = 0; row + def.h <= rows; row++) {
          if (!canPlace(empty, def.id, col, row, tables)) continue;
          if (comforts[0] >= needed) return true;
          let mask = 0n;
          for (let x = col; x < col + def.w; x++) for (let y = row; y < row + def.h; y++) {
            mask |= 1n << BigInt((y + band) * width + x);
          }
          masks.push(mask);
        }
      }
    }
    if (!masks.length) continue;
    const groupEnd = candidates.length + comforts.length;
    for (const comfort of comforts) candidates.push({ comfort, masks, groupEnd });
    // A witness using any already-enumerated subset is sufficient. In particular
    // two useful pieces often avoid generating all lower-value kinds entirely.
    if (hasLayout(candidates, needed)) return true;
  }
  return false;
}

function hasLayout(candidates: { comfort: number; masks: bigint[]; groupEnd: number }[], needed: number): boolean {
  const remaining = new Array<number>(candidates.length + 1).fill(0);
  for (let i = candidates.length - 1; i >= 0; i--) remaining[i] = remaining[i + 1] + candidates[i].comfort;
  const impossible = new Set<string>();
  const search = (index: number, shortfall: number, occupied: bigint, firstMask: number): boolean => {
    if (shortfall <= 0) return true;
    if (remaining[index] < shortfall) return false;
    const key = `${index}:${shortfall}:${occupied.toString(16)}:${firstMask}`;
    if (impossible.has(key)) return false;
    // An admissible bound: count each remaining kind only if at least one of
    // its placements is still free. It may overestimate simultaneous packing.
    let available = 0;
    for (let i = index; i < candidates.length && available < shortfall; i++) {
      const from = i < candidates[index].groupEnd ? firstMask : 0;
      if (candidates[i].masks.some((mask, j) => j >= from && (occupied & mask) === 0n)) available += candidates[i].comfort;
    }
    if (available < shortfall) return false;
    const candidate = candidates[index];
    for (let j = firstMask; j < candidate.masks.length; j++) {
      const mask = candidate.masks[j];
      // Canonical ordering eliminates permutations of identical footprints.
      const nextMask = index + 1 < candidate.groupEnd ? j + 1 : 0;
      if ((occupied & mask) === 0n && search(index + 1, shortfall - candidate.comfort, occupied | mask, nextMask)) return true;
    }
    if (search(candidate.groupEnd, shortfall, occupied, 0)) return true;
    impossible.add(key);
    return false;
  };
  // No time/node cap: an exhausted finite search is an actual impossibility proof.
  return search(0, needed, 0n, 0);
}

/** A single bean is available only when ordinary stock, shopping and free goals cannot help. */
export function canEmergencyRestock(state: GameState): boolean {
  try {
    if (!state || state.phase !== 'prep' || !validState(state)) return false;
    // Espresso needs a full bean; trial leftovers alone cannot make a serving.
    // At $1 or more a bean can be bought normally;
    // below $1 every paid goal prerequisite in the current catalog is unaffordable.
    if (state.pantry.beans >= 1 || state.coins >= ingredientDef('beans').cost) return false;
    // In-flight paid work blocks aid. Legacy shelf stock suspended before a
    // kitchen is built cannot be sold, so only accessible shelf stock counts.
    if (Object.values(state.inProduction).some((n) => (n ?? 0) > 0)) return false;
    for (const { id } of unlockedItems(state).filter((m) => canPrepareItem(state, m.id))) {
      if ((state.shelf[id] ?? 0) > 0 || servingsLeft(state, id) >= 1) return false;
      const deficitCost = recipe(id).reduce((sum, [ing, n]) => sum + Math.max(0, Math.ceil(n - state.pantry[ing])) * ingredientDef(ing).cost, 0);
      if (deficitCost <= state.coins) return false;
    }
    if (goalDone(state)) return false;
    const goal = currentGoal(state);
    // Opening/closing an empty day is free, including after selecting espresso.
    if (goal?.id === 'firstDay' || goal?.id === 'days5') return false;
    if (goal?.id === 'comfort' && canReachOwnedComfort(state, goal.progress(state)[1])) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true only for an actual grant. Enables the existing espresso recipe
 * without removing other menu selections. The bean itself prevents a second
 * grant until it is consumed; no money, debt or persistent allowance is created.
 */
export function emergencyRestock(state: GameState): boolean {
  if (!canEmergencyRestock(state)) return false;
  state.pantry.beans += 1;
  if (!state.onMenu.includes('espresso')) state.onMenu.push('espresso');
  return true;
}
