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

type LanguageSelectProps = {
  /** Tighter layout for the mobile footer bar */
  compact?: boolean;
  className?: string;
};

export function LanguageSelect({ compact = false, className }: LanguageSelectProps) {
  const { locale, setLocale, messages } = useI18n();
  const label = messages.shell.language;

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "flex-col gap-1.5" : "rounded-full border border-[#3dffc8]/35 bg-[#3dffc8]/8 px-2 py-1 shadow-[inset_0_0_0_1px_rgba(61,255,200,0.12)]",
        className,
      )}
      role="group"
      aria-label={label}
    >
      {!compact ? (
        <span className="hidden pl-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7af7e2] sm:inline">
          {label}
        </span>
      ) : (
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7af7e2]">{label}</span>
      )}
      <div className={cn("flex gap-0.5", compact && "flex-wrap justify-center")}>
        {locales.map((entry) => {
          const active = entry.code === locale;
          return (
            <button
              key={entry.code}
              type="button"
              title={entry.label}
              aria-pressed={active}
              onClick={() => setLocale(entry.code)}
              className={cn(
                "min-w-[2.25rem] rounded-full px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide transition",
                active
                  ? "bg-[#3dffc8]/20 text-[#3dffc8] shadow-[inset_0_0_0_1px_rgba(61,255,200,0.55)]"
                  : "text-muted-foreground hover:bg-white/10 hover:text-[#7af7e2]",
              )}
            >
              {localeShort[entry.code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
