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
await ev('document.querySelector("[data-cozy-owner-preset]").click()');await delay(200);
for(let i=0;i<3;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(150);}
await ev(`(async()=>{const {Sim}=await import('/src/game/sim.ts');const original=Sim.prototype.update;Sim.prototype.update=function(state,dt){window.cafeQA={sim:this,state};return window.freezeCafeQA?[]:original.call(this,state,dt);};})()`);
await delay(500);
console.log('CAPTURED '+JSON.stringify(await ev('({sim:!!window.cafeQA,state:window.cafeQA?.state.phase})')));
await ev(`(async()=>{window.freezeCafeQA=true;const {sim,state}=window.cafeQA;sim.customerCast.restore({remaining:[1],previous:-1});sim.spawn(state);const c=sim.customers[0];if(c.appearanceId!==1)throw Error('Wrong guest');window.guestQA=c;const layout=await import('/src/game/layout.ts');window.qaLayout=layout;Object.assign(c,{x:190,y:230,tx:210,ty:230,phase:'queue',via:[],journey:[],stride:4});sim.queue=[];})()`);

await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));if(!url)throw Error('Scene module URL missing');const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};})()`);
await delay(300);
console.log('SCENE '+JSON.stringify(await ev('({scene:!!window.qaScene})')));


const data=await ev(`(async()=>{const s=await import('/src/render/sprites.ts'),f=await import('/src/render/fine-sprite-art.ts'),cast=await import('/src/game/customer-cast.ts'),cozy=await import('/src/render/cozy-character-art.ts');const c=document.createElement('canvas');c.width=900;c.height=650;const x=c.getContext('2d');x.fillStyle='#efe2c7';x.fillRect(0,0,c.width,c.height);const rows=[{name:'Owner',look:cozy.COZY_OWNER_LOOK,role:'owner'},...[1,0,2,5].map(id=>({name:'Guest '+id,look:cast.CUSTOMER_CAST[id].look,role:'customer',id}))];for(let i=0;i<rows.length;i++){const r=rows[i],p=s.character(r.look,r.role,r.id);x.fillStyle='#33231b';x.font='15px sans-serif';x.fillText(r.name,8,i*125+20);[p.down[0],p.right[0],p.sitRight,p.sitPetRight[0]].forEach((v,j)=>{const a=f.fineSpriteArt(v);x.imageSmoothingEnabled=false;x.drawImage(a.canvas,100+j*175,i*125+115-v.height*2.5,v.width*2.5,v.height*2.5)})}return c.toDataURL('image/jpeg',.7).split(',')[1]})()`);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/character-proportions-comparison.jpg',Buffer.from(data,'base64'));console.log('COMPARE_FILE artifacts/character-proportions-comparison.jpg');

const measurements=await ev(`(async()=>{
const text=await fetch('/src/render/sprites.ts').then(r=>r.text()),url=text.match(/from "([^"]*reference-character-art[^"]*)"/)[1],ref=await import(url),sprites=await import('/src/render/sprites.ts'),cast=await import('/src/game/customer-cast.ts'),fine=await import('/src/render/fine-sprite-art.ts');
const rows=[];
for(const id of [0,1,2,5,17]){const f=sprites.character(cast.CUSTOMER_CAST[id].look,'customer',id);const stand=ref.referenceCharacterContacts(f.stand);if(!stand?.head)throw Error('Missing head landmark');rows.push({id,standingHeadToFloor:stand.foot.y-stand.head.y,standingFloor:stand.foot.y,sittingFloor:ref.referenceCharacterContacts(f.sitRight).foot.y});}
const batch=[];
for(const d of cast.CUSTOMER_CAST){if(d.id===1)continue;const f=sprites.character(d.look,'customer',d.id),a=ref.referenceCharacterContacts(f.right[0]),b=ref.referenceCharacterContacts(f.sitRight);
if(!a?.headScale||!b?.headScale||Math.abs(a.headScale/b.headScale-1)>.001)throw Error('Walking/seated head scale mismatch '+d.id);
batch.push({id:d.id,headRatio:a.headScale/b.headScale,standingBodyScale:a.bodyScale,seatedBodyScale:b.bodyScale});}
return {rows,batch};
})()`);console.log('LANDMARKS '+JSON.stringify(measurements));
await ev(`(()=>{const {sim}=cafeQA;const c=guestQA,p=qaLayout.seatSpot(0,0);Object.assign(c,p,{tx:p.x,ty:p.y,phase:'sitting',seat:0,hasCup:false});const walker={...c,id:c.id+100,phase:'queue',seat:-1,x:p.x+65,y:p.y,tx:p.x+75,ty:p.y,stride:4};sim.customers=[c,walker];sim.seats.fill(null);sim.seats[0]=c.id;sim.queue=[];})()`);await delay(300);
const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
const scene=await send('Page.captureScreenshot',{format:'jpeg',quality:42,clip:rect});fs.writeFileSync('artifacts/character-proportions-scene.jpg',Buffer.from(scene.data,'base64'));console.log('SCENE_FILE artifacts/character-proportions-scene.jpg');
const phases=[];
for(const phase of ['walk','at-chair','seated']){
await ev(`(()=>{const {sim}=cafeQA;const c=guestQA,p=qaLayout.seatSpot(0,0);sim.customers=[c];sim.seats.fill(null);Object.assign(c,{phase:${JSON.stringify(phase)}==='seated'?'sitting':'queue',seat:0,x:p.x,y:p.y,tx:${JSON.stringify(phase)}==='walk'?p.x+10:p.x,ty:p.y,stride:4});if(${JSON.stringify(phase)}==='seated')sim.seats[0]=c.id;})()`);await delay(140);
const crop={x:rect.x+130,y:rect.y+310,width:250,height:150,scale:1};
const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:55,clip:crop});phases.push(shot.data);
}
const transition=await ev(`(async()=>{const shots=${JSON.stringify(phases)};const c=document.createElement('canvas');c.width=750;c.height=175;const x=c.getContext('2d');x.fillStyle='#efe2c7';x.fillRect(0,0,c.width,c.height);for(let i=0;i<3;i++){const im=new Image();im.src='data:image/jpeg;base64,'+shots[i];await im.decode();x.drawImage(im,i*250,0);x.fillStyle='#33231b';x.font='13px sans-serif';x.fillText(['Walking','At chair','Seated'][i],i*250+8,168)}return c.toDataURL('image/jpeg',.65).split(',')[1]})()`);fs.writeFileSync('artifacts/character-proportions-transition.jpg',Buffer.from(transition,'base64'));console.log('TRANSITION_FILE artifacts/character-proportions-transition.jpg');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);console.log('MOBILE '+JSON.stringify(await ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})')));console.log('ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime errors');

} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
