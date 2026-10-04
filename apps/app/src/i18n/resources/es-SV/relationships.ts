export const relationships = {
  common: {
    back: "Volver",
    loading: "Cargando información…",
    noBusinessTitle: "Selecciona un negocio",
    noBusinessDescription:
      "Necesitas un negocio activo antes de administrar clientes y cuentas por cobrar.",
    notProvided: "No indicado",
    clearValue: "Eliminar dato guardado",
    unavailableTitle: "No pudimos cargar esta información",
    unavailableDescription:
      "Revisa tu conexión e inténtalo otra vez. No mostramos datos estimados cuando falla la consulta.",
  },
  access: {
    deniedTitle: "No tienes acceso a esta sección",
    deniedDescription:
      "Tu acceso actual no permite consultar ni administrar clientes y cuentas por cobrar.",
    offlineTitle: "Sin conexión",
  },
} as const;
