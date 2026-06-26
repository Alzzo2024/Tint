import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ptPT, type Translation } from "./locales/pt-PT";
import { enGB } from "./locales/en-GB";
import { ptBR } from "./locales/pt-BR";
import { enUS } from "./locales/en-US";
import { esES } from "./locales/es-ES";
import { frFR } from "./locales/fr-FR";
import { frCA } from "./locales/fr-CA";
import { deDE } from "./locales/de-DE";
import { itIT } from "./locales/it-IT";

const isBrowser = typeof window !== "undefined";
const DEFAULT_LANGUAGE = "en-GB";
const SUPPORTED_LANGUAGES = [
  "pt-PT",
  "pt-BR",
  "es-ES",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "it-IT",
  "en-GB",
  "en-US",
] as const;
const STORAGE_KEY = "tint:lang";

type Language = (typeof SUPPORTED_LANGUAGES)[number];

const dictionaries: Record<Language, Translation> = {
  "pt-PT": ptPT,
  "pt-BR": ptBR,
  "es-ES": esES,
  "fr-FR": frFR,
  "fr-CA": frCA,
  "de-DE": deDE,
  "it-IT": itIT,
  "en-GB": enGB,
  "en-US": enUS,
};

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

function detectFromNavigator(): Language {
  if (!isBrowser) return DEFAULT_LANGUAGE;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    if (!raw) continue;
    if (isLanguage(raw)) return raw;
    const lower = raw.toLowerCase();
    // exact match by lowercase
    const exact = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    // base language match → pick first variant; prefer specific defaults
    const base = lower.split("-")[0];
    if (base === "pt") return lower.includes("br") ? "pt-BR" : "pt-PT";
    if (base === "en") return lower.includes("us") ? "en-US" : "en-GB";
    if (base === "es") return "es-ES";
    if (base === "fr") return lower.includes("ca") ? "fr-CA" : "fr-FR";
    if (base === "de") return "de-DE";
    if (base === "it") return "it-IT";
  }
  return DEFAULT_LANGUAGE;
}

function getStoredLanguage(): Language {
  if (!isBrowser) return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) return stored;
  return detectFromNavigator();
}

let currentLanguage: Language = getStoredLanguage();

function emitLanguageChange() {
  if (!isBrowser) return;
  window.dispatchEvent(new Event("tint:language-change"));
}

function setDocumentLanguage(language: Language) {
  if (!isBrowser) return;
  document.documentElement.lang = language;
}

function setLanguage(language: string) {
  const next = isLanguage(language) ? language : DEFAULT_LANGUAGE;
  currentLanguage = next;
  if (isBrowser) window.localStorage.setItem(STORAGE_KEY, next);
  setDocumentLanguage(next);
  emitLanguageChange();
}

function subscribe(onStoreChange: () => void) {
  if (!isBrowser) return () => {};
  window.addEventListener("tint:language-change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("tint:language-change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): Language {
  if (isBrowser) currentLanguage = getStoredLanguage();
  return currentLanguage;
}
function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

function readPath(dictionary: unknown, key: string): string | undefined {
  let value: unknown = dictionary;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !(part in (value as object))) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : undefined;
}

function interpolate(value: string, options?: Record<string, string | number>) {
  if (!options) return value;
  return value.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
    options[name] === undefined ? "" : String(options[name]),
  );
}

export function translate(
  key: string,
  options?: Record<string, string | number>,
  language: Language = currentLanguage,
) {
  const translated =
    readPath(dictionaries[language], key) ??
    readPath(dictionaries["en-GB"], key) ??
    readPath(dictionaries["pt-PT"], key);
  if (!translated) return key.split(".").at(-1) ?? key;
  return interpolate(translated, options);
}

export function useTranslation() {
  const language = useSyncExternalStore<Language>(subscribe, getSnapshot, getServerSnapshot);
  const t = useCallback(
    (key: string, options?: Record<string, string | number>) => translate(key, options, language),
    [language],
  );
  const i18n = useMemo(
    () => ({
      language,
      resolvedLanguage: language,
      changeLanguage: (next: string) => {
        setLanguage(next);
        return Promise.resolve(translate("app.name", undefined, isLanguage(next) ? next : DEFAULT_LANGUAGE));
      },
    }),
    [language],
  );
  return { t, i18n };
}

setDocumentLanguage(currentLanguage);

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "pt-PT", label: "Português", flag: "🇵🇹" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "es-ES", label: "Castellano", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "fr-CA", label: "Français (CA)", flag: "🇨🇦" },
  { code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "en-GB", label: "English", flag: "🇬🇧" },
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
];

export default {
  get language() {
    return currentLanguage;
  },
  get resolvedLanguage() {
    return currentLanguage;
  },
  changeLanguage: (next: string) => {
    setLanguage(next);
    return Promise.resolve(translate("app.name", undefined, isLanguage(next) ? next : DEFAULT_LANGUAGE));
  },
  t: translate,
};
