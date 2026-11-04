import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';
import { EFFECTS, drawEffect } from './build-ambient-reserve.mjs';
import { decodePng } from './pixel-conform.mjs';

const root = new URL('../assets/generated/ambient-reserve-v1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const html = readFileSync(new URL('index.html', root), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const hash = data => createHash('sha256').update(data).digest('hex');
function boot(reduced = false) {
  const window = new Window({ url: 'http://localhost/ambient-reserve-v1/', settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const document = window.document;
  document.body.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '');
  window.AMBIENT_RESERVE = manifest;
  window.matchMedia = () => ({ matches: reduced, addEventListener() {} });
  const paints = [], callbacks = [];
  window.HTMLCanvasElement.prototype.getContext = () => ({ imageSmoothingEnabled: true, clearRect() {}, drawImage(...args) { paints.push(args); } });
  class MockImage { naturalWidth = 512; naturalHeight = 64; set src(value) { this.url = value; this.onload?.(); } }
  const context = { window, document, Image: MockImage, performance: { now: () => 0 }, requestAnimationFrame: fn => callbacks.push(fn) };
  runInNewContext(script, context);
  const $ = id => document.getElementById(id);
  return { window, document, $, context, paints, callbacks, close: () => window.happyDOM.abort() };
}
test('effect sources cover 16 effects and 32 distinct eight-frame clips', () => {
  assert.equal(EFFECTS.length, 16); assert.equal(manifest.clips.length, 32); assert.equal(manifest.counts.frames, 256);
  for (const clip of manifest.clips) {
    assert.equal(clip.frameCount, 8); assert.equal(clip.durationMs, 1000); assert.equal(clip.fps, 8); assert.equal(clip.density, 2);
    const effect = EFFECTS.find(e => e.id === clip.effect), strength = clip.strength === 'lively' ? 1 : 0, hashes = new Set();
    for (let f = 0; f < 8; f++) {
      const a = drawEffect(effect, strength, f), b = drawEffect(effect, strength, f);
      assert.equal(hash(a.pixels), hash(b.pixels)); hashes.add(hash(a.pixels));
    }
    assert.equal(hashes.size, 8, clip.id);
  }
});
test('strips and individual frames have exact matching pixels and stable anchors', () => {
  for (const clip of manifest.clips) {
    const strip = decodePng(new URL(clip.strip, root)); assert.equal(strip.width, 512); assert.equal(strip.height, 64);
    assert.deepEqual(clip.anchor, { x: .5, y: .875 });
    for (const frame of clip.frames) {
      const image = decodePng(new URL(frame.path, root)); assert.equal(hash(image.pixels), frame.pixelSha256);
      for (let y = 0; y < 64; y++) {
        const at = (y * 512 + frame.index * 64) * 4;
        assert.deepEqual(strip.pixels.slice(at, at + 256), image.pixels.slice(y * 256, (y + 1) * 256));
      }
    }
  }
});
test('effect browser catalog is exactly the PNG manifest', () => {
  const context = { window: {} }; runInNewContext(readFileSync(new URL('catalog.js', root), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.AMBIENT_RESERVE)), manifest);
});
test('reduced motion starts paused and manual frame controls work', async () => {
  const app = boot(true); assert.equal(app.$('play').getAttribute('aria-pressed'), 'false'); assert.match(app.$('status').textContent, /系统设置/);
  assert.equal(app.document.querySelectorAll('.card').length, 32);
  app.$('step').click(); assert.equal(app.$('frame-label').textContent, '2/8');
  app.callbacks[0](100); assert.equal(app.paints.length, 32); assert.equal(app.paints[0][1], 64);
  app.$('play').click(); assert.equal(app.$('play').getAttribute('aria-pressed'), 'true');
  app.$('frame').value = '7'; app.$('frame').dispatchEvent(new app.window.Event('input')); assert.equal(app.$('frame-label').textContent, '8/8'); assert.equal(app.$('play').getAttribute('aria-pressed'), 'false');
  app.$('strength').value = 'gentle'; app.$('strength').dispatchEvent(new app.window.Event('change')); assert.equal([...app.document.querySelectorAll('.card')].filter(e => !e.hidden).length, 16);
  await app.close();
});
test('looping frames wrap while single-shot feedback holds last frame before repeat', async () => {
  const app = boot();
  assert.equal(runInNewContext('frameAt({durationMs:1000,loop:true,frameCount:8,fps:8},1000)', app.context), 0);
  assert.equal(runInNewContext('frameAt({durationMs:1000,loop:false,frameCount:8,fps:8},1250)', app.context), 7);
  assert.equal(runInNewContext('frameAt({durationMs:1000,loop:false,frameCount:8,fps:8},1500)', app.context), 0);
  assert.equal(runInNewContext('frameAt({durationMs:1000,loop:true,frameCount:8,fps:8},250,2)', app.context), 4);
  assert.equal(app.window.localStorage.length, 0); await app.close();
});

test('paused previews stop requesting frames until a manual repaint', async () => {
  const app = boot(true);
  assert.equal(app.callbacks.length, 1, 'initial image loads share one pending repaint');
  app.callbacks.shift()(0);
  assert.equal(app.callbacks.length, 0, 'paused preview does not schedule another frame');
  app.$('step').click();
  assert.equal(app.callbacks.length, 1);
  app.callbacks.shift()(100);
  assert.equal(app.callbacks.length, 0);
  app.$('play').click();
  app.callbacks.shift()(200);
  assert.equal(app.callbacks.length, 1, 'playing preview schedules another frame');
  app.$('play').click();
  app.callbacks.shift()(300);
  assert.equal(app.callbacks.length, 0, 'pause drains the last pending repaint');
  await app.close();
});
