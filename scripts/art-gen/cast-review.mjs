#!/usr/bin/env node
// Build a phone-readable review page that compares candidate character sheets with the
// shipped cast, standing in the real café room at the game's art density.
//
//   node scripts/art-gen/cast-review.mjs <review.json> --out=<dir>
//
// review.json: { title, intro, current: [customerId...], variants: [{ key, title, note, prefix, walk? }] }
// walk is the --out of gif-frames.mjs for a right-profile walk cycle of the first character;
// when present the page opens with every variant walking side by side as one animated GIF.
// where prefix is the --out of slice-figures.mjs (six poses per row: front, front step,
// profile, profile step, rear, seated). Writes index.html plus PNGs into <dir>.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from '../pixel-conform.mjs';
import { FW, FH, blank, blit, scaled, roomArt, castMaster, writeGif } from './lib.mjs';

const [configFile] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (!configFile || !out) { console.error('Usage: cast-review.mjs <review.json> --out=<dir>'); process.exit(2); }
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const POSES = 6;
fs.mkdirSync(out, { recursive: true });

const room = roomArt();
const BAND_TOP = 150, BAND_HEIGHT = 310, FEET = 442;
const SLOTS = [[0, 0], [0, 3], [1, 1], [1, 2], [1, 4], [2, 0], [2, 3], [2, 4]];   // [row, pose]

// The shipped cast as the same six poses: frames 0,1 front, 6,7 profile, 3 rear, 9 seated.
const currentRows = config.current.map((id, row) => {
  const sheet = castMaster(id), strip = blank(FW * POSES, FH);
  [0, 1, 6, 7, 3, 9].forEach((frame, index) => blit(strip, sheet, frame * FW, 0, FW, FH, index * FW, 0));
  encodePng(path.join(out, `current-row${row}.png`), strip);
  return strip;
});
const variants = [{ key: 'current', title: '现在游戏里的', note: config.currentNote ?? '', rows: currentRows },
  ...config.variants.map(v => ({ ...v, rows: [0, 1, 2].map(row => fs.existsSync(`${v.prefix}-row${row}.png`) ? decodePng(`${v.prefix}-row${row}.png`) : null) }))];

for (const v of variants) {
  const band = blank(room.width, BAND_HEIGHT);
  blit(band, room, 0, BAND_TOP, room.width, BAND_HEIGHT, 0, 0);
  // Opaque backdrop pixels only; make the band fully opaque where the screenshot was.
  SLOTS.forEach(([row, pose], slot) => { if (v.rows[row]) blit(band, v.rows[row], pose * FW, 0, FW, FH, slot * FW, FEET - BAND_TOP - 84); });
  encodePng(path.join(out, `band-${v.key}.png`), scaled(band, 2));
  const sheet = blank(FW * POSES, FH * 3);
  v.rows.forEach((strip, row) => { if (strip) blit(sheet, strip, 0, 0, FW * POSES, FH, 0, row * FH); });
  encodePng(path.join(out, `sheet-${v.key}.png`), scaled(sheet, 3));
  if (v.source) fs.copyFileSync(v.source, path.join(out, `source-${v.key}.png`));
}

// Everyone walking in place on the same floor, as one looping GIF. The shipped cast has a
// three-pose walk (neutral, step, neutral, other step); generated cycles play every frame.
const TICK = 60, walkers = [];
{
  const sheet = castMaster(config.current[0]);
  walkers.push({ key: 'current', title: '现在', strip: sheet, sequence: [6, 7, 6, 8], hold: 3 });
}
for (const v of config.variants) if (v.walk && fs.existsSync(`${v.walk}-strip.png`)) {
  const strip = decodePng(`${v.walk}-strip.png`);
  walkers.push({ key: v.key, title: v.key.toUpperCase(), strip, sequence: Array.from({ length: strip.width / FW }, (_, n) => n), hold: 2 });
  encodePng(path.join(out, `walk-${v.key}.png`), scaled(strip, 3));
}
const hasWalk = walkers.length > 1;
if (hasWalk) {
  const gcd = (a, b) => b ? gcd(b, a % b) : a, ticks = walkers.map(w => w.sequence.length * w.hold).reduce((a, b) => a * b / gcd(a, b));
  const X0 = 0, Y0 = 345, W = FW * walkers.length, H = 115, frames = [];
  for (let tick = 0; tick < ticks; tick++) {
    const frame = blank(W, H);
    blit(frame, room, X0, Y0, W, H, 0, 0);
    walkers.forEach((w, slot) => blit(frame, w.strip, w.sequence[Math.floor(tick / w.hold) % w.sequence.length] * FW, 0, FW, FH, slot * FW, FEET - Y0 - 84));
    frames.push(scaled(frame, 3));
  }
  writeGif(path.join(out, 'walk.gif'), frames, TICK);
}

const esc = text => String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.title)}</title>
<style>
body{margin:0;background:#2a1a12;color:#f3e6cf;font:15px/1.55 -apple-system,"PingFang SC",sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 12px 48px}
h1{font-size:19px;margin:8px 0}h2{font-size:17px;margin:28px 0 4px;color:#ffd98a}
p{margin:6px 0;color:#d9c7a8}small{color:#a8937a}
img{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:4px}
.sheet{background:#e9d9b8;padding:6px;box-sizing:border-box;margin-top:8px}
.phone{width:360px;max-width:100%}
details{margin-top:8px}summary{color:#a8937a}
</style><main>
<h1>${esc(config.title)}</h1><p>${esc(config.intro ?? '')}</p>
${hasWalk ? `<h2>走路动画对比</h2><p>从左到右：${walkers.map(w => esc(w.title)).join('、')}。同一位顾客向右走。</p><img src="walk.gif" alt="">` : ''}
${variants.map(v => `<h2>${esc(v.title)}</h2><p>${esc(v.note ?? '')}</p>
<small>手机上的实际大小</small><img class="phone" src="band-${v.key}.png" alt="">
<small>放大细看（六个姿势：正面、正面迈步、侧面、侧面迈步、背面、坐姿）</small><img class="sheet" src="sheet-${v.key}.png" alt="">
${fs.existsSync(path.join(out, `walk-${v.key}.png`)) ? `<small>走路循环的每一帧</small><img class="sheet" src="walk-${v.key}.png" alt="">` : ''}
${v.source ? `<details><summary>Codex 原图</summary><img src="source-${v.key}.png" alt=""></details>` : ''}`).join('\n')}
</main></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`${path.join(out, 'index.html')}  (${variants.length} variants)`);
