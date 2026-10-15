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
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5173/?qa-light=10'});
for(let i=0;i<120;i++){await delay(300);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}
for(let i=0;i<5;i++){await ev('document.querySelector(".onboard [data-next]").click()');await delay(250);}
await delay(1000);
fs.mkdirSync('artifacts',{recursive:true});
for(const [name,width,height] of [['desktop',1200,900],['wide',1920,1080],['ultrawide',3440,1440],['mobile',390,844],['resized',1920,1080]]){
await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(1200);
const metrics=await ev(`(async()=>{const c=document.querySelector('#scene'),s=document.querySelector('#stage'),r=c.getBoundingClientRect(),b=s.getBoundingClientRect();return {width:innerWidth,height:innerHeight,canvas:{x:r.x,y:r.y,width:r.width,height:r.height},stage:{x:b.x,y:b.y,width:b.width,height:b.height},roomWidth:320,side:0,overflow:document.documentElement.scrollWidth>innerWidth,ready:document.body.classList.contains('ready'),buttons:[...document.querySelectorAll('#open-btn,.cafe-style-button')].filter(x=>!x.hidden).map(x=>{const r=x.getBoundingClientRect();return {id:x.id,x:r.x,y:r.y,width:r.width,height:r.height}})}})()`);
console.log(name.toUpperCase()+' '+JSON.stringify(metrics));
if(!metrics.ready||metrics.overflow)throw Error(name+' readiness/overflow');
if(Math.abs(metrics.canvas.width/metrics.canvas.height-4/3)>.01)throw Error(name+' distorted room');
if(metrics.canvas.x<metrics.stage.x||metrics.canvas.y<metrics.stage.y||metrics.canvas.x+metrics.canvas.width>metrics.stage.x+metrics.stage.width||metrics.canvas.y+metrics.canvas.height>metrics.stage.y+metrics.stage.height)throw Error(name+' cropped room');
if(width>860&&Math.min(metrics.stage.width-36-metrics.canvas.width,metrics.stage.height-40-metrics.canvas.height)>3)throw Error(name+' room below maximum contain size');
const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:30});fs.writeFileSync('artifacts/contain-room-'+name+'.jpg',Buffer.from(shot.data,'base64'));
}

await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};document.querySelector('[data-guide-action="skip"]')?.click()})()`);
await delay(600);
const before=await ev('JSON.stringify(qaScene.getState().decor)');
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(400);}
async function clickSelector(selector){const p=await ev('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.hidden)throw Error("Missing button");const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await clickAt(p.x,p.y);}
async function clickWorld(x,y){const p=await ev('(()=>{const c=qaScene.cameras.main,r=document.querySelector("#scene").getBoundingClientRect(),canvas=document.querySelector("#scene");return {x:r.x+('+x+'-c.scrollX)*c.zoom*r.width/canvas.width,y:r.y+('+y+'-c.scrollY)*c.zoom*r.height/canvas.height}})()');await clickAt(p.x,p.y);}
const cat=await ev(`(async()=>{const p=await import('/src/render/main-pixel-presentation.ts'),l=await import('/src/game/layout.ts');return p.projectMainPlaneWorld(l.CAT_SPOT,p.MAIN_WALL_PLANE)})()`);
await clickWorld(cat.x,cat.y-5);
if(!(await ev('qaScene.view.catHappy>0')))throw Error('Cat click missed after fitting');
await clickSelector('.area-right');await delay(900);
if(await ev('qaScene.view.area')!=='reading')throw Error('Right door failed');

await clickSelector('.area-left');await delay(900);
if(await ev('qaScene.view.area')!=='main')throw Error('Return door failed');
await clickSelector('.area-plan-toggle');await delay(900);
if(!(await ev('qaScene.view.overview')))throw Error('Map failed');
await clickWorld(160,120);await delay(900);
if(await ev('qaScene.view.overview'))throw Error('Map room hit failed');
await clickSelector('#panel-toggle');await delay(700);
const collapsed=await ev('(()=>{const c=document.querySelector("#scene").getBoundingClientRect(),s=document.querySelector("#stage").getBoundingClientRect();return {canvas:c.width,canvasHeight:c.height,stage:s.width,stageHeight:s.height}})()');
if(Math.min(collapsed.stage-36-collapsed.canvas,collapsed.stageHeight-40-collapsed.canvasHeight)>3)throw Error('Collapsed maximum fit');
await clickSelector('#panel-toggle');await delay(700);
if(before!==await ev('JSON.stringify(qaScene.getState().decor)'))throw Error('Decor changed on resize/navigation');
console.log('INTERACTIONS cat, right door, return door, map hit, collapse/expand, unchanged decor: PASS');

console.log('ERRORS '+JSON.stringify(errors));if(errors.length)throw Error('Runtime errors');
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});console.log('PROFILE_CLEANED '+profile);}})();
