import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return groups.flat();
}

const RUNTIME_ART = new Set(JSON.parse(readFileSync(new URL('./runtime-art.json', import.meta.url), 'utf8')));

/**
 * What a player downloads up front: the app, the pack manifests and the art the game opens
 * with. runtime-art.json lists art by its PNG name, whichever format it ships in. Any other
 * art is cached the first time something asks for it.
 */
export function isPrecached(name, runtimeArt = RUNTIME_ART) {
  return !name.startsWith('art/') || name.endsWith('/manifest.json') || runtimeArt.has(name.replace(/\.gif$/, '.png'));
}

// Run after Vite has written both its hashed bundles and copied public files.
// The worker's own bytes affect its version, but it must never precache itself.
export async function generateServiceWorker(outputDirectory, templatePath, runtimeArt = RUNTIME_ART) {
  const template = await readFile(templatePath, 'utf8');
  const files = (await filesIn(outputDirectory))
    .filter((path) => relative(outputDirectory, path) !== 'sw.js' && !path.endsWith('.map'))
    .sort();
  const hash = createHash('sha256').update(template);
  const rows = [];
  for (const path of files) {
    const name = relative(outputDirectory, path).split('\\').join('/');
    const bytes = await readFile(path);
    hash.update(name).update('\0').update(bytes).update('\0');
    const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    rows.push([`./${name.split('/').map(encodeURIComponent).join('/')}`, revision, isPrecached(name, runtimeArt) ? 1 : 0]);
  }
  const manifest = rows.filter((row) => row[2]).map((row) => row[0]);
  if (!manifest.includes('./index.html')) throw new Error('Offline shell requires index.html');
  const source = template
    .replace("'__PRECACHE_MANIFEST__'", JSON.stringify(rows))
    .replace('__PRECACHE_VERSION__', hash.digest('hex').slice(0, 20));
  await writeFile(join(outputDirectory, 'sw.js'), source);
  return { source, manifest };
}

export function offlinePrecache() {
  let outputDirectory;
  let templatePath;
  let base;
  return {
    name: 'tiny-bean-offline-precache',
    apply: 'build',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
      templatePath = resolve(config.publicDir, 'sw.js');
      base = config.base;
    },
    transformIndexHtml() {
      return [{
        tag: 'script',
        injectTo: 'head-prepend',
        // Start installation before the game module and its large dependencies
        // finish loading. Failure must not prevent ordinary online play.
        children: `if ('serviceWorker' in navigator) navigator.serviceWorker.register(${JSON.stringify(`${base}sw.js`)}, { updateViaCache: 'none' }).catch(() => {});`,
      }];
    },
    async closeBundle() {
      await generateServiceWorker(outputDirectory, templatePath);
    },
  };
}
