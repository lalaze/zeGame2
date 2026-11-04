#!/usr/bin/env node
/**
 * Original seasonal reserve, NOT runtime-integrated artwork. Node >=22 with native
 * TS import support (the existing pixel-conform codec imports pixel-resample.ts).
 *   node scripts/build-seasonal-reserve.mjs          # generate + decoded audit
 *   node scripts/build-seasonal-reserve.mjs --check  # audit existing files only
 * No dependencies, canvas, runtime resampling, network, randomness or timestamps.
 * Only assets/generated/seasonal-reserve-v1 is written; never public or gameplay.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {encodePng,decodePng} from './pixel-conform.mjs';
import {CATALOG,SEASONS,SEASON_ZH,createPainter,paintSprite} from './build-seasonal-reserve-art.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REL='assets/generated/seasonal-reserve-v1';
const OUT=path.join(ROOT,REL), PALETTE=path.join(ROOT,'docs/art-grid/palette.json');
const palette=JSON.parse(fs.readFileSync(PALETTE,'utf8'));
const ID='seasonal-reserve-v1',GENERATOR='scripts/build-seasonal-reserve.mjs';
const SIZE=96,COLUMNS=12,ROWS=16;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const pixelsHash=image=>hash(image.pixels);
const json=obj=>JSON.stringify(obj,null,2)+'\n';
const fail=message=>{throw new Error(message);};
const assert=(condition,message)=>{if(!condition)fail(message);};
const within=(rel)=>typeof rel==='string'&&!rel.includes('\\')&&!path.isAbsolute(rel)&&!rel.split('/').includes('..')&&path.resolve(OUT,rel).startsWith(OUT+path.sep);
const artifact=rel=>{assert(within(rel),`Unsafe artifact path ${rel}`);return path.join(OUT,rel);};
function readJson(rel){return JSON.parse(fs.readFileSync(artifact(rel),'utf8'));}
function writeJson(rel,value){fs.writeFileSync(artifact(rel),json(value));}
function blit(src,dst,ox,oy,opaqueOnly=false){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const i=(y*src.width+x)*4,j=((oy+y)*dst.width+ox+x)*4;if(!opaqueOnly||src.pixels[i+3])dst.pixels.set(src.pixels.subarray(i,i+4),j);}}
const blank=(w,h)=>({width:w,height:h,pixels:new Uint8ClampedArray(w*h*4)});

// Protect user-edited outputs across rebuilds. The generated-file index is also a
// complete enumeration for offline copying; user-owned gallery/README are absent.
function protectExisting(){
  if(!fs.existsSync(OUT))return;
  const indexPath=artifact('generated-file-index.json');
  if(!fs.existsSync(indexPath)){
    for(const rel of ['manifest.json','atlas.png','contact-sheet.png','catalog.js','verification-report.json',...CATALOG.flatMap(b=>SEASONS.map(s=>`sprites/${b.id}-${s}.png`))])assert(!fs.existsSync(artifact(rel)),`Refusing to overwrite unowned ${rel}`);
    return;
  }
  const previous=JSON.parse(fs.readFileSync(indexPath,'utf8'));
  assert(previous.generator===GENERATOR&&previous.packId===ID,'Unrecognized output ownership index');
  for(const item of previous.files){assert(within(item.path),`Unsafe ownership path ${item.path}`);assert(fs.existsSync(artifact(item.path)),`Missing prior artifact ${item.path}; restore it before rebuilding`);const bytes=fs.readFileSync(artifact(item.path));assert(hash(bytes)===item.sha256,`User-modified generated artifact ${item.path}; preserve it before rebuilding`);}
}
function contactSheet(images){
  const sheet=createPainter(palette,1344,1856),{color:C,rect:R}=sheet;
  R(0,0,sheet.width,sheet.height,C('porcelain',2));
  const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  images.forEach((image,i)=>{
    const x=i%12*112,y=Math.floor(i/12)*116;
    R(x+3,y+3,106,110,C('porcelain',3));
    for(let yy=0;yy<12;yy++)for(let xx=0;xx<12;xx++)if((xx+yy)%2===0)R(x+8+xx*8,y+6+yy*8,8,8,C('cloth-7',2));
    blit(image,sheet,x+8,y+6,true);
    String(i+1).padStart(3,'0').split('').forEach((d,k)=>{[...digits[+d]].forEach((v,j)=>{if(v==='1')R(x+44+k*8+j%3*2,y+104+Math.floor(j/3)*1,2,1,C('walnut',0));});});
    R(x+8,y+112,96,1,C('porcelain',1));
  });
  return sheet;
}
function build(){
  protectExisting();fs.mkdirSync(artifact('sprites'),{recursive:true});
  const atlas=blank(COLUMNS*SIZE,ROWS*SIZE),images=[],sprites=[];
  for(const base of CATALOG)for(let season=0;season<SEASONS.length;season++){
    const image=paintSprite(palette,base,season),i=sprites.length;
    const id=`${base.id}-${SEASONS[season]}`,rel=`sprites/${id}.png`;
    const position={x:(i%COLUMNS)*SIZE,y:Math.floor(i/COLUMNS)*SIZE,width:SIZE,height:SIZE};
    encodePng(artifact(rel),image);blit(image,atlas,position.x,position.y);images.push(image);
    sprites.push({id,nameZh:`${SEASON_ZH[season]}·${base.nameZh}`,nameEn:`${SEASONS[season][0].toUpperCase()+SEASONS[season].slice(1)} ${base.nameEn}`,category:base.category,season:SEASONS[season],tags:['reserve','original','native-2x','low-three-quarter','top-left-light',base.category,SEASONS[season]],baseShape:base.id,variant:SEASONS[season],path:rel,width:SIZE,height:SIZE,logicalWidth:48,logicalHeight:48,density:2,anchor:{x:0.5,y:11/12},atlas:position,pixelSha256:pixelsHash(image)});
  }
  encodePng(artifact('atlas.png'),atlas);encodePng(artifact('contact-sheet.png'),contactSheet(images));
  const manifest={schemaVersion:1,packId:ID,status:'reserve',integrated:false,generator:GENERATOR,license:'Original project artwork; no third-party source images or external fonts used.',density:2,alpha:'binary',projection:'low-three-quarter, non-isometric',lighting:'upper-left',anchorConvention:'normalized sprite coordinates; bottom-center floor contact at (48,88) art px',paddingMinimum:2,palette:{source:'docs/art-grid/palette.json',colors:[...new Set(palette.colors.filter(c=>!c.ramp.startsWith('team-')).map(c=>c.hex))]},counts:{sprites:sprites.length,baseShapes:CATALOG.length,variantsPerBase:SEASONS.length,categories:6,seasons:4},categories:[...new Set(CATALOG.map(b=>b.category))],seasons:SEASONS,variantDesign:{spring:'Petalled blossoms and flowering stems; edible flower toppings and floral textile motifs.',summer:'Whole fruit, citrus discs, leaves and iced-drink components; not a palette swap.',autumn:'Lobed maple leaves, nuts and harvest arrangements, changing drawn geometry.',winter:'Tiered evergreen boughs, pinecones and cream/snow-like toppings, changing drawn geometry.'},baseShapes:CATALOG,atlas:{path:'atlas.png',width:atlas.width,height:atlas.height,columns:COLUMNS,rows:ROWS,cellWidth:SIZE,cellHeight:SIZE},contactSheet:{path:'contact-sheet.png',width:1344,height:1856,columns:12,cellWidth:112,cellHeight:116,labels:'One-based manifest sprite ordinal',background:'Opaque on-palette cream checkerboard for inspection; NOT a runtime sprite'},sprites};
  writeJson('manifest.json',manifest);fs.writeFileSync(artifact('catalog.js'),`// Generated reserve metadata; not an integration registration.\nwindow.SEASONAL_RESERVE = ${JSON.stringify(manifest)};\n`);
  // Record completed writes before auditing, so a failed audit remains recoverable
  // without deleting outputs or weakening the user-edit hash protection.
  const saveIndex=()=>{
    const files=['manifest.json','catalog.js','atlas.png','contact-sheet.png','verification-report.json',...sprites.map(s=>s.path)].filter(rel=>fs.existsSync(artifact(rel))).map(rel=>({path:rel,bytes:fs.statSync(artifact(rel)).size,sha256:hash(fs.readFileSync(artifact(rel)))}));
    writeJson('generated-file-index.json',{schemaVersion:1,packId:ID,generator:GENERATOR,notes:'This file inventories generator-owned files only; excludes itself and any manually maintained gallery or README.',files});
  };
  saveIndex();
  const report=check();writeJson('verification-report.json',report);saveIndex();
  return report;
}
function pixelAudit(image,label,{padding=false}={}){
  const allowed=new Set(palette.colors.filter(c=>!c.ramp.startsWith('team-')).map(c=>c.hex.slice(1))),colors=new Set();
  let opaque=0,partial=0,off=0,dirtyTransparent=0,minX=image.width,minY=image.height,maxX=-1,maxY=-1;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const i=(y*image.width+x)*4,a=image.pixels[i+3];
    if(!a){if(image.pixels[i]||image.pixels[i+1]||image.pixels[i+2])dirtyTransparent++;continue;}
    opaque++;if(a!==255)partial++;
    const c=Array.from(image.pixels.subarray(i,i+3)).map(v=>v.toString(16).padStart(2,'0')).join('');colors.add(c);if(!allowed.has(c))off++;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  assert(opaque>0,`${label}: empty image`);assert(partial===0,`${label}: ${partial} partial-alpha pixels`);assert(off===0,`${label}: ${off} off-palette pixels`);assert(dirtyTransparent===0,`${label}: nonzero transparent RGB`);
  if(padding)assert(minX>=2&&minY>=2&&maxX<image.width-2&&maxY<image.height-2,`${label}: insufficient transparent padding`);
  return {opaquePixels:opaque,colors:colors.size,bounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},padding:{left:minX,top:minY,right:image.width-maxX-1,bottom:image.height-maxY-1}};
}
// True global recolors preserve alpha AND a consistent one-to-one mapping of
// colors. A changed flower/fruit/leaf/branch drawing breaks that mapping.
function pureRecolor(a,b){const f=new Map(),r=new Map();for(let i=0;i<a.pixels.length;i+=4){if(a.pixels[i+3]!==b.pixels[i+3])return false;if(!a.pixels[i+3])continue;const ca=a.pixels[i]*65536+a.pixels[i+1]*256+a.pixels[i+2],cb=b.pixels[i]*65536+b.pixels[i+1]*256+b.pixels[i+2];if((f.has(ca)&&f.get(ca)!==cb)||(r.has(cb)&&r.get(cb)!==ca))return false;f.set(ca,cb);r.set(cb,ca);}return true;}
function check(){
  const manifest=readJson('manifest.json');assert(manifest.schemaVersion===1&&manifest.packId===ID&&manifest.status==='reserve'&&manifest.integrated===false,'Manifest reserve/schema mismatch');
  assert(manifest.sprites.length>=144,'Fewer than 144 sprites');assert(manifest.counts.sprites===manifest.sprites.length,'Sprite count mismatch');
  const bases=new Set(manifest.sprites.map(s=>s.baseShape));assert(bases.size>=48&&bases.size===manifest.counts.baseShapes,'Base shape count mismatch');assert(manifest.baseShapes.length===bases.size,'Base shape catalog mismatch');
  const atlas=decodePng(artifact(manifest.atlas.path));assert(atlas.width===manifest.atlas.width&&atlas.height===manifest.atlas.height,'Atlas dimensions mismatch');pixelAudit(atlas,'atlas');
  const ids=new Set(),paths=new Set(),hashes=new Map(),groups=new Map(),occupiedCells=new Set(),spriteResults=[];
  let comparedAtlasPixels=0,geometryPairs=0;
  for(const [ordinal,s]of manifest.sprites.entries()){
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)&&!ids.has(s.id),`Invalid/duplicate stable id ${s.id}`);ids.add(s.id);
    assert(within(s.path)&&s.path===`sprites/${s.id}.png`&&!paths.has(s.path),`Invalid/duplicate path ${s.path}`);paths.add(s.path);
    assert(typeof s.nameZh==='string'&&/[\u3400-\u9fff]/.test(s.nameZh)&&typeof s.nameEn==='string'&&s.nameEn.length>3,`${s.id}: missing bilingual names`);
    assert(manifest.categories.includes(s.category)&&SEASONS.includes(s.season)&&s.variant===s.season&&Array.isArray(s.tags)&&s.tags.includes('reserve'),`${s.id}: invalid classification`);
    assert(s.width===96&&s.height===96&&s.logicalWidth===48&&s.logicalHeight===48&&s.density===2,`${s.id}: native size/density mismatch`);
    assert(Number.isFinite(s.anchor?.x)&&Number.isFinite(s.anchor?.y)&&s.anchor.x===.5&&s.anchor.y===11/12,`${s.id}: invalid anchor`);
    assert(Number.isInteger(s.anchor.x*s.width)&&Number.isInteger(s.anchor.y*s.height),`${s.id}: subpixel anchor`);
    const a=s.atlas;assert(a.width===s.width&&a.height===s.height&&Number.isInteger(a.x)&&Number.isInteger(a.y)&&a.x>=0&&a.y>=0&&a.x+a.width<=atlas.width&&a.y+a.height<=atlas.height,`${s.id}: invalid atlas rectangle`);
    assert(a.x===(ordinal%COLUMNS)*SIZE&&a.y===Math.floor(ordinal/COLUMNS)*SIZE,`${s.id}: unexpected packing/order`);const cell=`${a.x},${a.y}`;assert(!occupiedCells.has(cell),`${s.id}: atlas overlap`);occupiedCells.add(cell);
    const image=decodePng(artifact(s.path));assert(image.width===s.width&&image.height===s.height,`${s.id}: decoded dimensions mismatch`);
    const result=pixelAudit(image,s.id,{padding:true}),digest=pixelsHash(image);assert(!hashes.has(digest),`${s.id}: completely duplicates ${hashes.get(digest)}`);hashes.set(digest,s.id);assert(digest===s.pixelSha256,`${s.id}: pixel hash mismatch`);
    assert(result.colors>=6&&result.opaquePixels>=250,`${s.id}: suspiciously sparse/flat sprite`);
    // Anchors sit immediately below the opaque contact shadow, not halfway up a prop.
    assert(s.anchor.y*s.height>result.bounds.y+result.bounds.height-1&&s.anchor.y*s.height-(result.bounds.y+result.bounds.height-1)<=5,`${s.id}: anchor does not match contact base`);
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4,j=((a.y+y)*atlas.width+a.x+x)*4;for(let c=0;c<4;c++)assert(image.pixels[i+c]===atlas.pixels[j+c],`${s.id}: atlas readback mismatch at ${x},${y},${c}`);comparedAtlasPixels++;}
    const original=paintSprite(palette,CATALOG.find(b=>b.id===s.baseShape)??fail(`${s.id}: unknown base`),SEASONS.indexOf(s.season));assert(pixelsHash(original)===digest,`${s.id}: generator determinism/source drift`);
    if(!groups.has(s.baseShape))groups.set(s.baseShape,[]);groups.get(s.baseShape).push({s,image});
    spriteResults.push({id:s.id,path:s.path,pixelSha256:digest,...result,status:'passed'});
  }
  for(const [base,variants]of groups){assert(variants.length===4&&new Set(variants.map(v=>v.s.season)).size===4,`${base}: incomplete seasonal variants`);for(let i=0;i<variants.length;i++)for(let j=i+1;j<variants.length;j++){assert(!pureRecolor(variants[i].image,variants[j].image),`${base}: ${variants[i].s.season}/${variants[j].s.season} are only recolors`);geometryPairs++;}}
  const representativeSilhouettes=new Set([...groups.values()].map(v=>hash(Uint8Array.from(v[0].image.pixels.filter((_,i)=>i%4===3)))));assert(representativeSilhouettes.size>=48,'Fewer than 48 distinct representative base silhouettes');
  const contact=decodePng(artifact(manifest.contactSheet.path));assert(contact.width===1344&&contact.height===1856,'Contact sheet dimensions mismatch');pixelAudit(contact,'contact-sheet');
  const catalog=fs.readFileSync(artifact('catalog.js'),'utf8');assert(catalog===`// Generated reserve metadata; not an integration registration.\nwindow.SEASONAL_RESERVE = ${JSON.stringify(manifest)};\n`,'Offline catalog diverges from manifest');
  return {schemaVersion:1,packId:ID,status:'passed',command:'node scripts/build-seasonal-reserve.mjs --check',counts:{sprites:manifest.sprites.length,baseShapes:bases.size,representativeBaseSilhouettes:representativeSilhouettes.size,seasons:4,categories:6,pngFiles:manifest.sprites.length+2,nonRecolorVariantPairs:geometryPairs,atlasPixelsCompared:comparedAtlasPixels},checks:{pngDecode:true,dimensions:true,nativeDensity2:true,binaryAlpha:true,masterPaletteOnly:true,transparentRgbClean:true,transparentPaddingAtLeast2:true,nonemptyDetailedSprites:true,noExactDuplicates:true,noPureRecolorVariants:true,distinctBaseSilhouettes:true,atlasPixelReadback:true,atlasNonoverlap:true,safeRelativePaths:true,stableUniqueIds:true,bilingualNames:true,normalizedContactAnchors:true,deterministicRegeneration:true,offlineCatalogMatchesManifest:true,reserveNotIntegrated:true},artifacts:{atlas:{path:manifest.atlas.path,width:atlas.width,height:atlas.height,pixelSha256:pixelsHash(atlas),fileSha256:hash(fs.readFileSync(artifact(manifest.atlas.path)))},contactSheet:{path:manifest.contactSheet.path,width:contact.width,height:contact.height,fileSha256:hash(fs.readFileSync(artifact(manifest.contactSheet.path)))}},limitations:['Machine checks do not replace human visual review.','These are unregistered reserve assets, not new gameplay or runtime content.','Contact sheet intentionally has an opaque on-palette background.'],sprites:spriteResults};
}
try{
  const args=process.argv.slice(2);assert(args.every(a=>a==='--check'),`Unknown arguments: ${args.join(' ')}`);
  const report=args.includes('--check')?check():build();
  console.log(JSON.stringify({status:report.status,mode:args.includes('--check')?'check':'build',directory:REL,...report.counts,report:`${REL}/verification-report.json`},null,2));
}catch(error){console.error(`Seasonal reserve FAILED: ${error.stack??error}`);process.exitCode=1;}
