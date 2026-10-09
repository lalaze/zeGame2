import { afterEach, describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, UPGRADES } from './game/data';
import { formatDuration } from './game/format';
import { detectLocale, messagesFor, setLocale, t, tList, type MessageKey } from './i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  afterEach(() => setLocale('en'));

  it('Chinese has every English key with the same placeholders and list lengths', () => {
    const en = messagesFor('en');
    const zh = messagesFor('zh');
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
      expect(zh[key].split('|').length, key).toBe(en[key].split('|').length);
      expect(zh[key].trim(), key).not.toBe('');
    }
  });

  it('has names for every menu item, ingredient and upgrade', () => {
    const keys = Object.keys(messagesFor('en'));
    for (const m of MENU) expect(keys).toContain(`item.${m.id}`);
    for (const i of INGREDIENTS) expect(keys).toContain(`ing.${i.id}`);
    for (const u of UPGRADES) {
      expect(keys).toContain(`upgrade.${u.id}.name`);
      expect(keys).toContain(`upgrade.${u.id}.desc`);
    }
  });

  it('detects the locale from a saved choice or the browser languages', () => {
    expect(detectLocale(null, ['zh-CN', 'en'])).toBe('zh');
    expect(detectLocale(null, ['zh-TW'])).toBe('zh');
    expect(detectLocale(null, ['en-US', 'zh-CN'])).toBe('zh');
    expect(detectLocale(null, ['fr-FR'])).toBe('en');
    expect(detectLocale('en', ['zh-CN'])).toBe('en');
    expect(detectLocale('garbage', ['ja'])).toBe('en');
  });

  it('translates and interpolates', () => {
    setLocale('zh');
    expect(t('item.latte')).toBe('拿铁');
    expect(t('row.sellsFor', { price: '$10' })).toBe('售价 $10');
    expect(formatDuration(3725)).toBe('1小时2分');
    expect(tList('boss.sheets')).toEqual(['汇总', '预测', '假设']);
  });
});
