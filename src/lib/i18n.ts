import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { ptPT } from "./locales/pt-PT";
import { enGB } from "./locales/en-GB";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        "pt-PT": { translation: ptPT },
        "en-GB": { translation: enGB },
      },
      fallbackLng: "pt-PT",
      supportedLngs: ["pt-PT", "en-GB"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "tint:lang",
        caches: ["localStorage"],
      },
    });
}

export default i18n;
