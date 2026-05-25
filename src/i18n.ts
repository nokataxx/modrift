import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en/translation.json';
import ja from '../locales/ja/translation.json';

const resources = {
  en: { translation: en },
  ja: { translation: ja },
} as const;

export const supportedLanguages = ['en', 'ja'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

function resolveInitialLanguage(): SupportedLanguage {
  const code = getLocales()[0]?.languageCode;
  return (supportedLanguages as readonly string[]).includes(code ?? '')
    ? (code as SupportedLanguage)
    : 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
