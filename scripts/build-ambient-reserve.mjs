#!/usr/bin/env node
// Native 64px utility effects, 16 effects × two densities × eight frames.
// Original procedural pixel art. Does not register animations or load game saves.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createPainter } from './build-seasonal-reserve-art.mjs';
import { encodePng, decodePng } from './pixel-conform.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/generated/ambient-reserve-v1');
const GENERATOR = 'scripts/build-ambient-reserve.mjs';
const palette = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/art-grid/palette.json'), 'utf8'));
const allowed = new Set(palette.colors.filter(c => !c.ramp.startsWith('team-')).map(c => c.hex.slice(1)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, message) => { if (!ok) throw Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
export const EFFECTS = [
  ['steam-curl','杯口卷蒸汽','Cup steam curls','brew',true],
  ['coffee-drip','咖啡滴落','Coffee droplets','brew',true],
  ['kettle-puff','水壶热气','Kettle puffs','brew',true],
  ['sugar-sparkle','糖粒闪光','Sugar sparkle','brew',true],
  ['falling-leaves','缓落秋叶','Falling leaves','weather',true],
  ['petal-drift','花瓣飘落','Drifting petals','weather',true],
  ['snow-flurry','窗边小雪','Window flurries','weather',true],
  ['rain-ripples','雨滴涟漪','Rain ripples','weather',true],
  ['candle-flicker','烛火轻摇','Candle flicker','room',true],
  ['water-ripple','水面波纹','Water rings','room',true],
  ['clean-bubbles','清洁泡泡','Cleaning bubbles','room',true],
  ['flour-dust','烘焙粉尘','Baking flour dust','room',true],
  ['coin-glint','收入小闪光','Income glint','feedback',false],
  ['heart-pop','爱心冒泡','Floating heart','feedback',false],
  ['music-notes','轻音乐符','Floating music notes','feedback',true],
  ['delivery-ping','送达提示星','Delivery star ping','feedback',false],
].map(([id,nameZh,nameEn,category,loop])=>({id,nameZh,nameEn,category,loop}));
const STRENGTHS = [{id:'gentle',nameZh:'轻柔',nameEn:'Gentle'},{id:'lively',nameZh:'活跃',nameEn:'Lively'}];
const N = 8, SIZE = 64, fps = 8;
const SINE = [0,.707,1,.707,0,-.707,-1,-.707];
function safe(relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.split('/').some(p=>p==='..'||p==='.'||!p), `Unsafe effect path ${relative}`);
  const file=path.resolve(OUT,relative);assert(file.startsWith(OUT+path.sep),'Effect path escaped');
  for(let p=file;p!==ROOT&&p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))assert(!fs.lstatSync(p).isSymbolicLink(),`Symlink path ${p}`);
  return file;
}
export function drawEffect(effect, strength, frame) {
  assert(Number.isInteger(strength)&&strength>=0&&strength<2&&Number.isInteger(frame)&&frame>=0&&frame<N,'Invalid effect/frame');
  const p=createPainter(palette,SIZE,SIZE),{color:C,rect:R,line:L,ellipse:E,poly:P}=p;
  const ink=C('walnut',0),cream=C('porcelain',2),white=C('porcelain',3),soft=C('porcelain',0),sage=C('sage',3),sageD=C('sage',0),gold=C('brass',3),goldL=C('brass',4),goldD=C('brass',1),rose=C('cloth-5',1),roseL=C('cloth-5',2),red=C('gingham',1),blue=C('cloth-6',1),blueL=C('cloth-6',2),wood=C('oak',3);
  const t=frame/7,sw=SINE[frame],count=strength?5:3;
  const star=(x,y,r,c=gold)=>{L(x-r,y,x+r,y,c);L(x,y-r,x,y+r,c);R(x-1,y-1,3,3,white);};
  const ring=(x,y,rx,ry,c=blue)=>{E(x,y,rx,ry,c,undefined,undefined,c);if(rx>2&&ry>1)E(x,y,rx-1,ry-1,null,undefined,undefined,null);};
  const leaf=(x,y,s=1)=>{P([[x-5*s,y-3],[x+3*s,y-7],[x+7*s,y],[x,y+5]],gold,goldD,goldL);L(x-4*s,y-2,x+4*s,y+1,sageD);};
  const heart=(x,y,r=7,scale=1)=>{const points=[[0,8],[-r,0],[-r,-5],[-r+3,-8],[-2,-8],[0,-5],[2,-8],[r-3,-8],[r,-5],[r,0],[0,8]].map(([dx,dy])=>[x+dx*scale,y+dy*scale]);P(points,rose,red,roseL);if(scale>.5)L(x+(-r+3)*scale,y-5*scale,x+(-r+5)*scale,y-5*scale,roseL);};
  switch(effect.id){
    case 'steam-curl':
      for(let k=0;k<(strength?4:2);k++){const x0=23+k*6;let previous=[x0,54];for(let j=1;j<=19;j++){const phase=(frame+Math.floor(j/3)+k*2)%8,x=x0+SINE[phase]*(2+j/7),y=54-j*2;L(previous[0],previous[1],x,y,j>14?soft:(k%2?cream:white),j>14?1:2);previous=[x,y];}}break;
    case 'coffee-drip':
      for(let k=0;k<(strength?4:2);k++){const y=14+(frame*6+k*17)%36,x=23+k*6;P([[x,y-5],[x-2,y],[x-1,y+3],[x+2,y+3],[x+3,y]],wood,C('oak',1),C('oak',5));}
      ring(32,52,7+frame%4*3,2+frame%3,goldD);L(20-frame%3,49,18-frame%3,46,gold);break;
    case 'kettle-puff':
      for(let k=0;k<count;k++){const age=(frame+k*2)%8,x=25+k*4+SINE[age]*3,y=49-age*4,r=3+age%4;E(x,y,r,r-1,cream,soft,white,soft);if(age>5){R(x-3,y,1,1,null);R(x+2,y-2,1,1,null);}}
      L(28,53,28+frame%2,50,white);break;
    case 'sugar-sparkle':
      for(let k=0;k<count+2;k++){const x=12+(k*11+frame*2)%40,y=15+(k*7+frame*3)%36;star(x,y,1+(frame+k)%3,(k+frame)%2?gold:cream);}break;
    case 'falling-leaves':
      for(let k=0;k<count;k++){const age=(frame+k*3)%8,x=16+k*8+SINE[age]*5,y=14+age*5;leaf(x,y,(age%3===0?-1:1));}break;
    case 'petal-drift':
      for(let k=0;k<count+1;k++){const age=(frame+k*2)%8,x=12+k*8+SINE[age]*4,y=12+age*5;P([[x-3,y-3],[x+2,y-4],[x+4,y],[x,y+4],[x-3,y+2]],rose,red,roseL);L(x-1,y+1,x+1,y-2,cream);}break;
    case 'snow-flurry':
      for(let k=0;k<count+3;k++){const age=(frame+k*3)%8,x=10+(k*9+Math.round(SINE[age]*3))%44,y=10+age*6;L(x-2,y,x+2,y,cream);L(x,y-2,x,y+2,white);R(x,y,1,1,blueL);}break;
    case 'rain-ripples':
      for(let k=0;k<(strength?4:2);k++){const age=(frame+k*3)%8,x=20+k*9-(k%2)*3,y=43+(k%2)*7;if(age<3)L(x+2,14+age*8,x,23+age*8,blueL,1);ring(x,y,3+age,1+Math.floor(age/3),blue);if(age===3||age===4){L(x-7,y-3,x-9,y-6,blueL);L(x+6,y-3,x+8,y-7,blueL);}}break;
    case 'candle-flicker':{
      const x=32+sw*2,h=20+(strength?7:0)+[0,3,1,5,2,4,1,3][frame];
      P([[31,55],[22,47],[24,37],[x,55-h],[38,37],[42,46],[37,54]],gold,goldD,goldL);
      P([[31,53],[27,46],[30,39+frame%3],[35,45],[35,51]],white,cream,white,cream);
      L(31,56,31,52,ink);if(strength)star(44,19+frame%5*2,1,cream);break;}
    case 'water-ripple':
      for(let k=0;k<count;k++){const age=(frame+k*2)%8;ring(32,43,5+age*2,2+Math.floor(age/2),k%2?blueL:blue);L(23-age,42,26-age,41,cream);}break;
    case 'clean-bubbles':
      for(let k=0;k<count;k++){const age=(frame+k*2)%8,x=16+k*8+SINE[age]*3,y=51-age*4,r=3+(k+frame)%4;ring(x,y,r,r,blue);L(x-r+2,y-r+2,x-r+3,y-r+1,white);R(x+1,y+r-1,2,1,cream);}break;
    case 'flour-dust':
      for(let k=0;k<(strength?24:14);k++){const age=(frame+k*3)%8,x=32+((k*13+age*3)%37)-18,y=52-age*4-(k%3)*2;R(x,y,k%4===0?2:1,k%4===0?2:1,k%3?cream:soft);if(k%5===0)R(x+2,y-1,1,1,white);}break;
    case 'coin-glint':{
      const y=48-frame*4,rx=3+Math.abs(SINE[frame])*5;
      E(32,y,rx,10,gold,goldD,goldL);E(31,y,Math.max(1,rx-2),7,gold,undefined,goldL,goldD);L(31,y-4,31,y+4,goldD);L(29,y-2,33,y-2,goldL);star(22-frame%3,y-9,1+frame%3,cream);if(strength)star(43,y+4,2,goldL);break;}
    case 'heart-pop':{
      const y=48-frame*4,scale=[.6,.85,1,1,.95,.8,.55,.35][frame];heart(32,y,7,scale);if(strength){heart(16,52-frame*3,3,scale);heart(47,47-frame*3,3,scale);}star(20+(frame%3),y-9,1,cream);if(frame>5){R(29-frame%2,y-5,1,1,roseL);R(36+frame%2,y+2,1,1,cream);}break;}
    case 'music-notes':
      for(let k=0;k<(strength?3:2);k++){const age=(frame+k*3)%8,x=18+k*14+SINE[age]*2,y=51-age*4;E(x,y,4,3,sage,sageD,cream);L(x+4,y,x+4,y-13,sageD,2);P([[x+4,y-13],[x+10,y-10],[x+10,y-6],[x+5,y-9]],sage,sageD,cream);}break;
    case 'delivery-ping':{
      const radius=4+frame*2;ring(32,35,radius,Math.max(2,Math.floor(radius*.75)),goldD);
      const r=4+[0,3,5,4,2,1,2,0][frame];P([[32,35-r],[35,32],[32+r,35],[35,38],[32,35+r],[29,38],[32-r,35],[29,32]],gold,goldD,goldL);
      for(let k=0;k<(strength?8:4);k++){const a=k*Math.PI*2/(strength?8:4),x=32+Math.round(Math.cos(a)*(10+frame*2)),y=35+Math.round(Math.sin(a)*(9+frame*2));star(x,y,1,cream);}break;}
    default:throw Error(`Unknown effect ${effect.id}`);
  }
  return {width:SIZE,height:SIZE,pixels:p.pixels};
}
function audit(image,label){
  assert(image.width===SIZE&&image.height===SIZE,`${label}: wrong size`);let opaque=0,minX=64,minY=64,maxX=-1,maxY=-1;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const i=(y*SIZE+x)*4,a=image.pixels[i+3],hex=Array.from(image.pixels.subarray(i,i+3)).map(v=>v.toString(16).padStart(2,'0')).join('');if(!a){assert(hex==='000000',`${label}: dirty transparent pixel`);continue;}assert(a===255&&allowed.has(hex),`${label}: alpha/palette mismatch`);opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  assert(opaque>=15,`${label}: empty/sparse frame`);assert(minX>=2&&minY>=2&&maxX<=61&&maxY<=61,`${label}: clipped effect ${minX},${minY}..${maxX},${maxY}`);return {opaquePixels:opaque,bounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},pixelSha256:hash(image.pixels)};
}
function place(src,dst,x0,y0){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const i=(y*src.width+x)*4,j=((y+y0)*dst.width+x+x0)*4;dst.pixels.set(src.pixels.subarray(i,i+4),j);}}
function prepare(){
  const clips=[],files=[],atlas={width:SIZE*N,height:SIZE*EFFECTS.length*2,pixels:new Uint8ClampedArray(SIZE*N*SIZE*EFFECTS.length*2*4)};
  for(const effect of EFFECTS)for(const [strength,variant]of STRENGTHS.entries()){
    const id=`${effect.id}-${variant.id}`,strip={width:SIZE*N,height:SIZE,pixels:new Uint8ClampedArray(SIZE*N*SIZE*4)},frames=[],hashes=new Set();
    for(let f=0;f<N;f++){const image=drawEffect(effect,strength,f),result=audit(image,`${id}/${f}`);assert(!hashes.has(result.pixelSha256),`${id}: repeated frame ${f}`);hashes.add(result.pixelSha256);const relative=`frames/${id}-${f}.png`;files.push({path:relative,image});place(image,strip,f*SIZE,0);frames.push({index:f,path:relative,...result});}
    files.push({path:`strips/${id}.png`,image:strip});place(strip,atlas,0,clips.length*SIZE);
    clips.push({id,nameZh:`${variant.nameZh}·${effect.nameZh}`,nameEn:`${variant.nameEn} ${effect.nameEn}`,effect:effect.id,category:effect.category,strength:variant.id,width:SIZE,height:SIZE,logicalWidth:32,logicalHeight:32,density:2,anchor:{x:.5,y:.875},fps,frameCount:N,durationMs:N/fps*1000,loop:effect.loop,strip:`strips/${id}.png`,atlas:{x:0,y:clips.length*SIZE,width:SIZE*N,height:SIZE},frames});
  }
  files.push({path:'atlas.png',image:atlas});
  const manifest={schemaVersion:1,packId:'ambient-reserve-v1',status:'reserve',integrated:false,generator:GENERATOR,provenance:'Original deterministic native pixel effects; no external images or model output.',palette:'docs/art-grid/palette.json',alpha:'binary',counts:{effects:EFFECTS.length,clips:clips.length,frames:clips.length*N},atlas:{path:'atlas.png',width:atlas.width,height:atlas.height},clips};
  return {manifest,files};
}
const catalogText=m=>`window.AMBIENT_RESERVE = ${JSON.stringify(m)};\n`;
function checkPrepared(prepared){
  const {manifest,files}=prepared;assert(fs.readFileSync(safe('manifest.json'),'utf8')===json(manifest),'Effect manifest drift');assert(fs.readFileSync(safe('catalog.js'),'utf8')===catalogText(manifest),'Effect browser catalog drift');
  for(const file of files){const disk=decodePng(safe(file.path));assert(disk.width===file.image.width&&disk.height===file.image.height&&hash(disk.pixels)===hash(file.image.pixels),`Effect PNG/source mismatch ${file.path}`);}
  return {status:'passed',...manifest.counts,pngFiles:files.length,checks:{nativeDensity2:true,binaryAlpha:true,masterPalette:true,transparentPadding2:true,nonemptyFrames:true,noRepeatedFramesWithinClip:true,deterministicRepaint:true,decodedPngReadback:true,stripAndAtlasReadback:true,offlineCatalog:true},limitations:['This check does not judge animation aesthetics.','Feedback effects marked loop=false should play once in production; the preview repeats them after a pause.','No animation hooks or gameplay changes are installed.']};
}
function outputPaths(p){return [...p.files.map(f=>f.path),'manifest.json','catalog.js','verification-report.json'];}
function protect(p){const index=safe('generated-file-index.json');if(fs.existsSync(index)){const previous=JSON.parse(fs.readFileSync(index,'utf8'));assert(previous.generator===GENERATOR,'Unknown effect ownership');const owned=new Set();for(const f of previous.files){assert(fs.existsSync(safe(f.path))&&hash(fs.readFileSync(safe(f.path)))===f.sha256,`Hand-edited effect artifact ${f.path}`);owned.add(f.path);}for(const rel of outputPaths(p))if(fs.existsSync(safe(rel)))assert(owned.has(rel),`Unowned effect artifact ${rel}`);}else for(const rel of outputPaths(p))assert(!fs.existsSync(safe(rel)),`Unowned effect artifact ${rel}`);}
function index(p){fs.writeFileSync(safe('generated-file-index.json'),json({generator:GENERATOR,packId:p.manifest.packId,files:outputPaths(p).filter(rel=>fs.existsSync(safe(rel))).map(rel=>({path:rel,sha256:hash(fs.readFileSync(safe(rel))),bytes:fs.statSync(safe(rel)).size}))}));}
export function buildEffects(checkOnly=false){const prepared=prepare();if(checkOnly)return checkPrepared(prepared);protect(prepared);fs.mkdirSync(OUT,{recursive:true});for(const f of prepared.files)encodePng(safe(f.path),f.image);fs.writeFileSync(safe('manifest.json'),json(prepared.manifest));fs.writeFileSync(safe('catalog.js'),catalogText(prepared.manifest));index(prepared);const report=checkPrepared(prepared);fs.writeFileSync(safe('verification-report.json'),json(report));index(prepared);return report;}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){try{assert(process.argv.slice(2).every(a=>a==='--check'),'Usage: node scripts/build-ambient-reserve.mjs [--check]');console.log(JSON.stringify(buildEffects(process.argv.includes('--check')),null,2));}catch(error){console.error(error.stack??error);process.exitCode=1;}}
