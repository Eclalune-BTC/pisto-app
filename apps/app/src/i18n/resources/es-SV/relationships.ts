export const relationships = {
  common: {
    clearSearch: "Limpiar búsqueda",
    unavailableDescription: "Revisa tu conexión e inténtalo otra vez.",
  },
  access: {
    deniedTitle: "No tienes acceso a esta sección",
    deniedDescription:
      "Tu acceso actual no permite consultar ni administrar clientes y cuentas por cobrar.",
  },
  command: {
    failedDescription: "No pudimos completar la operación. Revisa los datos y vuelve a intentarlo.",
  },
  picker: {
    unavailable: "No pudimos cargar las opciones.",
  },
} as const;
