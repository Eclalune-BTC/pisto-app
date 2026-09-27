import { DEFAULT_LOCALE } from "@/i18n/locale";

export function resolveMissingTranslation(key: string): never {
  throw new Error(`Missing ${DEFAULT_LOCALE} translation key: ${key}`);
}
