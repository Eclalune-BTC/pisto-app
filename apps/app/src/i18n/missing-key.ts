import { DEFAULT_LOCALE } from "@/i18n/locale";

/**
 * `fallbackLng` is disabled, so a missing key would otherwise render its raw
 * dotted path into the UI. Fail loudly while developing and render nothing in a
 * release build rather than leaking an identifier to the user.
 */
export function resolveMissingTranslation(key: string): string {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`Missing ${DEFAULT_LOCALE} translation key: ${key}`);
  }
  return "";
}
