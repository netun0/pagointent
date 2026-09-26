import { en } from "./messages/en";
import type { Messages } from "./messages/types";
import { es } from "./messages/es";
import { ja } from "./messages/ja";
import { pt } from "./messages/pt";

export type Locale = "en" | "ja" | "es" | "pt";

export const locales: { code: Locale; label: string }[] = [
  { code: "en", label: en.localeName },
  { code: "ja", label: ja.localeName },
  { code: "es", label: es.localeName },
  { code: "pt", label: pt.localeName },
];

export const messagesByLocale: Record<Locale, Messages> = {
  en,
  ja,
  es,
  pt,
};

export const defaultLocale: Locale = "en";
export const LOCALE_STORAGE_KEY = "pagointent.locale";

export type { Messages };

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "ja" || value === "es" || value === "pt";
}

export function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ""));
}
