// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { startupLoading } from './startup-loading';

describe('startup loading feedback', () => {
  it.each([true, false])('shows real progress and exposes one reload on failure (Chinese: %s)', chinese => {
    const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    const root = document.importNode(page.getElementById('loader')!, true);
    expect(root).not.toBeNull();
    document.body.append(root);
    const retry = vi.fn();
    const loading = startupLoading(root, chinese, retry);
    loading.progress(6, 100);
    expect(root.querySelector('progress')!.value).toBe(6);
    expect(root.textContent).toContain('6 / 100');
    loading.progress(100, 100);
    expect(root.textContent).toContain(chinese ? '准备场景' : 'Preparing the scene');
    loading.fail(new Error('Image failed: customer-12'));
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelector('.loader-content .loader-detail')).not.toBeNull();
    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(root.querySelector('progress')!.hidden).toBe(true);
    expect(root.textContent).toContain('Image failed: customer-12');
    const text = root.textContent;
    loading.progress(100, 100);
    loading.fail(new Error('late failure'));
    expect(root.textContent).toBe(text);
    const button = root.querySelector('button')!;
    expect(button.hidden).toBe(false);
    button.click();
    button.click();
    expect(retry).toHaveBeenCalledTimes(1);
    root.remove();
  });
});
