import { t } from '../i18n';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 1000) return Math.floor(n).toString();
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('+', '');
  const scaled = n / 1000 ** tier;
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  // Truncate rather than round so "999.99K" never displays as "1000K".
  const factor = 10 ** digits;
  const truncated = Math.floor(scaled * factor) / factor;
  return truncated.toFixed(digits) + SUFFIXES[tier];
}

export const formatMoney = (n: number) => '$' + formatNumber(n);

/** Transactions keep useful fractional precision; an approximation is never unmarked.
 * Exact values remain available through the amount-details controls. */
export function formatTransactionMoney(n: number): string {
  if (!Number.isFinite(n)) return formatMoney(n);
  if (Math.abs(n) < 1000 || Number.isInteger(n) && Math.abs(n) < 100000) {
    const shown = Number(n.toFixed(4));
    if (n !== 0 && shown === 0) {
      const tiny = n.toExponential(2).replace('+', '');
      return `${Number(tiny) === n ? '' : '≈'}$${tiny}`;
    }
    return `${shown === n ? '' : '≈'}$${shown}`;
  }
  const compact = formatNumber(n);
  const parts = compact.match(/^(-?[\d.]+)([A-Za-z]*)$/);
  const tier = parts ? SUFFIXES.indexOf(parts[2]) : -1;
  const exact = parts && tier >= 0 && Number(parts[1]) * 1000 ** tier === n;
  return `${exact ? '' : '≈'}$${compact}`;
}

/** Shortest round-trip representation of the actual amount used by the economy. */
export const formatExactMoney = (n: number) => '$' + String(n);

/** Ledger values retain cents so partial care consumption is visible. */
export const formatAccountMoney = (n: number) => Math.abs(n) < 1_000_000 ? '$' + n.toFixed(2) : formatMoney(n);

/** Like formatMoney, but keeps a decimal for small rates so $0.6/s isn't shown as $0/s. */
export const formatRate = (n: number) => (n > 0 && n < 100 ? '$' + (Math.floor(n * 10) / 10).toString() : formatMoney(n));

export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return t('duration.hm', { h, m });
  if (m > 0) return t('duration.ms', { m, s: s % 60 });
  return t('duration.s', { s });
}
