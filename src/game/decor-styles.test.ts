import { describe, expect, it } from 'vitest';
import { DECOR, comfort, useDecor } from './decor';
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
