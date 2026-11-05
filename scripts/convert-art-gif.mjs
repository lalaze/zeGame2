// Re-encodes runtime art as GIF where the picture survives it, moves the PNG into
// assets/art-masters and rewrites the references. Safe to re-run: a PNG newly written to
// public/ by a pack script becomes the new master. `--revert` undoes everything.
//
// GIF has 256 colours and on/off transparency, so a file stays PNG when it:
//  - feeds the staff recolouring, which segments skin, hair and cloth by exact RGB
//    (team-pixel-art.ts): the shifted palette shows up as speckles on the figures;
//  - has soft regions, not just soft edges (glass, liquids): they would turn into holes;
//  - would barely shrink.
// Single frames only. The scene picks poses by state and recolours them on canvas, where
// an animated GIF only ever shows its first frame.
import fs from 'node:fs';
import path from 'node:path';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const PUBLIC = 'public', MASTERS = 'assets/art-masters', REPORT = `${MASTERS}/conversion.json`;
const TARGETS = JSON.parse(fs.readFileSync('scripts/runtime-art.json', 'utf8'));
/** The cut the game itself applies to its sprites (cozy-team-art.ts, cozy-seating-art.ts). */
const ALPHA_CUT = 100;
const MAX_SOFT_AREA = 0.01, MAX_SIZE_RATIO = 0.9;
const KEEP = [
  [/\/cozy-team-v\d+\//, 'recolour-pipeline'],
  // These sets change state on screen, so one member with real glass keeps them all PNG.
  [/\/till-jar-\d\.png$/, 'glass-set'],
  [/\/cozy-signature-v2\/cup-[a-z]+\.png$/, 'glass-set'],
];
/** Paths the code builds at runtime, which the literal rewrite below cannot see. */
const TEMPLATES = [
  ['src/ui/chain-ui.ts', '`${ART}shop-${place}.png`', '`${ART}shop-${place}.gif`'],
  ['src/ui/chain-ui.ts', '`${ART}perk-${id}.png`', '`${ART}perk-${id}.gif`'],
  ['src/render/cozy-materials.ts', '`cozy-world-v2/${id}.png`', '`cozy-world-v2/${id}.gif`'],
  ['src/render/cozy-materials.ts', '`cozy-world-v2/decor-${id}.png`', '`cozy-world-v2/decor-${id}.gif`'],
  ['src/render/cozy-world-assets.ts', '`cozy-world-v2/environment-${id}.png`', '`cozy-world-v2/environment-${id}.gif`'],
  ['src/render/cozy-world-assets.ts', '`cozy-world-v2/kitchen-${id}.png`', '`cozy-world-v2/kitchen-${id}.gif`'],
  ['src/render/cozy-world-assets.ts', '`cozy-idle-v1/gift-${id}.png`', '`cozy-idle-v1/gift-${id}.gif`'],
  ['src/render/cozy-seating-art.ts', "['ensemble.png','petting.png','idle-v4.png']", "['ensemble.gif','petting.gif','idle-v4.gif']"],
  ['src/render/cozy-cat-assets.ts', "breed.breed + '.png'", "breed.breed + '.gif'"],
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const toGif = (file) => file.replace(/\.png$/, '.gif');
const move = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); };

/** Share of visible pixels in a soft region: thin antialiased edges erode away, glass does not. */
function softArea(data, width, height) {
  const radius = Math.max(1, Math.round(Math.min(width, height) / 96)), stride = width + 1;
  const sums = new Int32Array(stride * (height + 1));
  let visible = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (alpha >= 8) visible++;
    sums[(y + 1) * stride + x + 1] = (alpha >= 8 && alpha <= 223 ? 1 : 0)
      + sums[y * stride + x + 1] + sums[(y + 1) * stride + x] - sums[y * stride + x];
  }
  let soft = 0;
  const full = (2 * radius + 1) ** 2;
  for (let y = radius; y < height - radius; y++) for (let x = radius; x < width - radius; x++) {
    const top = (y - radius) * stride, bottom = (y + radius + 1) * stride;
    if (sums[bottom + x + radius + 1] - sums[top + x + radius + 1] - sums[bottom + x - radius] + sums[top + x - radius] === full) soft++;
  }
  return visible ? soft / visible : 0;
}

async function encode(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const soft = softArea(data, info.width, info.height);
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] < ALPHA_CUT ? 0 : 255;
  const gif = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .gif({ colours: 256, dither: 0, effort: 10 }).toBuffer();
  return { gif, soft };
}

/** Rewrites only strings that resolve to exactly one of the given files. */
function rewriteReferences(files, from, to) {
  // catalog.json is left alone: it records each PNG's provenance and hash, and those PNGs live on as masters.
  const texts = ['assets/generated/runtime-catalog-v1/runtime.json',
    ...walk('src').filter((file) => /\.(ts|json|mjs)$/.test(file)),
    ...walk('public/art/generated').filter((file) => file.endsWith('manifest.json')),
    ...walk('scripts').filter((file) => /\.test\.(ts|mjs)$/.test(file))];
  const pattern = new RegExp(`(["'\`])([^"'\`$\\n]*\\${from})\\1`, 'g');
  let changed = 0;
  for (const file of texts) {
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(pattern, (whole, quote, value) => {
      const plain = value.replace(/^.*?public\//, '');
      const names = [plain, `art/generated/${plain}`];
      if (file.startsWith('public/')) names.push(path.posix.join(path.posix.dirname(file).slice('public/'.length), plain));
      if (!names.some((name) => files.has(name))) return whole;
      return `${quote}${value.slice(0, -from.length)}${to}${quote}`;
    });
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
  return changed;
}

function applyTemplates(reverse) {
  for (const [file, png, gif] of TEMPLATES) {
    const [from, to] = reverse ? [gif, png] : [png, gif];
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(from)) fs.writeFileSync(file, text.replace(from, to));
    else if (!text.includes(to)) throw new Error(`${file}: expected ${from}`);
  }
}

if (process.argv.includes('--revert')) {
  const rows = JSON.parse(fs.readFileSync(REPORT, 'utf8')).filter((row) => row.status === 'gif');
  for (const { file } of rows) {
    move(`${MASTERS}/${file}`, `${PUBLIC}/${file}`);
    fs.rmSync(`${PUBLIC}/${toGif(file)}`);
  }
  const changed = rewriteReferences(new Set(rows.map((row) => toGif(row.file))), '.gif', '.png');
  applyTemplates(true);
  fs.rmSync(MASTERS, { recursive: true });
  console.log(`restored ${rows.length} PNGs, ${changed} text files`);
} else {
  const rows = [];
  const queue = [...TARGETS];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const file = queue.shift();
      const fresh = `${PUBLIC}/${file}`, master = `${MASTERS}/${file}`;
      const source = fs.existsSync(fresh) ? fresh : master;
      const { gif, soft } = await encode(source);
      const png = fs.statSync(source).size;
      const status = KEEP.find(([pattern]) => pattern.test(file))?.[1]
        ?? (soft > MAX_SOFT_AREA ? 'soft-alpha' : gif.length > png * MAX_SIZE_RATIO ? 'no-saving' : 'gif');
      if (status === 'gif') {
        fs.writeFileSync(`${PUBLIC}/${toGif(file)}`, gif);
        if (source === fresh) move(fresh, master);
      } else if (source === master) {
        move(master, fresh);
        fs.rmSync(`${PUBLIC}/${toGif(file)}`, { force: true });
      }
      rows.push({ file, status, png, gif: gif.length, softArea: +soft.toFixed(4) });
    }
  }));
  rows.sort((a, b) => a.file.localeCompare(b.file));
  fs.mkdirSync(MASTERS, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(rows, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  const converted = rows.filter((row) => row.status === 'gif');
  const changed = rewriteReferences(new Set(converted.map((row) => row.file)), '.png', '.gif');
  applyTemplates(false);
  const mb = (bytes) => (bytes / 1048576).toFixed(1);
  const before = rows.reduce((sum, row) => sum + row.png, 0);
  const after = rows.reduce((sum, row) => sum + (row.status === 'gif' ? row.gif : row.png), 0);
  console.log(`${converted.length}/${rows.length} GIF, ${mb(before)} MB -> ${mb(after)} MB, ${changed} text files`);
  const kept = {};
  for (const row of rows) if (row.status !== 'gif') (kept[row.status] ??= []).push(row.file.split('/').slice(2).join('/'));
  for (const [why, list] of Object.entries(kept)) console.log(`kept ${why}: ${list.length}${list.length <= 12 ? ` (${list.join(', ')})` : ''}`);
}
