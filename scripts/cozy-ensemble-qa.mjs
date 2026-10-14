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
const mode=process.argv[2]||'both';
const castId=process.argv[3]===undefined?null:Number(process.argv[3]);const side=process.argv[4]==='1'?1:0;if(castId!==null&&(!Number.isInteger(castId)||castId<0||castId>29))throw Error('Invalid cast ID');
const setup=`(async()=>{
 const s=qaScene,{sim,state}=cafeQA;sim.seats.fill(null);
 const sprites=await import('/src/render/sprites.ts');const cozy=await import('/src/render/cozy-character-art.ts');
 const c=guestQA,second={...c,id:c.id+100};sim.customers.splice(0,sim.customers.length,c,second);sim.queue=[];
 window.originalFrames=s.customerFrames.bind(s);
 s.customerFrames=function(customer){return customer.qaOwner?sprites.character({...cozy.COZY_OWNER_LOOK},'owner'):originalFrames(customer)};
 for(const [i,g] of sim.customers.entries()){const p=qaLayout.seatSpot(0,i);Object.assign(g,p,{tx:p.x,ty:p.y,phase:'sitting',seat:i,dineIn:true,hasCup:true,qaOwner:i===0});sim.seats[i]=g.id;}
 if(${JSON.stringify(mode)}==='empty'){sim.customers=[];sim.seats.fill(null);}
 if(${JSON.stringify(mode)}==='guest-left'){c.qaOwner=false;sim.customers=[c];sim.seats[1]=null;}
 if(${JSON.stringify(mode)}==='owner-right'){second.qaOwner=true;sim.customers=[second];sim.seats[0]=null;}
 if(${JSON.stringify(mode)}==='other'){c.qaOwner=false;c.appearanceId=2;second.qaOwner=false;second.appearanceId=6;}
 if(${JSON.stringify(mode)}==='waiting'){c.phase='waiting';second.phase='waiting';c.hasCup=false;second.hasCup=false;}
 if(${JSON.stringify(castId)}!==null){const cast=await import('/src/game/customer-cast.ts');c.qaOwner=false;c.appearanceId=${JSON.stringify(castId)};c.look={...cast.CUSTOMER_CAST[c.appearanceId].look};}
 if(${JSON.stringify(mode)}==='walk'){const p=qaLayout.seatSpot(0,0);Object.assign(c,p,{tx:p.x+12,ty:p.y,phase:'queue',hasCup:false});sim.customers=[c];sim.seats.fill(null);}
 if(${JSON.stringify(mode)}.startsWith('pet')){
   if(${JSON.stringify(side)}===1){const p=qaLayout.seatSpot(0,1);Object.assign(c,p,{tx:p.x,ty:p.y,seat:1});sim.customers=[c];sim.seats.fill(null);sim.seats[1]=c.id;}
   const living=await import('/src/game/living-cats.ts');living.LivingCats.prototype.update=function(){};
   state.pets=[{id:'ginger',careSeconds:180,autoRefill:false}];
   const p=qaLayout.seatApproach(0,c.seat%2);const cat={...p,id:'ginger',area:'main',personality:'affectionate',behavior:'watch',remaining:50,elapsed:1,facing:1,stride:0,affection:1,route:[],targetKind:'people',resting:false,interaction:{guestId:c.id,phase:'response',elapsed:${JSON.stringify(mode)}==='pet-b'?.8:.1}};
   s.view.livingCats.actors.set('ginger',cat);
   if(${JSON.stringify(mode)}==='pet-guest')c.qaOwner=false;
   if(${JSON.stringify(mode)}==='pet-paused')s.view.paused=true;
   window.qaCat=cat;
 }
})()`;
await ev(setup);await delay(350);
console.log('CHECK '+JSON.stringify(await ev(`(()=>{const s=qaScene;return {mode:${JSON.stringify(mode)},seats:cafeQA.sim.seats.slice(0,2),poses:cafeQA.sim.customers.map(c=>{const p=s.seatedCustomerPose(0,c.seat%2,c,0);return {owner:c.qaOwner,id:c.appearanceId,x:p.x,y:p.y,w:p.sprite.width,h:p.sprite.height,pair:!!p.pair}})}})()`)));
const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+145,y:r.y+325,width:230,height:130,scale:1}})()');
const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:48,clip:rect});
fs.writeFileSync(path.join(os.tmpdir(),'cozy-ensemble-'+mode+'.jpg'),Buffer.from(shot.data,'base64'));
console.log('IMAGE '+shot.data);
console.log('RUNTIME_ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime exceptions');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
