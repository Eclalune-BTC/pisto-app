import type { ApiErrorCode, CashAccountKind, CashMovementAction } from "@pisto/contracts";
import { ApiClientError } from "@/lib/api-error";

import type { CashAccountDetailCopy } from "./cash-account-detail-screen";
import type { CashAccountEditorCopy } from "./cash-account-editor-screen";
import type { CashAdjustmentCopy } from "./cash-adjustment-screen";
import type { CashMovementDetailCopy } from "./cash-movement-detail-screen";
import type { CashScreenCopy } from "./cash-screen";
import type { CashTransferCopy } from "./cash-transfer-screen";
import type { CashDraftIssue } from "./drafts";

const accountKinds: Record<CashAccountKind, string> = {
  bank: "Cuenta bancaria",
  cash: "Efectivo",
  mobile_money: "Dinero móvil",
  other: "Otra cuenta",
};

const movementActions: Record<CashMovementAction, string> = {
  adjustment_in: "Ajuste de entrada",
  adjustment_out: "Ajuste de salida",
  expense: "Gasto pagado",
  opening: "Saldo inicial",
  receivable_payment: "Cobro recibido",
  reverse: "Reversión",
  transfer_in: "Transferencia recibida",
  transfer_out: "Transferencia enviada",
};

const boundaryCopy = {
  deniedDescription: "Tu rol actual no permite consultar ni cambiar el efectivo del negocio.",
  deniedTitle: "No tienes acceso al efectivo",
  loading: "Cargando efectivo y cuentas…",
  offlineTitle: "Sin conexión",
  retry: "Intentar de nuevo",
  unavailableTitle: "No pudimos cargar el efectivo",
} as const;

const reviewCopy = {
  checkStatus: "Comprobar estado",
  confirm: "Confirmar",
  edit: "Editar",
  failedTitle: "No se pudo completar la operación",
  uncertainDescription:
    "La conexión se interrumpió antes de confirmar el resultado. Comprueba el estado con la misma operación para evitar duplicados.",
  uncertainTitle: "El resultado todavía es incierto",
} as const;

export const cashOverviewCopy = (businessName: string): CashScreenCopy => ({
  accountFilter: "Estado de las cuentas",
  ...boundaryCopy,
  accountsTitle: "Cuentas",
  active: "Activa",
  activeAccounts: "Activas",
  allAccounts: "Todas",
  archived: "Archivada",
  archivedAccounts: "Archivadas",
  checkStatus: reviewCopy.checkStatus,
  createAccount: "Crear cuenta",
  deniedDescription: boundaryCopy.deniedDescription,
  description: `Saldos derivados de los movimientos registrados en ${businessName}. No representan una conciliación bancaria.`,
  emptyDescription:
    "Crea la cuenta real donde guardas dinero para registrar gastos, ajustes y transferencias.",
  emptyTitle: "Todavía no hay cuentas",
  eyebrow: "Operar",
  loading: boundaryCopy.loading,
  loadingMore: "Cargando más…",
  loadMore: "Cargar más",
  movementActions,
  movementsTitle: "Movimientos recientes",
  mutationFailedTitle: reviewCopy.failedTitle,
  negativeAllowed: "Permite saldo negativo",
  noMovements: "Todavía no hay movimientos registrados.",
  retry: boundaryCopy.retry,
  title: "Efectivo",
  uncertainDescription: reviewCopy.uncertainDescription,
  uncertainTitle: reviewCopy.uncertainTitle,
  unavailableTitle: boundaryCopy.unavailableTitle,
  deniedTitle: boundaryCopy.deniedTitle,
});

export const cashAccountEditorCopy: CashAccountEditorCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  allowNegative: "Permitir saldo negativo",
  cancel: "Cancelar",
  createDescription:
    "Define dónde se guarda el dinero. Si existe un saldo inicial, revísalo como un movimiento explícito.",
  createTitle: "Nueva cuenta",
  currency: "Moneda",
  date: "Fecha local",
  eyebrow: "Efectivo",
  kind: "Tipo de cuenta",
  moneyIn: "Entrada de dinero",
  moneyOut: "Salida de dinero",
  name: "Nombre",
  negativePolicy: "Política de saldo",
  openingAmount: "Monto inicial",
  openingBalance: "Saldo inicial",
  openingReason: "Motivo del saldo inicial",
  protectedBalance: "No permitir saldo negativo",
  review: "Revisar cuenta",
  reviewDescription:
    "Comprueba el nombre, la política de saldo y el movimiento inicial antes de confirmar.",
  reviewTitle: "Revisar cuenta",
  startAtZero: "Iniciar en cero",
  time: "Hora local",
  updateDescription:
    "Actualiza únicamente los datos de referencia. El saldo siempre se deriva del historial.",
  updateTitle: "Editar cuenta",
};

export const cashAccountDetailCopy: CashAccountDetailCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  accountKinds,
  active: "Activa",
  allowNegative: "Puede quedar en negativo",
  archiveAccount: "Archivar cuenta",
  archiveDescription:
    "La cuenta dejará de aceptar operaciones nuevas, pero conservará todos sus movimientos.",
  archiveEffect:
    "Archivar no elimina el saldo ni el historial. Las correcciones históricas seguirán disponibles.",
  archiveTitle: "Revisar archivo de cuenta",
  archived: "Archivada",
  balance: "Saldo derivado",
  currency: "Moneda",
  description: "Consulta el saldo exacto derivado y el historial de esta cuenta.",
  editAccount: "Editar cuenta",
  eyebrow: "Efectivo",
  kind: "Tipo",
  movementActions,
  movementsTitle: "Historial de movimientos",
  loadMore: "Cargar más",
  loadingMore: "Cargando más…",
  name: "Cuenta",
  negativePolicy: "Política de saldo",
  noMovements: "Esta cuenta todavía no tiene movimientos.",
  notFoundDescription: "La cuenta no existe o no está disponible en este negocio.",
  notFoundTitle: "Cuenta no encontrada",
  protectedBalance: "No puede quedar en negativo",
  recordAdjustment: "Registrar ajuste",
  status: "Estado",
  title: "Detalle de cuenta",
  transfer: "Transferir",
};

export const cashAdjustmentCopy: CashAdjustmentCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  account: "Cuenta",
  accountUnavailableDescription: "Selecciona una cuenta activa antes de preparar un ajuste manual.",
  accountUnavailableTitle: "No hay una cuenta activa seleccionada",
  amount: "Monto",
  cancel: "Cancelar",
  createAccount: "Crear cuenta",
  date: "Fecha local",
  description:
    "Registra una corrección de efectivo con un motivo verificable. No modifica movimientos anteriores.",
  direction: "Dirección",
  eyebrow: "Efectivo",
  moneyIn: "Entrada de dinero",
  moneyOut: "Salida de dinero",
  loadMore: "Cargar más",
  loadingMore: "Cargando más…",
  reason: "Motivo",
  review: "Revisar ajuste",
  reviewDescription: "Comprueba la cuenta, el monto, la dirección y la fecha antes de confirmar.",
  reviewTitle: "Revisar ajuste",
  time: "Hora local",
  title: "Ajuste manual",
};

export const cashTransferCopy: CashTransferCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  accountsUnavailableDescription: "Una transferencia requiere dos cuentas activas diferentes.",
  accountsUnavailableTitle: "Faltan cuentas activas",
  amount: "Monto",
  cancel: "Cancelar",
  createAccount: "Crear cuenta",
  date: "Fecha local",
  description: "Mueve dinero entre dos cuentas del negocio como un par de movimientos atómicos.",
  eyebrow: "Efectivo",
  fromAccount: "Cuenta de origen",
  loadMore: "Cargar más",
  loadingMore: "Cargando más…",
  noNote: "Sin nota",
  noteOptional: "Nota opcional",
  review: "Revisar transferencia",
  reviewDescription: "Comprueba ambas cuentas, el monto y la fecha antes de confirmar.",
  reviewTitle: "Revisar transferencia",
  time: "Hora local",
  title: "Transferir dinero",
  toAccount: "Cuenta de destino",
};

export const cashMovementDetailCopy: CashMovementDetailCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  account: "Cuenta",
  action: "Tipo de movimiento",
  amount: "Cambio en el saldo",
  backToAccount: "Volver a la cuenta",
  cancel: "Cancelar",
  date: "Fecha local",
  description: "Consulta el movimiento exacto que forma parte del saldo derivado.",
  eyebrow: "Efectivo",
  movementActions,
  notFoundDescription: "El movimiento ya no está disponible en el historial cargado.",
  notFoundTitle: "Movimiento no encontrado",
  reason: "Motivo",
  reversalEffect:
    "La reversión agrega un movimiento opuesto y conserva el ajuste original en el historial.",
  reversalUnavailable: "Este ajuste ya fue revertido y no puede revertirse otra vez.",
  reverseAdjustment: "Revertir ajuste",
  reverseDescription: "Indica por qué se revierte el ajuste y revisa el efecto antes de confirmar.",
  reverseTitle: "Revertir ajuste",
  reviewReversal: "Revisar reversión",
  time: "Hora local",
  timeZone: "Zona horaria",
  title: "Detalle del movimiento",
};

export const cashUiCopy = {
  accountFilter: "Estado de las cuentas",
  accountStatus: {
    active: "Activas",
    all: "Todas",
    archived: "Archivadas",
  },
  adjustmentEffect:
    "El ajuste agregará un movimiento nuevo al saldo. No sobrescribe el historial existente.",
  archiveEffect: cashAccountDetailCopy.archiveEffect,
  backToAccount: "Volver a la cuenta",
  createAccountEffect:
    "La cuenta se creará una vez. El saldo inicial, si existe, quedará registrado como movimiento.",
  editAccountEffect: "El cambio actualiza la referencia de la cuenta, no su saldo ni su historial.",
  loadMore: "Cargar más",
  loadingMore: "Cargando más…",
  mutationFallback: "Revisa los datos e intenta nuevamente.",
  offline: "No hay conexión para cargar esta información.",
  stale:
    "Mostramos la última información disponible. Actualiza antes de iniciar una operación nueva.",
  staleMutation:
    "No podemos confirmar una operación mientras el acceso o los datos están desactualizados. Vuelve a cargar.",
  transferEffect:
    "La confirmación registrará una salida y una entrada vinculadas en una sola operación.",
  unavailable: "No pudimos consultar la información del efectivo. Intenta nuevamente.",
} as const;

const issueMessages: Record<CashDraftIssue, string> = {
  "account-required": "Selecciona una cuenta activa.",
  "accounts-must-differ": "Elige una cuenta de destino diferente.",
  "invalid-amount": "Ingresa un monto positivo con los decimales permitidos.",
  "invalid-date": "Usa una fecha válida con formato AAAA-MM-DD.",
  "invalid-time": "Usa una hora válida con formato HH:MM.",
  "no-changes": "No hay cambios para revisar.",
  required: "Este campo es obligatorio.",
  "too-long": "El texto supera el límite permitido.",
};

export function cashIssueMessage(issue: CashDraftIssue): string {
  return issueMessages[issue];
}

const apiErrorMessages: Partial<Record<ApiErrorCode, string>> = {
  BUSINESS_REQUIRED: "Selecciona un negocio antes de continuar.",
  CONFLICT: "La operación entra en conflicto con el estado actual. Actualiza y revisa de nuevo.",
  FORBIDDEN: "Tu rol ya no permite completar esta operación.",
  IDEMPOTENCY_CONFLICT:
    "Esta confirmación ya se usó con datos diferentes. Vuelve a preparar la operación.",
  NOT_FOUND: "El registro no existe o ya no está disponible.",
  UNAUTHORIZED: "Tu sesión venció. Inicia sesión nuevamente.",
  VALIDATION_ERROR: "El servidor rechazó uno o más datos. Revisa la operación.",
};

export function cashErrorMessage(
  error: unknown,
  fallback: string = cashUiCopy.mutationFallback,
): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 0) return cashUiCopy.offline;
  return apiErrorMessages[error.code as ApiErrorCode] ?? fallback;
}

export const cashKindOptions = (Object.entries(accountKinds) as [CashAccountKind, string][]).map(
  ([value, label]) => ({ label, value }),
);
