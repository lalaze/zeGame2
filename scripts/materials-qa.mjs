import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'materials-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const results=[];const shots=[];
function check(ok,label,detail={}) { results.push({label,pass:!!ok,...detail}); console.log((ok?'PASS ':'FAIL ')+label+' '+JSON.stringify(detail)); }
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:75});const file='artifacts/materials-'+name+'.jpg';fs.writeFileSync(file,Buffer.from(shot.data,'base64'));shots.push(file);}
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(240);}
async function click(selector){const p=await ev('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.hidden)throw Error("Missing "+'+JSON.stringify(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()');await clickAt(p.x,p.y);}
async function key(key,modifiers=0){const code=key==='Escape'?27:9;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code,modifiers});await delay(160);}
async function geometry(){return ev(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {width:innerWidth,height:innerHeight,stage:box('#stage'),canvas:box('#scene'),room:box('#scene-area'),panel:box('#management-panel'),overflow:document.documentElement.scrollWidth>innerWidth,scrollY,ready:document.body.classList.contains('ready'),open:!document.querySelector('#management-panel').hidden,paused:qaScene.view.paused,speed:qaScene.getState().speed,focus:document.activeElement?.id,modal:!!document.querySelector('#modal-root .modal'),inert:document.querySelector('#stage').inert}})()`);}
(async()=>{try{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('tiny-bean-cafe/locale','zh')}catch{}"});
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://100.96.195.115:5173/'});
for(let i=0;i<120;i++){await delay(250);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}
for(let i=0;i<5;i++){await ev('document.querySelector(".onboard [data-next]")?.click()');await delay(300);}
await delay(1500);fs.mkdirSync('artifacts',{recursive:true});
await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};})()`);
await ev('document.querySelector("[data-guide-action=skip]")?.click()');await delay(900);check(await ev('!!window.qaScene'),'scene captured');
await click('[data-management-tab="pantry"]');
await click('[data-tab="pantry"]');
console.log('PANEL_INITIAL '+await ev('document.querySelector("#management-panel").innerText'));
const stateBefore=await ev('JSON.stringify(qaScene.getState())');
check(await ev('document.querySelector("[data-buy=\\"ing:beans\\"]").disabled'),'zero balance purchase disabled');
check(await ev('document.querySelector(".goal .bar i").style.width==="0%"'),'first goal empty progress');
check(await ev('document.querySelector("[data-restock]").classList.contains("is-complete")'),'full stock renders status strip');
check(await ev('document.querySelector("[data-price-details=\\"ing:beans\\"]").textContent.includes("10")'),'purchase shortfall explained');
await screenshot('desktop-pantry');
await click('.drawer-balance');
check(await ev('!!document.querySelector("#modal-root .modal")'),'balance still opens details');
await key('Escape');
check(await ev('!document.querySelector("#modal-root .modal")&&!document.querySelector("#management-panel").hidden'),'details Escape retains panel');
check(await ev('JSON.stringify(qaScene.getState())')===stateBefore,'viewing controls preserves game state');
const style=async sel=>ev('(()=>{const e=document.querySelector('+JSON.stringify(sel)+');const s=getComputedStyle(e),r=e.getBoundingClientRect();return {bg:s.backgroundColor,shadow:s.boxShadow,translate:s.translate,color:s.color,outline:s.outlineStyle,w:r.width,h:r.height}})()');
const close='#drawer-close';await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});
const normal=await style(close);const pos=await ev('(()=>{const r=document.querySelector("#drawer-close").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});const hover=await style(close);
check(normal.bg!==hover.bg,'hover changes surface',{normal,hover});
await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});const pressed=await style(close);
check(pressed.translate==='0px 1px','pressed sinks one pixel',{pressed});await screenshot('desktop-pressed');
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:20,button:'left',clickCount:1});
if(await ev('document.querySelector("#management-panel").hidden'))await click('[data-management-tab="pantry"]');
await ev('document.querySelector("[data-tab=pantry]").focus()');await key('Tab');
const focus=await ev('(()=>{const e=document.activeElement,s=getComputedStyle(e);return{match:e.matches(":focus-visible"),outline:s.outlineStyle}})()');
check(focus.match&&focus.outline==='solid','keyboard focus visibly outlined',focus);
await screenshot('desktop-focus');
for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['mobile',390,844,true],['narrow',320,740,true],['landscape',844,390,true]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(400);
 if(await ev('!document.querySelector("#management-panel").hidden'))await click('#drawer-close');
 const closed=await ev('(()=>{const r=document.querySelector("#scene").getBoundingClientRect();return {w:r.width,h:r.height}})()');
 await click('#panel-toggle');
 await click('[data-tab="pantry"]');
 const layout=await ev(`(()=>{const p=document.querySelector('#management-panel'),r=p.getBoundingClientRect(),c=document.querySelector('#scene').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,panel:{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom},canvas:{w:c.width,h:c.height},small:[...p.querySelectorAll('button')].filter(e=>!e.closest('[hidden]')&&e.getClientRects().length).map(e=>({name:e.textContent,r:e.getBoundingClientRect()})).filter(x=>x.r.width<44||x.r.height<44).map(x=>({name:x.name,w:x.r.width,h:x.r.height}))}})()`);
 check(!layout.overflow&&layout.panel.x>=0&&layout.panel.right<=width+1&&layout.panel.bottom<=height+1,name+' panel fits viewport',layout);
 check(JSON.stringify(layout.canvas)===JSON.stringify(closed),name+' drawer preserves canvas scale');
 check(!layout.small.length,name+' controls have 44px targets',{small:layout.small});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
 const selected=await style('[data-tab="pantry"]');check(selected.bg==='rgb(89, 105, 75)',name+' sage selected tab',selected);
 await screenshot(name+'-pantry');
 await key('Escape');check(await ev('document.querySelector("#management-panel").hidden'),name+' Escape closes drawer');
 await click('#panel-toggle');
 await click('[data-tab="menu"]');await screenshot(name+'-menu');
 await click('#drawer-close');
}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await delay(400);
await click('[data-management-tab="pantry"]');
await ev('qaScene.getState().pantry.beans=0');await delay(500);
check(await ev('!document.querySelector(".restock-reason").hidden&&!!document.querySelector(".restock-reason").textContent'),'empty wallet restock gives visible reason');
await ev('qaScene.getState().coins=100');await delay(500);
check(await ev('!document.querySelector("[data-buy=\\"ing:beans\\"]").disabled'),'purchase enables with funds');
const buyBefore=await ev('({coins:qaScene.getState().coins,beans:qaScene.getState().pantry.beans})');
await click('[data-buy="ing:beans"]');await delay(300);
const buyAfter=await ev('({coins:qaScene.getState().coins,beans:qaScene.getState().pantry.beans})');
check(buyAfter.coins===buyBefore.coins-10&&buyAfter.beans===buyBefore.beans+10,'real purchase still charges and stocks exactly',{buyBefore,buyAfter});
await screenshot('desktop-funded');
check(errors.length===0,'no runtime exceptions',{errors});
const report={results,shots,errors,failed:results.filter(r=>!r.pass)};
fs.writeFileSync('artifacts/materials-qa-results.json',JSON.stringify(report,null,2));
console.log('MATERIALS_QA_SUMMARY '+JSON.stringify({checks:results.length,failed:report.failed,shots}));
if(report.failed.length)process.exitCode=1;
}catch(e){await screenshot('error').catch(()=>{});console.log('QA_ERROR '+e.stack);console.log('BODY '+await ev('document.body.innerText.slice(-5000)').catch(()=>''));process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});console.log('PROFILE_CLEANED '+profile);}})();
