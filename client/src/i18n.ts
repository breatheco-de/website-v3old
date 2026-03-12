import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';

const resources = {
  en: {
    translation: enTranslation
  },
  es: {
    translation: esTranslation
  }
};

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  i18n.use(LanguageDetector);
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,

    interpolation: {
      escapeValue: false
    },

    ...(isBrowser ? {
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    } : {}),
  });

if (isBrowser) {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });

  document.documentElement.lang = i18n.language;
}

export default i18n;
