import en from './locales/en.json';
import zh from './locales/zh.json';

export type Locale = 'en' | 'zh';
export type MessageKey = keyof typeof en;

// Typed against the English file, so a missing Chinese key fails to compile.
const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, zh };

export const LOCALES: { id: Locale; label: string; htmlLang: string }[] = [
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'zh', label: '中文', htmlLang: 'zh-CN' },
];

export const LOCALE_KEY = 'tiny-bean-cafe/locale';

let current: Locale = 'en';
const listeners: (() => void)[] = [];

export function detectLocale(stored: string | null, languages: readonly string[]): Locale {
  if (stored === 'en' || stored === 'zh') return stored;
  return languages.some((l) => l.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
}

export const getLocale = () => current;

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const fn of listeners) fn();
}

export function onLocaleChange(fn: () => void): void {
  listeners.push(fn);
}

/**
 * Plural forms inside a message look like `{n, one|other}`, optionally after some text:
 * `"{n} unread {n, story|stories}"`. The count must also be passed to `t()`, so the
 * value shown and the form chosen can never disagree. `zh` keeps one form.
 */
const PLURAL = /\{(\w+),\s*([^{}|]*\|[^{}]*)\}/g;

/** Picks the form for `count`: 1 is singular, everything else (0, 2, 1.5…) is plural. */
export function pluralForm(forms: string, count: number): string {
  const options = forms.split('|');
  if (options.length === 1) return options[0];
  // Chinese messages keep one form, so `count` decides the English shape alone.
  const index = count === 1 ? 0 : 1;
  return options[index] ?? options[options.length - 1];
}

function fill(template: string, params: Record<string, string | number> | undefined): string {
  let text = template;
  if (params) {
    text = text.replace(PLURAL, (_match, name: string, forms: string) => {
      if (!(name in params)) return _match;
      const count = Number(params[name]);
      return Number.isFinite(count) ? pluralForm(forms, count) : forms.split('|').at(-1)!;
    });
    text = text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }
  return text;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[current][key] ?? MESSAGES.en[key];
  return params ? fill(template, params) : template;
}

/** For messages that hold a '|'-separated list. */
export const tList = (key: MessageKey) => t(key).split('|');

export const messagesFor = (locale: Locale) => MESSAGES[locale];
