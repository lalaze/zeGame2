import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const {pathToFileURL}=require('url');const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fullscreen-overlay-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;let holdMain=true,holdImages=true,failImage=false,allowed=0;const held=[];const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Fetch.requestPaused'){const p=msg.params;if(p.request.url.includes('/src/main.ts')&&holdMain)held.push(p.requestId);else if(p.request.url.includes('/art/generated/')&&failImage){failImage=false;void send('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'});}else if(p.request.url.includes('/art/generated/')&&holdImages&&allowed++>=180)held.push(p.requestId);else void send('Fetch.continueRequest',{requestId:p.requestId});}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const results=[];const shots=[];
function check(ok,label,detail={}) { results.push({label,pass:!!ok,...detail}); console.log((ok?'PASS ':'FAIL ')+label+' '+JSON.stringify(detail)); }
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:75});const file='artifacts/loading-local-'+name+'.jpg';fs.writeFileSync(file,Buffer.from(shot.data,'base64'));shots.push(file);}
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(240);}
async function click(selector){const p=await ev('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.hidden)throw Error("Missing "+'+JSON.stringify(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()');await clickAt(p.x,p.y);}
async function key(key,modifiers=0){const code=key==='Escape'?27:9;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code,modifiers});await delay(160);}
async function geometry(){return ev(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {width:innerWidth,height:innerHeight,stage:box('#stage'),canvas:box('#scene'),panel:box('#management-panel'),overflow:document.documentElement.scrollWidth>innerWidth,scrollY,ready:document.body.classList.contains('ready'),open:!document.querySelector('#management-panel').hidden,paused:qaScene.view.paused,speed:qaScene.getState().speed,focus:document.activeElement?.id,modal:!!document.querySelector('#modal-root .modal'),inert:document.querySelector('#stage').inert}})()`);}
(async()=>{try{
fs.mkdirSync('artifacts',{recursive:true});
const source=fs.readFileSync('index.html','utf8');
const boot='<script id="loader-bootstrap">'+source.split('<script id="loader-bootstrap">')[1].split('</script>')[0]+'</script>';
const html=source.split('<div id="app">')[0]+boot+'</body></html>';
const file='artifacts/loading-local-preview.html';
fs.writeFileSync(file,html.replaceAll('./loading-carry-staff-v2.png',pathToFileURL(path.resolve('public/loading-carry-staff-v2.png')).href));
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:pathToFileURL(path.resolve(file)).href});await delay(600);
check(await ev('new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth===1254&&i.naturalHeight===1254);i.onerror=()=>resolve(false);i.src=document.querySelector(".loader-pose image").href.baseVal})'),'actual alpha atlas decodes');
check(await ev('!document.querySelector(".loader-coffee")&&document.querySelectorAll(".loader-pose").length===4'),'four whole carry poses replace separate cup overlay');
const gait=[];
for(let i=0;i<8;i++){await delay(110);gait.push(await ev('({x:document.querySelector(".loader-walker").getBoundingClientRect().x,poses:Array.from(document.querySelectorAll(".loader-pose")).map(e=>getComputedStyle(e).opacity),progress:document.querySelector("progress").hasAttribute("value")})'));}
const activity=[];
for(let i=0;i<3;i++){activity.push(await ev('getComputedStyle(document.querySelector(".loader-track"),"::after").left'));await delay(200);}
check(new Set(activity).size>1&&await ev('!document.querySelector("progress").hasAttribute("value")'),'pre-module activity moves without a fake percentage',{activity});
check(new Set(gait.map(p=>p.x)).size>1&&new Set(gait.map(p=>JSON.stringify(p.poses))).size===4&&gait.every(p=>!p.progress),'all four gait frames advance without inventing progress',{gait});
for(let frame=0;frame<4;frame++){
await ev('document.querySelectorAll(".loader-walker,.loader-figure").forEach(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=1500});document.querySelectorAll(".loader-pose").forEach(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime='+String(frame*200+50)+'})');
await screenshot('pose-'+frame);
}
await ev('document.querySelectorAll(".loader-walker,.loader-figure,.loader-pose").forEach(e=>e.getAnimations()[0].play())');
for(const [name,width,height,mobile] of [['desktop',1200,800,false],['mobile',390,844,true],['small',320,568,true],['landscape',844,390,true]]){
await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(160);
const box=await ev('(()=>{const r=document.querySelector(".loader-content").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,overflow:document.documentElement.scrollWidth>innerWidth}})()');
check(box.x>=0&&box.y>=0&&box.x+box.w<=width&&box.y+box.h<=height&&!box.overflow,name+' isolated loader fits',box);
if(name==='desktop'||name==='mobile')await screenshot(name);
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
check(await ev('Array.from(document.querySelectorAll(".loader-walker,.loader-figure,.loader-pose")).every(e=>getComputedStyle(e).animationName==="none")&&getComputedStyle(document.querySelector(".loader-pose")).opacity==="1"'),'reduced motion stationary carry pose');
check(await ev('getComputedStyle(document.querySelector(".loader-track"),"::after").animationName==="none"'),'reduced motion stops indeterminate activity');
await send('Emulation.setEmulatedMedia',{features:[]});
await ev('document.querySelector("#loader").setAttribute("aria-busy","false")');
check(await ev('Array.from(document.querySelectorAll(".loader-walker,.loader-figure,.loader-pose")).every(e=>getComputedStyle(e).animationPlayState==="paused")'),'idle/failure CSS stops decorative walk');
await ev('document.querySelector("#loader").setAttribute("aria-busy","true");const s=document.createElement("script");s.id="game-entry";s.type="module";s.src="./missing-entry-for-qa.js";document.body.append(s)');
for(let i=0;i<50;i++){await delay(100);if(await ev('!!document.querySelector("#loader [role=alert]")'))break;}
check(await ev('document.querySelector("progress").hidden&&!document.querySelector("[data-loading-retry]").hidden&&!!document.querySelector("#loader [role=alert]")'),'actual missing entry module surfaces failure and retry');
await screenshot('entry-failure');
const report={scope:'Isolated actual inline loader via file URL; no server or gameplay readiness verification',results,shots,failed:results.filter(r=>!r.pass)};
fs.writeFileSync('artifacts/loading-local-qa-results.json',JSON.stringify(report,null,2));console.log('LOCAL_LOADING_QA '+JSON.stringify(report));if(report.failed.length)process.exitCode=1;
}catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});console.log('PROFILE_CLEANED');}})();