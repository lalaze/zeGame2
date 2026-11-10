// Scratch: render a staff family sheet (3x3 poses) through the game's material pipeline.
//   node team-render.mjs <sheet.png> <out.png> [manifest-family-index]
import fs from 'node:fs';
const R = '/Volumes/data/code/zeGame2/';
const { decodePng, encodePng } = await import(R + 'scripts/pixel-conform.mjs');
const { sliceSheet, blank, blit, scaled } = await import(R + 'scripts/art-gen/lib.mjs');
const T = await import(R + 'src/render/team-pixel-art.ts');
const [sheetFile, out, family] = process.argv.slice(2);
const sheet = decodePng(sheetFile);
let poses;
if (family !== undefined) {
  const m = JSON.parse(fs.readFileSync(R + 'public/art/generated/cozy-team-v7/manifest.json', 'utf8')).families[Number(family)];
  const k = sheet.width / 1254;   // manifest bounds are for the shipped file size
  poses = m.bounds.map(([l, t, r, b]) => { const w = r - l, h = b - t, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) data.set(sheet.pixels.subarray(((y + t) * sheet.width + l) * 4, ((y + t) * sheet.width + r) * 4), y * w * 4);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 100) data[i] = 0;
    return { data, width: w, height: h, anchors: {} }; });
} else {
  poses = sliceSheet(sheet, 3, 3).flat().map(f => ({ data: f.pixels, width: f.width, height: f.height, anchors: {} }));
}
const D = 2, W = 32, H = 44, scale = Math.min(40 / Math.max(...poses.map(p => p.height)), 28 / Math.max(...poses.map(p => p.width)));
const hex = h => T.hexRgb(h), colours = { skin: T.shadeRamp(hex('#f4cfad')), hair: T.shadeRamp(hex('#594237')), cloth: T.shadeRamp(hex('#8ba477')), pants: T.shadeRamp(hex('#53637b')) };
const strip = blank(W * D * 9, H * D);
poses.forEach((p, index) => {
  const dx = 16 - p.width * scale / 2, dy = 42 - p.height * scale;
  const grid = T.voteTeamPose(T.segmentTeamPose(p, { role: 'barista', sit: false, back: index >= 3 && index < 6 }), { x: dx * D, y: dy * D, scale: scale * D }, W * D, H * D);
  const art = { width: W * D, height: H * D, pixels: T.paintTeamPose(grid, colours) };
  blit(strip, art, 0, 0, W * D, H * D, index * W * D, 0);
});
encodePng(out, scaled(strip, 3));
console.log(out, 'scale', scale.toFixed(4), 'pose sizes', poses.map(p => p.width + 'x' + p.height).join(' '));
