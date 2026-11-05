import { describe, expect, it } from 'vitest';
import { openBranch } from './chain';
import { COIN_HOURS, GIFT_HOURS, GIFT_INTERVAL_MS, GIFT_KINDS, GIFT_MIN, GIFT_SPOTS, bringGifts, collectGift, giftKindsFound, giftValue, parseCatGifts } from './cat-gifts';
import { awayHourly, hireManager } from './manager';
import { adoptCat } from './pets';
import { createInitialState, deserialize, serialize } from './state';

function withCats(...ids: Parameters<typeof adoptCat>[1][]) {
  const state = createInitialState(0);
  state.coins = 100_000;
  for (const id of ids) expect(adoptCat(state, id)).toBe(true);
  return state;
}

describe('cat gifts', () => {
  it('brings nothing without a cat, and does not save the time up', () => {
    const state = createInitialState(0);
    expect(bringGifts(state, 10 * GIFT_INTERVAL_MS)).toEqual([]);
    expect(state.catGifts.next).toBe(11 * GIFT_INTERVAL_MS);
    state.coins = 1_000;
    adoptCat(state, 'ginger');
    expect(bringGifts(state, 10 * GIFT_INTERVAL_MS + 1)).toEqual([]);
  });

  it('brings one gift per interval from a resident cat, onto a free sill spot', () => {
    const state = withCats('ginger', 'tuxedo');
    expect(bringGifts(state, GIFT_INTERVAL_MS - 1)).toEqual([]);
    const [first] = bringGifts(state, GIFT_INTERVAL_MS);
    expect(['ginger', 'tuxedo']).toContain(first.cat);
    expect(GIFT_KINDS).toContain(first.kind);
    expect(first.spot).toBe(0);
    expect(state.catGifts.next).toBe(2 * GIFT_INTERVAL_MS);
  });

  it('fills the sills, then waits a full interval after the last gift fits', () => {
    const state = withCats('ginger');
    const brought = bringGifts(state, 10 * GIFT_INTERVAL_MS);
    expect(brought.map((g) => g.spot)).toEqual(GIFT_SPOTS.map((_, i) => i));
    expect(state.catGifts.next).toBe(11 * GIFT_INTERVAL_MS);
    expect(collectGift(state, brought[1].id)).not.toBeNull();
    // The freed middle spot is the next one used.
    expect(bringGifts(state, 11 * GIFT_INTERVAL_MS)[0].spot).toBe(1);
  });

  it('is the same gift after a reload', () => {
    const a = withCats('ginger', 'calico', 'tabby'), b = withCats('ginger', 'calico', 'tabby');
    expect(bringGifts(a, 3 * GIFT_INTERVAL_MS)).toEqual(bringGifts(deserialize(serialize(b), 0), 3 * GIFT_INTERVAL_MS));
  });

  it('pays for a gift once, the coin most, and files it in the treasure box', () => {
    const state = withCats('ginger');
    state.manager.hired = false;
    expect(giftValue(state, 'leaf')).toBe(Math.max(GIFT_MIN, Math.round(awayHourly(state) * GIFT_HOURS)));
    state.items.latte = 40;
    state.onMenu = ['espresso', 'latte'];
    expect(giftValue(state, 'coin')).toBe(Math.round(awayHourly(state) * COIN_HOURS));
    expect(giftValue(state, 'coin')).toBeGreaterThan(giftValue(state, 'leaf'));
    const [gift] = bringGifts(state, GIFT_INTERVAL_MS);
    const coins = state.coins, value = giftValue(state, gift.kind);
    expect(collectGift(state, gift.id)).toEqual({ gift, amount: value, first: true });
    expect(state.coins).toBe(coins + value);
    expect(state.catGifts.found[gift.kind]).toBe(1);
    expect(giftKindsFound(state)).toBe(1);
    expect(collectGift(state, gift.id)).toBeNull();
  });

  it('reads back only gifts from cats that live here, one per spot', () => {
    const parsed = parseCatGifts({
      waiting: [
        { id: 1, cat: 'ginger', kind: 'leaf', spot: 0 },
        { id: 2, cat: 'ginger', kind: 'acorn', spot: 0 },
        { id: 3, cat: 'persian', kind: 'yarn', spot: 1 },
        { id: 4, cat: 'ginger', kind: 'diamond', spot: 2 },
        { id: 5, cat: 'ginger', kind: 'coin', spot: 9 },
      ],
      next: 1e15, brought: 6, found: { leaf: 2, diamond: 3, yarn: -1 },
    }, 1_000, ['ginger']);
    expect(parsed.waiting).toEqual([{ id: 1, cat: 'ginger', kind: 'leaf', spot: 0 }]);
    expect(parsed.next).toBe(1_000 + GIFT_INTERVAL_MS);
    expect(parsed.found).toEqual({ leaf: 2 });
    expect(parsed.brought).toBe(6);
  });

  it('moves with the cats to a new branch', () => {
    const state = withCats('ginger');
    hireManager(state);
    state.regions = ['reading', 'greenhouse', 'terrace'];
    state.totalEarned = 1_000_000;
    bringGifts(state, GIFT_INTERVAL_MS);
    const next = openBranch(state, 'city', GIFT_INTERVAL_MS)!;
    expect(next.catGifts.waiting).toEqual(state.catGifts.waiting);
  });
});
