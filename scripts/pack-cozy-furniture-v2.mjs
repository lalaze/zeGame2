import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

// Packaging only: original image-generated RGBA pixels are cropped and uniformly
// resized with nearest-neighbor sampling. No drawing, recoloring or alpha cleanup.
const root = 'public/art/generated/cozy-furniture-v2';
const prompts = JSON.parse(await fs.readFile(`${root}/prompts.json`, 'utf8'));
const catalogFrom = async (file, symbol) => {
  const source = await fs.readFile(file, 'utf8');
  const object = source.split(`export const ${symbol} = `)[1].split(' as const;')[0];
  return Function(`return (${object})`)();
};
const furniture = await catalogFrom('src/render/generated-furniture-art.ts', 'GENERATED_FURNITURE_CATALOG');
const decor = await catalogFrom('src/render/generated-decor-art.ts', 'GENERATED_DECOR_CATALOG');
// Visually inspected per-object bounds (the generator varies grid spacing).
// Eight source pixels are included around each visible silhouette.
const bounds = {
  'furniture-a-atlas': [[118,28,162,387],[421,65,363,340],[865,188,333,201],[57,499,291,322],[541,443,148,378],[816,521,387,300],[40,874,342,341],[487,841,229,383],[807,859,398,359]],
  'furniture-b-atlas': [[34,97,497,286],[588,96,203,290],[959,48,172,333],[29,456,353,341],[418,510,468,279],[926,421,254,383],[64,832,258,397],[420,831,429,400],[955,886,226,264]],
  'plants-atlas': [[27,67,329,290],[465,23,176,337],[788,15,252,345],[32,407,319,317],[410,401,284,323],[819,393,213,331],[97,786,188,268],[450,764,204,302],[801,744,233,357],[129,1147,120,250],[420,1094,251,313],[763,1123,302,284]],
  'wall-atlas': [[68,98,260,306],[394,176,415,192],[836,165,402,229],[31,541,353,230],[409,554,439,142],[895,469,309,335],[65,853,299,303],[466,853,296,303],[821,875,396,281]],
  'accent-atlas': [[36,74,352,251],[439,74,352,251],[843,74,351,251],[30,468,363,99],[437,433,354,183],[966,375,135,254],[61,688,300,259],[419,735,391,174],[830,734,385,175],[37,1022,348,187],[422,1053,393,124],[923,1012,213,197]],
  'neon-cup': [[294,177,676,921]],
  'wide-accents-atlas': [[31,106,1193,226],[26,374,1202,154],[26,582,1203,151],[35,799,1184,175],[41,1028,1173,145]],
  'slender-props-atlas': [[120,20,250,1186],[505,32,266,1177],[951,66,199,1145]],
};
const authoredPoints = {
  clock: { dial: { x: 198, y: 252 }, minute: 77, hour: 54 },
  lantern: { wick: { x: 1045, y: 239 } },
  hanging_ivy: { potRim: { x: 919, y: 917 }, leftAttachment: { x: 878, y: 884 }, rightAttachment: { x: 972, y: 880 } },
};
const entries = [], assets = {}, overlays = {};
for (const [atlasIndex, atlas] of prompts.atlases.entries()) {
  const source = await fs.readFile(`${root}/${atlas.file}.png`).catch(() => fs.readFile(atlas.source));
  await fs.writeFile(`${root}/${atlas.file}.png`, source);
  const dimensions = await sharp(source).metadata();
  for (const [index, id] of atlas.ids.entries()) {
    // A later, specifically proportioned regeneration supersedes the first pass.
    if (prompts.atlases.some((later, i) => i > atlasIndex && later.ids.includes(id))) continue;
    const meta = furniture[id] ?? decor[id];
    if (!meta) throw new Error(`Unknown identity ${id}`);
    const key = `${furniture[id] ? 'furniture' : 'decor'}-${id}`;
    const [bx, by, bw, bh] = bounds[atlas.file][index];
    const crop = { left: Math.max(0, bx - 8), top: Math.max(0, by - 8), width: Math.min(dimensions.width, bx + bw + 8) - Math.max(0, bx - 8), height: Math.min(dimensions.height, by + bh + 8) - Math.max(0, by - 8) };
    const packedScale = 384 / Math.max(...meta.size);
    const width = Math.ceil(meta.size[0] * packedScale), height = Math.ceil(meta.size[1] * packedScale);
    const anchor = { x: meta.anchor.x * packedScale, y: meta.anchor.y * packedScale };
    const foot = /bottom|foot|pot-base/.test(meta.anchor.kind);
    const ceiling = meta.anchor.kind === 'ceiling-top-center';
    const maxW = Math.min(anchor.x - 2, width - anchor.x - 2) * 2;
    const maxH = foot ? anchor.y - 2 : ceiling ? height - anchor.y - 2 : Math.min(anchor.y - 2, height - anchor.y - 2) * 2;
    const scale = Math.min(maxW / crop.width, maxH / crop.height);
    const rw = Math.max(1, Math.round(crop.width * scale)), rh = Math.max(1, Math.round(crop.height * scale));
    const left = Math.max(1, Math.round(anchor.x - rw / 2));
    const top = Math.max(1, Math.round(foot ? anchor.y - rh : ceiling ? anchor.y : anchor.y - rh / 2));
    const cutout = await sharp(source).extract(crop).resize(rw, rh, { kernel: 'nearest', fit: 'fill' }).png().toBuffer();
    const output = await sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite([{ input: cutout, left, top }]).png().toBuffer();
    const file = `${key}.png`;
    await fs.writeFile(`${root}/${file}`, output);
    assets[key] = `cozy-furniture-v2/${file}`;
    const point = p => ({ x: (left + (p.x - crop.left) * rw / crop.width) / packedScale, y: (top + (p.y - crop.top) * rh / crop.height) / packedScale });
    if (id === 'clock') overlays[id] = { clock: { dial: point(authoredPoints.clock.dial), minute: authoredPoints.clock.minute * scale / packedScale, hour: authoredPoints.clock.hour * scale / packedScale } };
    else if (authoredPoints[id]) overlays[id] = { overlayPoints: Object.fromEntries(Object.entries(authoredPoints[id]).map(([k,p]) => [k, point(p)])) };
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    let opaque = 0, edge = 0;
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) if (data[(y*width+x)*info.channels+3] > 0) { opaque++; if (x===0 || y===0 || x===width-1 || y===height-1) edge++; }
    if (!opaque || edge) throw new Error(`${key}: empty or clipped result (${opaque}, ${edge})`);
    entries.push({ id, key, file, atlas: `${atlas.file}.png`, crop, packed: [width,height], sourceSize: meta.size, anchor: meta.anchor, placement: { left,top,width:rw,height:rh }, sha256: createHash('sha256').update(output).digest('hex'), opaquePixels: opaque, edgePixels: edge });
  }
}
if (entries.filter(e=>e.key.startsWith('furniture-')).length !== 39 || entries.filter(e=>e.key.startsWith('decor-')).length !== 13) throw new Error('Incomplete replacement coverage');
await fs.writeFile(`${root}/manifest.json`, JSON.stringify({ generator: 'built-in image_gen', processing: 'RGBA crop, uniform nearest-neighbor resize, transparent canvas packing; no procedural drawing', furnitureCount: 39, decorSpriteCount: 13, assets: entries, overlayCorrections: overlays },null,2)+'\n');
await fs.writeFile('src/render/cozy-furniture-assets.ts', `import { GENERATED_FURNITURE_CATALOG } from './generated-furniture-art';\n\n/** All 39 placed furnishings and 13 decor sprites redrawn against the cozy cafe reference. */\nexport const COZY_FURNITURE_ASSETS = ${JSON.stringify(assets,null,2)} as const;\n\n/** Source sizes and anchors are preserved; these interactive points follow the redrawn artwork. */\nexport const COZY_FURNITURE_CATALOG = {\n  ...GENERATED_FURNITURE_CATALOG,\n${Object.entries(overlays).map(([id,value])=>`  ${id}: { ...GENERATED_FURNITURE_CATALOG.${id}, ...${JSON.stringify(value)} },`).join('\n')}\n} as const;\n`);
console.log(JSON.stringify({ furniture: 39, decorSprites: 13, count: entries.length, edges: entries.reduce((n,e)=>n+e.edgePixels,0) }));
