/** Use the inline loader immediately; show measured file progress once its total is known. */
export function startupLoading(root: HTMLElement, chinese: boolean, retry: () => void) {
  let failed = false;
  const status = root.querySelector<HTMLElement>('[data-loading-status]')!;
  const bar = root.querySelector<HTMLProgressElement>('[data-loading-bar]')!;
  const count = root.querySelector<HTMLElement>('[data-loading-count]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-loading-retry]')!;
  bar.setAttribute('aria-label', chinese ? '图片加载进度' : 'Image loading progress');
  button.textContent = chinese ? '重新加载' : 'Reload';
  button.addEventListener('click', () => { button.disabled = true; retry(); });
  root.setAttribute('aria-busy', 'true');
  status.textContent = chinese ? '正在准备资源加载…' : 'Preparing to load assets…';
  return {
    progress(loaded: number, total: number) {
      if (failed || !Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) return;
      const completed = Math.min(total, Math.max(0, loaded));
      // This is the fraction of completed images, not bytes or overall startup time.
      const percent = Math.floor(completed / total * 100);
      bar.max = total;
      bar.value = completed;
      count.textContent = `${percent}% · ${completed} / ${total}`;
      bar.setAttribute('aria-valuetext', chinese
        ? `已加载 ${completed} / ${total} 张图片，${percent}%`
        : `${completed} of ${total} images loaded, ${percent}%`);
      status.textContent = completed === total
        ? (chinese ? '图片已加载，正在准备场景…' : 'Images loaded. Preparing the scene…')
        : (chinese ? '正在加载咖啡馆图片…' : 'Loading café images…');
    },
    complete() {
      if (failed) return;
      root.setAttribute('aria-busy', 'false');
      status.textContent = chinese ? '咖啡馆已就绪' : 'Your café is ready';
    },
    fail(error: unknown) {
      if (failed) return;
      failed = true;
      root.setAttribute('aria-busy', 'false');
      root.querySelector('i')?.remove();
      bar.hidden = true;
      count.hidden = true;
      status.setAttribute('role', 'alert');
      status.textContent = chinese
        ? '咖啡馆未能完成加载。请检查网络，然后重新加载。'
        : 'The café could not finish loading. Check your connection and reload.';
      const detail = document.createElement('small');
      detail.className = 'loader-detail';
      detail.textContent = error instanceof Error ? error.message : String(error);
      root.append(detail);
      button.hidden = false;
      button.focus();
    },
  };
}
