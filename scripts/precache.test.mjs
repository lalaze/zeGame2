import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { generateServiceWorker, offlinePrecache } from './precache.mjs';
import { build } from 'vite';

const templatePath = new URL('../public/sw.js', import.meta.url);
const temporary = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function buildFixture(extraFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cafe-precache-'));
  temporary.push(dir);
  await mkdir(join(dir, 'assets'));
  for (const [name, body] of Object.entries({
    'index.html': '<script src="./assets/app-123.js"></script>',
    'assets/app-123.js': 'game',
    'assets/style-123.css': 'style',
    'assets/font-123.woff2': 'font',
    'manifest.webmanifest': 'manifest',
    'icon-192.png': 'icon',
    'assets/app-123.js.map': 'excluded source map',
    'sw.js': 'old worker',
    ...extraFiles,
  })) await writeFile(join(dir, name), body);
  return { dir, ...(await generateServiceWorker(dir, templatePath)) };
}

function worker(source, scope = 'https://example.test/games/cafe/', existing = new Map()) {
  const handlers = {};
  let offline = false;
  const keyOf = (request) => typeof request === 'string' ? request : request.url;
  const fetch = vi.fn(async (request) => {
    if (offline) throw new TypeError('Offline');
    return new Response(keyOf(request));
  });
  const caches = {
    keys: async () => [...existing.keys()],
    delete: vi.fn(async (key) => existing.delete(key)),
    open: async (name) => {
      if (!existing.has(name)) existing.set(name, new Map());
      const entries = existing.get(name);
      return {
        match: async (request) => entries.get(keyOf(request))?.clone(),
        put: async (request, response) => { entries.set(keyOf(request), response.clone()); },
        addAll: async (requests) => {
          const responses = await Promise.all(requests.map((request) => fetch(request)));
          // Like Cache.addAll, HTTP failures reject the entire batch before
          // committing any response, even though fetch itself resolved.
          if (responses.some((response) => !response.ok)) throw new TypeError('Unsuccessful precache response');
          requests.forEach((request, i) => entries.set(keyOf(request), responses[i]));
        },
      };
    },
  };
  const claim = vi.fn();
  const skipWaiting = vi.fn();
  runInNewContext(source, {
    self: { registration: { scope }, location: { origin: new URL(scope).origin },
      clients: { claim }, skipWaiting,
      addEventListener: (type, callback) => { handlers[type] = callback; } },
    caches, fetch, Request, Response, URL,
  });
  return {
    caches, existing, fetch, claim, skipWaiting,
    goOffline: () => { offline = true; },
    async lifecycle(type) {
      const pending = [];
      handlers[type]({ waitUntil: (promise) => pending.push(promise) });
      await Promise.all(pending);
    },
    async request(path, mode = 'cors', method = 'GET') {
      let response;
      const pending = [];
      handlers.fetch({ request: { url: new URL(path, scope).href, mode, method },
        respondWith: (promise) => { response = promise; },
        waitUntil: (promise) => pending.push(promise) });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

describe('production offline app shell', () => {
  it('generates all emitted assets and public files, excluding itself and sourcemaps', async () => {
    const { source, manifest, dir } = await buildFixture();
    expect(manifest).toEqual(['./assets/app-123.js', './assets/font-123.woff2', './assets/style-123.css', './icon-192.png', './index.html', './manifest.webmanifest']);
    expect(source).not.toContain('__PRECACHE_');
    expect(await readFile(join(dir, 'sw.js'), 'utf8')).toBe(source);
    expect((await generateServiceWorker(dir, templatePath)).source).toBe(source);
    await writeFile(join(dir, 'icon-192.png'), 'changed icon');
    expect((await generateServiceWorker(dir, templatePath)).source).not.toBe(source);
  });

  it.each(['https://example.test/', 'https://example.test/games/cafe/'])('first install permits immediate offline reopen at %s without any prior controlled fetch', async (scope) => {
    const { source, manifest } = await buildFixture();
    const app = worker(source, scope);
    await app.lifecycle('install');
    expect(app.fetch).toHaveBeenCalledTimes(manifest.length);
    expect(app.fetch.mock.calls.every(([request]) => request.cache === 'reload')).toBe(true);
    await app.lifecycle('activate');
    expect(app.claim).toHaveBeenCalledOnce();
    app.goOffline();
    // Neither navigation URL was fetched by a controlled page before going offline.
    for (const path of ['./', './?launch=installed', './index.html?launch=installed']) {
      expect(await (await app.request(path, 'navigate')).text()).toBe(new URL('./index.html', scope).href);
    }
    const nested = await app.request('./room/deep?from=bookmark', 'navigate');
    expect(nested.status).toBe(302);
    expect(nested.headers.get('location')).toBe(scope);
    for (const path of manifest.filter((path) => path !== './index.html')) {
      expect(await (await app.request(path)).text()).toBe(new URL(path, scope).href);
    }
  });

  it('reopens the merged artwork page offline without replacing it with the game', async () => {
    const { dir } = await buildFixture();
    await writeFile(join(dir, 'sprite-preview.html'), '<main>Artwork and 30 customers</main>');
    const { source, manifest } = await generateServiceWorker(dir, templatePath);
    expect(manifest).toContain('./sprite-preview.html');
    const app = worker(source);
    await app.lifecycle('install');
    app.goOffline();
    for (const path of ['./sprite-preview.html', './sprite-preview.html?view=customers']) {
      const response = await app.request(path, 'navigate');
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('https://example.test/games/cafe/sprite-preview.html');
    }
  });

  it('limits installation to four requests and waits for each batch before starting the next', async () => {
    const { source, manifest } = await buildFixture({ 'extra-a.bin': 'a', 'extra-b.bin': 'b', 'extra-c.bin': 'c' });
    const app = worker(source);
    const releases = new Map();
    const gates = new Map(manifest.map((path) => {
      const url = new URL(path, 'https://example.test/games/cafe/').href;
      return [url, new Promise((resolve) => releases.set(url, resolve))];
    }));
    const urls = [...gates.keys()];
    let active = 0;
    let peak = 0;
    app.fetch.mockImplementation(async (request) => {
      active++;
      peak = Math.max(peak, active);
      await gates.get(request.url);
      active--;
      return new Response(request.url);
    });
    let installed = false;
    const install = app.lifecycle('install').then(() => { installed = true; });
    const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
    await nextTurn();
    expect(app.fetch).toHaveBeenCalledTimes(4);
    expect(active).toBe(4);
    for (const url of urls.slice(0, 3)) releases.get(url)();
    await nextTurn();
    expect(app.fetch).toHaveBeenCalledTimes(4);
    expect(active).toBe(1);
    expect(installed).toBe(false);

    releases.get(urls[3])();
    await nextTurn();
    expect(app.fetch).toHaveBeenCalledTimes(8);
    expect(active).toBe(4);
    for (const url of urls.slice(4, 8)) releases.get(url)();
    await nextTurn();
    expect(app.fetch).toHaveBeenCalledTimes(9);
    expect(active).toBe(1);
    expect(installed).toBe(false);
    expect(app.claim).not.toHaveBeenCalled();
    expect(app.skipWaiting).not.toHaveBeenCalled();

    releases.get(urls[8])();
    await install;
    expect(installed).toBe(true);
    expect(active).toBe(0);
    expect(peak).toBe(4);
    expect(app.fetch.mock.calls.map(([request]) => request.url)).toEqual(urls);
    expect(app.fetch.mock.calls.every(([request]) => request.cache === 'reload')).toBe(true);
  });

  it('holds installation open until the final shell asset in the final batch has downloaded', async () => {
    const { source, manifest } = await buildFixture();
    const app = worker(source);
    let release;
    let reached;
    const gate = new Promise((resolve) => { release = resolve; });
    const lastStarted = new Promise((resolve) => { reached = resolve; });
    const lastUrl = new URL(manifest.at(-1), 'https://example.test/games/cafe/').href;
    app.fetch.mockImplementation(async (request) => {
      if (request.url === lastUrl) { reached(); await gate; }
      return new Response(request.url);
    });
    let installed = false;
    const install = app.lifecycle('install').then(() => { installed = true; });
    await lastStarted;
    expect(app.fetch).toHaveBeenCalledTimes(manifest.length);
    expect(installed).toBe(false);
    expect(app.claim).not.toHaveBeenCalled();
    release();
    await install;
    expect(installed).toBe(true);
  });

  it('uses the installed shell when navigation receives a server error', async () => {
    const { source } = await buildFixture();
    const app = worker(source);
    await app.lifecycle('install');
    app.fetch.mockImplementationOnce(async () => new Response('unavailable', { status: 503 }));
    expect(await (await app.request('./', 'navigate')).text()).toBe('https://example.test/games/cafe/index.html');
  });

  it('deletes only old caches for this exact app scope and does not force an update over open tabs', async () => {
    const { source } = await buildFixture();
    const scope = 'https://example.test/games/cafe/';
    const old = `tiny-bean-cafe:${encodeURIComponent(scope)}:old`;
    const sibling = `tiny-bean-cafe:${encodeURIComponent('https://example.test/other/')}:old`;
    const existing = new Map([[old, new Map()], [sibling, new Map()], ['other-app-cache', new Map()]]);
    const app = worker(source, scope, existing);
    await app.lifecycle('install');
    expect(app.skipWaiting).not.toHaveBeenCalled();
    await app.lifecycle('activate');
    expect(app.caches.delete.mock.calls).toEqual([[old]]);
    expect(existing.has(sibling)).toBe(true);
    expect(existing.has('other-app-cache')).toBe(true);
  });

  it('rejects incomplete installs without deleting the previous working cache', async () => {
    const { source } = await buildFixture();
    const old = `tiny-bean-cafe:${encodeURIComponent('https://example.test/games/cafe/')}:previous-working-version`;
    const app = worker(source, undefined, new Map([[old, new Map()]]));
    app.fetch.mockImplementationOnce(async () => { throw new TypeError('Missing bundle'); });
    await expect(app.lifecycle('install')).rejects.toThrow('Missing bundle');
    expect(app.caches.delete).not.toHaveBeenCalled();
    expect(app.claim).not.toHaveBeenCalled();
    expect(app.existing.has(old)).toBe(true);
  });

  it.each([
    ['network', 0], ['HTTP', 0], ['network', 4], ['HTTP', 4],
  ])('rejects a %s failure at entry %i, preserves the old cache, and safely retries the partial version', async (failure, failedIndex) => {
    const { source, manifest } = await buildFixture({ 'extra-a.bin': 'a', 'extra-b.bin': 'b', 'extra-c.bin': 'c' });
    const scope = 'https://example.test/games/cafe/';
    const urls = manifest.map((path) => new URL(path, scope).href);
    const shellUrl = new URL('./index.html', scope).href;
    const old = `tiny-bean-cafe:${encodeURIComponent(scope)}:previous-working-version`;
    const oldEntries = new Map([[shellUrl, new Response('previous working shell')]]);
    const app = worker(source, scope, new Map([[old, oldEntries]]));
    app.fetch.mockImplementation(async (request) => {
      if (request.url === urls[failedIndex]) {
        if (failure === 'network') throw new TypeError('Missing bundle');
        return new Response('unavailable', { status: 503 });
      }
      return new Response(`first attempt: ${request.url}`);
    });
    await expect(app.lifecycle('install')).rejects.toThrow(
      failure === 'network' ? 'Missing bundle' : 'Unsuccessful precache response');
    expect(app.fetch).toHaveBeenCalledTimes(failedIndex + 4);
    expect(app.fetch.mock.calls.map(([request]) => request.url)).toEqual(urls.slice(0, failedIndex + 4));
    expect(app.caches.delete).not.toHaveBeenCalled();
    expect(app.claim).not.toHaveBeenCalled();
    expect(app.skipWaiting).not.toHaveBeenCalled();
    expect(app.existing.get(old)).toBe(oldEntries);
    expect(await oldEntries.get(shellUrl).clone().text()).toBe('previous working shell');
    const newKeys = [...app.existing.keys()].filter((key) => key !== old);
    expect(newKeys).toHaveLength(1);
    const partial = app.existing.get(newKeys[0]);
    expect([...partial.keys()]).toEqual(urls.slice(0, failedIndex));

    // A new installer sees the same partially populated version cache. It
    // reloads all entries, including earlier batches, rather than treating
    // their mere presence as proof that the complete offline shell is ready.
    const retry = worker(source, scope, app.existing);
    const defaultFetch = retry.fetch.getMockImplementation();
    retry.fetch.mockImplementation(async (request) => new Response(`retry: ${request.url}`));
    await retry.lifecycle('install');
    expect(retry.fetch.mock.calls.map(([request]) => request.url)).toEqual(urls);
    expect(retry.fetch.mock.calls.every(([request]) => request.cache === 'reload')).toBe(true);
    expect(retry.existing.get(newKeys[0])).toBe(partial);
    expect([...partial.keys()]).toEqual(urls);
    expect(retry.caches.delete).not.toHaveBeenCalled();
    expect(retry.claim).not.toHaveBeenCalled();
    expect(retry.skipWaiting).not.toHaveBeenCalled();
    expect(await oldEntries.get(shellUrl).clone().text()).toBe('previous working shell');
    for (const url of urls) expect(await partial.get(url).clone().text()).toBe(`retry: ${url}`);

    await retry.lifecycle('activate');
    expect(retry.caches.delete.mock.calls).toEqual([[old]]);
    expect(retry.claim).toHaveBeenCalledOnce();
    retry.fetch.mockImplementation(defaultFetch);
    retry.goOffline();
    for (const path of manifest) expect(await (await retry.request(path)).text()).toBe(`retry: ${new URL(path, scope).href}`);
    expect(await (await retry.request('./', 'navigate')).text()).toBe(`retry: ${shellUrl}`);
  });

  it('does not serve responses from unrelated caches or intercept foreign/out-of-scope/non-GET traffic', async () => {
    const { source } = await buildFixture();
    const app = worker(source);
    await app.lifecycle('install');
    await app.lifecycle('activate');
    const unrelated = await app.caches.open('another-app');
    await unrelated.put('https://example.test/games/cafe/not-ours.js', new Response('foreign'));
    app.goOffline();
    await expect(app.request('./not-ours.js')).rejects.toThrow('Offline');
    expect(await app.request('https://foreign.test/image.png')).toBeUndefined();
    expect(await app.request('/other-app/file')).toBeUndefined();
    expect(await app.request('./', 'cors', 'POST')).toBeUndefined();
  });

  it('keeps the installed fallback shell stable across online navigation and caches runtime assets', async () => {
    const { source } = await buildFixture();
    const app = worker(source);
    await app.lifecycle('install');
    app.fetch.mockImplementationOnce(async () => new Response('new server page'));
    expect(await (await app.request('./index.html', 'navigate')).text()).toBe('new server page');
    expect(await (await app.request('./new-asset.js')).text()).toContain('new-asset.js');
    app.goOffline();
    expect(await (await app.request('./index.html', 'navigate')).text()).toBe('https://example.test/games/cafe/index.html');
    expect(await (await app.request('./new-asset.js')).text()).toContain('new-asset.js');
  });
});


describe('Vite precache integration', () => {
  it.each(['./', '/games/cafe/'])('injects early production registration and precaches actual output at base %s', async (base) => {
    const root = await mkdtemp(join(tmpdir(), 'cafe-vite-'));
    temporary.push(root);
    await mkdir(join(root, 'public'));
    await writeFile(join(root, 'public/sw.js'), await readFile(templatePath));
    await writeFile(join(root, 'public/icon.svg'), '<svg/>');
    await writeFile(join(root, 'index.html'), '<html><head></head><body><script type="module" src="/main.js"></script></body></html>');
    await writeFile(join(root, 'main.js'), "import './style.css'; document.body.dataset.loaded = 'yes';");
    await writeFile(join(root, 'style.css'), 'body { color: red; }');
    await build({ configFile: false, root, base, plugins: [offlinePrecache()], logLevel: 'silent' });
    const html = await readFile(join(root, 'dist/index.html'), 'utf8');
    const source = await readFile(join(root, 'dist/sw.js'), 'utf8');
    expect(html).toContain(`register("${base}sw.js", { updateViaCache: 'none' })`);
    expect(html.indexOf('serviceWorker.register')).toBeLessThan(html.indexOf('type="module"'));
    expect(source).not.toContain('__PRECACHE_');
    expect(source).toMatch(/\.\/assets\/index-[^" ]+\.js/);
    expect(source).toMatch(/\.\/assets\/index-[^" ]+\.css/);
    expect(source).toContain('./icon.svg');
    const app = worker(source);
    await app.lifecycle('install');
    app.goOffline();
    expect((await app.request('./', 'navigate')).ok).toBe(true);
  });
});
