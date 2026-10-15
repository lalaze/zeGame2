import { describe, expect, it } from 'vitest';
import { formatExactMoney, formatMoney, formatNumber, formatTransactionMoney } from './format';
import { buyItem, quoteItem } from './economy';
import { createInitialState } from './state';

describe('transaction money presentation', () => {
  it('retains fractional prices and balances without changing compact statistics', () => {
    expect(formatTransactionMoney(8.96)).toBe('$8.96');
    expect(formatTransactionMoney(10.0352)).toBe('≈$10.04');
    expect(formatTransactionMoney(57.04)).toBe('$57.04');
    expect(formatTransactionMoney(0)).toBe('$0');
    expect(formatTransactionMoney(1e-8)).toBe('<$0.01');
    expect(formatTransactionMoney(-57.04)).toBe('$-57.04');
    expect(formatMoney(57.04)).toBe('$57');
    expect(formatNumber(57.04)).toBe('57');
  });

  it('never silently rounds a quote or balance, including tiny affordability gaps', () => {
    for (const n of [10.03521, 10.035199999999998, 1000.25, 999999, 1.23456789e12]) {
      expect(formatTransactionMoney(n)).toMatch(/^≈\$/);
      expect(Number(formatExactMoney(n).slice(1))).toBe(n);
    }
    expect(formatTransactionMoney(100000)).toBe('$100K');
    expect(formatTransactionMoney(1500000)).toBe('$1.50M');
    expect(formatTransactionMoney(25000000)).toBe('$25.0M');
  });

  it('keeps original 66 → 57.04 debit and exact affordability gates', () => {
    const state = createInitialState(0); state.coins = 66;
    expect(quoteItem(state, 'espresso', 1).cost).toBe(8.96);
    expect(buyItem(state, 'espresso', 1)).toBe(true);
    expect(state.coins).toBe(57.04);
    expect(formatTransactionMoney(state.coins)).toBe('$57.04');
    const next = quoteItem(state, 'espresso', 1).cost;
    expect(next).toBe(8 * 1.12 ** 2);
    state.coins = 10.03;
    expect(quoteItem(state, 'espresso', 1).affordable).toBe(false);
    expect(buyItem(state, 'espresso', 1)).toBe(false);
    expect(state.coins).toBe(10.03);
    state.coins = next;
    expect(buyItem(state, 'espresso', 1)).toBe(true);
    expect(state.coins).toBe(0);
  });
});
