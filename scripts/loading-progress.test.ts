// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startupLoading } from '../src/ui/startup-loading';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function setup(chinese = true) {
  const root = document.getElementById('loader')!;
  const retry = vi.fn();
  const loading = startupLoading(root, chinese, retry);
  return {
    root, retry, loading,
    bar: root.querySelector<HTMLProgressElement>('progress')!,
    status: root.querySelector<HTMLElement>('[data-loading-status]')!,
    count: root.querySelector<HTMLElement>('[data-loading-count]')!,
    button: root.querySelector<HTMLButtonElement>('button')!,
  };
}
beforeEach(() => {
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<div id="app">'));
});
describe('first-entry resource progress', () => {
  it('exists before JavaScript and does not invent a percentage', () => {
    const bar = document.querySelector('progress')!;
    expect(bar.hasAttribute('value')).toBe(false);
    expect(document.querySelector('[data-loading-status]')?.textContent).toContain('Loading');
    const { root } = setup();
    expect(root.querySelectorAll('progress')).toHaveLength(1);
    expect(root.getAttribute('aria-busy')).toBe('true');
  });
  it('reports actual image counts and waits for scene readiness', () => {
    const { root, loading, bar, count, status } = setup();
    loading.progress(3, 12);
    expect(bar.max).toBe(12);
    expect(bar.value).toBe(3);
    expect(count.textContent).toBe('25% · 3 / 12');
    expect(bar.getAttribute('aria-valuetext')).toContain('25%');
    loading.progress(12, 12);
    expect(status.textContent).toContain('正在准备场景');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(document.body.classList.contains('ready')).toBe(false);
    loading.complete();
    expect(status.textContent).toBe('咖啡馆已就绪');
    expect(root.getAttribute('aria-busy')).toBe('false');
  });
  it('ignores unknown totals and clamps out-of-range completed counts', () => {
    const { loading, bar, count } = setup(false);
    loading.progress(0, 0);
    loading.progress(NaN, 12);
    expect(bar.hasAttribute('value')).toBe(false);
    loading.progress(-1, 12);
    expect(bar.value).toBe(0);
    loading.progress(15, 12);
    expect(count.textContent).toBe('100% · 12 / 12');
  });
  it('keeps failure visible and allows only one retry activation', () => {
    const { loading, bar, count, status, button, retry, root } = setup(false);
    loading.progress(2, 12);
    loading.fail(new Error('Image unavailable'));
    loading.progress(12, 12);
    loading.complete();
    expect(status.getAttribute('role')).toBe('alert');
    expect(status.textContent).toContain('could not finish');
    expect(bar.hidden).toBe(true);
    expect(count.hidden).toBe(true);
    expect(root.querySelector('.loader-detail')?.textContent).toBe('Image unavailable');
    expect(button.hidden).toBe(false);
    expect(document.activeElement).toBe(button);
    button.click();
    button.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
