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
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5173/?qa-light=10'});
for(let i=0;i<120;i++){await delay(500);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}
console.log('BOOT '+JSON.stringify(await ev('({title:document.title,loader:document.querySelector("#loader")?.textContent,onboarding:!!document.querySelector(".onboard"),errors:document.querySelector("vite-error-overlay")?.textContent})')));
await ev('document.querySelector(".onboard [data-next]").click()');await delay(100);
await ev('document.querySelector(".onboard [data-next]").click()');await delay(200);
console.log('PRESET '+JSON.stringify(await ev('({exists:!!document.querySelector("[data-cozy-owner-preset]"),label:document.querySelector("[data-cozy-owner-preset]")?.textContent})')));
await ev('document.querySelector("[data-cozy-owner-preset]").click()');await delay(200);
console.log('PREVIEW '+JSON.stringify(await ev('({loading:document.querySelector(".char-preview canvas")?.dataset.loading,error:document.querySelector(".char-preview canvas")?.dataset.loadError})')));
for(let i=0;i<3;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(200);}
console.log('GAME '+JSON.stringify(await ev('({onboarding:!!document.querySelector(".onboard"),canvas:[...document.querySelectorAll("canvas")].map(c=>({w:c.width,h:c.height,visible:c.getBoundingClientRect().width>0})),body:document.body.innerText.slice(-800)})')));
console.log('OWNER_CHECK '+JSON.stringify(await ev(`(async()=>{const c=await import('/src/render/cozy-character-art.ts');const s=await import('/src/render/sprites.ts');const source=await fetch('/src/render/sprites.ts').then(r=>r.text());const referenceUrl=source.match(/from "([^"]*reference-character-art[^"]*)"/)[1];const r=await import(referenceUrl);const f=await import('/src/render/fine-sprite-art.ts');await r.preloadReferenceCharacters();const look={...c.COZY_OWNER_LOOK};const frames=s.character(look,'owner');const all=[...frames.down,...frames.up,...frames.right,...frames.left,frames.sitRight,frames.sitLeft,...frames.sitPetRight,...frames.sitPetLeft];const checks=all.map(frame=>{const art=f.fineSpriteArt(frame).canvas;const px=art.getContext('2d').getImageData(0,0,art.width,art.height).data;let nonempty=0,edge=0;for(let i=3;i<px.length;i+=4){if(!px[i])continue;nonempty++;const n=(i-3)/4,x=n%art.width,y=Math.floor(n/art.width);if(x===0||y===0||x===art.width-1||y===art.height-1)edge++;}return {nonempty,edge,scale:f.fineSpriteArt(frame).scale};});if(checks.length!==18||checks.some(p=>p.nonempty===0||p.edge!==0))throw Error('Pose pixels failed'); if(all.some(frame=>!r.referenceCharacterContacts(frame)))throw Error('Missing contacts'); return {cached:s.character(look,'owner')===frames,otherRoles:['barista','server','cook','customer'].every(role=>!c.isCozyOwner(look,role)),customFields:Object.keys(look).every(key=>!c.isCozyOwner({...look,[key]:look[key]+1},'owner')),checks};})()`)));

await ev('document.querySelector("#settings-btn").click()');await delay(100);
const beforeIcon=await ev('document.querySelector(".profile-row img").src');
await ev('document.querySelector("[data-edit-profile]").click();document.querySelector(".onboard [data-next]").click()');await delay(100);
await ev('document.querySelector("[data-key=skin] button:nth-child(2)").click();document.querySelector(".onboard [data-back]").click();document.querySelector(".onboard [data-back]").click()');await delay(100);
const canceledIcon=await ev('document.querySelector(".profile-row img").src');
if(beforeIcon!==canceledIcon)throw Error('Cancel changed profile');
console.log('CANCEL_PRESERVES_PROFILE true');
await ev('document.querySelector("[data-edit-profile]").click();document.querySelector(".onboard [data-next]").click()');await delay(100);
await ev('document.querySelector("[data-cozy-owner-preset]").click()');await delay(100);
const presetIcon=await ev('document.querySelector(".char-preview canvas").toDataURL()');
await ev('document.querySelector("[data-key=skin] button:nth-child(2)").click()');await delay(100);
const changedIcon=await ev('document.querySelector(".char-preview canvas").toDataURL()');
if(presetIcon===changedIcon)throw Error('Skin customization has no visual effect');
await ev('document.querySelector("[data-cozy-owner-preset]").click()');await delay(100);
if(presetIcon!==await ev('document.querySelector(".char-preview canvas").toDataURL()'))throw Error('Preset is not repeatable');
await ev('document.querySelector(".onboard [data-next]").click()');await delay(100);
if(beforeIcon!==await ev('document.querySelector(".profile-row img").src'))throw Error('Saved owner icon mismatch');
console.log('CUSTOMIZATION_AND_REPEAT_PRESET true');
await send('Page.reload');
for(let i=0;i<120;i++){await delay(300);if(await ev('!document.querySelector("#loader") && !!document.querySelector("#settings-btn")'))break;}
await ev('document.querySelector("#settings-btn").click()');await delay(100);
if(beforeIcon!==await ev('document.querySelector(".profile-row img").src'))throw Error('Reload changed preset');
console.log('SAVE_RELOAD true');

await delay(800);

await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);
console.log('MOBILE '+JSON.stringify(await ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})')));
console.log('RUNTIME_ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime exceptions');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
