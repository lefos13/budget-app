import { en, Dictionary } from './dictionaries/en';
import { el } from './dictionaries/el';
import type { Language } from './types';

export type { Language };

export type TranslationFunction = {
  (path: string, defaultValue?: string): string;
} & Dictionary;

export function createTranslator(dict: Dictionary): TranslationFunction {
  const fn = ((path: string, defaultValue?: string): string => {
    if (!path) return defaultValue || '';
    const keys = path.split('.');
    let current: unknown = dict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return defaultValue || path;
      }
    }
    return typeof current === 'string' ? current : defaultValue || path;
  }) as TranslationFunction;

  return Object.assign(fn, dict);
}

export function getTranslator(language: 'en' | 'el'): TranslationFunction {
  return createTranslator(language === 'el' ? el : en);
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
