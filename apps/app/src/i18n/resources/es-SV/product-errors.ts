export const productErrors = {
  rateLimited: "Hizo varias solicitudes seguidas. Espere un momento y vuelva a intentarlo.",
  writesPaused:
    "Los cambios están pausados temporalmente. Puede consultar sus registros e intentar guardar más tarde.",
  businessRequired: "Seleccione o cree un negocio antes de continuar.",
  conflict: "La operación entra en conflicto con el estado actual. Actualice y revise de nuevo.",
  forbidden: "Su cuenta no tiene permiso para realizar esta acción.",
  idempotencyConflict:
    "Esta confirmación ya se usó con datos diferentes. Vuelva a preparar la operación.",
  notFound: "No encontramos ese registro en su negocio.",
  unauthorized: "Su sesión ya no es válida. Vuelva a iniciar sesión.",
  validation: "Revise los datos antes de continuar.",
  connection: "No pudimos conectar con Pisto. Revise la conexión e inténtelo de nuevo.",
  ambiguous:
    "No sabemos si el servidor confirmó esta operación. Reintente exactamente la misma confirmación; Pisto conserva la clave para evitar duplicados.",
  contexts: {
    archiveProduct: {
      conflict: "El producto ya está archivado o su estado cambió antes de confirmar.",
      fallback: "No pudimos archivar el producto. Su estado no se confirmó como cambiado.",
      forbidden: "Su rol actual no permite archivar productos.",
      idempotency: "Esta confirmación ya se envió con otra operación. Abra de nuevo el producto.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "La confirmación para archivar no es válida.",
    },
    business: {
      conflict: "Esta cuenta ya pertenece a un negocio con una configuración diferente.",
    },
    category: {
      conflict: "Ya existe una categoría con ese nombre.",
      fallback: "No pudimos guardar la categoría. Ningún cambio se confirmó.",
      forbidden: "Su rol actual no permite administrar categorías.",
      idempotency:
        "Esta confirmación ya se envió con otros datos. Edite y vuelva a revisar la operación.",
      notFound: "La categoría ya no está disponible en este negocio.",
      validation: "Revise el nombre antes de continuar.",
    },
    movement: {
      conflict:
        "La existencia o el estado actual del producto ya no permite este movimiento. Actualice el historial antes de decidir.",
      fallback: "No pudimos confirmar el movimiento. La existencia no se muestra como modificada.",
      forbidden: "Su rol actual no permite cambiar existencias.",
      idempotency:
        "Esta confirmación ya se envió con otros datos. Edite y vuelva a revisar el movimiento.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "Revise la cantidad, el motivo, la fecha y la hora antes de continuar.",
    },
    product: {
      conflict:
        "El SKU ya existe o el historial del producto impide cambiar su precisión o seguimiento.",
      fallback: "No pudimos guardar el producto. Ningún cambio se confirmó.",
      forbidden: "Su rol actual no permite administrar productos.",
      idempotency:
        "Esta confirmación ya se envió con otros datos. Edite y vuelva a revisar la operación.",
      notFound: "El producto ya no está disponible en este negocio.",
      validation: "Revise los datos del producto antes de continuar.",
    },
    reversal: {
      conflict:
        "El movimiento ya fue revertido, no admite reversión o la reversión dejaría una existencia negativa.",
      fallback: "No pudimos confirmar la reversión. La existencia no se muestra como modificada.",
      forbidden: "Su rol actual no permite revertir movimientos.",
      idempotency: "Esta confirmación ya se envió con otros datos. Abra de nuevo el movimiento.",
      notFound: "El movimiento ya no está disponible en este negocio.",
      validation: "Revise el motivo, la fecha y la hora antes de continuar.",
    },
    sale: {
      idempotency: "Esta confirmación ya se utilizó para una venta diferente.",
    },
  },
} as const;
