#!/usr/bin/env node
/* Deterministic game-runtime raster export, not an authoring edit.
 * Original generated sources stay untouched. Requires @napi-rs/canvas 0.1.100
 * (https://www.npmjs.com/package/@napi-rs/canvas); optional authoring dependency,
 * not required for normal npm build. Uses the same nearest-neighbor Canvas
 * drawImage transform as the game's native renderer, with one isotropic scale.
 */
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = path.join(ROOT, 'assets/generated/bulk-candidates');
const OUTPUT = path.join(ROOT, 'public/art/generated/catalog-v1');
const REPORT = path.join(ROOT, 'assets/generated/runtime-catalog-v1');
const ORIGINAL_ACTORS = path.join(ROOT, 'assets/generated/original-main-actors-v1');
const ORIGINAL_MAIN_STATIC = path.join(ROOT, 'assets/generated/original-main-static-v1');
const originalActorsOnly = process.argv.includes('--original-actors-only');
const signatureOnly = process.argv.includes('--signature-only');
const mainStaticOnly = process.argv.includes('--main-static-only');
if ([originalActorsOnly, signatureOnly, mainStaticOnly].filter(Boolean).length > 1) throw new Error('Choose only one partial-export mode');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const catalog = originalActorsOnly || signatureOnly || mainStaticOnly ? read(path.join(REPORT, 'catalog.json')) :
  { version: 1, sampling: 'Canvas nearest, isotropic scale, ceil canvas; no source crop or recolor', assets: {}, images: [] };
async function exportImage(key, source, outputRelative, maxEdge, forcedScale) {
  // Old authoring alias manifests still name public crops. Resolve only an exact,
  // hash-verified archived path after those originals leave the shipping tree.
  if (!fs.existsSync(source)) {
    const archiveFile = path.join(ORIGINAL_MAIN_STATIC, 'manifest.json');
    const row = fs.existsSync(archiveFile) && read(archiveFile).images.find(row => row.previousPublicFile === path.relative(ROOT, source));
    if (!row) throw new Error(`Missing authoring source: ${source}`);
    source = path.join(ROOT, row.file);
    if (sha(fs.readFileSync(source)) !== row.sha256) throw new Error(`Archived alias changed: ${source}`);
  }
  const bytes = fs.readFileSync(source), img = await loadImage(bytes);
  const scale = forcedScale ?? Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.ceil(img.width * scale), height = Math.ceil(img.height * scale);
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
  const png = canvas.toBuffer('image/png');
  const output = path.join(OUTPUT, outputRelative); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, png);
  catalog.assets[key] = `catalog-v1/${outputRelative}`;
  catalog.images.push({ key, file: path.relative(ROOT, output), source: path.relative(ROOT, source), sourceSha256: sha(bytes),
    sha256: sha(png), originalSize: [img.width, img.height], size: [width, height], scale, bytes: png.length });
  return { scale, size: [width,height] };
}
/** Archive first, then derive runtime copies. Authoring manifests and all RGBA crops stay unchanged. */
async function exportOriginalActors() {
  const archiveFile = path.join(ORIGINAL_ACTORS, 'manifest.json');
  const priorArchive = fs.existsSync(archiveFile) ? read(archiveFile) : null;
  const families = [
    { name: 'staff', folder: 'staff-v2', output: 'staff-owner', key: row => `barista-${row.direction}-${row.state}` },
    { name: 'customer', folder: 'customer-0-v1', output: 'customers/cast-00', key: row => `mina-${row.direction}-${row.state}` },
    { name: 'cat', folder: 'cat-siamese-v1', output: 'cats/siamese', key: row => `siamese-${row.state}` },
  ];
  const archive = { version: 1, operation: 'Byte-identical archival copies; original source sheets and manifests remain unchanged.', manifests: [], images: [] };
  for (const family of families) {
    const manifestFile = path.join(ROOT, `src/render/generated-${family.name}-manifest.json`);
    const bytes = fs.readFileSync(manifestFile);
    const priorManifest = priorArchive?.manifests.find(row => row.file === path.relative(ROOT, manifestFile));
    if (priorArchive && (!priorManifest || priorManifest.sha256 !== sha(bytes))) throw new Error(`Original actor manifest changed: ${manifestFile}`);
    family.manifest = JSON.parse(bytes);
    archive.manifests.push({ file: path.relative(ROOT, manifestFile), sha256: sha(bytes) });
    for (const row of family.manifest.frames) {
      const file = path.join(ORIGINAL_ACTORS, family.folder, path.basename(row.file));
      const previous = path.join(ROOT, 'public/art/generated', family.folder, path.basename(row.file));
      const original = fs.readFileSync(fs.existsSync(previous) ? previous : file);
      const priorImage = priorArchive?.images.find(entry => entry.key === family.key(row));
      if (priorArchive && (!priorImage || priorImage.sha256 !== sha(original))) throw new Error(`Original actor crop changed: ${file}`);
      if (fs.existsSync(file)) {
        if (!fs.readFileSync(file).equals(original)) throw new Error(`Refusing to replace archived crop: ${file}`);
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, original);
      }
      if (sha(fs.readFileSync(file)) !== sha(original)) throw new Error(`Archive verification failed: ${file}`);
      archive.images.push({ key: family.key(row), file: path.relative(ROOT, file), previousPublicFile: path.relative(ROOT, previous), sha256: sha(original), bytes: original.length });
    }
  }
  if (archive.images.length !== 38 || new Set(archive.images.map(row => row.key)).size !== 38) throw new Error('Expected exactly 38 distinct original actor crops');
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2) + '\n');
  const ids = new Set(archive.images.map(row => row.key));
  catalog.images = catalog.images.filter(row => !ids.has(row.key));
  catalog.customerManifests = (catalog.customerManifests ?? []).filter(manifest => manifest.appearanceId !== 0);
  catalog.catManifests = (catalog.catManifests ?? []).filter(manifest => manifest.breed !== 'siamese');
  for (const family of families) {
    const manifest = family.manifest;
    // One 192px raster budget for the whole identity, never a per-pose fit.
    const scale = Math.min(1, 192 / Math.max(...manifest.frames.flatMap(row => row.size)));
    const frames = [];
    for (const row of manifest.frames) {
      const key = family.key(row), source = path.join(ORIGINAL_ACTORS, family.folder, path.basename(row.file));
      const result = await exportImage(key, source, `${family.output}/${key}.png`, 192, scale);
      const meta = { ...row, size: result.size, productionContentSize: row.size.map(n => n * scale), sourceToWorldScale: row.sourceToWorldScale / scale };
      for (const field of ['bbox', 'foot', 'seatContact', 'petContact', 'headContact']) {
        if (row[field]) meta[field] = Object.fromEntries(Object.entries(row[field]).map(([k, v]) => [k, typeof v === 'number' ? v * scale : v]));
      }
      meta.productionTransform = { sourceToRuntimeScale: scale, authoringFile: path.relative(ROOT, source) };
      frames.push(meta);
    }
    const packed = { ...manifest, frames, productionRasterScale: scale };
    if (family.name === 'staff') catalog.staffManifest = packed;
    else if (family.name === 'customer') catalog.customerManifests.unshift(packed);
    else catalog.catManifests.push(packed);
  }
}
/** Per-use raster budgets. Small repeating wood and direct Phaser props are deliberately untouched. */
async function exportOriginalMainStatic() {
  const rows = [
    ['vine', 'main-v1/vine.png', 96], ['display', 'main-v2/empty-wide-display.png', 256],
    ['espresso', 'menu-v1/espresso.png', 128], ['latte', 'menu-v1/latte.png', 128], ['eggtart', 'menu-v1/eggtart.png', 128],
    ['croissant', 'main-v2/croissant.png', 128], ['cake', 'main-v2/strawberry-cake.png', 128],
    ['service-pickup', 'service-v1/pickup-hutch-two-tier-v2.png', 192], ['service-machine', 'service-v1/espresso-machine.png', 128],
    ['service-cupboard', 'service-v1/low-service-cupboard.png', 192], ['service-cups', 'service-v1/cups-stack.png', 64],
    ['service-jars', 'service-v1/glass-jars-pair.png', 96], ['service-basket', 'service-v1/empty-wicker-basket.png', 96],
    ['wall-window', 'wall-v1/window-gingham-frame.png', 256], ['wall-board', 'wall-v1/blank-chalkboard.png', 384],
    ['wall-lamp', 'wall-v1/brass-wall-lamp.png', 96],
  ];
  const archiveFile = path.join(ORIGINAL_MAIN_STATIC, 'manifest.json');
  const prior = fs.existsSync(archiveFile) ? read(archiveFile) : null;
  const archive = { version: 1, operation: 'Byte-identical original crops; complete nearest runtime export, no new crop, mask or recolor.', images: [] };
  for (const [key, relative, maxEdge] of rows) {
    const previous = path.join(ROOT, 'public/art/generated', relative), file = path.join(ORIGINAL_MAIN_STATIC, relative);
    const original = fs.readFileSync(fs.existsSync(previous) ? previous : file);
    const recorded = prior?.images.find(row => row.key === key);
    if (prior && (!recorded || recorded.sha256 !== sha(original))) throw new Error(`Original static crop changed: ${file}`);
    if (fs.existsSync(file)) {
      if (!fs.readFileSync(file).equals(original)) throw new Error(`Refusing to replace archived static crop: ${file}`);
    } else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, original); }
    if (sha(fs.readFileSync(file)) !== sha(original)) throw new Error(`Static archive verification failed: ${file}`);
    archive.images.push({ key, file: path.relative(ROOT, file), previousPublicFile: path.relative(ROOT, previous), sha256: sha(original), bytes: original.length, maxEdge });
  }
  if (archive.images.length !== 16 || new Set(archive.images.map(row => row.key)).size !== 16) throw new Error('Expected sixteen distinct main static crops');
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2) + '\n');
  const ids = new Set(rows.map(row => row[0]));
  catalog.images = catalog.images.filter(row => !ids.has(row.key));
  catalog.mainStaticMetadata = {};
  for (const [key, relative, maxEdge] of rows) {
    await exportImage(key, path.join(ORIGINAL_MAIN_STATIC, relative), `main-static/${key}.png`, maxEdge);
    const image = catalog.images.at(-1);
    catalog.mainStaticMetadata[key] = { originalSize: image.originalSize, size: image.size, scale: image.scale,
      productionContentSize: image.originalSize.map(n => n * image.scale) };
  }
}
(async () => {
  if (!originalActorsOnly && !signatureOnly && !mainStaticOnly) {
  for (const [manifest, domain, prefix] of [['manifest.json','menu',''],['ingredient-manifest.json','ingredients','ingredient-']]) {
    const location=path.join(CANDIDATES,'menu',manifest);
    for (const row of read(location).assets) {
      const id=row.itemId ?? row.ingredientId;
      if (!id) throw new Error(`Missing ID in ${manifest}`);
      await exportImage(`${prefix}${id}`,path.resolve(path.dirname(location),row.file),`${domain}/${id}.png`,128);
    }
  }
  for (const [folder, domain] of [['furniture','furniture'],['decor-materials','decor']]) {
    const location=path.join(CANDIDATES,folder,'renderer-manifest.json');
    const manifest=read(location);
    for (const row of [...manifest.assets,...manifest.aliases]) {
      const state=row.state ?? 'base';
      const key=domain==='furniture' ? `furniture-${row.id}` : `decor-${row.id}-${state}`;
      const name=domain==='furniture' ? row.id : `${row.id}-${state}`;
      await exportImage(key,path.resolve(path.dirname(location),row.file ?? row.source),`${domain}/${name}.png`,256);
    }
  }
  // Main-room structural and tableware layers are independent of furniture,
  // inventories and actor identities. Only reviewed integration candidates
  // are exported here; the remaining room/UI originals stay offline.
  for (const [folder,prefix,ids,maxEdge] of [
    ['environments','environment',['main-horizontal-beam','main-corner-post','foreground-threshold','outdoor-tree-line','village-roof-cluster','cloud'],256],
    ['ui','tableware',['empty-cup-saucer','empty-plate','heart','drop','crown'],128],
  ]) {
    const location=path.join(CANDIDATES,folder,'manifest.json');
    const rows=read(location).assets;
    for (const id of ids) {
      const row=rows.find(row=>row.id===id);
      if(!row)throw new Error(`Missing ${folder}/${id}`);
      await exportImage(`${prefix}-${id}`,path.resolve(path.dirname(location),row.file),`${prefix}/${id}.png`,maxEdge);
    }
  }
  const shallowLocation=path.join(ROOT,'assets/generated/shallow-tableware-v1/manifest.json');
  for(const row of read(shallowLocation).assets){
    await exportImage(`tableware-${row.id}`,path.resolve(path.dirname(shallowLocation),row.file),`tableware/${row.id}.png`,128);
  }
  const customerManifests=[], catManifests=[];
  const actorDomains=[['customers',/^cast-/,customerManifests],['cats',/./,catManifests]];
  for (const [domain, pattern, outputManifests] of actorDomains) {
    for (const entry of fs.readdirSync(path.join(CANDIDATES,domain),{withFileTypes:true})) {
      if(!entry.isDirectory() || !pattern.test(entry.name))continue;
      const location=path.join(CANDIDATES,domain,entry.name,'renderer-manifest.json');
      if(!fs.existsSync(location))continue;
      const manifest=read(location);
      const scale=Math.min(1,144/Math.max(...manifest.frames.flatMap(row=>row.size)));
      const frames=[];
      for(const row of manifest.frames){
        const state=row.state;
        const key=domain==='customers' ? `customer-${manifest.appearanceId}-${row.direction}-${state}` : `${manifest.breed}-${state}`;
        const transformed=await exportImage(key,path.resolve(path.dirname(location),row.file),`${domain}/${entry.name}/${key}.png`,256,scale);
        const meta={...row,size:transformed.size,productionContentSize:row.size.map(n=>n*scale),sourceToWorldScale:row.sourceToWorldScale/scale};
        for(const field of ['bbox','foot','seatContact','petContact','headContact']){
          if(row[field])meta[field]=Object.fromEntries(Object.entries(row[field]).map(([k,v])=>[k,typeof v==='number'?v*scale:v]));
        }
        meta.productionTransform={sourceToRuntimeScale:scale,authoringFile:row.file};
        frames.push(meta);
      }
      outputManifests.push({...manifest,frames,productionRasterScale:scale});
    }
  }
  catalog.customerManifests=customerManifests;
  catalog.catManifests=catManifests;
  const serverLocation=path.join(ROOT,'assets/generated/server-canonical-v1/renderer-manifest.json');
  const serverManifest=read(serverLocation);
  const serverScale=Math.min(1,144/Math.max(...serverManifest.frames.flatMap(row=>row.size)));
  const serverFrames=[];
  for(const row of serverManifest.frames){
    const key=`server-${row.direction}-${row.state}`;
    const transformed=await exportImage(key,path.resolve(path.dirname(serverLocation),row.file),`staff-server/${key}.png`,144,serverScale);
    const meta={...row,size:transformed.size,productionContentSize:row.size.map(n=>n*serverScale),sourceToWorldScale:row.sourceToWorldScale/serverScale};
    for(const field of ['bbox','foot'])meta[field]=Object.fromEntries(Object.entries(row[field]).map(([k,v])=>[k,v*serverScale]));
    serverFrames.push(meta);
  }
  catalog.serverManifest={...serverManifest,frames:serverFrames};
  }
  if (!signatureOnly && !mainStaticOnly) await exportOriginalActors();
  if (!originalActorsOnly && !mainStaticOnly) {
    const manifest=read(path.join(CANDIDATES,'ui/manifest.json'));
    const ids=manifest.assets.filter(row=>row.domain==='signature'&&!['topping-milk','glass-glints'].includes(row.id));
    const keys=new Set(ids.map(row=>`signature-${row.id}`));
    catalog.images=catalog.images.filter(row=>!keys.has(row.key));
    for(const row of ids)await exportImage(`signature-${row.id}`,path.join(CANDIDATES,'ui',row.file),`signature/${row.id}.png`,128);
    catalog.signatureComposition={status:'proposed-registration-requires-render-review',authoringManifest:'assets/generated/bulk-candidates/ui/manifest.json',geometry:'src/render/generated-signature-art.ts',liquidBody:'native explicit geometry; no color-derived masks',milk:'native liquid band, peaked foam excluded',dose:'grouped garnishes plus exact fixed-slot portion marks',excluded:['topping-milk','glass-glints']};
  }
  if (!originalActorsOnly && !signatureOnly) await exportOriginalMainStatic();
  fs.mkdirSync(REPORT, {recursive:true}); fs.writeFileSync(path.join(REPORT,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
  const signature = Object.fromEntries(catalog.images.filter(row => row.key.startsWith('signature-')).map(row => [row.key.slice('signature-'.length),
    { originalSize: row.originalSize, size: row.size, scale: row.scale, productionContentSize: row.originalSize.map(n => n * row.scale) }]));
  fs.writeFileSync(path.join(REPORT, 'signature.json'), JSON.stringify(signature, null, 2) + '\n');
  const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
  const frameKeys=['direction','state','group','source','size','bbox','foot','seatContact','petContact','headContact','sourceToWorldScale','productionContentSize'];
  const compact=(manifest)=>({...pick(manifest,['identity','appearanceId','look','hairstyle','outfit','accessory','accent','breed']),frames:manifest.frames.map(row=>pick(row,frameKeys))});
  fs.writeFileSync(path.join(REPORT,'runtime.json'),JSON.stringify({assets:catalog.assets,mainStaticMetadata:catalog.mainStaticMetadata,signatureComposition:catalog.signatureComposition,staffManifest:compact(catalog.staffManifest),customerManifests:catalog.customerManifests.map(compact),catManifests:catalog.catManifests.map(compact),serverManifest:{...compact(catalog.serverManifest),role:catalog.serverManifest.role,exactLookOnly:true}})+'\n');
  console.log(JSON.stringify({ images: catalog.images.length, bytes:catalog.images.reduce((n,row)=>n+row.bytes,0), output:REPORT }));
})().catch(error=>{console.error(error);process.exitCode=1});
