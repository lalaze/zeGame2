import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');
// The ledger loads after style.css (see main.ts) and is the final material layer.
const ledger = readFileSync('src/ui/ledger.css', 'utf8');
const declarations = (selector: string) => [...ledger.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
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
});

describe('café ledger chrome', () => {
  it('keeps every button, chip and tab a 44px touch target', () => {
    for (const selector of ['.pixel-btn', '.chip', '.tab']) {
      expect(declarations(selector), selector).toContain('min-width: 44px');
      expect(declarations(selector), selector).toContain('min-height: 44px');
    }
    // The fullscreen edge tools keep their existing hit rectangles.
    expect(css).toContain('min-height: 44px; min-width: 100px');
  });

  it('keeps disabled selection and keyboard focus visible', () => {
    for (const selector of ['.chip:disabled', '.tab:disabled', '.pixel-btn:disabled']) {
      expect(declarations(selector), selector).toContain('color: var(--disabled-ink)');
      expect(declarations(selector), selector).toContain('translate: none');
    }
    for (const selector of ['button:focus-visible', 'input:focus-visible', 'select:focus-visible', 'textarea:focus-visible', 'summary:focus-visible'])
      expect(declarations(selector), selector).toMatch(/outline: 2px solid/);
    expect(ledger).toContain('@media (forced-colors: active)');
    expect(ledger).toMatch(/:focus-visible \{ outline: 2px solid Highlight/);
  });

  it('keeps native controls recognisable and usable', () => {
    expect(declarations("input[type='checkbox']")).toContain('appearance: auto');
    expect(declarations("input[type='checkbox']")).toContain('accent-color: var(--accent)');
    // A select without its native arrow must draw one.
    expect(declarations('select')).toContain('appearance: none');
    expect(declarations('select')).toContain('background-image: linear-gradient');
    expect(declarations("input[type='number']::-webkit-inner-spin-button")).toContain('opacity: 1');
    expect(declarations('details > summary')).toContain('min-height: 44px');
    expect(declarations('details[open] > summary::before')).toContain("content: '−'");
  });

  it('retains font inheritance and phone-sized form targets', () => {
    expect(declarations('select')).toContain('font-family: inherit');
    // 16px inputs stop phones zooming the page on focus.
    expect(ledger).toContain('min-height: 44px; font-size: 16px');
    expect(declarations('.prep-select')).toContain('min-height: 44px');
    expect(declarations('.pet-auto')).toContain('min-height: 44px');
  });

  it('drops its transitions for players who prefer reduced motion', () => {
    expect(ledger).toContain('transition: background-color');
    expect(ledger).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*transition: none/);
  });
});
