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

const report=await ev(`(async()=>{
 const spriteSource=await fetch('/src/render/sprites.ts').then(r=>r.text());
 const url=spriteSource.match(/from "([^"]*reference-character-art[^"]*)"/)[1];
 const ref=await import(url),sprites=await import('/src/render/sprites.ts'),fine=await import('/src/render/fine-sprite-art.ts'),cast=await import('/src/game/customer-cast.ts');
 ref.clearReferenceCharacters();const loading=ref.preloadReferenceCharacters();if(ref.resolveReferenceCharacter({...cast.CUSTOMER_CAST[1].look},'customer',1)!==null)throw Error('Premature reference publication');await loading;
 const hash=frame=>{const art=fine.fineSpriteArt(frame).canvas,px=art.getContext('2d').getImageData(0,0,art.width,art.height).data;let h=2166136261,n=0,edge=0;for(let i=0;i<px.length;i++){h=Math.imul(h^px[i],16777619);if(i%4===3&&px[i]){n++;const v=(i-3)/4,x=v%art.width,y=Math.floor(v/art.width);if(!x||!y||x===art.width-1||y===art.height-1)edge++;}}return {hash:h>>>0,n,edge};};
 const variants=f=>[...f.down,...f.up,...f.right,...f.left,f.sitRight,f.sitLeft,...f.sitPetRight,...f.sitPetLeft];
 const people=cast.CUSTOMER_CAST.map(d=>{
  const f=sprites.character({...d.look},'customer',d.id),checks=variants(f).map(frame=>({...hash(frame),contact:ref.referenceCharacterContacts(frame)}));
  if(checks.some(c=>!c.n||c.edge||!c.contact||!Number.isFinite(c.contact.foot.x+c.contact.foot.y)))throw Error('Frame pixels/contact failed '+d.id+' '+JSON.stringify(checks));
  if([f.sitRight,f.sitLeft,...f.sitPetRight,...f.sitPetLeft].some(frame=>!ref.referenceCharacterContacts(frame)?.seatContact))throw Error('Missing seated contact '+d.id);
  if([...f.sitPetRight,...f.sitPetLeft].some(frame=>!ref.referenceCharacterContacts(frame)?.petContact))throw Error('Missing pet contact '+d.id);
  if(sprites.character({...d.look},'customer',d.id)!==f)throw Error('Cache mismatch '+d.id);
  return {id:d.id,name:d.name,outfit:d.outfit,hairstyle:d.hairstyle,frames:checks.length,hashes:checks.map(c=>c.hash)};
 });
 if(people.length!==30||new Set(people.map(p=>p.hashes[0])).size!==30)throw Error('Cast identities collapsed');
 const roles=[];
 for(const role of ['owner','barista','server','cook'])for(let hairStyle=0;hairStyle<4;hairStyle++){
  const look={skin:hairStyle,hair:hairStyle,hairStyle,shirt:hairStyle,pants:hairStyle%3},f=sprites.character(look,role);
  const checks=variants(f).map(hash);if(checks.some(c=>!c.n||c.edge))throw Error('Role pixels failed '+role+'/'+hairStyle+JSON.stringify(checks));
  roles.push({role,hairStyle,frames:checks.length});
 }
 const base={...cast.CUSTOMER_CAST[0].look},normal=sprites.character(base,'customer',0);
 const palettes={};for(const key of ['skin','hair','shirt','pants']){
  const changed=sprites.character({...base,[key]:base[key]+1},'customer',0);palettes[key]=hash(normal.down[0]).hash!==hash(changed.down[0]).hash;if(!palettes[key])throw Error('Palette ignored '+key);
 }
 // Chairs must not change when only skin changes.
 const light=fine.fineSpriteArt(normal.sitRight).canvas,dark=fine.fineSpriteArt(sprites.character({...base,skin:3},'customer',0).sitRight).canvas;
 const a=light.getContext('2d').getImageData(0,0,light.width,light.height).data,b=dark.getContext('2d').getImageData(0,0,dark.width,dark.height).data;
 let chairChanges=0;for(let y=30*3;y<41*3;y++)for(let x=2*3;x<10*3;x++){const n=(y*light.width+x)*4;if(a[n+3]&&a.slice(n,n+4).some((v,j)=>v!==b[n+j]))chairChanges++;}
 if(chairChanges)throw Error('Skin palette recoloured chair '+chairChanges);
 window.castQA={people,roles,palettes,chairChanges,cast};
 return {people,roles,palettes,chairChanges};
})()`);
console.log('BATCH '+JSON.stringify(report));
fs.mkdirSync('artifacts',{recursive:true});
await ev(`(()=>{const {sim}=cafeQA;sim.customers=[guestQA];sim.seats.fill(null);const p=qaLayout.seatSpot(0,0);Object.assign(guestQA,p,{tx:p.x,ty:p.y,phase:'sitting',seat:0,dineIn:true,hasCup:true});sim.seats[0]=guestQA.id;})()`);
const images=[];
for(let id=0;id<30;id++){
 await ev(`Object.assign(guestQA,{appearanceId:${id},look:{...castQA.cast.CUSTOMER_CAST[${id}].look}})`);await delay(70);
 const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x+145,y:r.y+325,width:230,height:130,scale:1}})()');
 const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:60,clip:rect});images.push(shot.data);fs.writeFileSync('artifacts/cozy-cast-seat-'+id+'.jpg',Buffer.from(shot.data,'base64'));
}
const sheet=await ev(`(async()=>{const data=${JSON.stringify(images)};const c=document.createElement('canvas');c.width=1380;c.height=750;const x=c.getContext('2d');x.fillStyle='#f4e8d0';x.fillRect(0,0,c.width,c.height);for(let i=0;i<data.length;i++){const im=new Image();im.src='data:image/jpeg;base64,'+data[i];await im.decode();const a=i%6*230,b=Math.floor(i/6)*150;x.drawImage(im,a,b,230,130);x.fillStyle='#38291c';x.font='12px sans-serif';x.fillText(i+' '+castQA.people[i].name,a+8,b+145);}return c.toDataURL('image/jpeg',.8).split(',')[1]})()`);
fs.writeFileSync('artifacts/cozy-cast-v4-seating-proof.jpg',Buffer.from(sheet,'base64'));

const interactions=await ev(`(async()=>{
 const living=await import('/src/game/living-cats.ts');living.LivingCats.prototype.update=function(){};
 const {sim,state}=cafeQA,s=qaScene;state.pets=[{id:'ginger',careSeconds:180,autoRefill:false}];
 const result=[];
 for(const id of [0,1,2,3,4,5,6,7,8,9,17])for(const side of [0,1]){
  const pos=qaLayout.seatSpot(0,side),approach=qaLayout.seatApproach(0,side);
  Object.assign(guestQA,pos,{appearanceId:id,look:{...castQA.cast.CUSTOMER_CAST[id].look},seat:side,phase:'sitting'});sim.seats.fill(null);sim.seats[side]=guestQA.id;
  const cat={...approach,id:'ginger',area:'main',personality:'affectionate',behavior:'watch',remaining:50,elapsed:0,facing:side===0?1:-1,stride:0,affection:1,route:[],targetKind:'people',resting:false,interaction:{guestId:guestQA.id,phase:'approach',elapsed:0}};
  s.view.livingCats.actors.set('ginger',cat);
  const points=[];
  for(const phase of ['approach','nuzzle','response','leave']){cat.interaction.phase=phase;cat.interaction.elapsed=phase==='leave'?.5:.1;points.push(s.residentPaintPoint(cat,state));}
  if(points.some(p=>!Number.isFinite(p.x+p.y)))throw Error('Invalid pet point '+id+'/'+side);
  cat.interaction.phase='response';cat.interaction.elapsed=.1;const a=s.seatedCustomerPose(0,side,guestQA,0);cat.interaction.elapsed=.8;const b=s.seatedCustomerPose(0,side,guestQA,0);
  if(!a.pair||!b.pair||a.sprite===b.sprite)throw Error('Pet A/B missing '+id+'/'+side);
  s.view.paused=true;const paused=s.seatedCustomerPose(0,side,guestQA,0);s.view.paused=false;if(paused.sprite!==a.sprite)throw Error('Paused gesture moves');
  s.residentPaintPoint(cat,state);cat.interaction=undefined;cat.elapsed=0;const cancelled=s.residentPaintPoint(cat,state);cat.elapsed=.5;const finished=s.residentPaintPoint(cat,state);
  if(!Number.isFinite(cancelled.x+finished.y))throw Error('Invalid cancellation retreat');
  result.push({id,side,phases:4,pause:true,cancellation:true});
 }
 s.view.livingCats.actors.clear();return result;
})()`);
console.log('INTERACTIONS '+JSON.stringify(interactions));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(100);
const reduced=await ev("(()=>{const s=qaScene,c=guestQA,pair={interaction:{phase:'response',elapsed:.1}};const a=s.seatedCustomerPose(0,c.seat%2,c,0,pair).sprite;pair.interaction.elapsed=.8;return {matches:s.motionPreference.matches,stable:a===s.seatedCustomerPose(0,c.seat%2,c,0,pair).sprite};})()");
if(!reduced.matches||!reduced.stable)throw Error('Reduced-motion gesture changed');console.log('REDUCED '+JSON.stringify(reduced));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});


await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
const mobile=await ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})');console.log('MOBILE '+JSON.stringify(mobile));if(mobile.scroll>mobile.width)throw Error('Mobile overflow');
console.log('PROOF artifacts/cozy-cast-v4-seating-proof.jpg');
console.log('RUNTIME_ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime exceptions');fs.writeFileSync('artifacts/cozy-cast-v4-qa.json',JSON.stringify({passed:true,report,mobile,interactions,reduced,errors},null,2));
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
