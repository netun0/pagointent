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
import { cn } from "@/lib/utils";

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (template: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const localeShort: Record<Locale, string> = {
  en: "EN",
  ja: "JA",
  es: "ES",
  pt: "PT",
};

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

export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, messages } = useI18n();

  return (
    <label className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{messages.shell.language}</span>
      <select
        value={locale}
        aria-label={messages.shell.language}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className={cn(
          "h-8 max-w-[3.25rem] cursor-pointer appearance-none bg-transparent py-0 pl-0 pr-4",
          "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
          "outline-none hover:text-[#7af7e2] focus:text-[#7af7e2]",
          "bg-[length:0.55rem] bg-[position:right_0.1rem_center] bg-no-repeat",
          "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%3E%3Cpath%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20d%3D%22m3%204.5%203%203%203-3%22/%3E%3C/svg%3E')]",
        )}
      >
        {locales.map((entry) => (
          <option key={entry.code} value={entry.code} title={entry.label}>
            {localeShort[entry.code]}
          </option>
        ))}
      </select>
    </label>
  );
}
