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
fs.mkdirSync('artifacts',{recursive:true});
const opening=await send('Page.captureScreenshot',{format:'jpeg',quality:60,clip:openingRect});fs.writeFileSync('artifacts/owner-v6-opening.jpg',Buffer.from(opening.data,'base64'));
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




await ev("Object.assign(cafeQA.sim.servers[0].look,{skin:0,hair:1,hairStyle:1,shirt:7,pants:1})");await delay(200);
const measurements=await ev(`(async()=>{const s=await import('/src/render/sprites.ts'),ref=await import((await fetch('/src/render/sprites.ts').then(r=>r.text())).match(/from \"([^\"]*reference-character-art[^\"]*)\"/)[1]),f=await import('/src/render/fine-sprite-art.ts');const {sim,state}=cafeQA;const roles=[{name:'owner',look:state.profile.look},{name:'server',look:sim.servers[0].look},{name:'customer',look:guestQA.look,id:1}];const c=document.createElement('canvas');c.width=600;c.height=230;const x=c.getContext('2d');x.fillStyle='#efe2c7';x.fillRect(0,0,600,230);let rows=[];for(let i=0;i<roles.length;i++){const r=roles[i],p=s.character(r.look,r.name,r.id),v=p.stand,a=f.fineSpriteArt(v),pt=ref.referenceCharacterContacts(v);x.imageSmoothingEnabled=false;x.drawImage(a.canvas,i*200+50,200-pt.foot.y*4,v.width*4,v.height*4);x.fillStyle='#33231b';x.font='16px sans-serif';x.fillText(r.name,i*200+20,25);rows.push({role:r.name,contacts:pt,height:pt.foot.y-pt.head.y})}return {rows,image:c.toDataURL('image/jpeg',.65).split(',')[1],servers:sim.servers.map(s=>({x:s.x,y:s.y,look:s.look}))}})()`);
console.log('MEASUREMENTS '+JSON.stringify({rows:measurements.rows,servers:measurements.servers}));fs.writeFileSync('artifacts/staff-height-'+(process.argv[2]||'before')+'-lineup.jpg',Buffer.from(measurements.image,'base64'));
const anchors=await ev(`(async()=>{const s=await import('/src/render/sprites.ts'),ref=await import((await fetch('/src/render/sprites.ts').then(r=>r.text())).match(/from "([^"]*reference-character-art[^"]*)"/)[1]);const server=cafeQA.sim.servers[0],frames=s.character(server.look,'server');let checked=0;for(const dir of ['down','up','left','right'])for(const frame of frames[dir]){const p=ref.referenceCharacterContacts(frame);if(p.legExtension!==3||Math.abs(p.foot.y-46.2)>.001)throw Error('Server foot contact');checked++;}const scene=qaScene,draw=scene.image,calls=[];scene.image=function(...args){calls.push(args);return draw.apply(this,args)};const prev={plates:server.plates,phase:server.phase};server.plates=[{items:['espresso']}];server.phase='toSeat';try{scene.drawServer(server,200);const tray=calls.at(-1),pose=scene.drawWalker(server,frames,'down',200);const expected=pose.y-10*pose.scale-pose.legExtension-pose.bob;if(Math.abs(tray[2]-expected)>.001)throw Error('Tray anchor mismatch');return {checked,trayY:tray[2],expected,legExtension:pose.legExtension};}finally{scene.image=draw;Object.assign(server,prev)}})()`);console.log('SERVER_ANCHORS '+JSON.stringify(anchors));
const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');const scene=await send('Page.captureScreenshot',{format:'jpeg',quality:42,clip:rect});fs.writeFileSync('artifacts/staff-height-'+(process.argv[2]||'before')+'-scene.jpg',Buffer.from(scene.data,'base64'));console.log('ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime errors');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
