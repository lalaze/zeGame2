import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');
const chrome = css.slice(css.lastIndexOf(':root {'));
const palette = JSON.parse(readFileSync('docs/art-grid/palette.json', 'utf8')) as { colors: { hex: string }[] };
const colors = new Set(palette.colors.map(color => color.hex));
const tokens = Object.fromEntries([...chrome.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
const declarations = (selector: string) => [...chrome.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(match => match[1].split(',').some(candidate => candidate.trim() === selector))
  .map(match => match[2]).join('\n');

describe('café pixel chrome', () => {
  it('takes digits from Fusion Pixel, since Pixelify Sans draws 5 almost like S', () => {
    const face = [...css.matchAll(/@font-face\s*\{([^{}]*)\}/g)].map(match => match[1]).find(rule => rule.includes("'Pixel Digits'"))!;
    expect(face).toMatch(/unicode-range:\s*U\+0030-0039;/);
    expect(face).toContain("url('./assets/pixel-digits.woff2')");
    const stacks = [...css.matchAll(/font(?:-family)?:[^;]*'Pixelify Sans'[^;]*;/g)].map(match => match[0]);
    // Every English text stack except the "···" settings glyph puts the digits first.
    for (const stack of stacks.filter(stack => !stack.startsWith("font-family: 'Pixelify Sans', ui-monospace"))) {
      if (stack.includes("'Pixel ZH', 'Pixelify Sans'")) continue; // Chinese stacks already use Fusion Pixel digits
      expect(stack, stack).toMatch(/'Pixel Digits', 'Pixelify Sans'/);
    }
  });

  it('turns off Pixelify Sans ligatures, whose fi/fl glyph reads as "A"', () => {
    const body = [...css.matchAll(/(?:^|\})\s*body\s*\{([^{}]*)\}/g)].map(match => match[1]).join('\n');
    expect(body).toMatch(/font-variant-ligatures:\s*none/);
    // A `font` shorthand resets ligatures, so any element using one must turn them off again.
    for (const [, rule] of css.matchAll(/\{([^{}]*\bfont:[ \t]*(?![ \t]|inherit)[^;]+;[^{}]*)\}/g)) expect(rule).toMatch(/font-variant-ligatures:\s*none/);
  });

  it('uses only master-palette colors in the final material layer', () => {
    const materialColors = [...chrome.matchAll(/#[\da-f]{6,8}\b/gi)].map(match => match[0]);
    expect(materialColors.length).toBeGreaterThan(20);
    for (const color of materialColors) expect(colors.has(color), color).toBe(true);
  });

  it.each([1, 2, 3])('keeps frame geometry on whole device pixels at DPR %i', dpr => {
    expect(tokens['ui-pixel']).toBe('2px');
    for (const token of ['border', 'frame', 'paper-card', 'button-edge', 'button-pressed']) {
      const lengths = [...tokens[token].matchAll(/(-?\d+)px/g)].map(match => Number(match[1]));
      expect(lengths.length, token).toBeGreaterThan(0);
      for (const length of lengths) {
        expect(Math.abs(length % 2), token).toBe(0);
        expect(Number.isInteger(length * dpr), token).toBe(true);
      }
    }
    expect(tokens.frame).toContain('inset 2px 2px var(--wood-hi)');
    expect(tokens.frame).toContain('inset -2px -2px var(--wood-lo)');
  });

  it('shares raised, pressed and selected joinery across actions', () => {
    for (const selector of ['.pixel-btn', '.chip', '.tab']) {
      expect(declarations(selector)).toContain('box-shadow: var(--button-edge)');
      expect(declarations(`${selector}:active:not(:disabled)`)).toContain('translate: 0 var(--ui-pixel)');
    }
    expect(declarations('.tab.active')).toContain('inset 4px 0 var(--brass-light)');
    expect(declarations('body.fullscreen-cafe .edge-tools button[aria-expanded="true"]')).toContain('--tool-surface: var(--green)');
  });

  it('reduces tool face coverage without reducing the existing hit rectangles', () => {
    expect(declarations('body.fullscreen-cafe .edge-tools button')).toContain('background: transparent');
    expect(declarations('body.fullscreen-cafe .edge-tools button::before')).toContain('inset: 4px 2px');
    expect(declarations('body.fullscreen-cafe .edge-tools button::before')).toContain('pointer-events: none');
    expect(css).toContain('min-height: 44px; min-width: 100px');
  });

  it('skins native controls without replacing their DOM or browser interactions', () => {
    expect(declarations('input[type="checkbox"]')).toContain('appearance: none');
    expect(declarations('input[type="checkbox"]:checked::after')).toContain('box-shadow:');
    expect(declarations('select')).toContain('appearance: none');
    expect(declarations('select')).toContain('background-size: 10px 2px, 6px 2px, 2px 2px');
    expect(declarations('input[type="number"]::-webkit-inner-spin-button')).toContain('opacity: 1');
    expect(declarations('progress::-moz-progress-bar')).toContain('background: var(--green)');
    expect(declarations('progress::-webkit-progress-value')).toContain('background: var(--green)');
    expect(declarations('details > summary')).toContain('min-height: 44px');
    expect(declarations('details[open] > summary::before')).toContain("content: '−'");
  });

  it('keeps disabled selection and keyboard focus visible on both materials', () => {
    for (const selector of ['.chip:disabled', '.tab:disabled', '.pixel-btn:disabled']) {
      expect(declarations(selector)).toContain('color: var(--disabled-ink)');
      expect(declarations(selector)).toContain('translate: none');
    }
    for (const selector of ['button:focus-visible', 'input:focus-visible', 'select:focus-visible', 'summary:focus-visible']) {
      expect(declarations(selector)).toContain('outline: 2px solid var(--paper-light)');
      expect(declarations(selector)).toContain('0 0 0 6px var(--ink)');
    }
    expect(chrome).toContain('@media (forced-colors: active)');
    expect(chrome).toContain('appearance: auto');
  });

  it('retains pixel font inheritance and phone-sized form targets', () => {
    expect(chrome).toContain('font-family: inherit');
    expect(chrome).toContain('min-height: 44px; font-size: 16px');
    expect(declarations('.prep-select')).toContain('min-height: 44px');
    expect(declarations('.pet-auto')).toContain('min-height: 44px');
    expect(chrome).not.toMatch(/font-family:\s*['"]?(Arial|sans-serif|system-ui)/);
  });
});
