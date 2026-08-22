export const DEFAULT_LOCALE = "es-SV";
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

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
