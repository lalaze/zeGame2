// Compile the Codex-generated staff kits (assets/generated/cozy-team-v9/kits) into the pack the
// game loads, public/art/generated/cozy-team-v9:
//   hair-N-name-v2.png   one hairstyle: nine standing poses, then six-frame walk cycles
//   seated-a..h-v2.png   three seated poses for each of four hairstyles
//   chef-walk-v2.png, chef-seated-v2.png
//   manifest.json        pose bounds in the order src/render/cozy-team-art.ts reads them
// Each kit is one generated sheet (scripts/art-gen/team-batch.mjs) with its colours snapped to
// the source colours the recolouring pipeline labels reliably (scripts/art-gen/team-kit.mjs).
// Sheets stay PNG: the pipeline reads exact colours. selected.json may pin a take per look.
//
//   node scripts/build-team-v9.mjs [--partial]
// --partial stands look 0 in for looks that have no kit yet (for trying the loader early).
import fs from 'node:fs';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
import { blank, blit } from './art-gen/lib.mjs';
import { COLS, seatAnchors, teamKit } from './art-gen/team-kit.mjs';

const ROOT = 'assets/generated/cozy-team-v9', OUT = 'public/art/generated/cozy-team-v9', PAD = 3;
const partial = process.argv.includes('--partial');
const styles = JSON.parse(fs.readFileSync(`${ROOT}/hairstyles.json`, 'utf8'));
const selected = fs.existsSync(`${ROOT}/selected.json`) ? JSON.parse(fs.readFileSync(`${ROOT}/selected.json`, 'utf8')) : {};
const looks = Object.keys(styles).filter(id => id !== 'chef').sort((a, b) => a - b);
/** Sheet columns: 0 stands, 1 and 4 are the two forward steps, 1 to 6 the walk cycle. */
const STANDING = [0, 1, 4], CYCLE = [1, 2, 3, 4, 5, 6];

function kitOf(id) {
  const base = `${ROOT}/kits/${id}`;
  if (!fs.existsSync(base)) return null;
  const takes = fs.readdirSync(base).filter(name => /^take-\d+$/.test(name) && fs.existsSync(`${base}/${name}/sheet.png`)).sort((a, b) => a.slice(5) - b.slice(5));
  const take = selected[id] ? `take-${selected[id]}` : takes.at(-1);
  return take && takes.includes(take) ? `${base}/${take}` : null;
}
/** Lay figures out on a grid, feet on each row's baseline; returns the atlas and each figure's bounds. */
function pack(rows) {
  const cw = Math.max(...rows.flat().map(f => f.width)) + PAD * 2, ch = Math.max(...rows.flat().map(f => f.height)) + PAD * 2;
  const atlas = blank(cw * Math.max(...rows.map(row => row.length)), ch * rows.length);
  const bounds = rows.map((row, r) => row.map((f, c) => {
    const x = c * cw + Math.floor((cw - f.width) / 2), y = (r + 1) * ch - PAD - f.height;
    blit(atlas, f, 0, 0, f.width, f.height, x, y);
    return [x, y, x + f.width, y + f.height];
  }));
  return { atlas, bounds };
}
const write = (file, atlas) => sharp(Buffer.from(atlas.pixels.buffer, atlas.pixels.byteOffset, atlas.pixels.length), { raw: { width: atlas.width, height: atlas.height, channels: 4 } })
  .png({ palette: true, colours: 64, dither: 0, effort: 10, compressionLevel: 9 }).toFile(`${OUT}/${file}`);
/** Bounds in loader order: stand, step, step for front, back, right; then the three cycles. */
const walkBounds = bounds => [...bounds.flatMap(row => STANDING.map(c => row[c])), ...bounds.flatMap(row => CYCLE.map(c => row[c]))];

fs.mkdirSync(OUT, { recursive: true });
const report = [], kits = new Map();
for (const id of [...looks, 'chef']) {
  const kit = kitOf(id) ?? (partial ? kitOf('0') : null);
  if (!kit) throw Error(`No kit for ${id} (use --partial to stand look 0 in)`);
  const built = teamKit(kit, id === 'chef' ? 'chef' : 'staff');
  kits.set(id, built);
  report.push(`${id} ${styles[id].name}: ${kit.replace(`${ROOT}/kits/`, '')}${kitOf(id) ? '' : ' (stand-in)'}${built.report.warnings.length ? ` — ${built.report.warnings.length} warning(s), e.g. ${built.report.warnings[0]}` : ''}`);
}
const manifest = { families: [], chef: null, seated: [], chefSeated: null };
for (const id of looks) {
  const { atlas, bounds } = pack(kits.get(id).walk), file = `hair-${id}-${styles[id].name}-v2.png`;
  await write(file, atlas);
  manifest.families.push({ file, bounds: walkBounds(bounds) });
}
const seatedSheet = async (file, ids) => {
  const { atlas, bounds } = pack(ids.map(id => kits.get(id).seated));
  await write(file, atlas);
  return { file, bounds: bounds.flat(), anchors: bounds.flatMap(row => row.map(([x, y, r, b], pose) => seatAnchors(pose, r - x, b - y))) };
};
for (let group = 0; group < looks.length / 4; group++) manifest.seated.push(await seatedSheet(`seated-${'abcdefgh'[group]}-v2.png`, looks.slice(group * 4, group * 4 + 4)));
{
  const { atlas, bounds } = pack(kits.get('chef').walk);
  await write('chef-walk-v2.png', atlas);
  manifest.chef = { file: 'chef-walk-v2.png', bounds: walkBounds(bounds) };
  manifest.chefSeated = await seatedSheet('chef-seated-v2.png', ['chef']);
}
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest) + '\n');
console.log(report.join('\n'));
const sizes = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).map(f => fs.statSync(`${OUT}/${f}`).size);
console.log(`${OUT}: ${manifest.families.length} hairstyles, ${manifest.seated.length} seated sheets, chef; ${sizes.length} PNGs, ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB, largest ${(Math.max(...sizes) / 1024).toFixed(0)} KB`);
