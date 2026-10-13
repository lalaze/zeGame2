/** Separate component build. Does not clear or rebuild the production dist. */
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const publish = process.argv.includes('--publish');
assert(process.argv.slice(2).every(arg => arg === '--publish'), 'Only --publish is supported.');
const root = fileURLToPath(new URL('./qa-replay/', import.meta.url));
const outDir = fileURLToPath(new URL('./replay-dist/', import.meta.url));
await build({
  configFile: false, root, publicDir: false, base: '/',
  build: { outDir, emptyOutDir: false, assetsDir: 'qa-replay/assets', chunkSizeWarningLimit: 1600,
    rolldownOptions: { input: `${root}/index.html` } },
});
await writeFile(`${outDir}/.gitignore`, '*\n');
const html = await readFile(`${outDir}/index.html`, 'utf8');
assert(html.includes('Synthetic seeded component replay, not live player save'));
assert(html.includes('/qa-replay/assets/'), 'Built entry URLs must match the isolated dist subdirectory.');
if (publish) {
  const destination = fileURLToPath(new URL('../../dist/qa-replay/', import.meta.url));
  await mkdir(destination, { recursive: true });
  await cp(`${outDir}/qa-replay/assets`, `${destination}/assets`, { recursive: true });
  await cp(`${outDir}/index.html`, `${destination}/index.html`);
}
console.log(publish ? 'Published only dist/qa-replay. Open /qa-replay/?qa-light=10.' :
  'Staged in docs/pixel-depth/replay-dist. After the main build, run this script with --publish to install only dist/qa-replay.');
