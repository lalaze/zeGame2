import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/style.css', 'utf8');

// Read the final stylesheet values, rather than testing a second copy of the palette.
const variables = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(m => [m[1], m[2]]));
const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};
const backgroundOf = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g'))];
  return rules.at(-1)![1].match(/background:\s*(#[0-9a-f]{6})/)![1];
};

describe('Warm Pixel A small-label contrast', () => {
  it.each(['green', 'green-dark', 'wood', 'terracotta'])('keeps light action labels readable on %s', surface => {
    expect(contrast(variables['paper-light'], variables[surface])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['paper', 'cream'])('keeps muted and brass labels readable on %s', surface => {
    for (const ink of ['muted', 'brass-ink']) expect(contrast(variables[ink], variables[surface])).toBeGreaterThanOrEqual(4.5);
  });
  it.each([
    '.pixel-btn:hover:not(:disabled)',
    '.pixel-btn.danger:hover:not(:disabled)', '.day-hud .chip.close-btn:hover:not(:disabled)',
  ])('keeps %s labels readable', selector => {
    expect(contrast(variables['paper-light'], backgroundOf(selector))).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps paper secondary buttons and disabled controls readable', () => {
    expect(contrast(variables['ink'], backgroundOf('.pixel-btn.ghost:hover:not(:disabled)'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variables['disabled-ink'], variables['disabled-paper'])).toBeGreaterThanOrEqual(3);
  });
  it('keeps off-menu and unavailable copy opaque while the artwork stays subdued', () => {
    expect(css).toContain('.row.locked, .prep-row.off { opacity: 1; }');
    expect(css).toContain('.row.locked .name, .row.off-menu .name, .prep-row.off .prep-name { opacity: 1; color: var(--muted); }');
  });
  it('never paints a light generic hover background behind a selected chip label', () => {
    expect(css).toContain('.chip:hover:not(:disabled):not(.active):not([aria-pressed="true"])');
  });
});
