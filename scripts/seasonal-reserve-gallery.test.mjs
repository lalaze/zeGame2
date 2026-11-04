import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';

const pack = new URL('../assets/generated/seasonal-reserve-v1/', import.meta.url);
const html = readFileSync(new URL('index.html', pack), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const sprite = (id, category, season, nameZh) => ({ id, category, season, nameZh, nameEn: id, tags: ['cafe'], path: `sprites/${id}.png`, width: 96, height: 96, logicalWidth: 48, logicalHeight: 48 });
const sample = { counts: { baseShapes: 3 }, sprites: [sprite('spring-cup', 'drinks', 'spring', '春日拿铁'), sprite('summer-pot', 'plants', 'summer', '夏日花盆'), sprite('winter-cake', 'desserts', 'winter', '冬日蛋糕')] };
function boot(manifest = sample) {
  const window = new Window({ url: 'http://localhost/assets/generated/seasonal-reserve-v1/index.html', settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
  const document = window.document;
  document.body.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '');
  window.SEASONAL_RESERVE = manifest;
  runInNewContext(script, { window, document, navigator: { clipboard: { writeText: async () => { throw Error('denied'); } } } });
  const $ = id => document.getElementById(id);
  const change = (id, value, event = 'change') => { $(id).value = value; $(id).dispatchEvent(new window.Event(event)); };
  return { window, document, $, change, close: () => window.happyDOM.abort() };
}

test('gallery renders real counts and uses lazy transparent PNGs', async () => {
  const app = boot();
  assert.equal(app.document.querySelectorAll('.card').length, 3);
  assert.match(app.$('count').textContent, /3 \/ 3/);
  assert.equal(app.document.querySelector('.card img').getAttribute('loading'), 'lazy');
  assert.equal(app.document.querySelector('.card a').getAttribute('download'), 'spring-cup.png');
  await app.close();
});
test('search, combined filters, empty state and reset', async () => {
  const app = boot();
  app.change('search', '拿铁', 'input');
  assert.equal(app.document.querySelectorAll('.card').length, 1);
  app.change('season', 'winter');
  assert.equal(app.document.querySelectorAll('.card').length, 0);
  assert.ok(app.document.querySelector('.empty'));
  app.$('reset').click();
  assert.equal(app.document.querySelectorAll('.card').length, 3);
  app.change('category', 'plants');
  app.change('season', 'summer');
  assert.equal(app.document.querySelectorAll('.card').length, 1);
  app.change('zoom', '1');
  assert.equal(app.document.querySelector('.card img').width, 96);
  app.change('background', 'dark');
  assert.equal(app.$('grid').dataset.background, 'dark');
  await app.close();
});
test('missing catalog gives actionable error without crashing', async () => {
  const app = boot(null);
  assert.match(app.$('count').textContent, /build-seasonal-reserve/);
  assert.equal(app.document.querySelectorAll('.card').length, 0);
  await app.close();
});
test('clipboard denial gives manual-copy fallback', async () => {
  const app = boot();
  app.document.querySelector('.card button').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.$('status').textContent, /手动复制：spring-cup/);
  await app.close();
});
test('catalog data is rendered as text, not injected HTML', async () => {
  const entry = { ...sample.sprites[0], nameZh: '<img src=x onerror=alert(1)>' };
  const app = boot({ counts: { baseShapes: 1 }, sprites: [entry] });
  assert.equal(app.document.querySelector('.info h2').textContent, entry.nameZh);
  assert.equal(app.document.querySelectorAll('.card img').length, 1);
  await app.close();
});

test('real offline catalog agrees with manifest and renders every sprite', async () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'));
  const context = { window: {} };
  runInNewContext(readFileSync(new URL('catalog.js', pack), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SEASONAL_RESERVE)), manifest);
  assert.equal(manifest.sprites.length, 192);
  assert.equal(manifest.counts.baseShapes, 48);
  const app = boot(manifest);
  assert.equal(app.document.querySelectorAll('.card').length, 192);
  assert.equal(app.$('category').options.length, 7);
  for (const season of manifest.seasons) {
    app.change('season', season);
    assert.equal(app.document.querySelectorAll('.card').length, 48);
  }
  assert.match(app.$('count').textContent, /48 \/ 192/);
  await app.close();
});
