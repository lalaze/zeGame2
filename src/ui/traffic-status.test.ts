import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { trafficHud } from './traffic-status';
afterEach(() => setLocale('en'));
describe('quiet traffic information', () => {
  it('appears only while arrivals are allowed', () => {
    expect(trafficHud({ phase: 'prep', dayTime: 0 })).toBeNull();
    expect(trafficHud({ phase: 'closing', dayTime: 55 })).toBeNull();
  });
  it.each(['en', 'zh'] as const)('explains current and next phase in %s without changing time', locale => {
    setLocale(locale);
    const state = { phase: 'open' as const, dayTime: 45 };
    const before = { ...state };
    const hint = trafficHud(state)!;
    expect(hint.label).toBe(locale === 'en' ? 'Small wave' : '一阵小忙');
    expect(hint.nextLabel).toBe(locale === 'en' ? 'Easing off' : '客流渐缓');
    expect(hint.description).toContain('30');
    expect(hint.description).toContain(locale === 'en' ? 'Easing off' : '客流渐缓');
    expect(state).toEqual(before);
  });
});
