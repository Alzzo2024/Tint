import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { ptPT } from "./locales/pt-PT";
import { enGB } from "./locales/en-GB";

const isBrowser = typeof window !== "undefined";
const DEFAULT_LANGUAGE = "pt-PT";
const SUPPORTED_LANGUAGES = ["pt-PT", "en-GB"] as const;

function getStoredLanguage() {
  if (!isBrowser) return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem("tint:lang");
  if (stored && SUPPORTED_LANGUAGES.includes(stored as (typeof SUPPORTED_LANGUAGES)[number])) {
    return stored;
  }

  const browserLanguage = window.navigator.language;
  if (browserLanguage === "en-GB" || browserLanguage.startsWith("en")) {
    return "en-GB";
  }

  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  const chain = i18n.use(initReactI18next);
  if (isBrowser) chain.use(LanguageDetector);
  chain.init({
    resources: {
      "pt-PT": { translation: ptPT },
      "en-GB": { translation: enGB },
    },
    lng: getStoredLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    initImmediate: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "tint:lang",
      caches: ["localStorage"],
    },
  });
}

export default i18n;
