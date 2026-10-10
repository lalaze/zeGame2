import { describe, expect, it } from 'vitest';
import { GuardedStorage } from './storage';

describe('guarded browser storage', () => {
  it('distinguishes a missing key from a denied property/getItem read', () => {
    expect(new GuardedStorage(() => ({ getItem: () => null, setItem: () => {} })).read('key'))
      .toEqual({ ok: true, value: null });
    const blocked = () => { throw new DOMException('Blocked', 'SecurityError'); };
    expect(new GuardedStorage(blocked).read('key')).toEqual({ ok: false });
    expect(new GuardedStorage(() => ({ getItem: blocked, setItem: blocked })).read('key'))
      .toEqual({ ok: false });
  });

  it('keeps preferences usable in memory through blocked reads and quota failures', () => {
    const storage = new GuardedStorage(() => ({
      getItem: () => { throw new Error('Denied'); },
      setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); },
    }));
    expect(storage.preference('locale')).toBeNull();
    storage.setPreference('locale', 'zh');
    storage.setPreference('panel', '1');
    storage.setPreference('hint', '1');
    expect(storage.preference('locale')).toBe('zh');
    expect(storage.preference('panel')).toBe('1');
    expect(storage.preference('hint')).toBe('1');
    expect(storage.write('save', 'data')).toEqual({ ok: false });
  });

  it('reads and writes ordinary preferences without losing failed local changes', () => {
    const values = new Map([['locale', 'en']]);
    let blocked = false;
    const storage = new GuardedStorage(() => {
      if (blocked) throw new Error('Denied');
      return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
    });
    expect(storage.preference('locale')).toBe('en');
    storage.setPreference('locale', 'zh');
    expect(values.get('locale')).toBe('zh');
    blocked = true;
    storage.setPreference('locale', 'en');
    blocked = false;
    expect(storage.preference('locale')).toBe('en');
    expect(values.get('locale')).toBe('zh');
  });
});
