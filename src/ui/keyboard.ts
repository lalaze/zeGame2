/** Native controls own their keys; game-wide shortcuts must not steal them. */
export function usesNativeKeyboard(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(
    'button, input, textarea, select, a[href], summary, [contenteditable]:not([contenteditable="false"]), ' +
    '[role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], ' +
    '[role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="tab"]',
  );
}

export function isComposingKey(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}
