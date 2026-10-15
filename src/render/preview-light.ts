/** Explicit local development visual QA clock. Never changes simulation/save time. */
export function previewLightDate(now: Date, href: string): Date {
  let url: URL;
  try { url = new URL(href); } catch { return now; }
  if (!['localhost', '127.0.0.1', '[::1]', '100.96.195.115'].includes(url.hostname)) return now;
  const raw = url.searchParams.get('qa-light');
  if (raw === null || raw.trim() === '') return now;
  const hour = Number(raw);
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return now;
  return new Date(2000, 0, 1, Math.floor(hour), Math.round((hour % 1) * 60));
}
