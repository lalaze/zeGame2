// Compile the Codex-generated customer kits (assets/generated/cozy-cast-v9/kits) into the
// packs the game loads:
//   public/art/generated/cozy-cast-v9/   customer-N.png       12 poses, the layout of v8
//                                        customer-N-walk.png  six-frame walk cycles, 3 directions
//   public/art/generated/cozy-dining-v5/ customer-N.png       3 seated poses with the chair
// A customer's kit is one generated sheet (scripts/art-gen/codex-kit.mjs), so every pose shares
// colours and proportions. selected.json may pin a take per id; otherwise the newest take wins.
//
// Each sheet is written as a single-frame GIF and its PNG kept in assets/art-masters (rows in
// conversion.json). Sheets are already on the palette with on/off transparency, so the GIF is
// exact. Run scripts/convert-art-webp.mjs afterwards: the game loads the WebP.
//
//   node scripts/build-cozy-cast-v9.mjs [--partial]
// --partial keeps the shipped v7/v8 art for customers that have no kit yet.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { encodePng } from './pixel-conform.mjs';
import { FW, FH, blank, blit } from './art-gen/lib.mjs';
import { kitFrames } from './art-gen/kit-frames.mjs';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const ROOT = 'assets/generated/cozy-cast-v9', CAST = 'public/art/generated/cozy-cast-v9', DINING = 'public/art/generated/cozy-dining-v5';
const OLD_CAST = 'public/art/generated/cozy-cast-v8', OLD_DINING = 'public/art/generated/cozy-dining-v4';
const partial = process.argv.includes('--partial'), COUNT = 36;
const MASTERS = 'assets/art-masters', REPORT = `${MASTERS}/conversion.json`, shipped = [];
/** Write a sheet: PNG master under assets/art-masters, single-frame GIF under public. Returns the GIF's file name. */
async function ship(dir, name, image) {
  const master = `${MASTERS}/${dir.slice('public/'.length)}/${name}.png`, gif = `${dir}/${name}.gif`;
  fs.mkdirSync(path.dirname(master), { recursive: true });
  encodePng(master, image);
  fs.rmSync(`${dir}/${name}.png`, { force: true });
  await sharp(Buffer.from(image.pixels.buffer, image.pixels.byteOffset, image.pixels.length), { raw: { width: image.width, height: image.height, channels: 4 } })
    .gif({ colours: 256, dither: 0, effort: 10 }).toFile(gif);
  shipped.push({ file: `${dir.slice('public/'.length)}/${name}.png`, status: 'gif', png: fs.statSync(master).size, gif: fs.statSync(gif).size, softArea: 0 });
  return `${name}.gif`;
}
const selected = fs.existsSync(`${ROOT}/selected.json`) ? JSON.parse(fs.readFileSync(`${ROOT}/selected.json`, 'utf8')) : {};
const oldCast = JSON.parse(fs.readFileSync(`${OLD_CAST}/manifest.json`, 'utf8')), oldDining = JSON.parse(fs.readFileSync(`${OLD_DINING}/manifest.json`, 'utf8'));
/** Walk-sheet columns: 0 stands; 1 and 4 are the two forward steps, the poses v8 called stepA/stepB. */
const STAND = 0, STEP_A = 1, STEP_B = 4, CYCLE = [1, 2, 3, 4, 5, 6];

function kitOf(id) {
  const base = `${ROOT}/kits/customer-${id}`;
  if (!fs.existsSync(base)) return null;
  const takes = fs.readdirSync(base).filter(name => /^take-\d+$/.test(name) && fs.existsSync(`${base}/${name}/sheet.png`))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const take = selected[id] ? `take-${selected[id]}` : takes.at(-1);
  return take && takes.includes(take) ? `${base}/${take}` : null;
}
const meta = (frame, index) => ({ box: [index * FW, 0, (index + 1) * FW, FH], top: frame.top, neck: frame.neck, foot: frame.foot, hip: frame.hip, hand: frame.hand });
const relocate = (file, from, to) => path.posix.relative(to, path.posix.join(from, file));

for (const dir of [CAST, DINING]) fs.mkdirSync(dir, { recursive: true });
const cast = { version: 9, density: 2, width: FW / 2, height: FH / 2, characters: [] };
const dining = { version: 5, density: 2, width: FW / 2, height: FH / 2, embeddedChair: true, characters: [] };
const report = [];
for (let id = 0; id < COUNT; id++) {
  const kit = kitOf(id);
  if (!kit) {
    if (!partial) throw Error(`No kit for customer ${id} (use --partial to keep the shipped art)`);
    const a = oldCast.characters.find(c => c.id === id), b = oldDining.characters.find(c => c.id === id);
    cast.characters.push({ ...a, file: relocate(a.file, OLD_CAST, CAST) });
    dining.characters.push({ ...b, file: relocate(b.file, OLD_DINING, DINING) });
    report.push(`${id}: shipped art kept`);
    continue;
  }
  const { walk, seated, report: frames } = kitFrames(kit);
  // Twelve poses in the v8 order: front, back, right (stand, step, step), then the three seated.
  const strip = blank(FW * 12, FH), poses = [];
  [0, 1, 2].forEach(row => [STAND, STEP_A, STEP_B].forEach((column, n) => {
    blit(strip, walk, column * FW, row * FH, FW, FH, (row * 3 + n) * FW, 0);
    poses.push(meta(frames.walk[row][column], row * 3 + n));
  }));
  [0, 1, 2].forEach(column => { blit(strip, seated, column * FW, 0, FW, FH, (9 + column) * FW, 0); poses.push(meta(frames.seated[column], 9 + column)); });
  const stripFile = await ship(CAST, `customer-${id}`, strip);
  // Walk cycles: one row per direction (front, back, right), six frames each.
  const cycle = blank(FW * CYCLE.length, FH * 3), cycleFrames = [];
  [0, 1, 2].forEach(row => CYCLE.forEach((column, n) => {
    blit(cycle, walk, column * FW, row * FH, FW, FH, n * FW, row * FH);
    cycleFrames.push({ ...meta(frames.walk[row][column], n), box: [n * FW, row * FH, (n + 1) * FW, (row + 1) * FH] });
  }));
  const cycleFile = await ship(CAST, `customer-${id}-walk`, cycle);
  const seat = blank(FW * 3, FH);
  blit(seat, seated, 0, 0, FW * 3, FH, 0, 0);
  const seatFile = await ship(DINING, `customer-${id}`, seat);
  const source = path.posix.relative(ROOT, `${kit}/sheet.png`);
  cast.characters.push({ id, file: stripFile, cycle: { file: cycleFile, frames: cycleFrames }, source, scale: frames.scale, seatedScale: frames.seatedScale, frames: poses });
  dining.characters.push({ id, file: seatFile, source, scale: frames.seatedScale, frames: [0, 1, 2].map(column => meta(frames.seated[column], column)) });
  report.push(`${id}: ${path.basename(kit)}${frames.warnings.length ? ` — ${frames.warnings.join('; ')}` : ''}`);
}
fs.writeFileSync(`${CAST}/manifest.json`, JSON.stringify(cast, null, 2) + '\n');
fs.writeFileSync(`${DINING}/manifest.json`, JSON.stringify(dining, null, 2) + '\n');
// Record the new sheets beside every other converted file, replacing rows from an earlier build.
const rows = JSON.parse(fs.readFileSync(REPORT, 'utf8')).filter(row => !shipped.some(mine => mine.file === row.file));
fs.writeFileSync(REPORT, '[' + [...rows, ...shipped].map(row => JSON.stringify(row)).join(',\n') + ']\n');
const files = [...fs.readdirSync(CAST).map(f => `${CAST}/${f}`), ...fs.readdirSync(DINING).map(f => `${DINING}/${f}`)].sort();
fs.writeFileSync(`${ROOT}/hashes.json`, JSON.stringify(Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), null, 2) + '\n');
console.log(report.join('\n'));
console.log(`Compiled ${cast.characters.filter(c => c.cycle).length} new customers, kept ${cast.characters.filter(c => !c.cycle).length} shipped.`);
