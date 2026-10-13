import { describe, expect, it } from 'vitest';
import { uiIcon, type UiIconName } from './pixel-icons';

describe('decorative pixel signage', () => {
  it.each<UiIconName>(['map', 'arrow', 'film', 'spark'])('draws %s without introducing a focus stop or an emoji', name => {
    const svg = uiIcon(name);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toMatch(/#39281f|#543425/);
    expect(svg).not.toMatch(/[\p{Extended_Pictographic}]/u);
    expect(svg).not.toContain('tabindex');
  });
});
