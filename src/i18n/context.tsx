"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  interpolate,
  isLocale,
  locales,
  LOCALE_STORAGE_KEY,
  messagesByLocale,
  type Locale,
  type Messages,
} from "./index";

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (template: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return defaultLocale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const messages = messagesByLocale[locale];

  const t = useCallback(
    (template: string, vars?: Record<string, string | number>) => interpolate(template, vars),
    [],
  );

  const value = useMemo(
    () => ({ locale, messages, setLocale, t }),
    [locale, messages, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageSelect() {
  const { locale, setLocale } = useI18n();

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className="h-8 max-w-[7.5rem] cursor-pointer rounded-full border border-white/15 bg-white/5 px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground outline-none hover:text-[#7af7e2] focus:border-[#3dffc8]/40"
      >
        {locales.map((entry) => (
          <option key={entry.code} value={entry.code} className="bg-[#070b12] text-foreground">
            {entry.label}
          </option>
        ))}
      </select>
    </label>
  );
}
