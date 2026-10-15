// Production packing only: preserve generated RGBA; crop, contain and nearest-neighbor resize.
// Optional authoring dependency, available separately from the game's dependencies.
const fs = require('node:fs');
const path = require('node:path');
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require(process.env.COZY_SHARP_PATH || '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp'); }
async function crop(source, box, destination, size, padding = 2) {
  const input = await sharp(source).extract({ left: box[0], top: box[1], width: box[2], height: box[3] }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info: { width, height } } = input;
  let l = width, t = height, r = -1, b = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 8) continue;
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  if (r < l) throw Error('Empty atlas cell: ' + destination);
  const cut = await sharp(source).extract({ left: box[0] + l, top: box[1] + t, width: r-l+1, height: b-t+1 }).png().toBuffer();
  const [w,h] = size || [r-l+1+padding*2,b-t+1+padding*2];
  const image = await sharp(cut).resize(w-padding*2,h-padding*2,{fit:'inside',kernel:'nearest'}).png().toBuffer();
  const meta = await sharp(image).metadata();
  const left = Math.floor((w-meta.width)/2), top = h-padding-meta.height;
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:image,left,top}]).png().toFile(destination);
  return { file: destination, size:[w,h], bounds:[left,top,meta.width,meta.height], sourceBox:[box[0]+l,box[1]+t,r-l+1,b-t+1] };
}
module.exports = { crop, sharp };
