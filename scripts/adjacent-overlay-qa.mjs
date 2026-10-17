import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fullscreen-overlay-qa-'));const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buffer='',session;const waiting=new Map(),errors=[];chrome.stdio[4].on('data',b=>{buffer+=b.toString();let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));

const results=[];const shots=[];
function check(ok,label,detail={}) { results.push({label,pass:!!ok,...detail}); console.log((ok?'PASS ':'FAIL ')+label+' '+JSON.stringify(detail)); }
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:75});const file='artifacts/adjacent-'+name+'.jpg';fs.writeFileSync(file,Buffer.from(shot.data,'base64'));shots.push(file);}
async function clickAt(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(240);}
async function click(selector){const p=await ev('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.hidden)throw Error("Missing "+'+JSON.stringify(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()');await clickAt(p.x,p.y);}
async function key(key,modifiers=0){const code=key==='Escape'?27:9;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code,modifiers});await delay(160);}
async function geometry(){return ev(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {width:innerWidth,height:innerHeight,stage:box('#stage'),canvas:box('#scene'),room:box('#scene-area'),panel:box('#management-panel'),overflow:document.documentElement.scrollWidth>innerWidth,scrollY,ready:document.body.classList.contains('ready'),open:!document.querySelector('#management-panel').hidden,paused:qaScene.view.paused,speed:qaScene.getState().speed,focus:document.activeElement?.id,modal:!!document.querySelector('#modal-root .modal'),inert:document.querySelector('#stage').inert}})()`);}
(async()=>{try{
const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://100.96.195.115:5173/'});
for(let i=0;i<120;i++){await delay(300);if(await ev('!!document.querySelector(".onboard [data-next]")'))break;}
for(let i=0;i<5;i++){await ev('document.querySelector(".onboard [data-next]")?.click()');await delay(250);}
await delay(1300);fs.mkdirSync('artifacts',{recursive:true});
await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)};document.querySelector('[data-guide-action="skip"]')?.click()})()`);
await delay(800);
check(await ev('!!window.qaScene'),'scene captured');
for(const [name,width,height,mobile] of [['desktop',1200,900,false],['wide',1920,1080,false],['mobile',390,844,true],['landscape',844,390,true],['wide-landscape',932,430,true]]){
  await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(550);
  if(await ev('!document.querySelector("#management-panel").hidden')) await click('#drawer-close');
  const closed=await geometry();
  check(closed.ready&&!closed.overflow,name+' ready and no horizontal overflow',closed);
  const noticeRects=await ev(`(()=>{const n=document.querySelector('#temporary-save-notice');return {noticeBottom:n?.getBoundingClientRect().bottom??0,controls:['.hud .brand','.hud .money','#reputation-btn'].map(selector=>({selector,top:document.querySelector(selector).getBoundingClientRect().top}))}})()`);
  check(noticeRects.controls.every(c=>c.top>=noticeRects.noticeBottom),name+' temporary notice does not overlap top HUD',noticeRects);
  const c=closed.room,s=closed.stage;
  check(Math.abs(s.x)<1&&Math.abs(s.y)<1&&Math.abs(s.width-width)<1&&Math.abs(s.height-height)<1,name+' stage fills viewport');
  check(Math.abs(c.width/c.height-4/3)<.002&&c.x>=-.5&&c.y>=-.5&&c.x+c.width<=width+.5&&c.y+c.height<=height+.5,name+' complete undistorted room');
  check(Math.min(width-c.width,height-c.height)<2,name+' maximum contain');
  if(!mobile){
    const doorHit=await ev(`(()=>{const e=document.querySelector('.area-right');const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:!!e.getClientRects().length,hit:hit?.outerHTML,correct:!!hit?.closest('.area-right')}})()`);
    check(doorHit.visible&&doorHit.correct,name+' right door is unobstructed',doorHit);
    const doorOverlap=await ev(`(()=>{const arrow=document.querySelector('.area-right');const boxes=[arrow,...arrow.querySelectorAll('*')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);const a={left:Math.min(...boxes.map(r=>r.left)),top:Math.min(...boxes.map(r=>r.top)),right:Math.max(...boxes.map(r=>r.right)),bottom:Math.max(...boxes.map(r=>r.bottom))};return {arrow:a,overlaps:[...document.querySelectorAll('.edge-tools button')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.height&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}).map(e=>e.dataset.managementTab)}})()`);
    check(!doorOverlap.overlaps.length,name+' entire right arrow and label clear of rail',doorOverlap);
    await click('.area-right');await delay(950);
    check(await ev('qaScene.view.area==="reading"'),name+' right door opens reading');
    await click('.area-left');await delay(950);
    check(await ev('qaScene.view.area==="main"'),name+' left door returns main');
    await click('.area-plan-toggle');await delay(950);
    check(await ev('qaScene.view.overview'),name+' map opens');
    const mapPoint=await ev(`(()=>{const c=qaScene.cameras.main,canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();return {x:r.x+(160-c.scrollX)*c.zoom*r.width/canvas.width,y:r.y+(120-c.scrollY)*c.zoom*r.height/canvas.height}})()`);
    await clickAt(mapPoint.x,mapPoint.y);await delay(950);
    check(await ev('!qaScene.view.overview&&qaScene.view.area==="main"'),name+' map room click returns main',{mapPoint});
  }
  const surroundings=await ev(`(()=>{const q=qaScene;return {visible:[...q.layers.entries()].filter(([k,v])=>k.startsWith('room-')&&!k.endsWith('-front')&&v.image.visible).map(([k])=>k),regions:[...q.getState().regions],kitchen:q.getState().kitchen,area:q.view.area}})()`);
  if(name==='wide'||name==='landscape')check(surroundings.visible.includes('room-reading')&&surroundings.visible.includes('room-kitchen'),name+' real side rooms rendered',surroundings);
  if(name==='mobile')check(surroundings.visible.includes('room-terrace'),name+' real rear terrace rendered',surroundings);
  if(name==='wide'){
    const before=await ev('JSON.stringify({regions:qaScene.getState().regions,kitchen:qaScene.getState().kitchen,coins:qaScene.getState().coins,area:qaScene.view.area})');
    await ev('window.previewTaps=0;window.originalTap=qaScene.hooks.pointerDown;qaScene.hooks.pointerDown=(...a)=>{window.previewTaps++;return window.originalTap(...a)}');
    await clickAt(width-30,height*.7);
    check(await ev('window.previewTaps')===0,'adjacent preview does not dispatch game taps');
    check(await ev('JSON.stringify({regions:qaScene.getState().regions,kitchen:qaScene.getState().kitchen,coins:qaScene.getState().coins,area:qaScene.view.area})')===before,'adjacent preview preserves unlocks and current room');
    await ev('qaScene.hooks.pointerDown=window.originalTap');
  }
  await screenshot(name+'-closed');
  if(!mobile){
    check(await ev('document.querySelector("#edge-tools").hidden'),name+' shortcuts folded by default');
    await click('#panel-toggle');
    check(await ev('!document.querySelector("#edge-tools").hidden&&document.querySelector("#panel-toggle").getAttribute("aria-expanded")==="true"'),name+' Manage unfolds shortcuts');
    await screenshot(name+'-shortcuts');
    await click('[data-management-tab="menu"]');
  } else await click('#panel-toggle');
  const opened=await geometry();
  check(opened.open&&JSON.stringify(closed.canvas)===JSON.stringify(opened.canvas)&&JSON.stringify(closed.stage)===JSON.stringify(opened.stage),name+' drawer never resizes room',{closed:closed.canvas,opened:opened.canvas});
  check(opened.focus==='drawer-close',name+' initial focus');
  check(opened.paused===mobile,name+' pause policy',{paused:opened.paused,mobile});
  check(!opened.overflow,name+' open no overflow');
  const tabs=await ev('[...document.querySelectorAll("[data-tab]")].map(e=>({id:e.dataset.tab,visible:!!e.getClientRects().length&&!e.hidden,rect:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}))');
  check(tabs.length===6&&tabs.every(t=>t.visible),name+' six tabs present',{tabs});
  for(const tabName of ['menu','pantry','upgrades','decor','pets','promotion']){
    await click('[data-tab="'+tabName+'"]');
    check(await ev('document.querySelector("[data-tab='+tabName+']").classList.contains("active")'),name+' tab '+tabName);
  }
  await screenshot(name+'-open');
  if(mobile){
    const controls=await ev(`(()=>{const p=document.querySelector('#management-panel');const cs=[...p.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>e.tabIndex>=0&&!e.matches(':disabled')&&!e.closest('[hidden],[inert]')&&e.getClientRects().length);window.qaFirst=cs[0];window.qaLast=cs.at(-1);window.qaLast.focus();return {count:cs.length,first:window.qaFirst.outerHTML,last:window.qaLast.outerHTML}})()`);
    await key('Tab');check(await ev('document.activeElement===window.qaFirst'),name+' Tab trap end',{controls});
    await key('Tab',8);check(await ev('document.activeElement===window.qaLast'),name+' Shift Tab trap start');
    check(await ev('document.querySelector("#stage").inert&&document.querySelector(".hud").inert'),name+' scene and HUD inert');
    const speed=await ev('qaScene.getState().speed');await key('Escape');const after=await geometry();
    check(!after.open&&!after.paused&&after.speed===speed&&after.focus==='panel-toggle'&&!after.inert,name+' Escape restores focus and prior state',after);
    await click('#panel-toggle');await clickAt(2,height/2);check(await ev('document.querySelector("#management-panel").hidden'),name+' backdrop closes');
  } else {
    await key('Escape');check(await ev('document.querySelector("#management-panel").hidden&&document.activeElement.id==="panel-toggle"'),name+' Escape restores focus');
  }
}
// Desktop six shortcuts fold into Manage; each opens its tab and folds away.
await send('Emulation.setTouchEmulationEnabled',{enabled:false});
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});await delay(400);
for(const tabName of ['menu','pantry','upgrades','decor','pets','promotion']){
  await click('#panel-toggle');await click('[data-management-tab="'+tabName+'"]');
  check(await ev('!document.querySelector("#management-panel").hidden&&document.querySelector("#edge-tools").hidden&&document.querySelector("[data-tab='+tabName+']").classList.contains("active")'),'edge entry '+tabName);
  await key('Escape');check(await ev('document.activeElement.id==="panel-toggle"'),'edge focus return '+tabName);
}
await click('#panel-toggle');await key('Escape');
check(await ev('document.querySelector("#edge-tools").hidden&&document.activeElement.id==="panel-toggle"'),'Escape folds shortcuts');
await click('#panel-toggle');await clickAt(600,450);
check(await ev('document.querySelector("#edge-tools").hidden&&document.querySelector("#management-panel").hidden'),'outside press folds shortcuts');
// UI pointer events must not reach canvas behind the panel.
await click('#panel-toggle');await click('[data-management-tab="menu"]');
await ev('window.qaCanvasDown=0;document.querySelector("#scene").addEventListener("pointerdown",()=>window.qaCanvasDown++)');
await click('[data-tab="menu"]');
check(await ev('window.qaCanvasDown===0'),'panel click does not reach canvas');
await click('#drawer-close');
// Table placement preview remains usable while mobile drawer is normally paused.
await click('#panel-toggle');await click('[data-management-tab="upgrades"]');
await click('[data-table-preview]');
check(await ev('qaScene.view.tablePreview&&!document.querySelector("#management-panel").hidden'),'desktop table preview activates');
await key('Escape');
check(await ev('!qaScene.view.tablePreview&&!document.querySelector("#management-panel").hidden'),'desktop first Escape clears only table preview');
await key('Escape');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(400);
await click('#panel-toggle');await click('[data-tab="upgrades"]');await click('[data-table-preview]');
check(await ev('qaScene.view.tablePreview&&document.querySelector("#management-panel").hidden&&!qaScene.view.paused&&!document.querySelector(".table-preview-exit").hidden'),'mobile table preview reveals scene and remains active');
await screenshot('mobile-table-preview');
await click('.table-preview-exit');
check(await ev('!qaScene.view.tablePreview&&!document.querySelector("#management-panel").hidden&&document.querySelector("[data-tab=upgrades]").classList.contains("active")&&qaScene.view.paused'),'mobile table preview Back returns upgrades');
await click('[data-table-preview]');await key('Escape');
check(await ev('!qaScene.view.tablePreview&&!document.querySelector("#management-panel").hidden&&qaScene.view.paused'),'mobile table preview Escape returns upgrades');
await click('#drawer-close');
// Set speed in isolated profile, then verify mobile drawer and modal pause compose.
await ev('qaScene.getState().speed=4');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(400);
await click('#panel-toggle');await click('[data-tab="upgrades"]');
const price=await ev('document.querySelector("[data-price-details]")?.getAttribute("data-price-details")');
if(price){
  await click('[data-price-details="'+price+'"]');await delay(250);const both=await geometry();
  check(both.open&&both.modal&&both.paused&&both.speed===4,'modal over drawer paused');
  await key('Escape');const drawer=await geometry();check(drawer.open&&!drawer.modal&&drawer.paused&&drawer.speed===4,'closing modal retains drawer pause');
  await key('Escape');const neither=await geometry();check(!neither.open&&!neither.modal&&!neither.paused&&neither.speed===4,'closing drawer restores speed 4');
} else {check(false,'modal price control present');await click('#drawer-close');}
// Existing modal pause must survive drawer close even when another owner holds focus.
await click('#panel-toggle');
await ev(`(async()=>{const {showModal}=await import('/src/ui/modal.ts');showModal({title:'QA pause composition',body:'Isolated temporary browser profile only.',buttons:[{label:'Close'}]});document.querySelector('#drawer-close').click()})()`);
await delay(250);const modalOnly=await geometry();check(!modalOnly.open&&modalOnly.modal&&modalOnly.paused&&modalOnly.speed===4,'closing drawer cannot unpause existing modal',modalOnly);await key('Escape');
// Furniture catalog hides while arranging and reopens without altering inventory on cancel.
await click('#panel-toggle');await click('[data-tab="decor"]');
const decorBefore=await ev('JSON.stringify(qaScene.getState().decor)');
await click('[data-furniture="arrange:"]');await delay(500);
check(await ev('document.body.classList.contains("arranging-cafe")&&document.querySelector("#management-panel").hidden&&!qaScene.view.paused'),'mobile arrange collapses drawer and resumes room');
await screenshot('mobile-arranging');
await click('#arrange-done');await delay(400);
check(await ev('!document.body.classList.contains("arranging-cafe")&&!document.querySelector("#management-panel").hidden&&qaScene.view.paused'),'arrange done reopens drawer');
check(decorBefore===await ev('JSON.stringify(qaScene.getState().decor)'),'arrange cancel preserves inventory');
// Buy a real piece using isolated test money, enter placement, then cancel.
await ev('qaScene.getState().coins=100000');await delay(400);
const buy=await ev('[...document.querySelectorAll("[data-furniture]")].find(e=>e.dataset.furniture.startsWith("buy:")&&!e.disabled&&!e.hidden&&e.getClientRects().length)?.dataset.furniture');
if(buy){
  await click('[data-furniture="'+buy+'"]');await delay(450);
  check(await ev('!!qaScene.view.ghost&&document.querySelector("#management-panel").hidden&&!qaScene.view.paused'),'furniture purchase enters placement');
  await screenshot('mobile-placement');
  const ghost=await ev('qaScene.view.ghost');console.log('PLACEMENT_GHOST '+JSON.stringify(ghost));
  await click('#arrange-done');await delay(300);
  check(await ev('!qaScene.view.ghost&&!document.querySelector("#management-panel").hidden'),'placement cancel returns catalog');
  await click('[data-furniture="place:'+ghost.id+'"]');await delay(300);
  const placeCount=await ev('qaScene.getState().decor.placed.length');
  const point=await ev(`(async()=>{const g=qaScene.view.ghost;const {furnitureDef}=await import('/src/game/furniture.ts');const {floorAnchor,cellRect}=await import('/src/render/cafe-view.ts');const {projectMainWorld,projectMainPlaneWorld,MAIN_WALL_PLANE}=await import('/src/render/main-pixel-presentation.ts');const d=furnitureDef(g.id);let p;if(d.surface==='wall'){const b=cellRect('wall',g.col,g.row,d.w,d.h);p=projectMainPlaneWorld({x:b.x+b.w/2,y:b.y+b.h/2},MAIN_WALL_PLANE);}else{const a=floorAnchor(d,g.col,g.row);p=projectMainWorld({x:a.cx,y:a.foot});}const c=qaScene.cameras.main,canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();return {x:r.x+(p.x-c.scrollX)*c.zoom*r.width/canvas.width,y:r.y+(p.y-c.scrollY)*c.zoom*r.height/canvas.height};})()`);
  await clickAt(point.x,point.y);await delay(350);
  check(await ev('qaScene.getState().decor.placed.length')===placeCount+1,'furniture placed by real pointer',{point});
  check(await ev('!qaScene.view.ghost&&!document.querySelector("#management-panel").hidden&&qaScene.view.paused'),'successful placement returns catalog and pause');
  await screenshot('mobile-placement-complete');
} else check(false,'available furniture purchase');
console.log('RUNTIME_ERRORS '+JSON.stringify(errors));check(errors.length===0,'no runtime errors');
const report={results,shots,errors,failed:results.filter(r=>!r.pass)};
fs.writeFileSync('artifacts/adjacent-qa-results.json',JSON.stringify(report,null,2));
console.log('FULLSCREEN_QA_SUMMARY '+JSON.stringify({checks:results.length,failed:report.failed,shots}));
if(report.failed.length)process.exitCode=1;
} catch(e){console.log('QA_ERROR '+e.stack);process.exitCode=1;}finally{await send('Browser.close',{},null).catch(()=>{});await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(2000)]);if(chrome.exitCode===null)chrome.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});console.log('PROFILE_CLEANED '+profile);}})();
