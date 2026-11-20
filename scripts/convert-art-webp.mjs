// Ships the game's art as lossless WebP, pixel for pixel what it shipped as before (GIF or PNG).
// Every visible pixel keeps its exact RGBA, so the staff recolouring, which segments by exact
// RGB, and soft glass both survive; the encoder is checked against its source for each file.
//
// Targets are scripts/runtime-art.json (the opening art, listed by PNG name) and the owner looks
// in cozy-team-v9 that load when first worn. Each target's PNG master stays in, or moves to,
// assets/art-masters, which is where tests and offline tools read pixels (scripts/art-files.mjs).
//
// Safe to re-run: a PNG or GIF a pack script writes into public/ replaces that file's WebP, and a
// PNG becomes its new master. Revert with git.
import fs from 'node:fs';
import path from 'node:path';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const PUBLIC = 'public', MASTERS = 'assets/art-masters', REPORT = `${MASTERS}/webp.json`;
/** Loaded on demand rather than precached, so not in runtime-art.json. */
const LAZY_PACKS = ['art/generated/cozy-team-v9'];
/** Paths the code builds at runtime, which the literal rewrite below cannot see. */
const TEMPLATES = [
  ['src/ui/chain-ui.ts', '`${ART}shop-${place}.gif`', '`${ART}shop-${place}.webp`'],
  ['src/ui/chain-ui.ts', '`${ART}perk-${id}.gif`', '`${ART}perk-${id}.webp`'],
  ['src/render/cozy-materials.ts', '`cozy-world-v2/${id}.gif`', '`cozy-world-v2/${id}.webp`'],
  ['src/render/cozy-materials.ts', '`cozy-world-v2/decor-${id}.gif`', '`cozy-world-v2/decor-${id}.webp`'],
  ['src/render/cozy-world-assets.ts', '`cozy-world-v2/environment-${id}.gif`', '`cozy-world-v2/environment-${id}.webp`'],
  ['src/render/cozy-world-assets.ts', '`cozy-world-v2/kitchen-${id}.gif`', '`cozy-world-v2/kitchen-${id}.webp`'],
  ['src/render/cozy-world-assets.ts', '`cozy-idle-v1/gift-${id}.gif`', '`cozy-idle-v1/gift-${id}.webp`'],
  ['src/render/cozy-seating-art.ts', "['ensemble.gif','petting.gif','idle-v4.gif']", "['ensemble.webp','petting.webp','idle-v4.webp']"],
  ['src/render/cozy-cat-assets.ts', "breed.breed + '.gif'", "breed.breed + '.webp'"],
  ['src/render/street-art.ts', '`${base}art/street-scene/${name}.png`', '`${base}art/street-scene/${name}.webp`'],
  ['src/render/street-art.ts', '`${base}art/street-art-v2/${name}.png`', '`${base}art/street-art-v2/${name}.webp`'],
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const withExt = (file, ext) => file.replace(/\.png$/, ext);
const move = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); };

function targets() {
  const list = new Set(JSON.parse(fs.readFileSync('scripts/runtime-art.json', 'utf8')));
  for (const pack of LAZY_PACKS) for (const name of fs.readdirSync(`${PUBLIC}/${pack}`)) {
    if (/\.(png|gif|webp)$/.test(name)) list.add(`${pack}/${name.replace(/\.(gif|webp)$/, '.png')}`);
  }
  return [...list].sort();
}

/** RGBA with the colour of fully transparent pixels cleared: no browser can show it. */
async function pixels(file) {
  const meta = await sharp(file).metadata();
  if (meta.pages > 1) throw new Error(`${file}: animated`);
  if (meta.orientation && meta.orientation !== 1) throw new Error(`${file}: EXIF orientation ${meta.orientation}`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
  return { data, width: info.width, height: info.height };
}

async function encode(file) {
  const source = await pixels(file);
  const raw = { width: source.width, height: source.height, channels: 4 };
  const webp = await sharp(source.data, { raw }).webp({ lossless: true, effort: 6 }).toBuffer();
  const back = await sharp(webp).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < source.data.length; i += 4) {
    const alpha = source.data[i + 3];
    if (back[i + 3] !== alpha || (alpha && (back[i] !== source.data[i] || back[i + 1] !== source.data[i + 1] || back[i + 2] !== source.data[i + 2])))
      throw new Error(`${file}: WebP differs at pixel ${i / 4}`);
  }
  return { webp, source, raw };
}

/** Rewrites only strings that resolve to exactly one of the given files. */
function rewriteReferences(files, from) {
  // catalog.json is left alone: it records each PNG's provenance and hash, and those PNGs live on as masters.
  const texts = ['assets/generated/runtime-catalog-v1/runtime.json',
    ...walk('src').filter((file) => /\.(ts|json|mjs|css)$/.test(file)),
    ...walk(`${PUBLIC}/art`).filter((file) => file.endsWith('manifest.json')),
    ...walk('scripts').filter((file) => /\.test\.(ts|mjs)$/.test(file))];
  const pattern = new RegExp(`(["'\`])([^"'\`$\\n]*\\${from})\\1`, 'g');
  let changed = 0;
  for (const file of texts) {
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(pattern, (whole, quote, value) => {
      const plain = value.replace(/^.*?public\//, '').replace(/^\.?\//, '');
      const names = [plain, `art/${plain}`, `art/generated/${plain}`];
      if (file.startsWith(`${PUBLIC}/`)) names.push(path.posix.join(path.posix.dirname(file).slice(PUBLIC.length + 1), plain));
      if (!names.some((name) => files.has(name))) return whole;
      return `${quote}${value.slice(0, -from.length)}.webp${quote}`;
    });
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
  return changed;
}

function applyTemplates() {
  for (const [file, from, to] of TEMPLATES) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(from)) fs.writeFileSync(file, text.replace(from, to));
    else if (!text.includes(to)) throw new Error(`${file}: expected ${from}`);
  }
}

const previous = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : [];
const rows = new Map(previous.map((row) => [row.file, row]));
const fresh = { '.gif': new Set(), '.png': new Set() };
const queue = targets();
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const file = queue.shift();
    const png = `${PUBLIC}/${file}`, gif = `${PUBLIC}/${withExt(file, '.gif')}`, out = `${PUBLIC}/${withExt(file, '.webp')}`;
    const master = `${MASTERS}/${file}`;
    const ext = fs.existsSync(png) ? '.png' : fs.existsSync(gif) ? '.gif' : null;
    if (!ext) {
      if (!fs.existsSync(out)) throw new Error(`missing ${file}`);
      continue;
    }
    const source = ext === '.png' ? png : gif;
    const { webp, source: decoded, raw } = await encode(source);
    const bytes = fs.statSync(source).size;
    fs.writeFileSync(out, webp);
    if (ext === '.png') move(png, master);
    else {
      // A GIF from a pack script that keeps no PNG of its own: its pixels become the master.
      if (!fs.existsSync(master)) {
        fs.mkdirSync(path.dirname(master), { recursive: true });
        fs.writeFileSync(master, await sharp(decoded.data, { raw }).png({ compressionLevel: 9 }).toBuffer());
      }
      fs.rmSync(gif);
    }
    // A pack script may leave both: everything that pointed at either now points at the WebP.
    for (const [kind, stale] of [['.png', png], ['.gif', gif]]) if (fs.existsSync(stale) || kind === ext) {
      fs.rmSync(stale, { force: true });
      fresh[kind].add(withExt(file, kind));
    }
    rows.set(file, { file, from: ext.slice(1), bytes, webp: webp.length });
  }
}));

const report = [...rows.values()].sort((a, b) => a.file.localeCompare(b.file));
fs.mkdirSync(MASTERS, { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 0).replace(/\},\{/g, '},\n{') + '\n');
const changed = rewriteReferences(fresh['.gif'], '.gif') + rewriteReferences(fresh['.png'], '.png');
applyTemplates();
const mb = (bytes) => (bytes / 1048576).toFixed(2);
const before = report.reduce((sum, row) => sum + row.bytes, 0), after = report.reduce((sum, row) => sum + row.webp, 0);
console.log(`${fresh['.gif'].size} GIF + ${fresh['.png'].size} PNG -> WebP this run; ${report.length} files ${mb(before)} MB -> ${mb(after)} MB; ${changed} text files`);
