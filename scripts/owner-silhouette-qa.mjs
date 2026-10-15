import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cozy-sample-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5173/?qa-light=10'});
for(let i=0;i<120;i++){await delay(300);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}
for(let i=0;i<2;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(100);}

await ev(`(()=>{for(const [key,index] of Object.entries({skin:1,hair:1,hairStyle:0,shirt:2})){document.querySelectorAll('[data-key="'+key+'"] button')[index].click();}})()`);await delay(250);
await ev('document.querySelector(".onboard [data-next]").click()');await delay(150);
await ev('document.querySelector(".onboard [data-next]").click()');await delay(250);
const openingRect=await ev('(()=>{const r=document.querySelector(".onboard").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
const opening=await send('Page.captureScreenshot',{format:'jpeg',quality:60,clip:openingRect});console.log('OPENING '+opening.data);
await ev('document.querySelector(".onboard [data-back]").click()');await delay(100);
await ev('document.querySelector(".onboard [data-back]").click()');await delay(200);
const thumbs=await ev('Array.from(document.querySelectorAll(".swatch-sprite")).map(c=>({width:c.width,height:c.height,ink:Array.from(c.getContext("2d").getImageData(0,0,c.width,c.height).data).filter((v,i)=>i%4===3&&v>0).length}))');if(thumbs.some(t=>!t.ink))throw Error('Empty hair thumbnail');console.log('THUMBNAILS '+JSON.stringify(thumbs));
for(let i=0;i<3;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(150);}
await ev(`(async()=>{const {Sim}=await import('/src/game/sim.ts');const original=Sim.prototype.update;Sim.prototype.update=function(state,dt){window.cafeQA={sim:this,state};return window.freezeCafeQA?[]:original.call(this,state,dt);};})()`);
await delay(500);
console.log('CAPTURED '+JSON.stringify(await ev('({sim:!!window.cafeQA,state:window.cafeQA?.state.phase})')));
await ev(`(async()=>{window.freezeCafeQA=true;const {sim,state}=window.cafeQA;sim.customerCast.restore({remaining:[1],previous:-1});sim.spawn(state);const c=sim.customers[0];if(c.appearanceId!==1)throw Error('Wrong guest');window.guestQA=c;const layout=await import('/src/game/layout.ts');window.qaLayout=layout;Object.assign(c,{x:190,y:230,tx:210,ty:230,phase:'queue',via:[],journey:[],stride:4});sim.queue=[];})()`);

await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));if(!url)throw Error('Scene module URL missing');const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};})()`);
await delay(300);
console.log('SCENE '+JSON.stringify(await ev('({scene:!!window.qaScene})')));



const data=await ev(`(async()=>{const s=await import('/src/render/sprites.ts'),f=await import('/src/render/fine-sprite-art.ts');const c=document.createElement('canvas');c.width=1000;c.height=700;const x=c.getContext('2d');x.fillStyle='#efe2c7';x.fillRect(0,0,c.width,c.height);for(let i=0;i<8;i++){const p=s.character({skin:i%4,hair:i%6,hairStyle:i,shirt:2,pants:1},'owner');x.fillStyle='#33231b';x.font='14px sans-serif';const xx=i%4*250,yy=Math.floor(i/4)*350;x.fillText('Owner style '+i,xx+8,yy+20);[p.down[0],p.right[0],p.sitRight].forEach((v,j)=>{const a=f.fineSpriteArt(v);x.imageSmoothingEnabled=false;x.drawImage(a.canvas,xx+10+j*78,yy+155-v.height*2.5,v.width*2.5,v.height*2.5)})}return c.toDataURL('image/jpeg',.65).split(',')[1]})()`);console.log('IMAGE '+data);
const check=await ev(`(async()=>{const s=await import('/src/render/sprites.ts'),fine=await import('/src/render/fine-sprite-art.ts');let checked=0;const gaps=[];for(let style=0;style<8;style++)for(let skin=0;skin<4;skin++){const f=s.character({skin,hair:style%6,hairStyle:style,shirt:2,pants:1},'owner');for(const [dir,frames]of Object.entries({down:f.down,up:f.up,left:f.left,right:f.right})){for(const [i,v]of frames.entries()){const a=fine.fineSpriteArt(v).canvas,d=a.getContext('2d').getImageData(0,0,a.width,a.height).data;const rows=Array.from({length:a.height},(_,y)=>{let n=0;for(let x=0;x<a.width;x++)if(d[(y*a.width+x)*4+3]>100)n++;return n;});const first=rows.findIndex(n=>n),last=rows.findLastIndex(n=>n);const blank=rows.slice(first,last+1).filter(n=>!n).length;if(blank)gaps.push({style,skin,dir,i,blank});checked++;}}}return {checked,gaps};})()`);console.log('SILHOUETTE '+JSON.stringify(check));if(check.gaps.length)throw Error('Disconnected silhouette');
const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');const scene=await send('Page.captureScreenshot',{format:'jpeg',quality:42,clip:rect});console.log('SCENE_IMAGE '+scene.data);console.log('ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime errors');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
