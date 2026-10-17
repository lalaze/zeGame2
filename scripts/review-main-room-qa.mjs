// Offline native-painter boards, not Chrome/Phaser screenshots.
// node scripts/review-main-room-qa.mjs [--out=artifacts/art-grid/review-1-fixes]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {rolldown} from 'rolldown';
import woff2 from 'wawoff2';
import {encodePng} from './pixel-conform.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'artifacts/art-grid/review-1-fixes';
fs.mkdirSync(out,{recursive:true});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'cafe-native-qa-'));
let rasters={};
try {
  const font=path.join(temporary,'pixel.ttf');
  fs.writeFileSync(font,await woff2.decompress(fs.readFileSync('src/assets/pixel-zh.woff2')));
  const result=spawnSync('swift',['-module-cache-path',path.join(temporary,'modules'),'scripts/art-grid-offline-fonts.swift',font],{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(result.stderr||'offline CoreText failed');
  rasters=JSON.parse(result.stdout);
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
const entry='offline-main-art';
const bundle=await rolldown({input:entry,plugins:[{name:entry,resolveId:id=>id===entry?id:null,load:id=>id===entry?[
  'src/render/main-room-surfaces.ts','src/render/sign-lettering.ts','src/game/layout.ts','src/game/decor.ts',
].map(file=>`export * from ${JSON.stringify(path.resolve(file))};`).join('\n'):null}]});
const {output}=await bundle.generate({format:'esm'});await bundle.close();
const art=await import('data:text/javascript;base64,'+Buffer.from(output.find(p=>p.type==='chunk').code).toString('base64'));
// Platform scratch raster feeds the ACTUAL JS mask bounds/threshold implementation.
globalThis.document={fonts:new Set([{family:'Pixel ZH',status:'loaded'}]),createElement:()=>{
  const ctx={font:'',textBaseline:'',fillStyle:'',text:'',fillText(text){this.text=text;},getImageData(){return {data:Buffer.from(rasters[(this.font.includes('"Pixel ZH"')?'pixel':'platform')+':'+this.text]??'', 'base64')};}};
  return {width:24,height:32,getContext:()=>ctx};
}};
function board(w,h) {
  const width=w*2,height=h*2,pixels=new Uint8ClampedArray(width*height*4),stack=[];
  const ctx={fillStyle:'#efdfbe',globalAlpha:1,clipBox:null,pending:null,
    save(){stack.push([this.fillStyle,this.globalAlpha,this.clipBox]);},restore(){[this.fillStyle,this.globalAlpha,this.clipBox]=stack.pop();},
    beginPath(){this.pending=null;},rect(x,y,w,h){this.pending=[x,y,w,h];},clip(){this.clipBox=this.pending;},
    fillRect(x,y,w,h){
      const rgb=[1,3,5].map(i=>parseInt(this.fillStyle.slice(i,i+2),16));
      const clip=this.clipBox??[0,0,width/2,height/2];
      for(let row=Math.max(0,Math.round(y*2),Math.round(clip[1]*2));row<Math.min(height,Math.round((y+h)*2),Math.round((clip[1]+clip[3])*2));row++)
        for(let col=Math.max(0,Math.round(x*2),Math.round(clip[0]*2));col<Math.min(width,Math.round((x+w)*2),Math.round((clip[0]+clip[2])*2));col++){
          const i=(row*width+col)*4;for(let c=0;c<3;c++)pixels[i+c]=Math.round(rgb[c]*this.globalAlpha+pixels[i+c]*(1-this.globalAlpha));pixels[i+3]=255;
        }
    },
  };
  ctx.fillRect(0,0,w,h);
  return {ctx,save:name=>encodePng(path.join(out,name+'.png'),{width,height,pixels})};
}
const label=(ctx,text,cx,y,w=100)=>art.paintPixelSignText(ctx,text,cx,y,w,6,art.artRamp('cloth-7')[2]);
const rect=(ctx,x,y,w,h,c)=>art.artRect(ctx,x,y,w,h,c);
for(const style of ['cream','mint','rose']) {
  const b=board(320,240),ctx=b.ctx,theme=art.STARTER_THEMES.find(t=>t.id===(style==='cream'?'classic':style)).equip;
  art.mainFloor(ctx,theme.floor,240);art.mainCarpet(ctx,240,true);art.mainWall(ctx,theme.wallpaper);
  // Native joinery layout only: legacy windows, actors, props and lighting aren't emulated.
  art.mainCabinet(ctx,theme.counter,art.BACK_BAR.x,art.BACK_BAR.top,art.BACK_BAR.w,art.BACK_BAR.front-art.BACK_BAR.top,80-art.BACK_BAR.front,true);
  art.mainCabinet(ctx,theme.counter,art.COUNTER.x,art.COUNTER.top,art.COUNTER.w,art.COUNTER.front-art.COUNTER.top,art.COUNTER.bottom-art.COUNTER.front);
  rect(ctx,110,7,100,44,art.artRamp('sage')[0]);label(ctx,'猫与朋友咖啡馆',160,10,84);label(ctx,'今日菜单',160,19,84);
  for(const win of art.WINDOWS) {
    art.mainTimber(ctx,win.x-2,win.y-2,win.w+4,win.h+4);
    rect(ctx,win.x,win.y,win.w,win.h,art.artRamp('sky')[1]);
    art.mainTimber(ctx,win.x+win.w/2-1,win.y,2,win.h,true);
    art.mainTimber(ctx,win.x,win.y+win.h/2-1,win.w,2);
  }
  const win=art.WINDOWS[0];art.mainTimber(ctx,25,35,27,10);rect(ctx,26.5,36.5,24,7,art.artRamp('cloth-7')[2]);
  art.paintPixelSignText(ctx,'营业中',38.5,37,23,6,art.artRamp('gingham')[0]);
  rect(ctx,109,113,29,8,art.artRamp('sage')[0]);label(ctx,'点单',123.5,114,27);
  const pc=art.PASTRY_CASE;rect(ctx,pc.x,97,pc.w,7,art.artRamp('cloth-2')[2]);
  rect(ctx,pc.x,110,pc.w,12,art.artRamp('cloth-7')[2]);
  art.mainPickup(ctx,theme.counter);label(ctx,'取餐',art.PASS.x+19,art.PASS.top,28);
  // The bell and plates below are QA overlays at the real anchors, not baked runtime stock.
  rect(ctx,art.PASS_BELL.x,art.PASS_BELL.y,3,1,art.artRamp('oak')[5]);
  for(let i=0;i<6;i++){const p=art.passSlot(i);rect(ctx,p.x+2,p.y-1,8,1,art.artRamp('cloth-7')[2]);rect(ctx,p.x+3,p.y-2,6,1,art.artRamp('floor')[4]);}
  b.save(style+'-native-composite');
}
{
  const b=board(320,250),ctx=b.ctx;
  const finishes=['counter_oak','counter_walnut','counter_marble','counter_pink','counter_gold'];
  finishes.forEach((id,i)=>{
    const y=i*50;rect(ctx,0,y,320,48,art.artRamp('sage')[0]);label(ctx,id.slice(8).toUpperCase(),160,y+2,150);
    art.mainCabinet(ctx,id,5,y+13,100,8,25);
    art.mainCabinet(ctx,id,113,y+16,100,5,25,true);
    art.mainCabinet(ctx,id,221,y+18,94,3,25);
  });b.save('cabinet-finishes');
}
{
  const b=board(160,65),ctx=b.ctx;rect(ctx,0,0,160,65,art.artRamp('sage')[0]);
  label(ctx,'猫与朋友咖啡馆',80,4,150);label(ctx,'今日菜单 点单 取餐',80,16,150);
  label(ctx,'营业中 休息中',80,28,150);label(ctx,'龘 𠮷 🐱',80,40,150);label(ctx,'ORDER',23,53,42);label(ctx,'PICKUP',64,53,40);label(ctx,'OPEN',105,53,36);label(ctx,'CLOSED',140,53,39);
  b.save('signage-native');
}
{
  const b=board(160,35),ctx=b.ctx;rect(ctx,0,0,160,10,art.artRamp('sage')[0]);
  ['sill_none','sill_cactus','sill_tulips','sill_bonsai'].forEach((id,i)=>{const cx=20+i*40;rect(ctx,cx-17,25,34,3,art.artRamp('oak')[3]);art.mainSillPlant(ctx,id,cx,25);label(ctx,id.slice(5).toUpperCase(),cx,3,37);});
  b.save('sill-options');
}
console.log('Native QA boards: '+out+' (CoreText masks; no Phaser/Chrome)');
