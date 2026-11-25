// Everything the Godot rules read instead of copying: each module's exported constants, plus a few tables that
// TypeScript keeps private or computes when it loads.
import { MODS, call } from './mods';
import en from '../../src/locales/en.json';
import zh from '../../src/locales/zh.json';

type Dict = Record<string, unknown>;
/** Functions inside a constant (a goal's condition) are ported by hand; the rest of it is data. */
const data = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(data);
  if (v instanceof Map || v instanceof Set) throw new Error('Export a Map or Set as a table of its own');
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'function').map(([k, x]) => [k, data(x)]));
  return v;
};
const ids = (mod: string, name: string) => (MODS[mod][name] as { id: string }[]).map((x) => x.id);
/** The order `localeCompare` puts known ids in. */
const order = (list: string[]) => Object.fromEntries([...list].sort((a, b) => a.localeCompare(b)).map((id, i) => [id, i]));
const pick = (from: Dict, keys: string[]) => Object.fromEntries(keys.map((k) => [k, from[k]]));
const DURATION = ['duration.hm', 'duration.ms', 'duration.s'];

export function rulesData(): Dict {
  const out: Dict = {};
  for (const [mod, exports] of Object.entries(MODS)) {
    const constants = Object.entries(exports).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, data(v)] as const).sort(([a], [b]) => (a < b ? -1 : 1));
    if (constants.length) out[mod] = Object.fromEntries(constants);
  }
  (out.flavors as Dict).ITEM_FLAVORS = Object.fromEntries(ids('data', 'MENU').map((id) => [id, call('flavors', 'itemFlavors', [id])]));
  (out.pets as Dict).DEFAULT_PREFERENCES = Object.fromEntries(ids('pets', 'CATS').map((id) => [id, call('pets', 'petPreferences', [{ id }])]));
  out.localeOrder = { ingredients: order(ids('data', 'INGREDIENTS')), furniture: order(ids('furniture', 'FURNITURE')) };
  out.i18nDuration = { zh: pick(zh, DURATION), en: pick(en, DURATION) };
  return out;
}
