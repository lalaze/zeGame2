import { containDialogFocus } from './dialog-focus';

export interface ModalButton {
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ModalOptions {
  title: string;
  body: string | Node;
  buttons: ModalButton[];
  icon?: string;
  /** Text-only long dialogs need a keyboard-scrollable body within the focus trap. */
  focusableBody?: boolean;
}

let open: HTMLElement | null = null;
let releaseFocus: (() => void) | null = null;
let titleId = 0;

export const isModalOpen = () => open !== null;

export function closeModal(): void {
  open?.remove();
  open = null;
  const release = releaseFocus;
  releaseFocus = null;
  release?.();
}

export function showModal(opts: ModalOptions): void {
  closeModal();
  const root = document.getElementById('modal-root')!;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal pixel-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');

  const title = document.createElement('h2');
  title.id = `modal-title-${++titleId}`;
  box.setAttribute('aria-labelledby', title.id);
  if (opts.icon) {
    const img = document.createElement('img');
    img.src = opts.icon;
    img.alt = '';
    img.className = 'modal-icon';
    title.append(img);
  }
  title.append(opts.title);
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (opts.focusableBody) {
    body.tabIndex = 0;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', title.id);
  }
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else body.append(opts.body);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  for (const b of opts.buttons) {
    const btn = document.createElement('button');
    btn.className = 'pixel-btn' + (b.primary ? '' : b.danger ? ' danger' : ' ghost');
    btn.textContent = b.label;
    btn.disabled = b.disabled ?? false;
    btn.addEventListener('click', () => {
      if (open !== overlay) return;
      closeModal();
      b.onClick?.();
    });
    actions.append(btn);
  }

  box.append(title, body, actions);
  overlay.append(box);
  root.append(overlay);
  open = overlay;
  releaseFocus = containDialogFocus(box, overlay);
}

let toastTimer = 0;
export function toast(message: string): void {
  const el = document.getElementById('toast')!;
  el.textContent = message;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 2600);
}
