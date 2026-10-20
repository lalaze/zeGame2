import type { IngredientId } from '../game/data';
import type { GameState } from '../game/state';
import {
  SIGNATURE_BASES, SIGNATURE_ADDONS, BASE_INGREDIENT, MAX_SIGNATURE_RECIPES, MAX_SIGNATURE_MENU,
  availableSignatureIngredients, compatibleSignatureAddons, validateSignatureRecipe, makeSignatureId, signatureDefinition,
  trialSignature, saveSignature, replaceSignature, renameSignature, deleteSignature, setSignatureOnMenu, listSignatureDrinks,
} from '../game/signature-drinks';
import { formatTransactionMoney as money } from '../game/format';
import { salePrice, prepTime } from '../game/economy';
import { tasteScore, tasteTier, SKILLED_SERVINGS, SIGNATURE_SERVINGS } from '../game/taste';
import { getLocale } from '../i18n';
import { signatureDrinkArt, type SignatureArtKey } from '../render/signature-drink-art';
import { showModal, closeModal } from './modal';
import { isComposingKey } from './keyboard';

type Base = typeof SIGNATURE_BASES[number];
type Recipe = Partial<Record<IngredientId, number>>;
const copy = {
  en: {
    doseRules: 'Base: 1–2 portions. Each addition: 0–2 portions. Up to 3 addition types and 6 portions in total.', pairingRules: 'Game pairing rules: coffee cannot pair with fruit or matcha; tea cannot pair with cocoa; fruit and cocoa cannot mix. Incompatible additions are hidden.', quality: 'Recipe quality', rating: 'Current taste', practice: 'Recipe practice', delivered: 'Servings delivered', standard: 'New recipe', skilled: 'Practiced', signature: 'Mastered', next: 'Next milestone', growth: 'Practice grows only when a customer receives this drink. Tastings, saving and renaming give no experience. At 30 deliveries it becomes practiced; at 100 it masters automatically, with no research fee.', mastered: 'Mastery reached. Keep serving your house favorite.', edit: 'Edit formula', title: 'Signature drinks', close: 'Close', create: 'Develop a drink', empty: 'Your recipe book is waiting for its first drink.',
    intro: 'Create a house recipe, taste a small sample, then save it to your collection.', collection: 'Recipe book', back: 'Back to recipes',
    base: '1 · Choose a base', additions: '2 · Add ingredients', preview: '3 · Taste & refine', name: '4 · Name your drink',
    prep: 'Research and menu changes are available during preparation only.', locked: 'Unlock a menu recipe using this ingredient first.',
    dose: 'Dose', none: 'None', light: '1 portion', extra: '2 portions', cost: 'Ingredients / serving', price: 'Current sale price', time: 'Current preparation time', margin: 'Ingredient margin / serving',
    ingredients: 'Ingredients per serving', trial: 'Taste ¼ serving', trialRule: 'Each tasting uses exactly ¼ of the listed ingredients. No extra cash fee.',
    shortage: 'Missing for a tasting', tasted: 'Tasting complete. You can now name and save this recipe.', save: 'Save recipe',
    placeholder: 'A name for your house drink', invalid: 'Choose a valid recipe: at most 3 additions and 6 total portions.',
    incompatible: 'These ingredients do not pair with this base.', full: 'Recipe book full. Delete a recipe before saving another.',
    saved: 'Recipe saved.', duplicate: 'This recipe is already in your book. Open it to rename or list it.',
    listed: 'On the menu', unlisted: 'Not on the menu', list: 'Add to menu', unlist: 'Remove from menu',
    menuFull: 'Three signature drinks are already on the menu. Remove one first.', rename: 'Rename', remove: 'Delete recipe',
    confirm: 'Delete this recipe from your book and menu?', cancel: 'Keep recipe', detail: 'Recipe details', failed: 'Could not save that change. Check the name, capacity and preparation phase.',
    book: 'saved', menu: 'on menu', feedback: 'Flavor notes', estimated: 'Current café bonuses included. Standard takeaway sale, before VIP or dine-in bonuses. Ingredient margin excludes other running costs.',
  },
  zh: {
    doseRules: '基底用量为 1–2 份，每种配料为 0–2 份；最多 3 种配料，总用量不超过 6 份。', pairingRules: '游戏搭配规则：咖啡不能搭配水果或抹茶，茶不能搭配可可，水果与可可不能混用。不兼容的配料会隐藏。', quality: '配方基础品质', rating: '当前口味评分', practice: '配方熟练度', delivered: '已交付杯数', standard: '新配方', skilled: '熟练', signature: '招牌大师', next: '下一目标', growth: '只有顾客实际收到饮品才会增加熟练度。试饮、保存和改名均不增加经验。交付 30 杯后熟练，100 杯后自动精通，无需支付研发费。', mastered: '已精通这款配方，继续为顾客送上你的招牌风味吧。', edit: '调整配方', title: '招牌饮品', close: '关闭', create: '研发饮品', empty: '配方本正等待你的第一款饮品。',
    intro: '搭配专属配方，少量试饮，再收入你的配方本。', collection: '配方本', back: '返回配方本',
    base: '1 · 选择基底', additions: '2 · 添加配料', preview: '3 · 试饮与调整', name: '4 · 为饮品取名',
    prep: '仅可在准备营业时研发饮品和调整菜单。', locked: '先解锁使用此食材的菜单配方。',
    dose: '用量', none: '不添加', light: '1 份', extra: '2 份', cost: '每杯食材成本', price: '当前售价', time: '当前制作时间', margin: '每杯食材毛利',
    ingredients: '每杯所需食材', trial: '试饮 ¼ 杯', trialRule: '每次试饮准确消耗所列食材的 ¼，不额外收取现金。',
    shortage: '试饮缺少', tasted: '试饮完成，可以取名并保存配方了。', save: '保存配方',
    placeholder: '为你的招牌饮品取个名字', invalid: '请使用有效配方：最多 3 种配料，总用量不超过 6 份。',
    incompatible: '这些配料不适合此基底。', full: '配方本已满，请先删除一款配方。',
    saved: '配方已保存。', duplicate: '配方本已有此配方，可打开详情改名或上架。',
    listed: '已上架', unlisted: '未上架', list: '加入菜单', unlist: '移出菜单',
    menuFull: '已有 3 款招牌饮品上架，请先移出一款。', rename: '改名', remove: '删除配方',
    confirm: '从配方本和菜单中删除此配方？', cancel: '保留配方', detail: '配方详情', failed: '未能保存更改，请检查名称、数量限制与营业阶段。',
    book: '款已保存', menu: '款已上架', feedback: '风味笔记', estimated: '已计入当前咖啡馆加成。按普通外带订单计算，不含贵宾或堂食加成。食材毛利未扣除其他运营成本。',
  },
};
const ingredientNames: Record<SignatureArtKey, [string, string]> = {
  coffee: ['Coffee', '咖啡'], beans: ['Coffee beans', '咖啡豆'], tea: ['Tea', '茶'], milk: ['Milk', '牛奶'], fruit: ['Fruit', '水果'],
  sugar: ['Sugar', '糖'], spice: ['Spice', '香料'], cocoa: ['Cocoa', '可可'], cream: ['Cream', '奶油'], matcha: ['Matcha', '抹茶'],
  flour: ['Flour', '面粉'], butter: ['Butter', '黄油'], eggs: ['Eggs', '鸡蛋'],
};
const label = (id: SignatureArtKey) => ingredientNames[id][getLocale() === 'zh' ? 1 : 0];
const zhNotes: Record<string, string> = {
  roasted: '烘焙香', fragrant: '清香', creamy: '奶香', fruity: '果香', sweet: '甜润', 'lightly sweet': '微甜', chocolate: '巧克力香', spiced: '香料味', earthy: '草木香',
  'A clean, base-forward drink.': '口感纯净，突出基底风味。',
  'Layered flavors take longer to prepare.': '风味层次丰富，制作也需要更长时间。',
  'A focused blend with a clear base.': '搭配协调，基底风味清晰。',
  'Extra sugar makes this noticeably sweeter.': '加倍的糖带来明显的甜味。',
  'Double cream gives a rich finish.': '双份奶油带来浓郁余味。',
  'Double spice creates a bold, warming finish.': '双份香料带来浓烈而温暖的余味。',
};
const flavorText = (text: string) => getLocale() === 'zh' ? (zhNotes[text] ?? text) : text;
const amount = (n: number) => String(n);
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = cls; return node;
}
function art(id: SignatureArtKey): HTMLImageElement {
  const image = document.createElement('img'); image.src = signatureDrinkArt(id); image.alt = ''; image.width = 48; image.height = 48; return image;
}

/** A single mounted dialog isolates focus; every mutation is checked against live state. */
/** `onClose` reopens whatever dialog led here, such as Prepare, instead of dropping back to the room. */
export function showSignatureDrinks(state: GameState, onChange: () => void, onClose?: () => void): void {
  const words = copy[getLocale()];
  const root = element('div', '', 'signature-research');
  let base: Base = 'coffee';
  let recipe: Recipe = { beans: 1 };
  let tastedId: string | null = null;
  let editingId: string | null = null;
  let draftName = '';
  let notice = '';
  const prep = () => state.phase === 'prep';
  function button(text: string, key: string, action: () => void, disabled = false): HTMLButtonElement {
    const node = element('button', text, 'pixel-btn ghost'); node.type = 'button'; node.dataset.signatureAction = key; node.disabled = disabled;
    node.addEventListener('click', () => { if (root.isConnected && node.isConnected && root.contains(node)) action(); }); return node;
  }
  function page(...nodes: Node[]): void {
    root.replaceChildren(...nodes);
    const body = root.closest<HTMLElement>('.modal-body'); if (body) body.scrollTop = 0;
    const heading = root.querySelector<HTMLElement>('h3'); if (heading && root.isConnected) { heading.tabIndex = -1; heading.focus(); }
  }
  function status(): HTMLElement { const node = element('p', notice || (!prep() ? words.prep : ''), 'signature-status'); node.setAttribute('role', 'status'); return node; }
  function ingredients(value: Recipe, scale = 1): HTMLElement {
    const list = element('ul', '', 'signature-ingredients');
    for (const [key, n] of Object.entries(value)) if (n && n > 0) {
      const item = element('li'); item.append(art(key as IngredientId), element('span', `${label(key as IngredientId)} × ${amount(n * scale)}`)); list.append(item);
    }
    return list;
  }
  function showList(): void {
    const drinks = listSignatureDrinks(state);
    const cards = element('div', '', 'signature-cards');
    for (const drink of drinks) {
      const def = signatureDefinition(drink.id); if (!def) continue;
      const card = element('section', '', 'signature-card'); card.dataset.signatureRecipe = drink.id;
      const info = element('div'); info.append(element('h4', drink.name), element('p', drink.onMenu ? words.listed : words.unlisted, 'note'));
      card.append(art(def.base), info, button(words.detail, `detail:${drink.id}`, () => showDetail(drink.id))); cards.append(card);
    }
    if (!drinks.length) cards.append(element('p', words.empty, 'note'));
    page(element('h3', words.collection), element('p', words.intro, 'note'), element('p', `${drinks.length}/${MAX_SIGNATURE_RECIPES} ${words.book} · ${drinks.filter(d => d.onMenu).length}/${MAX_SIGNATURE_MENU} ${words.menu}`, 'signature-count'), status(), cards,
      button(words.create, 'create', () => { base = 'coffee'; recipe = { beans: 1 }; tastedId = null; editingId = null; draftName = ''; notice = ''; showWorkbench(); }, !prep() || drinks.length >= MAX_SIGNATURE_RECIPES));
  }
  function summary(id: string): HTMLElement {
    const def = signatureDefinition(id)!;
    const section = element('section', '', 'signature-summary');
    const metrics = element('dl', '', 'signature-metrics');
    for (const [title, value] of [[words.cost, money(def.cost)], [words.price, money(salePrice(state, def.id))], [words.time, `${amount(prepTime(state, def.id))}s`], [words.margin, money(salePrice(state, def.id) - def.cost)]]) metrics.append(element('dt', title), element('dd', value));
    const delivered = state.signatureDrinks.served[def.id] ?? 0;
    const tier = tasteTier(state, def.id);
    const growth = element('section', '', 'signature-growth');
    growth.append(element('h4', words.practice), element('p', `${words.rating}: ${tasteScore(state, def.id).toFixed(1)} / 5 · ${words[tier]}`, 'signature-taste'), element('p', `${words.quality}: ${def.quality.toFixed(1)} / 5`, 'note'), element('p', `${words.delivered}: ${delivered}`, 'signature-delivered'), element('p', tier === 'signature' ? words.mastered : `${words.next}: ${delivered} / ${tier === 'standard' ? SKILLED_SERVINGS : SIGNATURE_SERVINGS}`, 'signature-next'), element('p', words.growth, 'note'));
    section.append(metrics, growth, element('p', words.estimated, 'note'), element('h4', words.feedback), element('p', def.flavor.map(flavorText).join(' · '), 'signature-flavor'), ...def.feedback.map(note => element('p', flavorText(note), 'note')), element('h4', words.ingredients), ingredients(def.recipe));
    return section;
  }
  function showWorkbench(focusKey?: string): void {
    const unlocked = availableSignatureIngredients(state);
    const bases = element('div', '', 'signature-bases');
    for (const value of SIGNATURE_BASES) {
      const unlockedBase = unlocked.includes(BASE_INGREDIENT[value]);
      const b = button(label(value), `base:${value}`, () => { base = value; recipe = { [BASE_INGREDIENT[value]]: 1 }; tastedId = null; notice = ''; showWorkbench(`base:${value}`); }, !prep() || !unlockedBase);
      b.prepend(art(value)); b.setAttribute('aria-pressed', String(base === value)); if (!unlockedBase) b.title = words.locked; bases.append(b);
    }
    const doses = element('div', '', 'signature-doses');
    function dose(id: IngredientId, isBase = false): void {
      // Check compatibility with one addition in isolation, independent of current limits.
      if (!isBase && !recipe[id] && !compatibleSignatureAddons(base, recipe).includes(id)) return;
      const row = element('label', '', 'signature-dose'); row.append(art(id), element('span', label(id)));
      const select = document.createElement('select'); select.dataset.signatureDose = id; select.setAttribute('aria-label', `${label(id)} · ${words.dose}`);
      for (const n of isBase ? [1, 2] : [0, 1, 2]) { const option = element('option', [words.none, words.light, words.extra][n]); option.value = String(n); select.append(option); }
      select.value = String(recipe[id] ?? 0); select.disabled = !prep() || !unlocked.includes(id);
      if (!unlocked.includes(id)) { row.title = words.locked; row.append(element('small', words.locked)); }
      select.addEventListener('change', () => {
        if (!root.isConnected || !select.isConnected || !prep()) return;
        if (Number(select.value)) recipe[id] = Number(select.value); else delete recipe[id];
        tastedId = null; notice = ''; showWorkbench(`dose:${id}`);
      });
      row.append(select); doses.append(row);
    }
    dose(BASE_INGREDIENT[base], true);
    for (const id of SIGNATURE_ADDONS) if (id !== BASE_INGREDIENT[base]) dose(id);
    const preview = element('section', '', 'signature-preview'); preview.append(element('h3', words.preview));
    const validation = validateSignatureRecipe(base, recipe);
    const id = makeSignatureId(base, recipe);
    const missing: Recipe = {};
    for (const [key, n] of Object.entries(recipe)) {
      const stock = state.pantry[key as IngredientId];
      const short = (n ?? 0) * .25 - (Number.isFinite(stock) ? Math.max(0, stock) : 0); if (short > 0) missing[key as IngredientId] = short;
    }
    const locked = Object.keys(recipe).some(key => !unlocked.includes(key as IngredientId));
    if (id && validation.ok) preview.append(summary(id));
    else preview.append(element('p', validation.error === 'incompatible' ? words.incompatible : words.invalid));
    preview.append(element('p', words.trialRule, 'note'));
    if (Object.keys(missing).length) preview.append(element('h4', words.shortage), ingredients(missing));
    if (locked) preview.append(element('p', words.locked, 'note'));
    preview.append(button(words.trial, 'trial', () => {
      const result = trialSignature(state, base, recipe);
      if (result.ok && result.id) { tastedId = result.id; notice = words.tasted; onChange(); }
      else notice = result.error === 'open' ? words.prep : result.error === 'locked' ? words.locked : result.error === 'stock' ? words.shortage : words.invalid;
      showWorkbench('trial');
    }, !prep() || !validation.ok || locked || Object.keys(missing).length > 0));
    const naming = element('section', '', 'signature-naming'); naming.append(element('h3', words.name));
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 24; input.value = draftName; input.placeholder = words.placeholder; input.setAttribute('aria-label', words.name); input.dataset.signatureName = ''; input.disabled = !prep();
    const save = button(words.save, 'save', () => {
      if (!id || tastedId !== id) return;
      if (listSignatureDrinks(state).some(d => d.id === id && d.id !== editingId)) { notice = words.duplicate; showWorkbench(); return; }
      if (editingId ? replaceSignature(state, editingId, id, draftName) : saveSignature(state, id, draftName)) { onChange(); notice = words.saved; showList(); } else { notice = words.failed; showWorkbench(); }
    }, !prep() || !id || tastedId !== id || !draftName.trim() || (!editingId && listSignatureDrinks(state).length >= MAX_SIGNATURE_RECIPES));
    input.addEventListener('input', () => { draftName = input.value; save.disabled = !prep() || !id || tastedId !== id || !draftName.trim() || (!editingId && listSignatureDrinks(state).length >= MAX_SIGNATURE_RECIPES); }); naming.append(input, save);
    page(button(words.back, 'back', showList), element('h3', words.base), bases, element('h3', words.additions), element('p', words.doseRules, 'note signature-dose-rules'), element('p', words.pairingRules, 'note signature-pairing-rules'), doses, preview, status(), naming);
    if (focusKey) root.querySelector<HTMLElement>(focusKey.startsWith('dose:') ? `[data-signature-dose="${focusKey.slice(5)}"]` : `[data-signature-action="${focusKey}"]`)?.focus();
  }
  function showDetail(id: string, confirming = false): void {
    const drinks = listSignatureDrinks(state); const drink = drinks.find(d => d.id === id); if (!drink) { showList(); return; }
    const def = signatureDefinition(id)!;
    const name = document.createElement('input'); name.value = drink.name; name.maxLength = 24; name.setAttribute('aria-label', words.rename); name.dataset.signatureRename = ''; name.disabled = !prep();
    const actions = element('div', '', 'signature-actions');
    const full = !drink.onMenu && drinks.filter(d => d.onMenu).length >= MAX_SIGNATURE_MENU;
    actions.append(button(words.edit, 'edit', () => { base = def.base; recipe = { ...def.recipe }; draftName = drink.name; tastedId = null; editingId = drink.id; notice = ''; showWorkbench(); }, !prep()), button(words.rename, 'rename', () => { if (renameSignature(state, drink.id, name.value)) { onChange(); notice = ''; } else notice = words.failed; showDetail(id); }, !prep()),
      button(drink.onMenu ? words.unlist : words.list, 'toggle-menu', () => { if (setSignatureOnMenu(state, drink.id, !drink.onMenu)) { onChange(); notice = ''; } else notice = words.failed; showDetail(id); }, !prep() || full),
      button(words.remove, 'delete', () => showDetail(id, true), !prep()));
    const deletion = element('div', '', 'signature-delete');
    if (confirming) deletion.append(element('p', words.confirm), button(words.cancel, 'cancel-delete', () => showDetail(id)), button(words.remove, 'confirm-delete', () => { if (deleteSignature(state, drink.id)) { onChange(); notice = ''; showList(); } else { notice = words.failed; showDetail(id); } }, !prep()));
    page(button(words.back, 'back', () => { notice = ''; showList(); }), element('h3', drink.name), art(def.base), element('p', drink.onMenu ? words.listed : words.unlisted), summary(id), status(), name, actions, ...(full ? [element('p', words.menuFull, 'note')] : []), deletion);
  }
  showList();
  showModal({ title: words.title, body: root, focusableBody: true, buttons: [{ label: words.close, onClick: onClose }] });
  const dialog = root.closest<HTMLElement>('[role="dialog"]')!; dialog.classList.add('signature-modal');
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape' && !isComposingKey(event)) { event.preventDefault(); event.stopPropagation(); closeModal(); onClose?.(); } });
}
export const showSignatureResearch = showSignatureDrinks;
