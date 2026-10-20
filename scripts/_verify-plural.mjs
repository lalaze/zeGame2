export default async ({ ev, delay, screenshot, click, clickText, send }) => {
  // Play one short day, close it, read the settlement partner line.
  for (let i = 0; i < 3; i++) { await click('.onboard-overlay [data-next]'); await delay(300); }
  await click('.onboard-overlay [data-next]'); await delay(700);
  await click('.onboard-overlay [data-next]'); await delay(1000);
  await ev(`document.querySelector('.first-service [data-guide-action="next"]').click()`); await delay(700);
  await clickText('button', 'Stock checked · Choose menu →'); await delay(600);
  await clickText('button', 'Menu confirmed · Review opening →'); await delay(700);
  await clickText('button', 'Start day 1'); await delay(1200);
  await ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='4×')?.click()`);
  await delay(4000);
  await clickText('button', 'Close shop');
  for (let i = 0; i < 80; i++) { await delay(250); if (await ev(`document.body.innerText.includes('settlement')`)) break; }
  await delay(700);
  await screenshot('p-01-settlement');
  console.log('settlement:', (await ev(`document.querySelector('[role="dialog"], .report')?.innerText`) || '').slice(0, 900).replace(/\n+/g, ' | '));
  // A one-star review summary uses the new plural form too.
  console.log('rating:', await ev(`(() => { const t = document.querySelector('#reputation-btn')?.innerText || ''; return t.replace(/\\n+/g,' '); })()`));
};
