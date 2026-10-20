export default async ({ ev, delay, screenshot, click, send }) => {
  for (let i = 0; i < 3; i++) { await click('.onboard-overlay [data-next]'); await delay(300); }
  await click('.onboard-overlay [data-next]'); await delay(700);
  await click('.onboard-overlay [data-next]'); await delay(900);
  // Seed a long late-game menu: Chai Latte, Lemon Black Tea and Americano on the first page.
  await ev(`(() => {
    const raw = localStorage.getItem('tiny-bean-cafe/save'); if (!raw) return 'none';
    const s = JSON.parse(raw);
    s.coins = 90000; s.day = 14; s.kitchen = false; s.phase = 'prep';
    s.items = { ...s.items, chai: 30, lemontea: 25, americano: 6 };
    s.onMenu = ['chai', 'lemontea', 'americano'];
    s.pantry = { ...s.pantry, beans: 400, milk: 400, tea: 400, spices: 300, fruit: 300, sugar: 300 };
    localStorage.setItem('tiny-bean-cafe/save', JSON.stringify(s));
    return 'seeded';
  })()`);
  await send('Page.reload');
  for (let i = 0; i < 120; i++) { await delay(250); if (await ev('document.body.classList.contains("ready")')) break; }
  await delay(2000);
  await screenshot('b-01-board');
  console.log('PROBE', await ev(`JSON.stringify((globalThis.__SIGN||[]).filter(e=>'label' in e).slice(-4))`));
  console.log(await ev(`JSON.stringify((globalThis.__SIGN||[]).slice(-12).map(e=>({t:e.text,w:Math.round(e.width),h:e.height,s:e.scale})))`));
};
