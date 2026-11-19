export const relationships = {
  common: {
    clearSearch: "Limpiar búsqueda",
    unavailableDescription: "Revise su conexión e inténtelo otra vez.",
  },
  access: {
    deniedTitle: "No tiene acceso a esta sección",
    deniedDescription:
      "Su acceso actual no permite consultar ni administrar clientes y cuentas por cobrar.",
  },
  command: {
    failedDescription: "No pudimos completar la operación. Revise los datos y vuelva a intentarlo.",
  },
  picker: {
    unavailable: "No pudimos cargar las opciones.",
  },
} as const;
