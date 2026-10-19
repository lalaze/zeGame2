// Run from the project root on the authorized Mac: node scripts/partner-browser-qa.mjs
// Ordinary new-game UI only. No game-state writes, virtual-time advancement, or fixtures.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const output = path.resolve('artifacts/gameplay-review-7085/expansion-play');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'partner-growth-qa-'));
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--remote-debugging-pipe', '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const began = Date.now(), deadline = began + 30 * 60_000;
let sequence = 0, buffer = '', session;
const pending = new Map(), results = [], shots = [], errors = [], milestones = [];
chrome.on('error', e => { for (const p of pending.values()) p.reject(e); });
chrome.stdio[4].on('data', b => {
  buffer += b.toString(); let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
    const m = JSON.parse(raw), p = pending.get(m.id);
    if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  }
});
function send(method, params = {}, sid = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 20_000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }) + '\0');
  });
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function log(label, detail = {}) { const row = { label, elapsedSeconds: Math.round((Date.now() - began) / 1000), ...detail }; milestones.push(row); console.log('MILESTONE ' + JSON.stringify(row)); }
function check(pass, label, detail = {}) { results.push({ pass: !!pass, label, ...detail }); console.log((pass ? 'PASS ' : 'FAIL ') + label + ' ' + JSON.stringify(detail)); }
async function shot(name) { const s = await send('Page.captureScreenshot', { format: 'png' }); const file = path.join(output, name + '.png'); fs.writeFileSync(file, Buffer.from(s.data, 'base64')); shots.push(file); }
async function visible(selector) { return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!e.disabled&&!e.closest('[hidden]')&&e.getClientRects().length>0})()`); }
async function click(selector) {
  const p = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||e.closest('[hidden]'))throw Error('Unavailable control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Invisible control');return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 }); await wait(250);
}
async function escape() { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await wait(250); }
async function snapshot() { return ev(`(()=>{const s=qaScene.getState();return {day:s.day,phase:s.phase,dayTime:s.dayTime,coins:s.coins,served:s.served,pantry:s.pantry,speed:s.speed,partners:s.partners,items:s.items,upgrades:s.upgrades,kitchen:s.kitchen,regions:s.regions,reviews:s.reviews,today:s.today,regulars:s.regulars,pets:s.pets}})()`); }
async function cleanDialogs() { for (let i = 0; i < 3 && await visible('#modal-root .modal'); i++) await escape(); if (await visible('#drawer-close')) await click('#drawer-close'); }
async function team(id) { await cleanDialogs(); await click('#partners-btn'); if (id) await click('[data-partner-open="' + id + '"]'); }
async function layout(label) {
  const detail = await ev(`(()=>{const m=document.querySelector('[role=dialog]'),r=m.getBoundingClientRect();return{viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1,modalOverflow:m.scrollWidth>m.clientWidth+1,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},small:[...m.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>({text:e.textContent,rect:e.getBoundingClientRect()})).filter(e=>e.rect.width<43.9||e.rect.height<43.9).map(e=>({text:e.text,w:e.rect.width,h:e.rect.height}))}})()`);
  check(!detail.overflow && !detail.modalOverflow && detail.bounds.left >= -1 && detail.bounds.right <= detail.viewport[0] + 1 && detail.bounds.bottom <= detail.viewport[1] + 1, label + ': fits viewport', detail);
  check(!detail.small.length, label + ': 44px targets', { small: detail.small }); await shot(label);
}
async function locale(value) {
  await cleanDialogs(); await click('#settings-btn'); await click('[data-locale="' + value + '"]'); await escape();
}
async function openDay() {
  await cleanDialogs(); await click('#open-btn'); if(await visible('[data-opening-advanced]')) await click('[data-opening-advanced]');
  // Restock through the documented prep UI, paying earned coins normally.
  if (await visible('.prep [data-restock]')) { await click('.prep [data-restock]'); log('Paid UI restock', await snapshot()); }
  if (await visible('.prep [data-emergency-restock]')) { await click('.prep [data-emergency-restock]'); log('Used offered emergency restock', await snapshot()); }
  if (!await visible('.modal-actions [data-start]')) throw Error('Prepare start is unavailable; manual menu inspection required');
  await click('.modal-actions [data-start]');
  if ((await snapshot()).phase !== 'open') throw Error('Prepare did not open the business day');
  if (await visible('[data-speed="3"]')) await click('[data-speed="3"]');
  log('Opened business day', await snapshot());
}
let finalState, normalComplete = false;
try {
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  for (let i = 0; i < 160 && !await visible('.onboard [data-next]'); i++) await wait(250);
  check(await ev('isSecureContext'), 'localhost is secure context');
  check(await ev('!document.querySelector("#save-session-notice")'), 'no save-session blocker');
  for (let i = 0; i < 8 && await visible('.onboard [data-next]'); i++) await click('.onboard [data-next]');
  await wait(1000);
  await ev(`(async()=>{const url=performance.getEntriesByType('resource').map(r=>r.name).find(u=>u.includes('/src/render/phaser/cafe-scene.ts'));if(!url)throw Error('Scene source module unavailable');const {CafeScene}=await import(url);const original=CafeScene.prototype.drawTable;CafeScene.prototype.drawTable=function(...args){window.qaScene=this;return original.apply(this,args)}})()`);
  if (await visible('[data-guide-action="skip"]')) await click('[data-guide-action="skip"]');
  await wait(1000); await cleanDialogs();
  const initial = await snapshot(); log('Fresh onboarding completed', initial);
  check(initial.day === 1 && initial.served === 0, 'ordinary fresh new game');
  const primary = Object.keys(initial.partners.roster)[0];
  if (!primary) throw Error('No initially recruited partner: earning staffing purchase requires manual UI inspection');

  await locale('en');if(await visible('summary[data-guide-action="details"]'))await click('summary[data-guide-action="details"]');if(await visible('[data-guide-action="skip"]'))await click('[data-guide-action="skip"]');
  async function manage(tab) {
    await cleanDialogs();
    if(!await visible('[data-management-tab="'+tab+'"]')) await click('#panel-toggle');
    await click('[data-management-tab="'+tab+'"]');
  }
  async function record(label) { const s=await snapshot();log(label,s);fs.writeFileSync(path.join(output,label+'.json'),JSON.stringify(s,null,2));fs.writeFileSync(path.join(output,label+'.txt'),await ev('document.body.innerText'));await shot(label); }
  async function buy(selector,reserve=80) {
    if(!await visible(selector)) return false;
    const cost=await ev("(()=>{const b=document.querySelector("+JSON.stringify(selector)+");return Number((b.querySelector('.cost')?.textContent||b.textContent).replace(/[^0-9.]/g,''))})()");
    if(!Number.isFinite(cost)||(await snapshot()).coins-cost<reserve)return false;
    await click(selector);log('UI purchase',{selector,cost,...await snapshot()});return true;
  }
  async function expand(name) {
    await cleanDialogs();
    const dir=await ev("(()=>{const b=[...document.querySelectorAll('[data-direction]')].find(b=>b.getClientRects().length&&b.textContent.toLowerCase().includes("+JSON.stringify(name)+"));return b?.dataset.direction})()");
    if(!dir)return;
    await click('[data-direction="'+dir+'"]');await record('preview-'+name+'-day'+(await snapshot()).day);
    if(await visible('[data-expand]') && (await snapshot()).coins>(name==='kitchen'?950:1400)) {await click('[data-expand]');log('UI expansion',{name,...await snapshot()});}
    const back=await ev("(()=>{const b=[...document.querySelectorAll('[data-direction]')].find(b=>b.getClientRects().length&&/main|café/i.test(b.textContent));return b?.dataset.direction})()");
    if(back)await click('[data-direction="'+back+'"]');
  }
  let lastDay=0,lastStock=0, lastLog=0;
  while(Date.now()<deadline) {
    await cleanDialogs();let s=await snapshot();
    if(s.phase==='prep') {
      if(s.day>=7){normalComplete=true;break;}
      await record('day'+s.day+'-start');
      await manage('menu');
      while(await visible('[data-claim]'))await click('[data-claim]');
      const state=await snapshot();
      if(state.day>=2) {
        for(const id of ['americano','blacktea','latte','roll','bagel','donut']) {
          const now=await snapshot();
          if((!['roll','bagel','donut'].includes(id)||now.kitchen)&&!now.items?.[id]) await buy('[data-buy="item:'+id+'"]',100);
        }
        for(let k=0;k<3;k++){const now=await snapshot();if((now.items?.espresso||0)<10)await buy('[data-buy="item:espresso"]',80);}
      }
      await manage('upgrades');
      for(const id of ['marketing','tables','barista','server','machine']) {
        const now=await snapshot(); const caps={marketing:2,tables:2,barista:1,server:1,machine:2};
        if((now.upgrades?.[id]||0)<caps[id])await buy('[data-buy="upgrade:'+id+'"]',150);
      }
      await expand('kitchen'); await expand('reading');
      if(s.day>=4 && (await snapshot()).coins>500) {await manage('pets');if(await visible('[data-choose-cat]'))await click('[data-choose-cat]');await buy('[data-adopt]',200);await record('pets-day'+s.day);}
      await cleanDialogs();await openDay();
      if(await visible('[data-speed="4"]'))await click('[data-speed="4"]');
      lastStock=0;lastDay=s.day;
    } else {
      if(s.phase==='open' && s.dayTime-lastStock>=90) {
        await manage('pantry');await record('pantry-day'+s.day+'-'+Math.floor(s.dayTime));
        if(await visible('[data-restock]'))await click('[data-restock]');await cleanDialogs();lastStock=s.dayTime;
      }
      if(s.phase==='open' && s.dayTime>=240) {await record('day'+s.day+'-end');await click('#close-btn');}
      await wait(1500);
    }
    if(Date.now()-lastLog>20000){lastLog=Date.now();log('Long play progress',await snapshot());}
  }
  finalState=await snapshot();await record('final-longplay');check(normalComplete,'6 real business days with expansion completed',{finalState});
  await click('#regular-guests-btn');await record('regulars-final');await cleanDialogs();
  await team();await record('team-final');await cleanDialogs();
  await click('#reputation-btn');await record('reputation-final');await cleanDialogs();
} catch (error) {
  check(false, 'browser execution completed', { error: error.stack });
  await shot('error').catch(() => {});
  log('Exact UI at blocker', { body: await ev('document.body.innerText.slice(-10000)').catch(() => '') });
} finally {
  const report = { mode: 'ordinary-new-game-only', fixtures: [], started: new Date(began).toISOString(), elapsedSeconds: (Date.now() - began) / 1000, normalComplete, finalState, results, milestones, shots, errors };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log('PARTNER_QA_SUMMARY ' + JSON.stringify({ checks: results.length, failed: results.filter(r => !r.pass), normalComplete, output }));
  await send('Browser.close', {}, null).catch(() => {});
  if (chrome.exitCode === null) { await Promise.race([new Promise(r => chrome.once('exit', r)), wait(2000)]); if (chrome.exitCode === null) chrome.kill('SIGTERM'); }
  fs.rmSync(profile, { recursive: true, force: true });
  if (results.some(r => !r.pass)) process.exitCode = 1;
}
