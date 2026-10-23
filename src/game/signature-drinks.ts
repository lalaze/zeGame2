import { INGREDIENTS, MENU, RECIPES, isDrink, type Category, type IngredientId } from './data';

export type SignatureId = `sig:${string}`;
export const SIGNATURE_BASES = ['coffee', 'tea', 'milk', 'fruit'] as const;
export type SignatureBase = typeof SIGNATURE_BASES[number];
export const BASE_INGREDIENT: Record<SignatureBase, IngredientId> = { coffee: 'beans', tea: 'tea', milk: 'milk', fruit: 'fruit' };
export const SIGNATURE_ADDONS = ['milk', 'sugar', 'spice', 'cocoa', 'cream', 'fruit', 'matcha'] as const;
export const MAX_SIGNATURE_RECIPES = 6;
export const MAX_SIGNATURE_MENU = 3;
export const SIGNATURE_TRIAL_PORTION = 0.25;
export type SignatureRecipe = Partial<Record<IngredientId, number>>;
export interface SignatureDrink { id: SignatureId; name: string; onMenu: boolean }
export interface SignatureState { recipes: SignatureDrink[]; tested: string[]; served: Record<string, number> }
/** Structural interface avoids importing state/economy and their initialization cycle. */
export interface SignatureGameState {
  trialSales?: { selected: string | null };
  phase: 'prep' | 'open' | 'closing';
  items: Partial<Record<string, number>>;
  pantry: Record<IngredientId, number>;
  kitchen: boolean;
  signatureDrinks?: SignatureState;
}
export type SignatureBlock = 'invalid' | 'incompatible' | 'locked' | 'open' | 'stock' | null;
export interface SignatureValidation { ok: boolean; error: SignatureBlock; id?: SignatureId }
export interface SignatureTrial extends SignatureValidation { missing: SignatureRecipe }
export interface SignatureDefinition {
  id: SignatureId; base: SignatureBase; category: Category;
  basePrice: number; prepTime: number; baseCost: number;
  recipe: SignatureRecipe; cost: number; quality: number; flavor: string[]; feedback: string[];
}
/** Renaming a single serving of espresso or black tea adds no new recipe value. */
export const isPlainSignatureCopy = (def: SignatureDefinition): boolean =>
  (def.base === 'coffee' || def.base === 'tea')
  && Object.keys(def.recipe).length === 1 && def.recipe[BASE_INGREDIENT[def.base]] === 1;
export const emptySignatureDrinks = (): SignatureState => ({ recipes: [], tested: [], served: {} });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const cleanName = (v: unknown): string => typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 24).join('') : '';

/** Zeros from form controls are ignored; all nonzero doses must be whole units. */
export function validateSignatureRecipe(base: unknown, recipe: unknown): SignatureValidation {
  const fail = (error: SignatureBlock): SignatureValidation => ({ ok: false, error });
  if (!SIGNATURE_BASES.includes(base as SignatureBase) || !record(recipe)) return fail('invalid');
  const b = base as SignatureBase;
  const primary = BASE_INGREDIENT[b];
  const entries = Object.entries(recipe).filter(([, n]) => n !== 0);
  if (!entries.length || entries.length > 4 || recipe[primary] !== 1 && recipe[primary] !== 2) return fail('invalid');
  for (const [key, n] of entries) {
    if (n !== 1 && n !== 2 || key !== primary && !(SIGNATURE_ADDONS as readonly string[]).includes(key)) return fail('invalid');
  }
  if (entries.reduce((sum, [, n]) => sum + (n as number), 0) > 6) return fail('invalid');
  // Fruit acidity muddies coffee/cocoa; strong matcha competes with coffee,
  // and cocoa masks a tea base. These are explicit gameplay recipe rules.
  if (incompatible(b, recipe)) return fail('incompatible');
  const encoded = entries.sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => `${key}=${n}`).join(',');
  return { ok: true, error: null, id: `sig:${b}:${encoded}` };
}
function incompatible(base: SignatureBase, recipe: Record<string, unknown>): boolean {
  return !!(base === 'coffee' && (recipe.fruit || recipe.matcha) || base === 'tea' && recipe.cocoa || recipe.fruit && recipe.cocoa);
}
/** Compatibility only; quantity/type caps are checked by validation. */
export function compatibleSignatureAddons(base: SignatureBase, recipe: SignatureRecipe = {}): IngredientId[] {
  return SIGNATURE_ADDONS.filter((ing) => ing !== BASE_INGREDIENT[base] && !incompatible(base, { ...recipe, [BASE_INGREDIENT[base]]: 1, [ing]: 1 }));
}
export const makeSignatureId = (base: SignatureBase, recipe: SignatureRecipe): SignatureId | null => validateSignatureRecipe(base, recipe).id ?? null;

/** The complete immutable recipe is encoded in the ID, so deleted drinks in
 * order queues and historical reports remain understandable after a reload. */
export function signatureDefinition(id: string): SignatureDefinition | null {
  if (typeof id !== 'string' || id.length > 160) return null;
  const parts = id.split(':');
  if (parts.length !== 3 || parts[0] !== 'sig') return null;
  const recipe: SignatureRecipe = {};
  for (const entry of parts[2].split(',')) {
    const match = /^([a-z]+)=([12])$/.exec(entry);
    if (!match || Object.hasOwn(recipe, match[1])) return null;
    recipe[match[1] as IngredientId] = Number(match[2]);
  }
  const validation = validateSignatureRecipe(parts[1], recipe);
  if (!validation.ok || validation.id !== id) return null;
  const base = parts[1] as SignatureBase;
  const cost = Object.entries(recipe).reduce((sum, [ing, n]) => sum + INGREDIENTS.find((i) => i.id === ing)!.cost * n, 0);
  const units = Object.values(recipe).reduce((sum, n) => sum + n, 0);
  const additions = Object.keys(recipe).length - 1;
  // Tea must steep just like the stock black tea. Preserve the existing coffee,
  // milk and fruit assembly rhythm; extra doses/additions still take more work.
  const basePrepTime = base === 'tea' ? MENU.find(item => item.id === 'blacktea')!.prepTime : 1.2;
  const flavor = [base === 'coffee' ? 'roasted' : base === 'tea' ? 'fragrant' : base === 'milk' ? 'creamy' : 'fruity'];
  if (recipe.sugar) flavor.push(recipe.sugar === 2 ? 'sweet' : 'lightly sweet');
  if ((recipe.milk || recipe.cream) && base !== 'milk') flavor.push('creamy');
  if (recipe.cocoa) flavor.push('chocolate');
  if (recipe.spice) flavor.push('spiced');
  if (recipe.matcha) flavor.push('earthy');
  if (recipe.fruit && base !== 'fruit') flavor.push('fruity');
  // A small sensory-quality difference makes richer, slower drinks useful
  // without changing their cost-based economy. One addon keeps a clear focus
  // (+0.1); double milk OR cream gives body (+0.2, never stacked). Double
  // sugar (-0.2) and spice (-0.1) overpower the base; three addons (-0.1)
  // muddy it. Bounded before practice bonuses so no formula grants mastery.
  const quality = Math.round(Math.max(3.7, Math.min(4.3, 4
    + (additions === 1 ? 0.1 : 0)
    + (recipe.milk === 2 || recipe.cream === 2 ? 0.2 : 0)
    - (recipe.sugar === 2 ? 0.2 : 0)
    - (recipe.spice === 2 ? 0.1 : 0)
    - (additions === 3 ? 0.1 : 0))) * 10) / 10;
  const feedback = [additions === 0 ? 'A clean, base-forward drink.' : additions >= 3 ? 'Layered flavors take longer to prepare.' : 'A focused blend with a clear base.'];
  if (recipe.sugar === 2) feedback.push('Extra sugar makes this noticeably sweeter.');
  if (recipe.cream === 2) feedback.push('Double cream gives a rich finish.');
  if (recipe.spice === 2) feedback.push('Double spice creates a bold, warming finish.');
  return { id: validation.id!, base, category: base === 'coffee' ? 'coffee' : 'tea', recipe, cost,
    basePrice: Math.round((cost * 1.6 + 2) * 100) / 100,
    prepTime: Math.round((basePrepTime + 0.35 * (units - 1) + 0.25 * additions) * 100) / 100,
    baseCost: 0, quality, flavor, feedback };
}

export const isSignatureId = (id: unknown): id is SignatureId => typeof id === 'string' && signatureDefinition(id) !== null;

/** Ingredients become available only through actually unlocked, usable menus. */
export function availableSignatureIngredients(state: SignatureGameState): IngredientId[] {
  const available = new Set<IngredientId>(['milk', 'sugar']);
  for (const m of MENU) {
    if (!(state.items[m.id]! > 0) || !state.kitchen && (!isDrink(m.category) || m.id === 'affogato' || m.id === 'matchafloat')) continue;
    for (const ing of Object.keys(RECIPES[m.id as keyof typeof RECIPES])) available.add(ing as IngredientId);
  }
  return INGREDIENTS.filter((i) => available.has(i.id)).map((i) => i.id);
}
const unlocked = (state: SignatureGameState, def: SignatureDefinition) => {
  const available = availableSignatureIngredients(state);
  return Object.keys(def.recipe).every((ing) => available.includes(ing as IngredientId));
};
export function trialSignature(state: SignatureGameState, base: SignatureBase, recipe: SignatureRecipe): SignatureTrial {
  if (state.phase !== 'prep') return { ok: false, error: 'open', missing: {} };
  const validation = validateSignatureRecipe(base, recipe);
  if (!validation.ok) return { ...validation, missing: {} };
  const def = signatureDefinition(validation.id!)!;
  if (!unlocked(state, def)) return { ...validation, ok: false, error: 'locked', missing: {} };
  const missing: SignatureRecipe = {};
  for (const [ing, n] of Object.entries(def.recipe) as [IngredientId, number][]) {
    const have = Number.isFinite(state.pantry[ing]) ? Math.max(0, state.pantry[ing]) : 0;
    if (have < n * SIGNATURE_TRIAL_PORTION) missing[ing] = n * SIGNATURE_TRIAL_PORTION - have;
  }
  if (Object.keys(missing).length) return { ...validation, ok: false, error: 'stock', missing };
  for (const [ing, n] of Object.entries(def.recipe) as [IngredientId, number][]) state.pantry[ing] -= n * SIGNATURE_TRIAL_PORTION;
  const signatures = state.signatureDrinks ??= emptySignatureDrinks();
  if (!signatures.tested.includes(def.id)) signatures.tested.push(def.id);
  return { ...validation, missing: {} };
}
export const listSignatureDrinks = (state: Pick<SignatureGameState, 'signatureDrinks'>): SignatureDrink[] => state.signatureDrinks?.recipes ?? [];
export function saveSignature(state: SignatureGameState, id: string, name: string): boolean {
  const def = signatureDefinition(id);
  const title = cleanName(name);
  const sig = state.signatureDrinks;
  if (state.phase !== 'prep' || !def || !title || !sig?.tested.includes(id) || !unlocked(state, def) || sig.recipes.length >= MAX_SIGNATURE_RECIPES || sig.recipes.some((r) => r.id === id)) return false;
  sig.recipes.push({ id: def.id, name: title, onMenu: false });
  return true;
}
/** Replace a saved slot atomically. Practice belongs to each immutable formula,
 * so changing a formula never copies its predecessor's serving count. */
export function replaceSignature(state: SignatureGameState, oldId: string, newId: string, name: string): boolean {
  if (state.phase !== 'prep' || !state.signatureDrinks) return false;
  const signatures = state.signatureDrinks;
  const index = signatures.recipes.findIndex((r) => r.id === oldId);
  const def = signatureDefinition(newId);
  const title = cleanName(name);
  if (index < 0 || !def || !title || !signatures.tested.includes(newId) || !unlocked(state, def) || signatures.recipes.some((r, i) => i !== index && r.id === newId)) return false;
  signatures.recipes[index] = { id: def.id, name: title, onMenu: signatures.recipes[index].onMenu };
  if (oldId !== newId && state.trialSales?.selected === oldId) state.trialSales.selected = null;
  return true;
}
export function renameSignature(state: SignatureGameState, id: string, name: string): boolean {
  const recipe = listSignatureDrinks(state).find((r) => r.id === id);
  const title = cleanName(name);
  if (state.phase !== 'prep' || !recipe || !title) return false;
  recipe.name = title;
  return true;
}
export function deleteSignature(state: SignatureGameState, id: string): boolean {
  if (state.phase !== 'prep' || !state.signatureDrinks) return false;
  const index = state.signatureDrinks.recipes.findIndex((r) => r.id === id);
  if (index < 0) return false;
  state.signatureDrinks.recipes.splice(index, 1);
  if (state.trialSales?.selected === id) state.trialSales.selected = null;
  return true;
}
export function setSignatureOnMenu(state: SignatureGameState, id: string, onMenu: boolean): boolean {
  const recipes = listSignatureDrinks(state);
  const recipe = recipes.find((r) => r.id === id);
  if (state.phase !== 'prep' || !recipe) return false;
  if (onMenu && !recipe.onMenu && (recipes.filter((r) => r.onMenu).length >= MAX_SIGNATURE_MENU || !unlocked(state, signatureDefinition(id)!))) return false;
  recipe.onMenu = onMenu;
  if (onMenu && state.trialSales?.selected === id) state.trialSales.selected = null;
  return true;
}

export function parseSignatureDrinks(value: unknown): SignatureState {
  const out = emptySignatureDrinks();
  if (!record(value)) return out;
  if (Array.isArray(value.tested)) for (const id of value.tested) {
    if (typeof id === 'string' && signatureDefinition(id) && !out.tested.includes(id)) out.tested.push(id);
  }
  if (record(value.served)) for (const [id, n] of Object.entries(value.served)) {
    if (signatureDefinition(id) && typeof n === 'number' && Number.isSafeInteger(n) && n > 0) out.served[id] = Math.min(1_000_000_000, n);
  }
  if (Array.isArray(value.recipes)) for (const recipe of value.recipes) {
    if (out.recipes.length >= MAX_SIGNATURE_RECIPES) break;
    if (!record(recipe) || typeof recipe.id !== 'string') continue;
    const def = signatureDefinition(recipe.id);
    const name = cleanName(recipe.name);
    if (!def || !name || !out.tested.includes(def.id) || out.recipes.some((r) => r.id === def.id)) continue;
    out.recipes.push({ id: def.id, name, onMenu: recipe.onMenu === true && out.recipes.filter((r) => r.onMenu).length < MAX_SIGNATURE_MENU });
  }
  return out;
}
