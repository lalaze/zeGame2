/** Focus and background isolation shared by all blocking dialogs. */
interface Scope { dialog: HTMLElement; overlay: HTMLElement; previous: HTMLElement | null }
const scopes: Scope[] = [];
const isolated = new Map<HTMLElement, boolean>();
const focusSelector = 'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]';

function focusable(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(focusSelector)].filter((el) =>
    el.tabIndex >= 0 && !el.matches(':disabled, input[type="hidden"]') && !el.closest('[hidden], [inert]') &&
    isVisible(el, dialog),
  );
}

function isVisible(element: HTMLElement, dialog: HTMLElement): boolean {
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el === dialog) break;
  }
  return true;
}

export function focusDialog(dialog: HTMLElement): void {
  if (document.activeElement !== dialog && dialog.contains(document.activeElement)) return;
  (focusable(dialog)[0] ?? dialog).focus();
}

function isolate(): void {
  for (const [el, inert] of isolated) el.inert = inert;
  isolated.clear();
  const scope = scopes.at(-1);
  if (!scope) return;
  let branch: HTMLElement = scope.overlay;
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling instanceof HTMLElement && sibling !== branch) {
        isolated.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    if (branch.parentElement === document.body) break;
    branch = branch.parentElement;
  }
}

export function containDialogFocus(dialog: HTMLElement, overlay: HTMLElement): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const scope: Scope = { dialog, overlay, previous };
  dialog.tabIndex = -1;
  scopes.push(scope);
  isolate();
  focusDialog(dialog);
  const isTop = () => scopes.at(-1) === scope;
  const keydown = (event: KeyboardEvent) => {
    if (!isTop() || event.key !== 'Tab') return;
    const items = focusable(dialog);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length || index < 0 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
      event.preventDefault();
      ((event.shiftKey ? items.at(-1) : items[0]) ?? dialog).focus();
    }
  };
  const focusin = () => { if (isTop()) focusDialog(dialog); };
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('focusin', focusin);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const wasTop = isTop();
    scopes.splice(scopes.indexOf(scope), 1);
    // If a lower dialog closes first, keep the original return-focus chain intact.
    for (const remaining of scopes) {
      if (remaining.previous && dialog.contains(remaining.previous)) remaining.previous = scope.previous;
    }
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('focusin', focusin);
    isolate();
    if (wasTop) {
      if (scope.previous?.isConnected && !scope.previous.closest('[inert]')) scope.previous.focus();
      const active = scopes.at(-1);
      if (active) focusDialog(active.dialog);
    }
  };
}
