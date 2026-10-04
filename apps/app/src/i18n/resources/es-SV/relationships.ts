export const relationships = {
  common: {
    clearSearch: "Limpiar búsqueda",
    unavailableTitle: "No pudimos cargar esta información",
    unavailableDescription: "Revisa tu conexión e inténtalo otra vez.",
    notFoundTitle: "Registro no disponible",
    notFoundDescription: "No existe o no está disponible en el negocio activo.",
    actionUnavailableTitle: "Esta acción ya no está disponible",
    actionUnavailableDescription:
      "El estado actual del cliente, la cuenta o el pago ya no permite esta operación.",
  },
  access: {
    deniedTitle: "No tienes acceso a esta sección",
    deniedDescription:
      "Tu acceso actual no permite consultar ni administrar clientes y cuentas por cobrar.",
  },
  command: {
    edit: "Editar",
    failedTitle: "No se pudo confirmar",
    failedDescription: "No pudimos completar la operación. Revisa los datos y vuelve a intentarlo.",
  },
  picker: {
    unavailable: "No pudimos cargar las opciones.",
  },
} as const;
