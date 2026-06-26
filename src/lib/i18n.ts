import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ptPT } from "./locales/pt-PT";
import { enGB } from "./locales/en-GB";

const isBrowser = typeof window !== "undefined";
const DEFAULT_LANGUAGE = "pt-PT";
const SUPPORTED_LANGUAGES = ["pt-PT", "en-GB"] as const;
const STORAGE_KEY = "tint:lang";

type Language = (typeof SUPPORTED_LANGUAGES)[number];
type Dictionary = typeof ptPT;

const dictionaries: Record<Language, Dictionary> = {
  "pt-PT": ptPT,
  "en-GB": enGB,
};

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

function getStoredLanguage(): Language {
  if (!isBrowser) return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) {
    return stored;
  }

  const browserLanguage = window.navigator.language;
  if (browserLanguage === "en-GB" || browserLanguage.startsWith("en")) {
    return "en-GB";
  }

  return DEFAULT_LANGUAGE;
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
  if (isBrowser) {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
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

function readPath(dictionary: Dictionary, key: string): string | undefined {
  let value: unknown = dictionary;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !(part in value)) return undefined;
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
    readPath(dictionaries[language], key) ?? readPath(dictionaries[DEFAULT_LANGUAGE], key);

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
