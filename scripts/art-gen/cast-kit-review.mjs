#!/usr/bin/env node
// Review one customer's complete action kit against the shipped one, animated on the café floor.
//
//   node scripts/art-gen/cast-kit-review.mjs <kit.json> --out=<dir>
//
// kit.json: { title, intro, id, front, back, right, seated } where front/back/right/seated are
// the --out prefixes of gif-frames.mjs (walk cycles toward the viewer, away, to the right, and
// the three seated frames: at the table, petting, petting lower). Writes kit.gif (top row the
// shipped art, bottom row the new kit: walking down, up, right, left, then seated) plus a page.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from '../pixel-conform.mjs';
import { FW, FH, blank, blit, scaled, roomArt, castMaster, diningMaster, writeGif } from './lib.mjs';

const [configFile] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (!configFile || !out) { console.error('Usage: cast-kit-review.mjs <kit.json> --out=<dir>'); process.exit(2); }
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
fs.mkdirSync(out, { recursive: true });

const strip = prefix => decodePng(`${prefix}-strip.png`);
const cycle = image => Array.from({ length: image.width / FW }, (_, n) => n);
const SEATED = [0, 0, 0, 0, 1, 2, 2, 1];
const oldWalk = castMaster(config.id), oldSeat = diningMaster(config.id);
const front = strip(config.front), back = strip(config.back), right = strip(config.right), seated = strip(config.seated);
// Each actor: sheet, frame sequence, ticks held per frame, mirrored.
const rows = [
  [[oldWalk, [1, 0, 2, 0], 3], [oldWalk, [4, 3, 5, 3], 3], [oldWalk, [7, 6, 8, 6], 3], [oldWalk, [7, 6, 8, 6], 3, true], [oldSeat, SEATED, 6]],
  [[front, cycle(front), 2], [back, cycle(back), 2], [right, cycle(right), 2], [right, cycle(right), 2, true], [seated, SEATED, 6]],
];
const TICK = 60, TICKS = 48, X0 = 0, Y0 = 345, W = FW * 5, H = 115, FOOT = 442 - Y0 - 84, room = roomArt(), frames = [];
for (let tick = 0; tick < TICKS; tick++) {
  const frame = blank(W, H * rows.length);
  rows.forEach((actors, row) => {
    blit(frame, room, X0, Y0, W, H, 0, row * H);
    actors.forEach(([sheet, sequence, hold, mirror], slot) =>
      blit(frame, sheet, sequence[Math.floor(tick / hold) % sequence.length] * FW, 0, FW, FH, slot * FW, row * H + FOOT, mirror));
  });
  frames.push(scaled(frame, 2));
}
writeGif(path.join(out, 'kit.gif'), frames, TICK);

const sheets = [front, back, right, seated], all = blank(Math.max(...sheets.map(s => s.width)), FH * sheets.length);
sheets.forEach((sheet, row) => blit(all, sheet, 0, 0, sheet.width, FH, 0, row * FH));
encodePng(path.join(out, 'kit-frames.png'), scaled(all, 3));

const esc = text => String(text ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.title)}</title>
<style>
body{margin:0;background:#2a1a12;color:#f3e6cf;font:15px/1.55 -apple-system,"PingFang SC",sans-serif}
main{max-width:800px;margin:0 auto;padding:16px 12px 48px}h1{font-size:19px}h2{font-size:17px;margin:28px 0 4px;color:#ffd98a}
p{margin:6px 0;color:#d9c7a8}img{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:4px}
.sheet{background:#e9d9b8;padding:6px;box-sizing:border-box}
</style><main><h1>${esc(config.title)}</h1><p>${esc(config.intro)}</p>
<h2>整套动作对比</h2><p>上排是现在游戏里的，下排是新的。从左到右：朝前走、朝后走、向右走、向左走、坐下并摸猫。</p><img src="kit.gif" alt="">
<h2>新版每一帧</h2><p>四行依次是朝前走、朝后走、向右走、坐姿。</p><img class="sheet" src="kit-frames.png" alt="">
</main></html>`);
console.log(`${path.join(out, 'kit.gif')}  ${frames.length} frames`);
