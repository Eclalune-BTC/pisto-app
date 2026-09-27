export const DEFAULT_LOCALE = "es-SV";
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function requireSupportedLocale(language: string | undefined): SupportedLocale {
  const locale = SUPPORTED_LOCALES.find((value) => value === language);
  if (!locale) throw new Error("The application locale is not initialized or supported");
  return locale;
}

export function resolveSupportedLocale(
  locales: ReadonlyArray<{ languageCode?: string | null; languageTag: string }>,
): SupportedLocale {
  for (const locale of locales) {
    const match = SUPPORTED_LOCALES.find(
      (supportedLocale) =>
        locale.languageTag.toLowerCase() === supportedLocale.toLowerCase() ||
        locale.languageCode?.toLowerCase() === supportedLocale.split("-")[0]?.toLowerCase(),
    );

    if (match) return match;
  }

  return DEFAULT_LOCALE;
}
