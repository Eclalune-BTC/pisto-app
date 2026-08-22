import { useLocales } from "expo-localization";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import { i18n } from "@/i18n/config";
import { resolveSupportedLocale } from "@/i18n/locale";

export function I18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const locale = resolveSupportedLocale(locales);

  useEffect(() => {
    if (i18n.resolvedLanguage !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
