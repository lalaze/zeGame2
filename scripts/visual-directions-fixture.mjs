import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = 'artifacts/visual-directions-1a309fcc/visual';
fs.mkdirSync(dir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-navigation-qa-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--remote-debugging-pipe', '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let sequence = 0, buffer = '', session;
const pending = new Map(), checks = [], errors = [], shots = [];
chrome.stdio[4].on('data', bytes => {
  buffer += bytes.toString();
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  }
});
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(pass, label, detail = {}) {
  checks.push({ pass: !!pass, label, ...detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + label + ' ' + JSON.stringify(detail));
}
async function click(selector, edge = 'center') {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || !element.getClientRects().length || element.closest('[hidden],[inert]')) throw Error('Unavailable control: ' + ${JSON.stringify(selector)});
    const rect = element.getBoundingClientRect();
    const x = ${JSON.stringify(edge)} === 'left' ? rect.left + 2 : ${JSON.stringify(edge)} === 'right' ? rect.right - 2 : rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return { x, y, hit: !!document.elementFromPoint(x, y)?.closest(${JSON.stringify(selector)}) };
  })()`);
  if (!point.hit) throw Error('Control obscured: ' + selector);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await delay(900);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
  const file = dir + '/' + name + '.jpg';
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64')); shots.push(file);
}
async function measure() {
  return evaluate(`(() => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const map = document.querySelector('.area-nav'), card = document.querySelector('.region-card');
    const overlap = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    const mapBox = box(map), cardBox = box(card);
    return {
      room: box(document.querySelector('#scene-area')), stage: box(document.querySelector('#stage')),
      viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth > innerWidth,
      arrows: [...document.querySelectorAll('.area-arrow')].filter(e => !e.hidden && e.getClientRects().length).map(e => ({ direction: e.dataset.direction, ...box(e) })),
      map: mapBox, card: cardBox, cardHidden: card.hidden,
      mapCardOverlap: !card.hidden && overlap(mapBox, cardBox),
      cardArrowOverlap: !card.hidden && [...document.querySelectorAll('.area-arrow')].filter(e => !e.hidden).some(e => overlap(box(e), cardBox)),
      mapControlOverlap: ['#settings-btn', '#panel-toggle'].some(s => overlap(mapBox, box(document.querySelector(s)))),
      title: card.querySelector('h2')?.textContent,
      statusDoorOverlap: [...document.querySelectorAll('.cafe-status-bar button')].some(control => [...document.querySelectorAll('.area-arrow')].filter(e => !e.hidden).some(arrow => overlap(box(control), box(arrow)))),
      overview: document.querySelector('.area-plan-toggle').getAttribute('aria-pressed') === 'true',
    };
  })()`);
}
try {
 const target=await send('Target.createTarget',{url:'about:blank'},null);
 session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1000,height:760,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://100.96.195.115:5173/scripts/visual-directions-fixture.html'});
 for(let i=0;i<150;i++){if(await evaluate('document.body.dataset.ready==="true"'))break;await delay(200)}
 check(await evaluate('document.body.dataset.ready==="true"'),'visual fixture ready');
 for(const room of ['main','kitchen','reading']){
  await evaluate('qa.view.moveToArea('+JSON.stringify(room)+',true)');await delay(1600);
  await screenshot(room+'-01');await delay(1400);await screenshot(room+'-02');
 }
 const metrics=await evaluate('qa.characterMetrics');console.log('CHARACTER_METRICS '+JSON.stringify(metrics));
 check(metrics.filter(x=>x.role==='customer'&&x.id!==1).every(x=>x.extension===4),'ordinary guests use reduced leg extension');
 check(metrics.find(x=>x.role==='customer'&&x.id===1).extension===9,'approved sample keeps existing proportion');
 check(metrics.every(x=>x.height>=36&&x.height<=41),'sample roster shares furniture-relative height band',{metrics});
 await evaluate('document.querySelector("#scene").style.display="none";document.querySelector("#roster").style.display="block"');
 await screenshot('character-roster');
 check(errors.length===0,'no fixture runtime errors',{errors});
} catch(error){check(false,'visual fixture completed',{error:String(error.stack||error)})}
finally{
 const report={checks,errors,shots,failed:checks.filter(c=>!c.pass)};
 fs.writeFileSync(dir+'/results.json',JSON.stringify(report,null,2));
 console.log('QA_SUMMARY '+JSON.stringify(report));
 await send('Browser.close',{},null).catch(()=>{});await delay(500);if(chrome.exitCode===null)chrome.kill('SIGTERM');
 if(report.failed.length)process.exitCode=1;
}