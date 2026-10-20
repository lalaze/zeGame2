import { afterEach, describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, UPGRADES } from './game/data';
import { formatDuration } from './game/format';
import { detectLocale, messagesFor, setLocale, t, tList, type MessageKey } from './i18n';

const placeholders = (s: string) => {
  // Plural markers such as `{n, dish|dishes}` carry the same placeholder `{n}`.
  const base = s.replace(/\{(\w+),\s*[^{}|]*\|[^{}]*\}/g, '{$1}');
  return [...new Set([...base.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
};
/** List length, ignoring the `|` that separates plural forms inside a marker. */
const listLength = (s: string) => s.replace(/\{(\w+),\s*[^{}|]*\|[^{}]*\}/g, '').split('|').length;

describe('i18n', () => {
  afterEach(() => setLocale('en'));

  it('Chinese has every English key with the same placeholders and list lengths', () => {
    const en = messagesFor('en');
    const zh = messagesFor('zh');
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
      expect(listLength(zh[key]), key).toBe(listLength(en[key]));
      expect(zh[key].trim(), key).not.toBe('');
    }
  });

  it('picks the singular form for one and the plural for everything else', () => {
    expect(t('rating.summary', { n: 1, score: '4.00' })).toBe('1 review · Average 4.00 stars');
    expect(t('rating.summary', { n: 2, score: '4.00' })).toBe('2 reviews · Average 4.00 stars');
    expect(t('regular.ui.unread', { n: 1 })).toBe('1 unread story');
    expect(t('report.reason.lowStock', { n: 1 })).toBe(
      'The pantry can no longer make 1 menu dish. This alone does not mean customers were lost.');
    expect(t('report.reason.lowStock', { n: 3 })).toContain('3 menu dishes');
    expect(t('report.partnerJobs', { n: 1 })).toBe('1 job');
    expect(t('report.partnerNewStories', { n: 1 })).toBe('1 new story');
    // Zero and fractions read as plurals.
    expect(t('menu.left', { n: 0 })).toBe('0 servings in stock');
    expect(t('menu.left', { n: 1 })).toBe('1 serving in stock');
    // Chinese keeps one form and never shows the marker.
    setLocale('zh');
    expect(t('rating.summary', { n: 1, score: '4.00' })).toBe('1 条 · 平均 4.00 星');
    expect(t('report.reason.lowStock', { n: 1 })).toContain('1 道菜单商品');
    expect(t('report.partnerJobs', { n: 2 })).toBe('2 次工作');
    for (const key of Object.keys(messagesFor('zh')) as MessageKey[]) {
      expect(t(key, { n: 1, count: 1, max: 1, score: '4.0', price: '$1', items: 'x', money: '$1', item: 'x', extra: 1, total: 1, pct: 1, day: 1, stars: '1', h: 1, m: 1, s: 1, name: 'x', baked: 1, goal: 'x', reward: '$1', sold: 1, slot: 1 }), key).not.toMatch(/\{[a-z]+,/);
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
    expect(tList('ob.names')).toEqual(['云朵咖啡', '慢慢咖啡', '猫爪咖啡屋', '月光拿铁', '小满咖啡', '日落咖啡馆', '暖暖咖啡', '豆子研究所']);
  });
});
