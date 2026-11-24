// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { FLOORS_APP_ART, FLOORS_THEME, installFloorsIdentity } from './floors-identity';
import { isFloorsView } from '../render/floors/floors-view';

const BUILD = 'assets/generated/floor-sample-v1/build/app';
const css = readFileSync('src/ui/floors-identity.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const app = existsSync(`${BUILD}/app.json`) ? JSON.parse(readFileSync(`${BUILD}/app.json`, 'utf8')) as { icon: string; candidates: string[]; files: Record<string, number> } : null;

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#865332"><link rel="manifest" href="./manifest.webmanifest">'
    + '<link rel="icon" id="favicon" href="./icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="./icon-192.png">';
  document.body.className = 'fullscreen-cafe';
  document.body.removeAttribute('style');
  document.body.innerHTML = '<div id="loader"><div class="loader-walkway"></div></div><img src="./icon.svg" class="brand-icon"><img src="./other.png">';
});

describe('floors identity', () => {
  it('swaps the tab icon, the touch icon and the brand icon for the painted ones, and nothing else', () => {
    installFloorsIdentity(document, '/art/app/');
    expect(document.body.classList.contains('floors-view')).toBe(true);
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe('/art/app/favicon.png');
    expect(document.querySelector('link[rel="icon"]')!.getAttribute('type')).toBe('image/png');
    expect(document.querySelector('link[rel="apple-touch-icon"]')!.getAttribute('href')).toBe('/art/app/apple-touch-icon.png');
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(FLOORS_THEME);
    expect(document.querySelector('.brand-icon')!.getAttribute('src')).toBe('/art/app/icon-192.png');
    // Absolute addresses: a stylesheet that uses them must not resolve them against its own.
    const absolute = (name: string) => new URL(`/art/app/${name}`, document.baseURI).href;
    expect(absolute('loading.webp')).toMatch(/^[a-z]+:.*\/art\/app\/loading\.webp$/);
    expect(document.body.style.getPropertyValue('--floors-loading-art')).toBe(`url("${absolute('loading.webp')}")`);
    expect(document.body.style.getPropertyValue('--floors-app-icon')).toBe(`url("${absolute('icon-192.png')}")`);
    // The installed app's manifest and every other picture stay as they are.
    expect(document.querySelector('link[rel="manifest"]')!.getAttribute('href')).toBe('./manifest.webmanifest');
    expect(document.querySelector('img:not(.brand-icon)')!.getAttribute('src')).toBe('./other.png');
    installFloorsIdentity(document, '/art/app/');
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
  });

  it('only styles the floors view, so the pixel view keeps its loading screen', () => {
    const selectors = [...css.matchAll(/([^{}]+){[^{}]*}/g)].map(m => m[1].trim());
    expect(selectors.length).toBeGreaterThan(15);
    for (const list of selectors) {
      for (const selector of list.split(/,(?![^()]*\))/)) expect(selector.trim(), list).toMatch(/^:root body\.floors-view\b/);
    }
    // The painted picture takes the walker's place.
    expect(css).toContain('var(--floors-loading-art)');
    expect(css).toMatch(/\.loader-walker\s*{\s*display:\s*none/);
  });

  it('is the page\'s own face unless the address asks for the pixel view', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toMatch(/if \(isFloorsView\(\)\) installFloorsIdentity\(\);/);
    expect(main.match(/installFloorsIdentity\(/g)).toHaveLength(1);
    expect(isFloorsView('')).toBe(true);
    expect(isFloorsView('?floors')).toBe(true);
    expect(isFloorsView('?pixel')).toBe(false);
    // The page shows the paper loading screen from its first paint, with the same switch.
    const page = readFileSync('index.html', 'utf8');
    expect(page).toContain('<link rel="icon" id="favicon" href="./favicon.png" type="image/png" />');
    expect(page).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />');
    expect(page).toContain(`<meta name="theme-color" content="${FLOORS_THEME}" />`);
    const first = page.slice(page.indexOf('<body'), page.indexOf('<div id="loader"'));
    expect(first).toContain("if (!new URLSearchParams(location.search).has('pixel'))");
    expect(first).toContain("document.body.classList.add('floors-view')");
    expect(first).toContain('--floors-loading-art');
    expect(first).toContain(`./${BUILD}/`);
  });
});

describe.skipIf(!app)('floors app pictures', () => {
  it('is what the installed app shows: public/ holds the same icons and manifest', () => {
    for (const file of ['icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png', 'manifest.webmanifest'])
      expect(readFileSync(`public/${file}`).equals(readFileSync(`${BUILD}/${file}`)), `public/${file} is not ${BUILD}/${file}: copy it after floor-app-build.py`).toBe(true);
  });

  it('has every file the page swaps in and the installed app will need, at its size', () => {
    expect(FLOORS_APP_ART.endsWith('assets/generated/floor-sample-v1/build/app/')).toBe(true);
    expect(Object.keys(app!.files).sort()).toEqual(['apple-touch-icon.png', 'favicon.png', 'icon-192.png', 'icon-512.png',
      'icon-maskable-192.png', 'icon-maskable-512.png', 'loading.webp']);
    for (const [file, size] of Object.entries(app!.files)) {
      const bytes = readFileSync(`${BUILD}/${file}`);
      if (file.endsWith('.png')) {
        // A PNG's width and height follow its signature and IHDR tag.
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], file).toEqual([size, size]);
      } else expect(bytes.subarray(8, 12).toString(), file).toBe('WEBP');
    }
    expect(app!.candidates).toContain(app!.icon);
  });

  it('has a manifest ready for the switch that names only icons that are there', () => {
    const next = JSON.parse(readFileSync(`${BUILD}/manifest.webmanifest`, 'utf8')) as { name: string; start_url: string; scope: string; display: string; theme_color: string;
      icons: { src: string; sizes: string; purpose?: string }[] };
    const now = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as typeof next;
    // The same app: only its face changes.
    expect([next.name, next.start_url, next.scope, next.display]).toEqual([now.name, now.start_url, now.scope, now.display]);
    expect(next.theme_color).toBe(FLOORS_THEME);
    for (const icon of next.icons) {
      expect(app!.files[icon.src], icon.src).toBe(Number(icon.sizes.split('x')[0]));
      expect(icon.src.includes('maskable')).toBe(icon.purpose === 'maskable');
    }
    expect(next.icons.filter(icon => icon.purpose === 'maskable').map(icon => icon.sizes).sort()).toEqual(['192x192', '512x512']);
  });
});
