import { referenceCharacterContacts } from '../render/reference-character-art';
import { COZY_OWNER_LOOK } from '../render/cozy-character-art';
// The opening flow: name the café, create the owner, pick a starter style.
// Also reused (name + character only) when editing the profile later.
import { STARTER_THEMES } from '../game/decor';
import { LOOK_RANGES, NAME_MAX, cleanName, type Look, type Profile } from '../game/state';
import { LOCALES, getLocale, setLocale, t, tList, type Locale, type MessageKey } from '../i18n';
import { starterThemePreview } from '../render/starter-theme-preview';
import { HAIRS, HEAD_ROWS, SHIRTS, SKINS, character } from '../render/sprites';

import { containDialogFocus, focusDialog } from './dialog-focus';
import { isComposingKey } from './keyboard';
import { createGeneratedOwnerPreview } from './generated-owner-preview';

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
  let releasePreview: (() => void) | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    releasePreview?.();
    releasePreview = undefined;
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
    releasePreview?.();
    releasePreview = undefined;
    const step = steps[index];
    card.classList.toggle('ob-style', step === 'style');
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
    const preset = document.createElement('button');
    preset.className = 'pixel-btn ghost small';
    preset.dataset.cozyOwnerPreset = 'true';
    preset.textContent = getLocale() === 'zh' ? '使用样板店主造型' : 'Use cozy owner look';
    body.querySelector('.char-options')!.append(preset);
    const preview = body.querySelector<HTMLElement>('.char-preview')!;
    const ownerPreview = createGeneratedOwnerPreview(draft.look, 5);
    preview.append(ownerPreview.canvas);
    releasePreview = ownerPreview.dispose;
    const palettes: Partial<Record<keyof Look, string[]>> = { skin: SKINS, hair: HAIRS, shirt: SHIRTS };
    // Screen readers hear the visible group name ("Apron 3"), never the save-format key.
    const groupLabels: Partial<Record<keyof Look, string>> = { skin: t('ob.char.skin'), hairStyle: t('ob.char.style'), hair: t('ob.char.hair'), shirt: t('ob.char.apron') };

    const paint = (repaintOwner = true) => {
      if (repaintOwner) ownerPreview.update(draft.look);
      body.querySelectorAll<HTMLElement>('.swatches').forEach((group) => {
        const key = group.dataset.key as keyof Look;
        const label = groupLabels[key] ?? key;
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', label);
        group.replaceChildren(
          ...Array.from({ length: LOOK_RANGES[key] }, (_, i) => {
            const b = document.createElement('button');
            b.className = 'swatch' + (draft.look[key] === i ? ' active' : '');
            b.setAttribute('aria-label', `${label} ${i + 1}`);
            b.setAttribute('aria-pressed', String(draft.look[key] === i));
            const colors = palettes[key];
            if (colors) b.style.background = colors[i];
            else {
              const head = character({ ...draft.look, hairStyle: i }, 'owner').stand;
              const crop = document.createElement('canvas');
              crop.width = head.width;
              const contact=referenceCharacterContacts(head);
              crop.height = Math.ceil(contact?.headHeight ?? HEAD_ROWS - 3);
              const headY=contact?.head?.y ?? 0;
              crop.getContext('2d')!.drawImage(head, 0, -headY);
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
    preset.addEventListener('click', () => { draft.look = { ...COZY_OWNER_LOOK }; paint(); });
    paint(false);
  }

  function style(body: HTMLElement): void {
    body.innerHTML = `
      <h2>${t('ob.style.title')}</h2>
      <p class="note">${t('ob.style.hint')}</p>
      <div class="themes"></div>`;
    const wrap = body.querySelector<HTMLElement>('.themes')!;
    const previews = new Map(STARTER_THEMES.map(th => [th.id, starterThemePreview(th.id)]));
    const paint = () => {
      wrap.replaceChildren(
        ...STARTER_THEMES.map((th) => {
          const b = document.createElement('button');
          b.className = 'theme' + (draft.theme === th.id ? ' active' : '');
          b.type = 'button';
          b.dataset.theme = th.id;
          b.setAttribute('aria-pressed', String(draft.theme === th.id));
          b.append(previews.get(th.id)!);
          const label = document.createElement('span');
          label.textContent = t(`theme.${th.id}` as MessageKey);
          const description = document.createElement('small');
          description.className = 'theme-description';
          for (const part of t(`theme.${th.id}.description` as MessageKey).split(' · ')) {
            const line = document.createElement('span');
            line.textContent = part;
            description.append(line);
          }
          b.append(label, description);
          b.addEventListener('click', () => {
            draft.theme = th.id;
            paint();
            wrap.querySelector<HTMLButtonElement>(`[data-theme="${th.id}"]`)?.focus({ preventScroll: true });
          });
          return b;
        }),
      );
    };
    paint();
  }

  function opening(body: HTMLElement): void {
    const cafe = escapeHtml(cleanName(draft.cafeName));
    body.innerHTML = `
      <h2>${t('ob.open.title')}</h2>
      <div class="opening-scene">
        <div class="name-sign"><span>${cafe}</span></div>
        <div class="opening-owner"></div>
      </div>
      <p>${t('ob.open.body', { cafe })}</p>`;
    const ownerPreview = createGeneratedOwnerPreview(draft.look, 6);
    body.querySelector('.opening-owner')!.append(ownerPreview.canvas);
    releasePreview = ownerPreview.dispose;
  }

  dismissOnboarding = close;
  releaseFocus = containDialogFocus(card, overlay);
  render();
}
