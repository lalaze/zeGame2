/** Use the inline loader immediately; show measured file progress once its total is known. */
export function startupLoading(root: HTMLElement, chinese: boolean, retry: () => void) {
  window.dispatchEvent(new Event('cafe:loader-owned'));
  let failed = false;
  const status = root.querySelector<HTMLElement>('[data-loading-status]')!;
  const bar = root.querySelector<HTMLProgressElement>('[data-loading-bar]')!;
  const count = root.querySelector<HTMLElement>('[data-loading-count]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-loading-retry]')!;
  const percentage = root.querySelector<HTMLElement>('[data-loading-percent]')!;
  const stages = root.querySelector<HTMLElement>('[data-loading-stages]')!;
  const steps = [...root.querySelectorAll<HTMLElement>('[data-loading-step]')];
  root.lang = chinese ? 'zh-CN' : 'en';
  stages.setAttribute('aria-label', chinese ? '加载阶段' : 'Loading stages');
  steps.forEach((item, index) => { item.textContent = (chinese ? ['启动', '加载素材', '布置店铺'] : ['Starting', 'Artwork', 'Scene'])[index]; });
  const stage = (name: 'boot' | 'assets' | 'scene' | 'ready' | 'error') => {
    root.dataset.loadingStage = name;
    const active = ['boot', 'assets', 'scene', 'ready'].indexOf(name);
    stages.hidden = name === 'error';
    steps.forEach((item, index) => {
      item.classList.toggle('done', index < active);
      if (index === active) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  };
  bar.setAttribute('aria-label', chinese ? '图片加载进度' : 'Image loading progress');
  button.textContent = chinese ? '重新加载' : 'Reload';
  button.addEventListener('click', () => { button.disabled = true; retry(); });
  root.setAttribute('aria-busy', 'true');
  status.textContent = chinese ? '正在准备咖啡馆…' : 'Preparing your café…';
  stage('boot');
  return {
    progress(loaded: number, total: number) {
      if (failed || !Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) return;
      const completed = Math.min(total, Math.max(0, loaded));
      // This is the fraction of completed images, not bytes or overall startup time.
      const percent = Math.floor(completed / total * 100);
      bar.max = total;
      bar.value = completed;
      percentage.textContent = `${percent}%`;
      count.textContent = chinese ? `已加载 ${completed} / ${total} 项素材` : `${completed} / ${total} assets loaded`;
      stage(completed === total ? 'scene' : 'assets');
      bar.setAttribute('aria-valuetext', chinese
        ? `已加载 ${completed} / ${total} 张图片，${percent}%`
        : `${completed} of ${total} images loaded, ${percent}%`);
      status.textContent = completed === total
        ? (chinese ? '正在布置店铺…' : 'Preparing the scene…')
        : (chinese ? '正在加载咖啡馆素材…' : 'Loading café artwork…');
    },
    complete() {
      if (failed) return;
      root.setAttribute('aria-busy', 'false');
      stage('ready');
      status.textContent = chinese ? '咖啡馆已就绪' : 'Your café is ready';
    },
    fail(error: unknown) {
      if (failed) return;
      failed = true;
      stage('error');
      percentage.hidden = true;
      root.setAttribute('aria-busy', 'false');
      // aria-busy=false pauses the decorative walk without affecting progress.
      bar.hidden = true;
      count.hidden = true;
      status.setAttribute('role', 'alert');
      status.textContent = chinese
        ? '咖啡馆未能完成加载。请检查网络，然后重新加载。'
        : 'The café could not finish loading. Check your connection and reload.';
      const detail = document.createElement('small');
      detail.className = 'loader-detail';
      detail.textContent = error instanceof Error ? error.message : String(error);
      (root.querySelector('.loader-content') ?? root).append(detail);
      button.hidden = false;
      button.focus();
    },
  };
}
