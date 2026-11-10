// Scratch QA: put chosen customers into the real game and screenshot them walking and seated.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const URL_ = process.env.QA_URL ?? 'http://127.0.0.1:5199/?qa-light=10', OUT = process.env.QA_OUT ?? '/tmp/zg-qa/shots';
const IDS = (process.env.QA_IDS ?? '0,19,31,1').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-qa-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-pipe', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--no-proxy-server'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let seq = 0, buffer = '', session; const waiting = new Map(), errors = [];
chrome.stdio[4].on('data', b => { buffer += b.toString(); let i; while ((i = buffer.indexOf('\0')) >= 0) { const raw = buffer.slice(0, i); buffer = buffer.slice(i + 1); if (!raw) continue; const msg = JSON.parse(raw);
  if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.reject(Error(JSON.stringify(msg.error))) : w.resolve(msg.result); }
  else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' ')); } });
const send = (method, params = {}, sid = session) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }) + '\0'); });
const ev = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value; };
const delay = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')); };
try {
  const target = await send('Target.createTarget', { url: 'about:blank' }, null); session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 200; i++) { await delay(300); if (await ev('!!document.querySelector(".onboard [data-next]")')) break; }
  for (let i = 0; i < 2; i++) { await ev('document.querySelector(".onboard [data-next]").click()'); await delay(100); }
  await ev('document.querySelector("[data-cozy-owner-preset]").click()'); await delay(200);
  for (let i = 0; i < 3; i++) { await ev('document.querySelector(".onboard [data-next]")?.click()'); await delay(150); }
  await ev(`(async()=>{const {Sim}=await import('/src/game/sim.ts');const original=Sim.prototype.update;Sim.prototype.update=function(state,dt){window.cafeQA={sim:this,state};return window.freezeCafeQA?[]:original.call(this,state,dt);};})()`);
  for (let i = 0; i < 40 && !(await ev('!!window.cafeQA')); i++) await delay(250);
  const visible = () => ev('JSON.stringify([...document.querySelectorAll("button")].filter(b=>b.offsetParent).map(b=>b.textContent.trim().slice(0,28)))');
  const click = text => ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.offsetParent).find(b=>b.textContent.includes(${JSON.stringify(text)}));if(b)b.click();return !!b;})()`);
  for (const text of (process.env.QA_CLICKS ?? 'Stock checked').split('|')) { console.log('CLICK ' + text + ' ' + await click(text)); await delay(500); console.log('  NOW ' + await visible()); }
  await shot('debug');
  console.log('PHASE ' + await ev('window.cafeQA?.state.phase'));
  const info = await ev(`(async()=>{window.freezeCafeQA=true;const {sim,state}=window.cafeQA;const layout=await import('/src/game/layout.ts');window.qaLayout=layout;sim.customers.length=0;sim.queue=[];sim.seats.fill(null);
    const ids=${JSON.stringify(IDS)};window.guests=[];
    for(const id of ids){sim.customerCast.restore({remaining:[id],previous:-1});sim.spawn(state);const c=sim.customers.at(-1);window.guests.push(c);}
    return window.guests.map(c=>c.appearanceId);})()`);
  console.log('SPAWNED ' + JSON.stringify(info));
  const dirs = ['right', 'left', 'down', 'up'];
  for (const [n, stride] of [1, 5, 8, 11, 15, 18].entries()) {
    await ev(`(()=>{const dirs=${JSON.stringify(dirs)};guests.forEach((c,i)=>{const d=dirs[(i+${n})%4],x=70+i*62,y=205;Object.assign(c,{x,y,tx:x+(d==='right'?20:d==='left'?-20:0),ty:y+(d==='down'?20:d==='up'?-20:0),phase:'queue',via:[],journey:[],stride:${stride},seat:null});});})()`);
    await delay(250); await shot('walk-' + n);
  }
  // Seat the first two at table 0, the next two at table 1, then make them pet.
  await ev(`(()=>{const {sim}=cafeQA;sim.seats.fill(null);guests.forEach((c,i)=>{const table=Math.floor(i/2),side=i%2,seat=table*2+side;const p=qaLayout.seatSpot(table,side);Object.assign(c,{...p,tx:p.x,ty:p.y,phase:'sitting',seat,dineIn:true,hasCup:true,stride:0});sim.seats[seat]=c.id;});})()`);
  await delay(400); await shot('seated');
  console.log('GUESTS ' + JSON.stringify(await ev('guests.map(c=>({id:c.appearanceId,phase:c.phase,seat:c.seat,x:c.x,y:c.y}))')));
  console.log('RUNTIME_ERRORS ' + JSON.stringify(errors.slice(0, 5)));
} catch (e) { console.log('QA_ERROR ' + e.stack); process.exitCode = 1; }
finally { await send('Browser.close', {}, null).catch(() => {}); await Promise.race([new Promise(r => chrome.once('exit', r)), delay(2000)]); if (chrome.exitCode === null) chrome.kill('SIGTERM'); fs.rmSync(profile, { recursive: true, force: true }); }
