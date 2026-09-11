import { addMessages, format as formatStore, init, locale as localeStore } from 'svelte-i18n';
import { get } from 'svelte/store';
import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';

const STORAGE_KEY = 'fediscope:locale-v1';

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // Storage unavailable: fall through to the browser hint.
  }
  const hint = (navigator.language ?? 'de').toLowerCase();
  if (hint.startsWith('de')) return 'de';
  if (hint.startsWith('en')) return 'en';
  return 'de';
}

init({
  initialLocale: detectInitialLocale(),
  fallbackLocale: 'de',
  formats: {
    time: {},
    number: { int: { maximumFractionDigits: 0 } },
    date: {
      standard: { dateStyle: 'medium', timeStyle: 'short' },
      date: { dateStyle: 'medium' },
      day: { day: '2-digit', month: '2-digit' },
      month: { month: 'short', year: '2-digit' },
    },
  },
});
addMessages('de', de);
addMessages('en', en);

export function currentLocale(): Locale {
  return (get(localeStore) ?? 'de') as Locale;
}

export function setLocale(next: Locale): void {
  localeStore.set(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable: the choice applies to this session only.
  }
  document.documentElement.lang = next;
}

document.documentElement.lang = currentLocale();

export function msg(
  id: string,
  values?: Record<string, string | number | boolean | Date | null | undefined>,
): string {
  return get(formatStore)({ id, values }) ?? id;
}

export { localeStore as locale };
