// Art-grid visual QA: renders every room of the live café at an exact even scale in an
// isolated headless Chrome profile and saves full-room captures plus 3× close-ups.
// No game save is read or written.
//
//   node scripts/art-grid-qa.mjs [--base=http://127.0.0.1:5173] [--out=artifacts/art-grid]
//                                [--backing=4] [--light=10.5] [--locale=zh|en] [--style=cream|mint|rose]
//
// Requires a running dev server (npm run dev) and Google Chrome.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const option = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = option('base', 'http://127.0.0.1:5173');
const out = option('out', 'artifacts/art-grid');
const backing = Number(option('backing', '4'));
const light = option('light', '10.5');
const locale = option('locale', 'zh');
const style = option('style', 'cream');
if (!['cream', 'mint', 'rose'].includes(style)) throw new Error('--style must be cream, mint or rose');
const chromePath = option('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
fs.mkdirSync(out, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'art-grid-qa-'));
const chrome = spawn(chromePath, ['--headless', '--remote-debugging-pipe', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let sequence = 0, buffer = '', session;
const pending = new Map(), errors = [], shots = [];
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
const send = (method, params = {}, target = session) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject });
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function shot(name, clip) {
  const result = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  const file = path.join(out, name + '.png');
  fs.writeFileSync(file, Buffer.from(result.data, 'base64')); shots.push(file);
}

const W = 320 * backing, H = 240 * backing;
// Close-ups in room pixels, enlarged three times on top of the stage scale.
const closeUps = {
  main: { counter: [64, 40, 120, 70], window: [10, 4, 90, 76], tables: [60, 128, 90, 60], entry: [110, 186, 100, 54] },
  kitchen: { left: [0, 10, 160, 100], right: [160, 10, 160, 100] },
  reading: { corner: [0, 0, 140, 120] },
  greenhouse: { corner: [0, 0, 140, 120] },
  terrace: { corner: [0, 0, 140, 120] },
};
try {
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/scripts/art-grid-fixture.html?backing=${backing}&qa-light=${light}&locale=${locale}&style=${style}` });
  for (let i = 0; i < 200; i++) { if (await evaluate('document.body.dataset.ready')) break; await delay(200); }
  if (await evaluate('document.body.dataset.ready') !== 'true') throw new Error('fixture failed: ' + await evaluate('document.querySelector("#status").textContent'));
  for (const [room, crops] of Object.entries(closeUps)) {
    await evaluate(`qa.view.moveToArea(${JSON.stringify(room)}, true)`); await delay(2200);
    await shot(`${room}-full`);
    for (const [name, [x, y, w, h]] of Object.entries(crops))
      await shot(`${room}-${name}`, { x: x * backing, y: y * backing, width: w * backing, height: h * backing, scale: 3 });
  }
  const report = { base, backing, light, locale, style, shots, errors: errors.map(e => JSON.stringify(e).slice(0, 400)) };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log('ART_GRID_QA ' + JSON.stringify({ shots: shots.length, errors: errors.length, out }));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  console.error('ART_GRID_QA failed', error.stack || error); process.exitCode = 1;
} finally {
  await send('Browser.close', {}, null).catch(() => {}); await delay(400);
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  fs.rmSync(profile, { recursive: true, force: true });
}
