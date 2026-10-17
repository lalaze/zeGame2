import { describe, expect, it } from 'vitest';
import { DECOR, STARTER_THEMES, applyTheme, comfort, useDecor } from './decor';
import { createInitialState, deserialize, serialize } from './state';
import { messagesFor } from '../i18n';

describe('replaceable café textiles and centerpieces', () => {
  it('upgrades an old save with free defaults without changing its purchases', () => {
    const state = createInitialState(0); state.coins = 2000;
    useDecor(state, 'counter_walnut');
    const old = JSON.parse(serialize(state));
    for (const slot of ['tablecloth', 'curtain', 'centerpiece']) delete old.decor.equipped[slot];
    old.decor.owned = ['counter_walnut'];
    const loaded = deserialize(JSON.stringify(old), 0);
    expect(loaded.decor.equipped).toMatchObject({ counter: 'counter_walnut', tablecloth: 'tablecloth_classic', curtain: 'curtain_classic', centerpiece: 'centerpiece_flowers' });
    expect(loaded.coins).toBe(state.coins);
    expect(useDecor(loaded, 'tablecloth_mint')).toBe(true);
    expect(loaded.coins).toBe(state.coins);
  });

  it('charges once, equips independently, and persists owned and equipped styles', () => {
    const state = createInitialState(0); state.coins = 1000;
    const baseline = comfort(state);
    for (const id of ['tablecloth_blue', 'centerpiece_succulent', 'curtain_blue']) expect(useDecor(state, id)).toBe(true);
    expect(state.coins).toBe(610); expect(comfort(state)).toBe(baseline + 6);
    useDecor(state, 'tablecloth_mint'); expect(comfort(state)).toBe(baseline + 4);
    useDecor(state, 'tablecloth_blue'); expect(state.coins).toBe(610);
    const loaded = deserialize(serialize(state), 0);
    expect(loaded.decor).toEqual(state.decor);
    useDecor(loaded, 'centerpiece_none');
    expect(loaded.decor.equipped.tablecloth).toBe('tablecloth_blue');
    expect(loaded.decor.equipped.curtain).toBe('curtain_blue');
    loaded.coins = 0; const before = serialize(loaded);
    expect(useDecor(loaded, 'tablecloth_linen')).toBe(false); expect(serialize(loaded)).toBe(before);
  });

  it('names every style and slot in both supported languages', () => {
    for (const lang of ['en', 'zh'] as const) {
      const keys = Object.keys(messagesFor(lang));
      for (const def of DECOR) {
        expect(keys).toContain(`decor.${def.id}`); expect(keys).toContain(`slot.${def.slot}`);
      }
    }
  });
});


describe('coordinated starter themes', () => {
  it('gives each theme distinct walls, floors, counters, tablecloths and curtains at no cost', () => {
    const state = createInitialState(0);
    const original = { coins: state.coins, comfort: comfort(state), upgrades: { ...state.upgrades } };
    for (const theme of [...STARTER_THEMES, STARTER_THEMES[0]]) {
      applyTheme(state, theme.id);
      expect(state.coins).toBe(original.coins);
      expect(comfort(state)).toBe(original.comfort);
      expect(state.upgrades).toEqual(original.upgrades);
      expect(state.decor.equipped).toMatchObject(theme.equip);
      for (const id of Object.values(theme.equip)) expect(state.decor.owned).toContain(id);
      expect(deserialize(serialize(state), 0).decor.equipped).toEqual(state.decor.equipped);
    }
    for (const slot of ['wallpaper', 'floor', 'counter', 'tablecloth', 'curtain'] as const) {
      expect(new Set(STARTER_THEMES.map(theme => theme.equip[slot])).size).toBe(3);
    }
  });

  it('adds the new free finishes to old saves without replacing their existing look', () => {
    const state = createInitialState(0); applyTheme(state, 'rose');
    const old = JSON.parse(serialize(state));
    old.decor.equipped.counter = 'counter_oak';
    old.decor.equipped.tablecloth = 'tablecloth_classic';
    old.decor.equipped.curtain = 'curtain_classic';
    old.decor.owned = old.decor.owned.filter((id: string) => !['counter_sage', 'counter_blush', 'tablecloth_rose', 'curtain_rose'].includes(id));
    const loaded = deserialize(JSON.stringify(old), 0);
    expect(loaded.decor.equipped).toEqual(old.decor.equipped);
    for (const id of ['counter_sage', 'counter_blush', 'tablecloth_rose', 'curtain_rose']) {
      expect(useDecor(loaded, id)).toBe(true);
    }
    expect(loaded.coins).toBe(0);
  });
});
