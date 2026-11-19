export const routeState = {
  loading: "Cargando la información…",
  deniedTitle: "No tiene acceso",
  deniedDescription:
    "Su rol en este negocio no permite abrir esta sección. El dueño o un administrador puede darle acceso.",
  errorTitle: "No pudimos cargar la información",
  errorDescription: "No cambiamos ningún registro. Vuelva a intentarlo cuando tenga conexión.",
  notFoundTitle: "No encontramos el registro",
  notFoundDescription: "Puede que ya no exista en este negocio o que no tenga acceso a él.",
  unavailableTitle: "Esta acción no está disponible",
  unavailableDescription: "El estado actual del registro no permite completarla.",
} as const;
