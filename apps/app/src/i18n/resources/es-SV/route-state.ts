export const routeState = {
  loading: "Cargando la información…",
  deniedTitle: "No tienes acceso",
  deniedDescription:
    "Tu rol en este negocio no permite abrir esta sección. El dueño o un administrador puede darte acceso.",
  errorTitle: "No pudimos cargar la información",
  errorDescription: "No cambiamos ningún registro. Vuelve a intentarlo cuando tengas conexión.",
  notFoundTitle: "No encontramos el registro",
  notFoundDescription: "Puede que ya no exista en este negocio o que no tengas acceso a él.",
  unavailableTitle: "Esta acción no está disponible",
  unavailableDescription: "El estado actual del registro no permite completarla.",
} as const;
