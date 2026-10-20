export default async ({ ev, delay, screenshot, click, clickText }) => {
  // Shortest path to the open shop with the guide still showing.
  for (let i = 0; i < 3; i++) { await click('.onboard-overlay [data-next]'); await delay(300); }
  await click('.onboard-overlay [data-next]'); await delay(700);
  await screenshot('01-opening-summary');
  console.log('opening:', await ev(`document.querySelector('.onboard-overlay p')?.innerText`));
  await click('.onboard-overlay [data-next]'); await delay(1000);
  await ev(`document.querySelector('.first-service [data-guide-action="next"]').click()`); await delay(700);
  await clickText('button', 'Stock checked · Choose menu →'); await delay(600);
  await clickText('button', 'Menu confirmed · Review opening →'); await delay(700);
  await clickText('button', 'Start day 1'); await delay(1200);
  await ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='4×')?.click()`);
  await delay(9000);
  await screenshot('02-service');
  console.log(await ev(`(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.right), Math.round(b.bottom)]; };
    const g = document.querySelector('.first-service'), gb = g.getBoundingClientRect();
    const overlaps = [...document.querySelectorAll('body *')].filter((e) => {
      if (!e.getClientRects().length || g.contains(e) || e.contains(g)) return false;
      if (e.closest('#management-panel')) return false;
      const b = e.getBoundingClientRect();
      return b.width && b.height && b.left < gb.right && b.right > gb.left && b.top < gb.bottom && b.bottom > gb.top;
    }).map((e) => (e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]));
    return JSON.stringify({ guide: box('.first-service'), status: box('#operation-status'), overlaps: [...new Set(overlaps)] });
  })()`));
};
