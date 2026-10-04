export const business = {
  loading: "Revisando tu negocio…",
  eyebrow: "Primer paso",
  title: "Configura tu negocio",
  description:
    "Elige la moneda y la zona horaria de este negocio. Pisto no usa una moneda global ni la decide por ti.",
  loadFailed: "No pudimos consultar tus negocios.",
  continue: "Continuar con este negocio",
  continueFailed: "No pudimos seleccionar este negocio. Vuelve a intentarlo.",
  name: "Nombre del negocio",
  namePlaceholder: "Ej. Tienda Luna",
  currency: "Moneda (ISO 4217)",
  currencyPlaceholder: "USD",
  timeZone: "Zona horaria (IANA)",
  timeZonePlaceholder: "America/El_Salvador",
  acknowledgment:
    "Confirmo que la moneda y la zona horaria son correctas. La moneda no se puede cambiar después de crear registros financieros.",
  create: "Crear negocio",
  uncertain:
    "No sabemos si el negocio se creó. Conservamos estos datos para reintentarlos sin crear otro negocio.",
  createFailed: "No pudimos crear el negocio.",
  incrementNote:
    "Cada negocio define su propia moneda. Los registros guardan esa moneda para conservar su significado histórico.",
  validation: {
    name: "Escribe un nombre de 2 a 80 caracteres.",
    currency: "Usa un código ISO 4217 de tres letras, por ejemplo USD.",
    timeZone: "Escribe una zona horaria IANA válida.",
  },
} as const;
