// TEMPORARY verification driver — deleted after the check.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL = 'http://localhost:5173/';
const W = Number(process.env.PLAY_W || 1280);
const H = Number(process.env.PLAY_H || 800);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--remote-debugging-pipe', '--user-data-dir=' + profile, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', '--no-sandbox', '--disable-gpu-sandbox',
  '--disable-crashpad', '--disable-dev-shm-usage', '--window-size=' + W + ',' + H,
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let seq = 0, buffer = '', session;
const waiting = new Map(), errors = [];
chrome.stdio[4].on('data', (b) => {
  buffer += b.toString(); let i;
  while ((i = buffer.indexOf('\0')) >= 0) {
    const raw = buffer.slice(0, i); buffer = buffer.slice(i + 1);
    if (!raw) continue;
    const msg = JSON.parse(raw);
    if (msg.id && waiting.has(msg.id)) { const p = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
  }
});
const send = (method, params = {}, sid = session) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }) + '\0'); });
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) throw Error(String(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)).slice(0, 400));
  return r.result.value;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('artifacts/verify', { recursive: true });
const click = async (sel, index = 0) => {
  const p = await ev(`(()=>{const es=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length);const e=es[${index}];if(!e)throw Error('missing ${sel}');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await delay(250);
};
const clickText = async (sel, text) => { const ok = await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.innerText.trim()===${JSON.stringify(text)}&&x.getClientRects().length);if(!e)return false;e.click();return true;})()`); await delay(400); return ok; };
const screenshot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join('artifacts/verify', name + '.png'), Buffer.from(r.data, 'base64')); console.log('shot', name); };

(async () => {
  try {
    const target = await send('Target.createTarget', { url: 'about:blank' }, null);
    session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
    await send('Runtime.enable'); await send('Page.enable');
    const mobile = process.env.PLAY_MOBILE === '1';
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Page.navigate', { url: URL });
    for (let i = 0; i < 150; i++) { await delay(200); try { if (await ev('document.body.classList.contains("ready")')) break; } catch {} }
    await delay(700);
    const mod = await import('file://' + path.resolve(process.argv[2]));
    await mod.default({ ev, send, delay, screenshot, click, clickText, W, H });
    if (errors.length) console.log('PAGE ERRORS', JSON.stringify(errors.map((e) => e.exception?.description ?? e.text).slice(0, 3)));
  } catch (e) { console.error('DRIVER', e); }
  finally { try { chrome.kill(); } catch {} process.exit(0); }
})();
