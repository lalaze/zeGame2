import type { ItemId } from '../game/data';
import type { GameState } from '../game/state';
import { signatureDefinition } from '../game/signature-drinks';
import { getLocale, t, type MessageKey } from '../i18n';

/** Names are display-only; canonical immutable recipes identify sales and orders. */
export function displayItemName(id: ItemId, state?: GameState): string {
  const custom = signatureDefinition(id);
  if (!custom) return t(`item.${id}` as MessageKey);
  const saved = state?.signatureDrinks.recipes.find((r) => r.id === id);
  if (saved) return saved.name;
  const bases = getLocale() === 'zh' ? { coffee: '咖啡', tea: '茶', milk: '奶饮', fruit: '果饮' } : { coffee: 'Coffee', tea: 'Tea', milk: 'Milk', fruit: 'Fruit' };
  return `${bases[custom.base]} · ${Object.entries(custom.recipe).map(([ing, n]) => `${t(`ing.${ing}` as MessageKey)} ×${n}`).join(' + ')}`;
}
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const htmlItemName = (id: ItemId, state?: GameState): string => escapeHtml(displayItemName(id, state));
