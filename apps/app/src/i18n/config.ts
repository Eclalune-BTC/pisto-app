import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, resolveSupportedLocale, SUPPORTED_LOCALES } from "@/i18n/locale";
import { esSV } from "@/i18n/resources/es-SV";

export const resources = {
  [DEFAULT_LOCALE]: { translation: esSV },
} as const;

void i18n.use(initReactI18next).init({
  defaultNS: "translation",
  fallbackLng: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  lng: resolveSupportedLocale(getLocales()),
  load: "currentOnly",
  resources,
  returnEmptyString: false,
  returnNull: false,
  react: { useSuspense: false },
  supportedLngs: [...SUPPORTED_LOCALES],
});

export { i18n };
