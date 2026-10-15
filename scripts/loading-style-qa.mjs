import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fullscreen-overlay-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;let holdMain=true,holdImages=true,failImage=false,allowed=0;const held=[];const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Fetch.requestPaused'){const p=msg.params;if(p.request.url.includes('/src/main.ts')&&holdMain)held.push(p.requestId);else if(p.request.url.includes('/art/generated/')&&!p.request.url.includes('/cafe-attendant-v1/')&&failImage){failImage=false;void send('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'});}else if(p.request.url.includes('/art/generated/')&&holdImages&&allowed++>=180)held.push(p.requestId);else void send('Fetch.continueRequest',{requestId:p.requestId});}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const results=[];const shots=[];
function check(ok,label,detail={}) { results.push({label,pass:!!ok,...detail}); console.log((ok?'PASS ':'FAIL ')+label+' '+JSON.stringify(detail)); }
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:75});const file='artifacts/loading-'+name+'.jpg';fs.writeFileSync(file,Buffer.from(shot.data,'base64'));shots.push(file);}
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(240);}
async function click(selector){const p=await ev('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.hidden)throw Error("Missing "+'+JSON.stringify(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()');await clickAt(p.x,p.y);}
async function key(key,modifiers=0){const code=key==='Escape'?27:9;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code,modifiers});await delay(160);}
async function geometry(){return ev(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {width:innerWidth,height:innerHeight,stage:box('#stage'),canvas:box('#scene'),panel:box('#management-panel'),overflow:document.documentElement.scrollWidth>innerWidth,scrollY,ready:document.body.classList.contains('ready'),open:!document.querySelector('#management-panel').hidden,paused:qaScene.view.paused,speed:qaScene.getState().speed,focus:document.activeElement?.id,modal:!!document.querySelector('#modal-root .modal'),inert:document.querySelector('#stage').inert}})()`);}
(async()=>{try{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Fetch.enable',{patterns:[{urlPattern:'*/src/main.ts*',requestStage:'Request'},{urlPattern:'*/art/generated/*',requestStage:'Request'}]});
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://100.96.195.115:5173/'});
for(let i=0;i<100;i++){await delay(100);if(held.length&&await ev('!!document.querySelector("#loader progress")'))break;}
fs.mkdirSync('artifacts',{recursive:true});
check(await ev('!document.querySelector("#loader progress").hasAttribute("value")&&!document.body.classList.contains("ready")'),'inline loader is indeterminate before bundle');
check(await ev('getComputedStyle(document.querySelector(".loader-content")).backgroundColor==="rgba(0, 0, 0, 0)" && getComputedStyle(document.querySelector(".loader-content")).boxShadow==="none"'),'standalone loader has no card background or shadow');
holdMain=false;for(const requestId of held.splice(0))await send('Fetch.continueRequest',{requestId});
for(let i=0;i<300;i++){await delay(100);if(held.length&&await ev('document.querySelector("#loader progress")?.value>0'))break;}
const progress=await ev('(()=>{const p=document.querySelector("#loader progress");return {value:p.value,max:p.max,text:document.querySelector("[data-loading-count]").textContent,ready:document.body.classList.contains("ready")}})()');
check(progress.value>0&&progress.value<progress.max&&!progress.ready,'measured partial progress while actual image requests held',progress);
const gait=[];
for(let i=0;i<5;i++){await delay(180);gait.push(await ev('(()=>{const w=document.querySelector(".loader-walker");return {x:w.getBoundingClientRect().x,poses:Array.from(document.querySelectorAll(".loader-pose")).map(e=>getComputedStyle(e).opacity),value:document.querySelector("progress").value}})()'));if(i<3)await screenshot('gait-'+i);}
check(new Set(gait.map(p=>p.x)).size>1&&new Set(gait.map(p=>JSON.stringify(p.poses))).size>1&&new Set(gait.map(p=>p.value)).size===1,'staff moves and changes gait while real progress stays fixed',{gait});
const flip=await ev('(()=>{const a=document.querySelector(".loader-figure").getAnimations()[0];a.pause();a.currentTime=4100;return getComputedStyle(a.effect.target).transform})()');
check(flip.startsWith('matrix(-1'),'staff faces left on return journey',{flip});
await ev('document.querySelector(".loader-figure").getAnimations()[0].play()');
for(const [name,width,height,mobile] of [['desktop',1200,800,false],['mobile',390,844,true],['small',320,568,true],['landscape',844,390,true]]){
await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(200);
const rect=await ev('(()=>{const r=document.querySelector(".loader-content").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,overflow:document.documentElement.scrollWidth>innerWidth}})()');
check(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=width&&rect.y+rect.h<=height&&!rect.overflow,name+' loading content fits viewport',rect);
if(name==='desktop'||name==='mobile')await screenshot(name);
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
check(await ev('Array.from(document.querySelectorAll(".loader-walker,.loader-figure,.loader-pose")).every(e=>getComputedStyle(e).animationName==="none")&&getComputedStyle(document.querySelector(".loader-pose")).opacity==="1"&&getComputedStyle(document.querySelector("#loader")).transitionDuration==="0s"'),'reduced motion keeps one stationary staff pose and removes fade');
holdImages=false;for(const requestId of held.splice(0))await send('Fetch.continueRequest',{requestId});await send('Fetch.disable');
for(let i=0;i<300;i++){await delay(100);if(await ev('document.body.classList.contains("ready")'))break;}
check(await ev('document.body.classList.contains("ready")'),'real assets and scene finish before ready');
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
failImage=true;await send('Fetch.enable',{patterns:[{urlPattern:'*/art/generated/*',requestStage:'Request'}]});await send('Page.reload',{ignoreCache:true});
for(let i=0;i<300;i++){await delay(100);if(await ev('!!document.querySelector("#loader [role=alert]")'))break;}
check(await ev('(()=>{const r=document.querySelector("#loader"),b=r.querySelector("[data-loading-retry]");return !b.hidden&&document.activeElement===b&&r.querySelector("progress").hidden&&!!r.querySelector(".loader-content .loader-detail")&&!document.body.classList.contains("ready")})()'),'real image failure shows accessible retry and detail in loading content');
check(await ev('Array.from(document.querySelectorAll(".loader-walker,.loader-figure,.loader-pose")).every(e=>getComputedStyle(e).animationPlayState==="paused")'),'failure pauses decorative walk');
await screenshot('failure-mobile');
await send('Fetch.disable');await click('[data-loading-retry]');
for(let i=0;i<300;i++){await delay(100);if(await ev('document.body.classList.contains("ready")'))break;}
check(await ev('document.body.classList.contains("ready")'),'retry reload reaches real ready state');
const report={results,shots,failed:results.filter(r=>!r.pass)};fs.writeFileSync('artifacts/loading-qa-results.json',JSON.stringify(report,null,2));console.log('LOADING_QA_SUMMARY '+JSON.stringify(report));if(report.failed.length)process.exitCode=1;
}catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});console.log('PROFILE_CLEANED');}})();