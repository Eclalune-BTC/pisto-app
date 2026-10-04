/** ISO 4217 codes offered first in onboarding; any other supported code can still be typed. */
export const BUSINESS_CURRENCIES = [
  "USD",
  "GTQ",
  "HNL",
  "NIO",
  "CRC",
  "MXN",
  "DOP",
  "COP",
  "PEN",
  "CLP",
  "ARS",
  "BOB",
  "PYG",
  "UYU",
  "EUR",
] as const;

/** IANA zones offered first in onboarding; the device zone is added when it is not listed. */
export const BUSINESS_TIME_ZONES = [
  "America/El_Salvador",
  "America/Guatemala",
  "America/Tegucigalpa",
  "America/Managua",
  "America/Costa_Rica",
  "America/Panama",
  "America/Mexico_City",
  "America/Santo_Domingo",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/La_Paz",
  "America/Asuncion",
  "America/Montevideo",
  "Europe/Madrid",
] as const;

export const OTHER_OPTION = "other";

export function isListedTimeZone(value: string): value is (typeof BUSINESS_TIME_ZONES)[number] {
  return (BUSINESS_TIME_ZONES as readonly string[]).includes(value);
}
