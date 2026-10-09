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
