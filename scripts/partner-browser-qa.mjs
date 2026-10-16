// Run from the project root on the authorized Mac: node scripts/partner-browser-qa.mjs
// Ordinary new-game UI only. No game-state writes, virtual-time advancement, or fixtures.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const output = path.resolve('artifacts/partner-growth');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'partner-growth-qa-'));
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--remote-debugging-pipe', '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const began = Date.now(), deadline = began + 20 * 60_000;
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
async function snapshot() { return ev(`(()=>{const s=qaScene.getState();return {day:s.day,phase:s.phase,dayTime:s.dayTime,coins:s.coins,served:s.served,pantry:s.pantry,speed:s.speed,partners:s.partners}})()`); }
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
  await cleanDialogs(); await click('#open-btn');
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
  await send('Page.navigate', { url: 'http://localhost:3000/' });
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
  for (const lang of ['en', 'zh']) {
    await locale(lang);
    for (const [width, height] of [[1440,1000],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
      await team(); check(await ev('document.querySelectorAll("[data-partner-open]").length===9'), lang + ': nine candidates'); await layout(lang + '-' + width + '-team');
      await click('[data-partner-open="' + primary + '"]');
      const before = await snapshot(); await wait(2200); const after = await snapshot();
      check(JSON.stringify(before.partners) === JSON.stringify(after.partners) && before.dayTime === after.dayTime, lang + '-' + width + ': profile is read-only and pauses time');
      check(await ev('[...document.querySelectorAll("[data-partner-chapter]")].every(b=>b.disabled)'), lang + '-' + width + ': fresh stories locked');
      await layout(lang + '-' + width + '-profile');
    }
  }
  await locale('en'); await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  let recruited = false, trained = false, read = false, pauseChecked = false, lastProgress = 0;
  while (Date.now() < deadline && !(recruited && trained && read)) {
    await cleanDialogs(); let s = await snapshot();
    if (s.phase === 'prep') {
      await team(primary); s = await snapshot();
      const p = s.partners.roster[primary];
      if (!trained && p.xp >= 20 && await visible('[data-partner-train="a"]')) {
        const before = await snapshot(); await click('[data-partner-train="a"]'); const after = await snapshot();
        check(after.partners.roster[primary].specialty === 'a' && before.coins - after.coins === 80 && before.partners.roster[primary].xp === after.partners.roster[primary].xp, 'ordinary earned 20 XP training charges $80 without granting XP', { before, after });
        trained = after.partners.roster[primary].specialty === 'a'; await shot('ordinary-trained');
      }
      if (!read && p.unlocked > 0 && p.workedDays >= 2) {
        const before = await snapshot(); await click('[data-partner-chapter="0"]'); await wait(1800); const during = await snapshot();
        check(before.partners.roster[primary].xp === during.partners.roster[primary].xp, 'reading story gives no XP'); await shot('ordinary-story');
        await click('[data-partner-finish]'); const after = await snapshot();
        check(after.partners.roster[primary].read.includes(0) && after.partners.roster[primary].xp === before.partners.roster[primary].xp, 'story marked read without granting XP across actual days', { before, after }); read = after.partners.roster[primary].read.includes(0);
      }
      if (!recruited && s.coins >= 100) {
        await team();
        const candidate = await ev(`(()=>{const s=qaScene.getState();return [...document.querySelectorAll('[data-partner-open]')].map(b=>b.dataset.partnerOpen).find(id=>!s.partners.roster[id])})()`);
        if (candidate) {
          await click('[data-partner-open="' + candidate + '"]');
          if (await visible('[data-partner-recruit="' + candidate + '"]')) {
            const before = await snapshot(); await click('[data-partner-recruit="' + candidate + '"]'); const after = await snapshot();
            recruited = !!after.partners.roster[candidate]; check(recruited && before.coins - after.coins === 60 && JSON.stringify(before.partners.active) === JSON.stringify(after.partners.active), 'ordinary earned coins recruit reserve without adding active slot', { before, after }); await shot('ordinary-recruited');
          }
        }
      }
      if (recruited && trained && read) break;
      await openDay();
    } else {
      if (!pauseChecked && s.served > 0) {
        await team(primary); const before = await snapshot(); await wait(2500); const after = await snapshot();
        check(before.dayTime === after.dayTime && JSON.stringify(before.partners) === JSON.stringify(after.partners), 'open-day modal pauses work and XP', { before, after }); pauseChecked = true; await cleanDialogs();
      }
      // Close through UI after at least 90 game seconds; allow pending orders to settle naturally.
      s = await snapshot(); if (s.phase === 'open' && s.dayTime >= 90) await click('#close-btn');
      await wait(2500);
    }
    if (Date.now() - lastProgress > 15_000) { lastProgress = Date.now(); log('Ordinary play progress', await snapshot()); }
  }
  finalState = await snapshot(); normalComplete = recruited && trained && read;
  check(normalComplete, 'normal-play milestones within 20 minutes', { recruited, trained, read, finalState });
  if (!normalComplete) log('Manual follow-up needed: inspect pantry, menu, and earned funds; do not grant resources', { finalState });
  await team(primary); await wait(1200); await shot('final');
  // Reload tests the normal browser save, without inspecting or changing storage.
  const saved = await snapshot();
  await send('Page.reload');
  await wait(1500);
  for (let i = 0; i < 240 && await visible('#loader'); i++) await wait(250);
  check(!await visible('#loader'), 'reload startup assets finished before interaction');
  for (let i = 0; i < 100 && !await visible('#partners-btn'); i++) await wait(250);
  await click('#partners-btn');
  const persistedCards = await ev('document.querySelector(".partner-journal")?.innerText || ""');
  check(persistedCards.includes(saved.partners.roster[primary].xp + ' XP'), 'normal browser reload preserves visible partner XP', { primary, expectedXP: saved.partners.roster[primary].xp, persistedCards });
  await shot('reload-team');
  check(errors.length === 0, 'no browser runtime exceptions', { errors });
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
