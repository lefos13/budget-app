'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { en, Dictionary } from '@/lib/i18n/dictionaries/en';
import { el } from '@/lib/i18n/dictionaries/el';

export type Language = 'en' | 'el';

export type TranslationFunction = {
  (path: string, defaultValue?: string): string;
} & Dictionary;

function createTranslator(dict: Dictionary): TranslationFunction {
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

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function subscribeLanguage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getLanguageSnapshot(): Language {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('aura_language');
  return saved === 'en' || saved === 'el' ? saved : 'en';
}

function getLanguageServerSnapshot(): Language {
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const storeLang = React.useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageServerSnapshot
  );

  const [activeLang, setActiveLang] = useState<Language | null>(null);
  const language = activeLang ?? storeLang;

  const setLanguage = (lang: Language) => {
    setActiveLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_language', lang);
      document.documentElement.lang = lang;
      window.dispatchEvent(new Event('storage'));
    }
  };

  const t = useMemo(() => {
    return createTranslator(language === 'el' ? el : en);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if used outside LanguageProvider
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: createTranslator(en),
    };
  }
  return context;
}
