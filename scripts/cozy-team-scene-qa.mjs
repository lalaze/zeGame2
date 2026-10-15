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

await ev(`(()=>{for(const [key,index] of Object.entries({skin:1,hair:1,hairStyle:3,shirt:2})){document.querySelectorAll('[data-key="'+key+'"] button')[index].click();}})()`);await delay(250);
fs.mkdirSync('artifacts',{recursive:true});const editorRect=await ev('(()=>{const r=document.querySelector(".onboard").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');const editorShot=await send('Page.captureScreenshot',{format:'jpeg',quality:85,clip:editorRect});fs.writeFileSync('artifacts/cozy-team-editor.jpg',Buffer.from(editorShot.data,'base64'));
await ev('document.querySelector(".onboard [data-next]").click()');await delay(150);
await ev('document.querySelector(".onboard [data-next]").click()');await delay(250);
const openingRect=await ev('(()=>{const r=document.querySelector(".onboard").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
fs.mkdirSync('artifacts',{recursive:true});
const opening=await send('Page.captureScreenshot',{format:'jpeg',quality:60,clip:openingRect});fs.writeFileSync('artifacts/cozy-team-opening.jpg',Buffer.from(opening.data,'base64'));
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




const captures=[];
async function capture(name){await delay(300);const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:80,clip:rect});fs.writeFileSync('artifacts/cozy-team-'+name+'.jpg',Buffer.from(shot.data,'base64'));captures.push(name);}
await capture('starter');
await ev(`(()=>{const {sim,state}=cafeQA;state.upgrades.barista=2;state.upgrades.server=2;state.kitchen=true;state.upgrades.cook=2;sim.sync(state);sim.baristas.forEach((b,i)=>Object.assign(b.look,{skin:i%3,hair:1,hairStyle:i,shirt:2,pants:1}));sim.servers.forEach((s,i)=>Object.assign(s.look,{skin:0,hair:1,hairStyle:i===0?4:3,shirt:1,pants:1}));sim.cooks.forEach(c=>Object.assign(c.look,{skin:0,hair:1,hairStyle:0,shirt:0,pants:1}));qaScene.view.moveToArea('main',true);})()`);
await capture('main');
await ev(`(()=>{const {sim}=cafeQA;sim.servers[0].plates=[{items:['espresso']}];sim.servers[0].phase='toSeat';})()`);await capture('service');
await ev(`(()=>{qaScene.view.moveToArea('kitchen',true)})()`);await capture('kitchen');
await ev(`(()=>{qaScene.view.moveToArea('main',true)})()`);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);await capture('mobile');
const mobile=await ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})');if(mobile.scroll>mobile.width)throw Error('Mobile overflow');
console.log('VISUAL_QA '+JSON.stringify({captures,mobile,errors}));if(errors.length)throw Error('Runtime errors');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
