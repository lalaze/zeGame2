// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { FLOORS_ICONS, OUTER_WALL_KEY, floorsIconUrl, installFloorsUi, markFloorsIcons, onOuterWall, outerWallShown, setOuterWall, type FloorsIcon } from './floors-ui';

const css = readFileSync('src/ui/floors-ui.css', 'utf8');
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
const names = Object.keys(FLOORS_ICONS) as FloorsIcon[];

beforeEach(() => {
  document.body.className = '';
  document.body.removeAttribute('style');
  document.body.innerHTML = '<nav><button id="open-btn"></button><button id="panel-toggle" data-floors-icon="spark"></button></nav>'
    + '<nav class="tabs"><button data-tab="menu"></button><button data-tab="pets"></button></nav>';
});

describe('floors UI', () => {
  it('only styles the floors view, so the pixel view keeps its look', () => {
    // Every selector list outside @font-face starts with the floors scope.
    const selectors = [...rules.replace(/@font-face\s*{[^}]*}/g, '').matchAll(/([^{}]+){[^{}]*}/g)].map(m => m[1].trim());
    expect(selectors.length).toBeGreaterThan(50);
    for (const list of selectors) {
      for (const selector of list.split(/,(?![^()]*\))/)) expect(selector.trim(), list).toMatch(/^:root body\.floors-view\b/);
    }
  });

  it('maps every icon it draws, and every pixel HUD icon it redraws, to a line icon', () => {
    for (const name of names) expect(rules).toContain(`[data-floors-icon="${name}"] { --floors-icon: var(--floors-icon-${name}); }`);
    for (const [, name, icon] of rules.matchAll(/\[data-game-icon="(\w+)"\] { --floors-icon: var\(--floors-icon-(\w+)\); }/g)) {
      expect(names).toContain(icon);
      expect(icon).toBe(name);
    }
  });

  it('switches the page to the floors look and marks the main controls', () => {
    installFloorsUi(document.body);
    expect(document.body.classList.contains('floors-view')).toBe(true);
    for (const name of names) expect(document.body.style.getPropertyValue(`--floors-icon-${name}`)).toBe(floorsIconUrl(name));
    expect(document.getElementById('open-btn')!.dataset.floorsIcon).toBe('menu');
    expect(document.querySelector<HTMLElement>('[data-tab="pets"]')!.dataset.floorsIcon).toBe('pets');
    // A mark already set by the page is kept.
    expect(document.getElementById('panel-toggle')!.dataset.floorsIcon).toBe('spark');
  });

  it('marks controls the page makes after it was switched on, like the phone HUD\'s close button', () => {
    installFloorsUi(document.body);
    document.body.insertAdjacentHTML('beforeend', '<div class="mobile-tools-heading"><strong></strong><button>×</button></div>');
    const close = document.querySelector<HTMLElement>('.mobile-tools-heading button')!;
    expect(close.dataset.floorsIcon).toBeUndefined();
    markFloorsIcons(document.body);
    expect(close.dataset.floorsIcon).toBe('close');
  });

  it('draws icons as self-contained SVG masks', () => {
    for (const name of names) {
      const url = floorsIconUrl(name);
      expect(url).toMatch(/^url\("data:image\/svg\+xml,%3Csvg/);
      expect(decodeURIComponent(url)).toContain('viewBox="0 0 24 24"');
    }
  });
});

describe('floors outer walls', () => {
  beforeEach(() => { setLocale('zh'); setOuterWall(false); localStorage.clear(); document.getElementById('floors-wall-btn')?.remove(); });

  it('puts a button under the money that shows and hides the walls, remembered on this device', () => {
    installFloorsUi(document.body);
    const button = document.getElementById('floors-wall-btn')!;
    expect(button.textContent).toBe('外墙');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    const seen: boolean[] = [];
    const stop = onOuterWall(shown => seen.push(shown));
    button.click();
    expect(outerWallShown()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe('看看店里');
    expect(localStorage.getItem(OUTER_WALL_KEY)).toBe('1');
    setOuterWall(false);
    expect(localStorage.getItem(OUTER_WALL_KEY)).toBe('0');
    stop();
    button.click();
    expect(seen).toEqual([true, false]);
  });

  it('starts with the walls as the player last left them', () => {
    localStorage.setItem(OUTER_WALL_KEY, '1');
    installFloorsUi(document.body);
    expect(outerWallShown()).toBe(true);
    expect(document.getElementById('floors-wall-btn')!.getAttribute('aria-pressed')).toBe('true');
  });
});
