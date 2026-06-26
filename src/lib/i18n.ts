import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { ptPT } from "./locales/pt-PT";
import { enGB } from "./locales/en-GB";

const isBrowser = typeof window !== "undefined";

if (!i18n.isInitialized) {
  const chain = i18n.use(initReactI18next);
  if (isBrowser) chain.use(LanguageDetector);
  chain.init({
    resources: {
      "pt-PT": { translation: ptPT },
      "en-GB": { translation: enGB },
    },
    lng: isBrowser ? undefined : "pt-PT",
    fallbackLng: "pt-PT",
    supportedLngs: ["pt-PT", "en-GB"],
    interpolation: { escapeValue: false },
    
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "tint:lang",
      caches: ["localStorage"],
    },
  });
}

export default i18n;
