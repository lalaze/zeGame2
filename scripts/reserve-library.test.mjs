import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { Window } from 'happy-dom';
import { auditPixels, pureRecolor, safeArtifact, validateDefinition } from './build-reserve-library.mjs';
import { createPainter } from './build-seasonal-reserve-art.mjs';

const palette = JSON.parse(readFileSync(new URL('../docs/art-grid/palette.json', import.meta.url), 'utf8'));
const folder = new URL('../assets/generated/reserve-library/', import.meta.url);
const html = readFileSync(new URL('index.html', folder), 'utf8');
const galleryScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
function painted() {
  const p = createPainter(palette);
  for (let i = 0; i < 6; i++) p.rect(20 + i * 6, 60, 6, 24, p.color('oak', i));
  return p;
}
function fixture() {
  const packs = ['one', 'two'].map((id, index) => ({ id, titleZh: `素材${index}`, baseShapes: 13, sprites: 52, categories: [id + '-tools'], categoryLabels: [{ id: id + '-tools', nameZh: `工具${index}`, nameEn: 'Tools' }], atlas: `../${id}/atlas.png`, contactSheet: `../${id}/contact-sheet.png`, manifest: `../${id}/manifest.json` }));
  const sprites = packs.flatMap(p => Array.from({ length: 52 }, (_, i) => ({ id: `${p.id}-${i}`, nameZh: `物件${i}`, nameEn: `${p.id} object ${i}`, packId: p.id, packTitleZh: p.titleZh, category: p.categories[0], season: ['spring', 'summer', 'autumn', 'winter'][i % 4], tags: ['test'], path: `../${p.id}/sprites/${i}.png`, width: 96, height: 96 })));
  return { counts: { packs: 2, baseShapes: 26, sprites: sprites.length }, packs, sprites };
}
function boot(library = fixture(), search = '') {
  const window = new Window({ url: `http://localhost/assets/generated/reserve-library/index.html${search}`, settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const document = window.document, downloads = [];
  document.body.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '');
  window.RESERVE_LIBRARY = library;
  class TestBlob { constructor(parts, options) { this.parts = parts; this.type = options.type; } }
  const TestURL = { createObjectURL(blob) { downloads.push(blob); return 'blob:selection'; }, revokeObjectURL() {} };
  runInNewContext(galleryScript, { window, document, navigator: { clipboard: { writeText: async () => { throw Error('clipboard unavailable'); } } }, URLSearchParams, Blob: TestBlob, URL: TestURL, setTimeout: fn => fn() });
  const $ = id => document.getElementById(id);
  const change = (id, value, event = 'change') => { $(id).value = value; $(id).dispatchEvent(new window.Event(event)); };
  return { window, document, $, change, downloads, close: () => window.happyDOM.abort() };
}

test('pixel audit rejects dirty alpha, off-palette, clipped or empty images', () => {
  const image = painted(); assert.equal(auditPixels(image, 'valid').colors, 6);
  const dirty = painted(); dirty.pixels[0] = 1; assert.throws(() => auditPixels(dirty, 'dirty'), /dirty transparent/);
  const partial = painted(); partial.pixels[(60 * 96 + 20) * 4 + 3] = 128; assert.throws(() => auditPixels(partial, 'partial'), /partial alpha/);
  const off = painted(); off.pixels.set([1, 2, 3, 255], (60 * 96 + 20) * 4); assert.throws(() => auditPixels(off, 'off'), /off-palette/);
  const clipped = painted(); clipped.put(1, 30, clipped.color('oak', 2)); assert.throws(() => auditPixels(clipped, 'clipped'), /transparent pixels/);
  const empty = createPainter(palette); assert.throws(() => auditPixels(empty, 'empty'), /empty image/);
  const below = painted(); below.put(50, 90, below.color('oak', 2)); assert.throws(() => auditPixels(below, 'below'), /baseline/);
});
test('recolor detection includes color merging, but rejects geometry changes', () => {
  const image = colors => ({ width: 4, height: 1, pixels: Uint8ClampedArray.from(colors.flatMap(c => c === null ? [0, 0, 0, 0] : [c, 0, 0, 255])) });
  assert.equal(pureRecolor(image([1, 1, 2, 2]), image([3, 3, 4, 4])), true);
  assert.equal(pureRecolor(image([1, 1, 2, 2]), image([3, 3, 3, 3])), true);
  assert.equal(pureRecolor(image([1, 1, 2, 2]), image([3, 4, 3, 4])), false);
  assert.equal(pureRecolor(image([1, null, 2, 2]), image([1, 1, 2, 2])), false);
});
test('artifact paths cannot escape pack directory', () => {
  const base = path.resolve('assets/generated/example-reserve-v1');
  assert.equal(safeArtifact(base, 'sprites/example.png'), path.join(base, 'sprites/example.png'));
  for (const bad of ['../escape', '/absolute', 'sprites/../../escape', './relative', 'a//b', 'a\\b', '']) assert.throws(() => safeArtifact(base, bad), /Unsafe artifact/);
});
test('source contract checks bilingual IDs and balanced categories', () => {
  const categories = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, nameZh: `类别${i}`, nameEn: `Category ${i}` }));
  const pack = { id: 'test-reserve-v1', titleZh: '测试', titleEn: 'Test', categories, variants: ['spring', 'summer', 'autumn', 'winter'].map(id => ({ id, nameZh: '季节', nameEn: id })), catalog: Array.from({ length: 48 }, (_, i) => ({ id: `base-${i}`, nameZh: `物件${i}`, nameEn: `Object ${i}`, category: `c${Math.floor(i / 8)}` })) };
  validateDefinition(pack);
  const duplicate = structuredClone(pack); duplicate.catalog[1].id = duplicate.catalog[0].id; assert.throws(() => validateDefinition(duplicate), /duplicate/);
  const missing = structuredClone(pack); missing.catalog[1].nameZh = ''; assert.throws(() => validateDefinition(missing), /bilingual/);
  const unbalanced = structuredClone(pack); unbalanced.catalog[0].category = 'c1'; assert.throws(() => validateDefinition(unbalanced), /8 bases/);
});
test('gallery paginates, filters and resets without rendering the whole library', async () => {
  const app = boot(); assert.equal(app.document.querySelectorAll('.card').length, 48); assert.match(app.$('count').textContent, /104 \/ 104/);
  app.$('next').click(); assert.match(app.$('page').textContent, /2 \/ 3/);
  app.$('next').click(); assert.equal(app.document.querySelectorAll('.card').length, 8); assert.ok(app.$('next').disabled);
  app.change('pack', 'one'); assert.equal(app.$('category').options.length, 2); assert.match(app.$('count').textContent, /52 \/ 104/);
  app.change('season', 'winter'); assert.equal(app.document.querySelectorAll('.card').length, 13);
  app.change('search', 'nothing-matches', 'input'); assert.ok(app.document.querySelector('.empty')); assert.equal(app.document.querySelectorAll('.card').length, 0);
  app.$('reset').click(); assert.equal(app.document.querySelectorAll('.card').length, 48); assert.match(app.$('page').textContent, /1 \/ 3/);
  await app.close();
});
test('selection survives paging and exports references without touching game state', async () => {
  const app = boot(); app.document.querySelector('.card input').click(); assert.match(app.$('export').textContent, /\(1\)/);
  app.$('next').click(); app.document.querySelector('.card input').click(); assert.match(app.$('export').textContent, /\(2\)/);
  app.$('only-selected').click(); assert.equal(app.document.querySelectorAll('.card').length, 2);
  app.$('export').click(); assert.equal(app.downloads.length, 1);
  const payload = JSON.parse(app.downloads[0].parts[0]); assert.equal(payload.count, 2); assert.equal(payload.integrated, false); assert.equal(payload.sprites[0].id, 'one-0'); assert.equal(payload.sprites[1].id, 'one-48');
  app.$('clear').click(); assert.ok(app.$('export').disabled); assert.ok(app.document.querySelector('.empty'));
  assert.equal(app.window.localStorage.length, 0); await app.close();
});
test('pack deep link and copy fallback work', async () => {
  const app = boot(fixture(), '?pack=two'); assert.equal(app.$('pack').value, 'two'); assert.match(app.$('count').textContent, /52 \/ 104/);
  app.document.querySelector('.card button').click(); await new Promise(resolve => setImmediate(resolve)); assert.match(app.$('status').textContent, /two-0/);
  await app.close();
});
test('missing catalog is actionable and untrusted names remain text', async () => {
  const absent = boot(null); assert.match(absent.$('count').textContent, /--gallery/); assert.ok(absent.$('next').disabled); await absent.close();
  const data = fixture(); data.sprites[0].nameZh = '<img src=x onerror=alert(1)>'; const app = boot(data);
  assert.equal(app.document.querySelector('.card h2').textContent, data.sprites[0].nameZh); assert.equal(app.document.querySelectorAll('.card img').length, 48); await app.close();
});
test('actual offline library catalog exactly matches manifest and counts', async () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
  const context = { window: {} }; runInNewContext(readFileSync(new URL('catalog.js', folder), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.RESERVE_LIBRARY)), manifest);
  assert.equal(manifest.sprites.length, manifest.counts.sprites); assert.equal(new Set(manifest.sprites.map(s => s.id)).size, manifest.sprites.length);
  const app = boot(manifest); assert.equal(app.document.querySelectorAll('.card').length, Math.min(48, manifest.sprites.length)); await app.close();
});
