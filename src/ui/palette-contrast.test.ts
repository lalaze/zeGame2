import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const style = readFileSync('src/style.css', 'utf8');
// main.ts loads the ledger after style.css, so its values are the ones players see.
const ledger = readFileSync('src/ui/ledger.css', 'utf8');
const css = `${style}\n${ledger}`;

// Read the final stylesheet values, rather than testing a second copy of the palette.
const hexVariables = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(m => [m[1], m[2]]));
const base = Object.assign({}, ...[...css.matchAll(/:root\s*\{([^}]*)\}/g)].map(m => hexVariables(m[1])));
// Action ink follows the room: each theme overrides the accent colours.
const themes: Record<string, Record<string, string>> = {
  classic: {},
  ...Object.fromEntries([...ledger.matchAll(/:root\[data-ledger-theme='(\w+)'\]\s*\{([^}]*)\}/g)].map(m => [m[1], hexVariables(m[2])])),
};
const palette = (theme: string) => ({ ...base, ...themes[theme] });
const resolve = (value: string, theme: string) => value.replace(/var\(--([a-z-]+)\)/, (_, name: string) => palette(theme)[name]);
const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};
/** The background the last rule naming `selector` paints, in a given room theme. */
const backgroundOf = (selector: string, theme = 'classic') => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(m => m[1].split(',').some(candidate => candidate.trim() === selector))
    .map(m => m[2].match(/background:\s*(#[0-9a-f]{6}\b|var\(--[a-z-]+\))/)?.[1])
    .filter((value): value is string => !!value);
  return resolve(rules.at(-1)!, theme);
};
/** The ledger's page colours, after the darker page edge that sits under the panel padding. */
const pageColors = [...ledger.match(/\.panel, body\.fullscreen-cafe #management-panel \{\s*background:[^;]*/)![0].matchAll(/#[0-9a-f]{6}\b/g)]
  .map(m => m[0]).slice(1);

describe('ledger small-label contrast', () => {
  it('styles every room theme the ledger can pick', () => {
    const picked = [...readFileSync('src/ui/ledger-theme.ts', 'utf8').matchAll(/wall_\w+: '(\w+)'/g)].map(m => m[1]);
    expect(picked.length).toBeGreaterThan(0);
    for (const theme of picked) expect(Object.keys(themes), theme).toContain(theme);
  });
  it.each(Object.keys(themes))('keeps light action labels and selected tabs readable in the %s theme', theme => {
    const p = palette(theme);
    for (const selector of ['.pixel-btn', '.pixel-btn:hover:not(:disabled)'])
      expect(contrast(p['paper-light'], backgroundOf(selector, theme)), selector).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p['accent-dark'], p['accent-soft'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.paper)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['green', 'green-dark', 'wood', 'terracotta'])('keeps light labels readable on %s', surface => {
    expect(contrast(base['paper-light'], base[surface])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['paper', 'cream'])('keeps muted and brass labels readable on %s', surface => {
    for (const ink of ['muted', 'brass-ink']) expect(contrast(base[ink], base[surface]), ink).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps muted notes readable across the whole ledger page', () => {
    expect(pageColors.length).toBeGreaterThan(1);
    for (const page of pageColors) expect(contrast(base.muted, page), page).toBeGreaterThanOrEqual(4.5);
  });
  it.each([
    '.pixel-btn.danger:hover:not(:disabled)', '.day-hud .chip.close-btn:hover:not(:disabled)',
  ])('keeps %s labels readable', selector => {
    expect(contrast(base['paper-light'], backgroundOf(selector))).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps paper secondary buttons and disabled controls readable', () => {
    expect(contrast(base.ink, backgroundOf('.pixel-btn.ghost:hover:not(:disabled)'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(base['disabled-ink'], base['disabled-paper'])).toBeGreaterThanOrEqual(3);
  });
  it('keeps off-menu and unavailable copy opaque while the artwork stays subdued', () => {
    expect(css).toContain('.row.locked, .prep-row.off { opacity: 1; }');
    expect(css).toContain('.row.locked .name, .row.off-menu .name, .prep-row.off .prep-name { opacity: 1; color: var(--muted); }');
  });
  it('never paints a light generic hover background behind a selected chip label', () => {
    expect(css).toMatch(/\.chip:hover:not\(:disabled\):not\(\.active\):not\(\[aria-pressed=["']true["']\]\)/);
  });
});
