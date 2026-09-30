'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Locale } from 'date-fns';
import { el as elLocale, enUS } from 'date-fns/locale';
import { en } from '@/lib/i18n/dictionaries/en';
import { el } from '@/lib/i18n/dictionaries/el';
import {
  createTranslator,
  getTranslator,
  type Language,
  type TranslationFunction,
} from '@/lib/i18n/translator';

export type { Language, TranslationFunction };
export { createTranslator, getTranslator };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
  dateLocale: Locale;
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

  const dateLocale = language === 'el' ? elLocale : enUS;

  React.useEffect(() => {
    document.documentElement.lang = language;
    const applyTitle = () => {
      if (document.title !== t.meta.title) document.title = t.meta.title;
    };
    applyTitle();
    // Next re-applies its static metadata title on navigation; keep the localized one.
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language, t]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const fallbackTranslationContext: LanguageContextType = {
  language: 'en' as Language,
  setLanguage: () => {},
  t: createTranslator(en),
  dateLocale: enUS,
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if used outside LanguageProvider
    return fallbackTranslationContext;
  }
  return context;
}
