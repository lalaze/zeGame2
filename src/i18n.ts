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

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[current][key] ?? MESSAGES.en[key];
  return params ? template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m)) : template;
}

/** For messages that hold a '|'-separated list. */
export const tList = (key: MessageKey) => t(key).split('|');

export const messagesFor = (locale: Locale) => MESSAGES[locale];
