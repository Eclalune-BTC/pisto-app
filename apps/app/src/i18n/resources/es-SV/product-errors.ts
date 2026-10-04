export const productErrors = {
  rateLimited: "Hiciste varias solicitudes seguidas. Espera un momento y vuelve a intentarlo.",
  writesPaused:
    "Los cambios están pausados temporalmente. Puedes consultar tus registros e intentar guardar más tarde.",
  businessRequired: "Selecciona o crea un negocio antes de continuar.",
  conflict: "La operación entra en conflicto con el estado actual. Actualiza y revisa de nuevo.",
  forbidden: "Tu cuenta no tiene permiso para realizar esta acción.",
  idempotencyConflict:
    "Esta confirmación ya se usó con datos diferentes. Vuelve a preparar la operación.",
  notFound: "No encontramos ese registro en tu negocio.",
  unauthorized: "Tu sesión ya no es válida. Vuelve a iniciar sesión.",
  validation: "Revisa los datos antes de continuar.",
  connection: "No pudimos conectar con Pisto. Revisa la conexión e inténtalo de nuevo.",
  ambiguous:
    "No sabemos si el servidor confirmó esta operación. Reintenta exactamente la misma confirmación; Pisto conserva la clave para evitar duplicados.",
  contexts: {
    archiveProduct: {
      conflict: "El producto ya está archivado o su estado cambió antes de confirmar.",
      fallback: "No pudimos archivar el producto. Su estado no se confirmó como cambiado.",
      forbidden: "Tu rol actual no permite archivar productos.",
      idempotency:
        "Esta clave de confirmación ya se usó con otra operación. Abre de nuevo el producto.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "La confirmación para archivar no es válida.",
    },
    business: {
      conflict: "Esta cuenta ya pertenece a un negocio con una configuración diferente.",
    },
    category: {
      conflict: "Ya existe una categoría con ese nombre o la categoría ya no admite cambios.",
      fallback: "No pudimos guardar la categoría. Ningún cambio se confirmó.",
      forbidden: "Tu rol actual no permite administrar categorías.",
      idempotency:
        "Esta clave de confirmación ya se usó con otros datos. Edita y vuelve a revisar la operación.",
      notFound: "La categoría ya no está disponible en este negocio.",
      validation: "Revisa el nombre antes de continuar.",
    },
    movement: {
      conflict:
        "La existencia o el estado actual del producto ya no permite este movimiento. Actualiza el historial antes de decidir.",
      fallback: "No pudimos confirmar el movimiento. La existencia no se muestra como modificada.",
      forbidden: "Tu rol actual no permite cambiar existencias.",
      idempotency:
        "Esta clave de confirmación ya se usó con otros datos. Edita y vuelve a revisar el movimiento.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "Revisa la cantidad, el motivo, la fecha y la hora antes de continuar.",
    },
    product: {
      conflict:
        "El SKU ya existe o el historial del producto impide cambiar su precisión o seguimiento.",
      fallback: "No pudimos guardar el producto. Ningún cambio se confirmó.",
      forbidden: "Tu rol actual no permite administrar productos.",
      idempotency:
        "Esta clave de confirmación ya se usó con otros datos. Edita y vuelve a revisar la operación.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "Revisa los datos del producto antes de continuar.",
    },
    reversal: {
      conflict:
        "El movimiento ya fue revertido, no admite reversión o la reversión dejaría una existencia negativa.",
      fallback: "No pudimos confirmar la reversión. La existencia no se muestra como modificada.",
      forbidden: "Tu rol actual no permite revertir movimientos.",
      idempotency:
        "Esta clave de confirmación ya se usó con otros datos. Abre de nuevo el movimiento.",
      notFound: "El movimiento ya no está disponible en este negocio.",
      validation: "Revisa el motivo, la fecha y la hora antes de continuar.",
    },
    sale: {
      idempotency: "Esta confirmación ya se utilizó para una venta diferente.",
    },
  },
} as const;
