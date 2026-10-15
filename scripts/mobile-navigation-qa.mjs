import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = 'artifacts/compact-navigation';
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
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://100.96.195.115:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!document.querySelector(".onboard [data-next]")')) break;
    await delay(200);
  }
  await click('[data-locale="zh"]');
  for (let step = 0; step < 5; step++) await click('.onboard [data-next]');
  // Explicit skip is a supported UI action; no save, money, or game-state injection.
  await evaluate('document.querySelector("[data-guide-action=skip]").click()');
  await delay(500);
  for (const [name, width, height, mobile] of [
    ['portrait',390,844,true], ['small',320,568,true], ['landscape',844,390,true],
    ['compact-landscape',667,375,true], ['mobile-boundary',860,700,true], ['desktop-boundary',861,700,false], ['desktop',1440,1000,false],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await delay(500);
    if (name === 'landscape') { await click('#open-btn'); await click('[data-start]'); }
    const before = await measure();
    check(!before.overflow, name + ' no horizontal overflow');
    check(Math.abs(before.room.width / before.room.height - 4 / 3) < .001, name + ' room aspect unchanged');
    if (mobile) check(before.arrows.every(a => a.x >= before.room.x - .5 && a.right <= before.room.right + .5 && a.y >= before.room.y - .5 && a.bottom <= before.room.bottom + .5 && a.width >= 44 && a.height >= 44), name + ' full 44px door targets inside room', { arrows: before.arrows, room: before.room });
    if (name === 'compact-landscape') check(!before.statusDoorOverlap, name + ' status controls clear door targets');
    if (name === 'compact-landscape') {
      for (const control of ['#regular-guests-btn', '#reputation-btn']) {
        await click(control);
        check(await evaluate('!!document.querySelector("#modal-root .modal")'), name + ' ' + control + ' opens');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await delay(200);
      }
    }
    await screenshot(name + '-main');
    await click('.area-right', mobile ? 'right' : 'center');
    const reading = await measure();
    check(reading.title === '阅读休息室' && !reading.cardHidden, name + ' right-edge tap opens reading');
    if (mobile) {
      check(!reading.cardArrowOverlap, name + ' locked card clears door targets');
      check(!reading.mapCardOverlap, name + ' map clears locked card', { map: reading.map, card: reading.card });
      check(!reading.mapControlOverlap, name + ' map clears settings and manage');
    }
    check(JSON.stringify(before.room) === JSON.stringify(reading.room), name + ' navigation preserves room bounds');
    await screenshot(name + '-reading');
    await click('.area-plan-toggle');
    check((await measure()).overview, name + ' map opens from locked room');
    await click('.area-plan-toggle');
    check(!(await measure()).overview, name + ' map returns to room');
    await click('.area-left', mobile ? 'left' : 'center');
    check((await measure()).cardHidden, name + ' left-edge tap returns main');
    await click('.area-left', mobile ? 'left' : 'center');
    const kitchen = await measure();
    check(kitchen.title === '后厨' && !kitchen.cardHidden, name + ' kitchen preview reachable');
    if (mobile) check(!kitchen.mapCardOverlap, name + ' map clears kitchen card');
    await click('.area-right', mobile ? 'right' : 'center');
    await click('#panel-toggle');
    const open = await measure();
    check(JSON.stringify(before.room) === JSON.stringify(open.room), name + ' drawer preserves room bounds');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await delay(200);
    check(await evaluate('document.querySelector("#management-panel").hidden && document.activeElement.id === "panel-toggle"'), name + ' Escape closes drawer and restores focus');
  }
  check(errors.length === 0, 'no runtime exceptions', { errors });
} catch (error) {
  check(false, 'browser QA completed', { error: String(error.stack || error) });
} finally {
  const report = { checks, errors, shots, failed: checks.filter(c => !c.pass) };
  fs.writeFileSync(dir + '/results.json', JSON.stringify(report, null, 2));
  console.log('QA_SUMMARY ' + JSON.stringify({ total: checks.length, failed: report.failed, shots }));
  await send('Browser.close', {}, null).catch(() => {});
  await delay(500);
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  if (report.failed.length) process.exitCode = 1;
}
