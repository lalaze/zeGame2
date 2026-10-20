export default async ({ ev, delay, screenshot, click, clickText, send }) => {
  for (let i = 0; i < 3; i++) { await click('.onboard-overlay [data-next]'); await delay(300); }
  await click('.onboard-overlay [data-next]'); await delay(700);
  await click('.onboard-overlay [data-next]'); await delay(1000);
  // Inspect the new copy in both locales through the live i18n module.
  const out = await ev(`(async () => {
    const mod = await import('/src/i18n.ts');
    const rows = [];
    for (const loc of ['en', 'zh']) {
      mod.setLocale(loc);
      for (const [key, params] of [
        ['report.partnerJobs', { n: 1 }], ['report.partnerJobs', { n: 2 }],
        ['report.partnerNewStories', { n: 1 }], ['report.partnerNewStories', { n: 3 }],
        ['rating.summary', { n: 1, score: '4.00' }], ['rating.summary', { n: 12, score: '4.20' }],
        ['report.reason.lowStock', { n: 1 }], ['report.reason.lowStock', { n: 2 }],
        ['report.reason.stock', { n: 1, extra: 0 }], ['report.reason.counter', { n: 1, extra: 2 }],
        ['menu.left', { n: 1 }], ['prep.ready', { n: 1 }], ['regular.ui.unread', { n: 1 }],
        ['area.tables', { n: 1 }], ['toast.evicted', { n: 1 }], ['pet.intro', { count: 12, max: 1 }],
      ]) rows.push(loc + ' · ' + key + ' · ' + mod.t(key, params));
    }
    mod.setLocale('en');
    return rows.join('\\n');
  })()`);
  console.log(out);
};
