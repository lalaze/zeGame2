import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'table-marker-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://100.96.195.115:5173/?qa-light=10'});
for(let i=0;i<120;i++){await delay(300);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}

for(let i=0;i<5;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(250);}
await delay(1800);fs.mkdirSync('artifacts',{recursive:true});
await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};})()`);
await delay(300);
const status=()=>ev(`(()=>{const sc=window.qaScene;return {preview:sc.view.tablePreview,pressed:document.querySelector('[data-table-preview]')?.getAttribute('aria-pressed'),tables:sc.getState().upgrades.tables,coins:sc.getState().coins,phase:sc.getState().phase,ghosts:sc.children.list.filter(o=>o.active&&o.visible&&o.alpha===.38).length};})()`);
async function click(selector){await ev('document.querySelector('+JSON.stringify(selector)+').click()');await delay(350);}
async function expectPreview(expected,label){const s=await status();if(s.preview!==expected || (expected?s.ghosts===0:s.ghosts!==0))throw Error(label+' '+JSON.stringify(s));console.log(label+' '+JSON.stringify(s));}
async function screenshot(name){const rect=await ev('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');const detail=await send('Page.captureScreenshot',{format:'jpeg',quality:82,clip:{x:rect.x,y:rect.y+rect.height*.4,width:rect.width*.49,height:rect.height*.52,scale:1}});fs.writeFileSync('artifacts/'+name+'.jpg',Buffer.from(detail.data,'base64'));}
await expectPreview(false,'DEFAULT_EMPTY');
await screenshot('table-preview-empty');
await click('[data-tab="upgrades"]');
await expectPreview(false,'UPGRADES_NOT_SELECTED');
await click('[data-table-preview]');
await expectPreview(true,'PREVIEW_ON');
await screenshot('table-preview-ghost');
await click('[data-table-preview]');
await expectPreview(false,'TOGGLE_OFF');
await click('[data-table-preview]');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
await delay(350);await expectPreview(false,'ESCAPE');
await click('[data-table-preview]');await click('[data-tab="menu"]');
await expectPreview(false,'TAB_EXIT');
await click('[data-tab="upgrades"]');await expectPreview(false,'TAB_REENTER');
await click('[data-table-preview]');await click('#panel-toggle');
await expectPreview(false,'COLLAPSE');
await click('#panel-toggle');await expectPreview(false,'REOPEN');
await click('[data-table-preview]');await click('[data-price-details="upgrade:tables"]');
await expectPreview(false,'MODAL');
await ev(`(async()=>{const {closeModal}=await import('/src/ui/modal.ts');closeModal();})()`);await delay(350);
await expectPreview(false,'MODAL_CLOSE');
await ev('window.qaScene.getState().coins=10000');await delay(400);
await click('[data-table-preview]');
const before=await ev(`(async()=>{const s=window.qaScene.getState();const {quoteUpgrade}=await import('/src/game/economy.ts');return {coins:s.coins,tables:s.upgrades.tables,cost:quoteUpgrade(s,'tables',1).cost};})()`);
await click('[data-buy="upgrade:tables"]');
await expectPreview(false,'PURCHASE_CLEARS');
const after=await status();if(after.tables!==before.tables+1||after.coins!==before.coins-before.cost)throw Error('Purchase mechanics changed '+JSON.stringify({before,after}));
await screenshot('table-preview-purchased');
await click('[data-table-preview]');await expectPreview(true,'NEXT_POSITION');
await click('[data-table-preview]');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(500);
await click('[data-table-preview]');await expectPreview(true,'MOBILE_PREVIEW');
await click('[data-table-preview]');await expectPreview(false,'MOBILE_DISMISS');
console.log('TABLE_PREVIEW_QA '+JSON.stringify({before,after,errors}));
if(errors.length)throw Error('Runtime errors');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});if(fs.existsSync(profile))throw Error('Temporary profile still exists');console.log('PROFILE_CLEANED '+profile);}})();
