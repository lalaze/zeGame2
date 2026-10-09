// The boss key: instantly swaps the game for a boring-looking spreadsheet,
// including the tab title and favicon.

import { getLocale, t, tList } from '../i18n';

const SHEET_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#1e7145"/><path d="M4 4h8v8H4z" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M4 8h8M8 4v8" stroke="#fff" stroke-width="1.2"/></svg>',
  );

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

function fakeNumber(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return Math.round((x - Math.floor(x)) * 90000 + 10000);
}

// A Chinese office sheet would be in yuan, an English one in dollars.
const money = (n: number) =>
  getLocale() === 'zh'
    ? n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 })
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class BossMode {
  active = false;
  private savedTitle = document.title;
  private favicon = document.getElementById('favicon') as HTMLLinkElement | null;
  private savedFavicon = this.favicon?.href ?? '';
  private secretCell!: HTMLElement;

  constructor(
    private root: HTMLElement,
    private app: HTMLElement,
    private onChange: (active: boolean) => void,
  ) {
    this.build();
  }

  /** Re-renders the sheet, e.g. after the language changes. */
  build(): void {
    const [deptHeader, ...numberHeaders] = tList('boss.headers').map(escape);
    const rows: string[] = [];
    rows.push(
      `<tr><th></th>${COLS.map((c) => `<th>${c}</th>`).join('')}</tr>`,
      `<tr><th>1</th><td class="b">${deptHeader}</td>${numberHeaders.map((h) => `<td class="b r">${h}</td>`).join('')}<td></td><td></td><td></td></tr>`,
    );
    const departments = tList('boss.departments').map(escape);
    departments.forEach((dept, i) => {
      const q = [1, 2, 3, 4].map((k) => fakeNumber(i * 7 + k));
      const total = q.reduce((a, b) => a + b, 0);
      const budget = Math.round(total * (0.9 + (fakeNumber(i) % 20) / 100));
      const variance = budget - total;
      rows.push(
        `<tr><th>${i + 2}</th><td>${dept}</td>${q.map((v) => `<td class="r">${money(v)}</td>`).join('')}` +
          `<td class="r">${money(total)}</td><td class="r">${money(budget)}</td>` +
          `<td class="r ${variance < 0 ? 'neg' : ''}">${money(variance)}</td><td></td><td></td><td></td></tr>`,
      );
    });
    const n = departments.length + 2;
    rows.push(
      `<tr><th>${n}</th><td class="b">${escape(t('boss.revenue'))}</td><td class="r" data-secret></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
    );
    for (let i = n + 1; i < n + 16; i++) rows.push(`<tr><th>${i}</th>${COLS.map(() => '<td></td>').join('')}</tr>`);

    this.root.innerHTML = `
      <div class="xl-title"><span class="xl-logo"></span>${escape(t('boss.file'))} — ${escape(t('boss.saved'))}</div>
      <div class="xl-ribbon">
        ${tList('boss.ribbon').map((r, i) => `<span${i === 0 ? ' class="on"' : ''}>${escape(r)}</span>`).join('')}
      </div>
      <div class="xl-tools">
        <span class="tool">${escape(t('boss.font'))}</span><span class="tool">11</span><span class="tool b">B</span><span class="tool"><i>I</i></span>
        <span class="tool"><u>U</u></span><span class="sep"></span><span class="tool">${getLocale() === 'zh' ? '¥' : '$'}</span><span class="tool">%</span><span class="tool">.00</span>
        <span class="sep"></span><span class="tool">${escape(t('boss.autosum'))}</span><span class="tool">${escape(t('boss.sort'))}</span>
      </div>
      <div class="xl-formula"><span class="ref">F8</span><span class="fx">fx</span><span>=SUM(B8:E8)</span></div>
      <div class="xl-grid"><table>${rows.join('')}</table></div>
      <div class="xl-sheets">
        ${tList('boss.sheets').map((s, i) => `<span${i === 0 ? ' class="on"' : ''}>${escape(s)}</span>`).join('')}<span data-return title="${escape(t('boss.return'))}">Sheet4</span><span class="add">+</span>
      </div>`;
    this.secretCell = this.root.querySelector('[data-secret]')!;
    this.root.querySelector('[data-return]')!.addEventListener('click', () => this.toggle(false));
    this.root.querySelector('.xl-grid tr:nth-child(9) td:nth-child(7)')?.classList.add('sel');
  }

  update(coins: number): void {
    if (this.active) this.secretCell.textContent = money(Math.floor(coins));
  }

  toggle(force?: boolean): void {
    const next = force ?? !this.active;
    if (next === this.active) return;
    this.active = next;
    this.root.hidden = !next;
    this.app.hidden = next;
    document.body.classList.toggle('boss', next);
    if (next) {
      this.savedTitle = document.title;
      document.title = t('boss.file');
      if (this.favicon) this.favicon.href = SHEET_FAVICON;
    } else {
      document.title = this.savedTitle;
      if (this.favicon) this.favicon.href = this.savedFavicon;
    }
    this.onChange(next);
  }
}
