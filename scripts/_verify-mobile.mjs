export default async ({ ev, delay, screenshot, click, clickText, send }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await delay(800);
  for (let i = 0; i < 3; i++) { await click('.onboard-overlay [data-next]'); await delay(300); }
  await click('.onboard-overlay [data-next]'); await delay(700);
  await click('.onboard-overlay [data-next]'); await delay(1000);
  await ev(`document.querySelector('.first-service [data-guide-action="next"]').click()`); await delay(700);
  await clickText('button', 'Stock checked · Choose menu →'); await delay(600);
  await clickText('button', 'Menu confirmed · Review opening →'); await delay(700);
  await clickText('button', 'Start day 1'); await delay(1200);
  await ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='4×')?.click()`);
  await delay(2500);
  await screenshot('m-01-service');
  // Open the management drawer on a phone.
  await ev(`document.querySelector('#panel-toggle').click()`);
  await delay(900);
  await screenshot('m-02-drawer');
  console.log('tabs:', await ev(`JSON.stringify([...document.querySelectorAll('[data-tab]')].map(b=>[b.dataset.tab, !!b.getClientRects().length, b.hidden]))`));
  // Reach Upgrades directly through the drawer's own tab row.
  const ok = await ev(`(()=>{const b=document.querySelector('[data-tab="upgrades"]'); if(!b||b.hidden) return false; b.click(); return true;})()`);
  await delay(700);
  console.log('upgrades reachable:', ok, '| panel tab:', await ev(`document.querySelector('#management-panel .tab.active')?.dataset.tab`));
  await screenshot('m-03-upgrades');
  console.log('error?', await ev(`document.body.innerText.includes('Upgrades')`));
};
