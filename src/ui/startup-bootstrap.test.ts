// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startupLoading } from './startup-loading';
const html = readFileSync('index.html', 'utf8');
function setup() {
  const page = new DOMParser().parseFromString(html, 'text/html');
  page.querySelectorAll('script').forEach(script => { script.removeAttribute('src'); script.type = 'application/json'; });
  document.body.innerHTML = page.body.innerHTML;
  const source = document.getElementById('loader-bootstrap')!.textContent!;
  new Function(source)();
  return { root: document.getElementById('loader')!, bar: document.querySelector('progress')!, retry: document.querySelector<HTMLButtonElement>('[data-loading-retry]')! };
}
afterEach(() => { window.dispatchEvent(new Event('cafe:loader-owned')); vi.useRealTimers(); localStorage.clear(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
describe('pre-module startup feedback', () => {
  it.each(['zh', 'en'])('uses the saved %s language before the main bundle is ready', locale => {
    localStorage.setItem('tiny-bean-cafe/locale', locale);
    const { root, bar } = setup();
    expect(root.lang).toBe(locale === 'zh' ? 'zh-CN' : 'en');
    expect(root.querySelector('[data-loading-status]')!.textContent).toBe(locale === 'zh' ? '正在准备咖啡馆…' : 'Preparing your café…');
    expect(bar.hasAttribute('value')).toBe(false);
    expect(root.querySelector('[data-loading-percent]')!.textContent).toBe('');
  });
  it('falls back to browser language when preference storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    const { root } = setup();
    expect(root.lang).toBe('zh-CN');
    expect(root.querySelector('[data-loading-step=boot]')!.textContent).toBe('启动');
  });
  it('keeps progress indeterminate and offers retry after a long wait, without faking failure or completion', () => {
    vi.useFakeTimers(); const {root,bar,retry}=setup();
    vi.advanceTimersByTime(21000);
    expect(bar.hasAttribute('value')).toBe(false);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('[role=alert]')).toBeNull();
    expect(retry.hidden).toBe(false);
    expect(root.textContent).toContain('Still waiting');
  });
  it('reports an actual entry module failure and exposes retry', () => {
    const {root,bar,retry}=setup();
    document.getElementById('game-entry')!.dispatchEvent(new Event('error'));
    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(bar.hidden).toBe(true);
    expect(retry.hidden).toBe(false);
    expect(document.activeElement).toBe(retry);
    expect(root.textContent).toContain('dependency unavailable');
  });
  it('hands off cleanly and displays actual measured resource progress', () => {
    vi.useFakeTimers(); const {root,bar,retry}=setup();
    window.dispatchEvent(new Event('cafe:bootstrap-ready'));
    const loading=startupLoading(root,true,vi.fn());
    loading.progress(25,100);
    vi.advanceTimersByTime(25000);
    expect(bar.value).toBe(25); expect(bar.max).toBe(100);
    expect(retry.hidden).toBe(true);
    expect(root.textContent).toContain('25%');
    loading.progress(80,100); expect(bar.value).toBe(80);
    loading.complete(); expect(root.getAttribute('aria-busy')).toBe('false');
  });
});
