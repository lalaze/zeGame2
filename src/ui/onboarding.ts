// The opening flow: name the café, create the owner, pick a starter style.
// Also reused (name + character only) when editing the profile later.
import { STARTER_THEMES } from '../game/decor';
import { LOOK_RANGES, NAME_MAX, cleanName, type Look, type Profile } from '../game/state';
import { LOCALES, getLocale, setLocale, t, tList, type Locale, type MessageKey } from '../i18n';
import { paintCounter, paintFloor, paintWainscot, paintWall } from '../render/decor-art';
import { HAIRS, HEAD_ROWS, SHIRTS, SKINS, character } from '../render/sprites';

import { containDialogFocus, focusDialog } from './dialog-focus';
import { isComposingKey } from './keyboard';

let dismissOnboarding: (() => void) | null = null;
let headingId = 0;

type Step = 'welcome' | 'name' | 'character' | 'style' | 'opening';

export interface OnboardingResult {
  profile: Profile;
  /** Only set for a brand-new café. */
  theme?: string;
}

interface Options {
  mode: 'new' | 'edit';
  initial?: Profile | null;
  onLocale: (locale: Locale) => void;
  onDone: (result: OnboardingResult) => void;
  onCancel?: () => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const randomOf = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function randomLook(): Look {
  return Object.fromEntries(
    (Object.keys(LOOK_RANGES) as (keyof Look)[]).map((k) => [k, Math.floor(Math.random() * LOOK_RANGES[k])]),
  ) as unknown as Look;
}

function scaledSprite(sprite: HTMLCanvasElement, scale: number, className: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  c.getContext('2d')!.drawImage(sprite, 0, 0);
  c.className = className;
  c.style.width = `${sprite.width * scale}px`;
  c.style.height = `${sprite.height * scale}px`;
  return c;
}

function themePreview(themeId: string): HTMLCanvasElement {
  const theme = STARTER_THEMES.find((th) => th.id === themeId)!;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  paintWall(ctx, theme.equip.wallpaper!, 0, 0, 48, 15);
  paintWainscot(ctx, theme.equip.wallpaper!, 0, 16, 48, 5);
  paintFloor(ctx, theme.equip.floor!, 0, 21, 48, 11);
  paintCounter(ctx, theme.equip.counter!, 4, 17, 26, 3, 9);
  c.className = 'theme-preview';
  return c;
}

export function showOnboarding(opts: Options): void {
  dismissOnboarding?.();
  const steps: Step[] = opts.mode === 'new' ? ['welcome', 'name', 'character', 'style', 'opening'] : ['name', 'character'];
  const draft = {
    cafeName: opts.initial?.cafeName ?? randomOf(tList('ob.names')),
    ownerName: opts.initial?.ownerName ?? '',
    look: opts.initial ? { ...opts.initial.look } : randomLook(),
    theme: STARTER_THEMES[0].id,
  };
  let index = 0;

  const overlay = document.createElement('div');
  overlay.className = 'onboard-overlay';
  const card = document.createElement('div');
  card.className = 'onboard pixel-box';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  overlay.append(card);
  document.body.append(overlay);

  let closed = false;
  let releaseFocus: (() => void) | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    releaseFocus?.();
    dismissOnboarding = null;
    document.removeEventListener('keydown', onKey, true);
  };
  const finish = () => {
    if (closed) return;
    close();
    opts.onDone({
      profile: { cafeName: cleanName(draft.cafeName) || tList('ob.names')[0], ownerName: cleanName(draft.ownerName), look: draft.look },
      theme: opts.mode === 'new' ? draft.theme : undefined,
    });
  };
  const next = () => {
    if (closed) return;
    if (steps[index] === 'name' && !cleanName(draft.cafeName)) {
      card.querySelector<HTMLInputElement>('#cafe-name')?.focus();
      return;
    }
    if (index === steps.length - 1) finish();
    else {
      index++;
      render();
    }
  };
  const back = () => {
    if (closed) return;
    if (index === 0) {
      close();
      opts.onCancel?.();
    } else {
      index--;
      render();
    }
  };
  // Enter advances; captured so the game's own shortcuts don't fire underneath.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !card.contains(document.activeElement) || isComposingKey(e)) return;
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    // Let focused buttons activate themselves (Back, locale, appearance, etc.).
    if (e.target instanceof Element && e.target.closest('button, a[href], select, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    next();
  };
  document.addEventListener('keydown', onKey, true);

  function render(): void {
    const step = steps[index];
    const dots = steps.map((_, i) => `<i class="${i === index ? 'on' : i < index ? 'done' : ''}"></i>`).join('');
    const isLast = index === steps.length - 1;
    const nextLabel =
      opts.mode === 'edit' && isLast ? t('ob.save') : step === 'opening' ? t('ob.open.button') : step === 'welcome' ? t('ob.start') : t('ob.next');
    const backLabel = index === 0 ? (opts.mode === 'edit' ? t('ob.cancel') : '') : t('ob.back');
    card.innerHTML = `
      <div class="ob-dots">${dots}</div>
      <div class="ob-body"></div>
      <div class="ob-actions">
        ${backLabel ? `<button class="pixel-btn ghost" data-back>${backLabel}</button>` : ''}
        <button class="pixel-btn" data-next>${nextLabel}</button>
      </div>`;
    const body = card.querySelector<HTMLElement>('.ob-body')!;
    card.querySelector('[data-next]')!.addEventListener('click', next);
    card.querySelector('[data-back]')?.addEventListener('click', back);
    ({ welcome, name, character: characterStep, style, opening })[step](body);
    const heading = body.querySelector('h2');
    if (heading) {
      heading.id = `onboard-title-${++headingId}`;
      card.setAttribute('aria-labelledby', heading.id);
    }
    focusDialog(card);
  }

  function welcome(body: HTMLElement): void {
    body.innerHTML = `
      <img class="ob-logo" src="./icon.svg" alt="" />
      <h2>${t('ob.welcome.title')}</h2>
      <p>${t('ob.welcome.body')}</p>
      <div class="lang-row center">${LOCALES.map(
        (l) => `<button class="chip${l.id === getLocale() ? ' active' : ''}" data-locale="${l.id}">${l.label}</button>`,
      ).join('')}</div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((b) =>
      b.addEventListener('click', () => {
        const locale = b.dataset.locale as Locale;
        // Keep the suggested name in step with the language, unless it was typed.
        const suggestions = tList('ob.names');
        setLocale(locale);
        opts.onLocale(locale);
        if (suggestions.includes(draft.cafeName)) draft.cafeName = randomOf(tList('ob.names'));
        render();
      }),
    );
  }

  function name(body: HTMLElement): void {
    body.innerHTML = `
      <h2>${t('ob.name.title')}</h2>
      <p class="note">${t('ob.name.hint')}</p>
      <div class="name-sign"><span></span></div>
      <div class="input-row">
        <input id="cafe-name" class="pixel-input" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" />
        <button class="pixel-btn ghost small" data-random>${t('ob.random')}</button>
      </div>`;
    const input = body.querySelector<HTMLInputElement>('#cafe-name')!;
    const sign = body.querySelector<HTMLElement>('.name-sign span')!;
    const sync = () => {
      sign.textContent = cleanName(draft.cafeName) || '…';
    };
    input.value = draft.cafeName;
    input.addEventListener('input', () => {
      draft.cafeName = input.value;
      sync();
    });
    body.querySelector('[data-random]')!.addEventListener('click', () => {
      const options = tList('ob.names').filter((n) => n !== draft.cafeName);
      draft.cafeName = input.value = randomOf(options);
      sync();
    });
    sync();
    input.focus();
    input.select();
  }

  function characterStep(body: HTMLElement): void {
    body.innerHTML = `
      <h2>${t('ob.char.title')}</h2>
      <div class="char-layout">
        <div class="char-preview"></div>
        <div class="char-options">
          <div class="opt"><span>${t('ob.char.skin')}</span><div class="swatches" data-key="skin"></div></div>
          <div class="opt"><span>${t('ob.char.style')}</span><div class="swatches styles" data-key="hairStyle"></div></div>
          <div class="opt"><span>${t('ob.char.hair')}</span><div class="swatches" data-key="hair"></div></div>
          <div class="opt"><span>${t('ob.char.apron')}</span><div class="swatches" data-key="shirt"></div></div>
        </div>
      </div>
      <div class="input-row">
        <input id="owner-name" class="pixel-input" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false"
          placeholder="${escapeHtml(t('ob.char.namePlaceholder'))}" />
        <button class="pixel-btn ghost small" data-random>${t('ob.random')}</button>
      </div>`;
    const preview = body.querySelector<HTMLElement>('.char-preview')!;
    const palettes: Partial<Record<keyof Look, string[]>> = { skin: SKINS, hair: HAIRS, shirt: SHIRTS };

    const paint = () => {
      preview.replaceChildren(scaledSprite(character(draft.look, 'owner').stand, 5, 'char-sprite'));
      body.querySelectorAll<HTMLElement>('.swatches').forEach((group) => {
        const key = group.dataset.key as keyof Look;
        group.replaceChildren(
          ...Array.from({ length: LOOK_RANGES[key] }, (_, i) => {
            const b = document.createElement('button');
            b.className = 'swatch' + (draft.look[key] === i ? ' active' : '');
            b.setAttribute('aria-label', `${key} ${i + 1}`);
            const colors = palettes[key];
            if (colors) b.style.background = colors[i];
            else {
              const head = character({ ...draft.look, hairStyle: i }, 'owner').stand;
              const crop = document.createElement('canvas');
              crop.width = head.width;
              crop.height = HEAD_ROWS - 3;
              crop.getContext('2d')!.drawImage(head, 0, 0);
              crop.className = 'swatch-sprite';
              b.append(crop);
            }
            b.addEventListener('click', () => {
              draft.look[key] = i;
              paint();
            });
            return b;
          }),
        );
      });
    };
    const owner = body.querySelector<HTMLInputElement>('#owner-name')!;
    owner.value = draft.ownerName;
    owner.addEventListener('input', () => (draft.ownerName = owner.value));
    body.querySelector('[data-random]')!.addEventListener('click', () => {
      draft.look = randomLook();
      paint();
    });
    paint();
  }

  function style(body: HTMLElement): void {
    body.innerHTML = `
      <h2>${t('ob.style.title')}</h2>
      <p class="note">${t('ob.style.hint')}</p>
      <div class="themes"></div>`;
    const wrap = body.querySelector<HTMLElement>('.themes')!;
    const paint = () => {
      wrap.replaceChildren(
        ...STARTER_THEMES.map((th) => {
          const b = document.createElement('button');
          b.className = 'theme' + (draft.theme === th.id ? ' active' : '');
          b.append(themePreview(th.id));
          const label = document.createElement('span');
          label.textContent = t(`theme.${th.id}` as MessageKey);
          b.append(label);
          b.addEventListener('click', () => {
            draft.theme = th.id;
            paint();
          });
          return b;
        }),
      );
    };
    paint();
  }

  function opening(body: HTMLElement): void {
    const cafe = escapeHtml(cleanName(draft.cafeName));
    const owner = escapeHtml(cleanName(draft.ownerName) || t('ob.char.defaultName'));
    body.innerHTML = `
      <h2>${t('ob.open.title')}</h2>
      <div class="opening-scene">
        <div class="name-sign"><span>${cafe}</span></div>
        <div class="opening-owner"></div>
      </div>
      <p>${t('ob.open.body', { owner, cafe })}</p>`;
    body.querySelector('.opening-owner')!.append(scaledSprite(character(draft.look, 'owner').stand, 6, 'char-sprite'));
  }

  dismissOnboarding = close;
  releaseFocus = containDialogFocus(card, overlay);
  render();
}
