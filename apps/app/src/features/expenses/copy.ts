import type { ExpenseCategory } from "@pisto/contracts";

import { cashErrorMessage, cashIssueMessage, cashUiCopy } from "../cash/copy";
import type { CashDraftIssue } from "../cash/drafts";
import type { ExpenseDetailCopy } from "./expense-detail-screen";
import type { ExpenseEditorCopy } from "./expense-editor-screen";
import type { ExpensesScreenCopy } from "./expenses-screen";

const categories: Record<ExpenseCategory, string> = {
  inventory: "Inventario",
  marketing: "Mercadeo",
  other: "Otro",
  payroll: "Planilla",
  rent: "Alquiler",
  tax: "Impuestos",
  transport: "Transporte",
  utilities: "Servicios",
};

const boundaryCopy = {
  deniedDescription: "Tu rol actual no permite consultar ni registrar gastos del negocio.",
  deniedTitle: "No tienes acceso a los gastos",
  loading: "Cargando gastos…",
  retry: "Intentar de nuevo",
  unavailableTitle: "No pudimos cargar los gastos",
} as const;

const reviewCopy = {
  checkStatus: "Comprobar estado",
  confirm: "Confirmar gasto",
  edit: "Editar",
  failedTitle: "No se pudo confirmar el gasto",
  uncertainDescription:
    "La conexión se interrumpió antes de conocer el resultado. Comprueba el estado con la misma confirmación para evitar duplicados.",
  uncertainTitle: "El resultado todavía es incierto",
} as const;

export const expensesOverviewCopy = (businessName: string): ExpensesScreenCopy => ({
  accountFilter: "Cuenta",
  allAccounts: "Todas las cuentas",
  allCategories: "Todas las categorías",
  allStatuses: "Todos",
  applyPeriod: "Aplicar período",
  categories,
  categoryBreakdown: "Por categoría",
  categoryFilter: "Categoría",
  checkStatus: reviewCopy.checkStatus,
  deniedDescription: boundaryCopy.deniedDescription,
  deniedTitle: boundaryCopy.deniedTitle,
  description: `Consulta los gastos pagados y registrados en ${businessName} sin confundirlos con utilidad.`,
  emptyDescription: "Registra el primer gasto pagado para empezar un historial verificable.",
  emptyTitle: "No hay gastos con estos filtros",
  endDate: "Fecha final",
  eyebrow: "Operar",
  expensesNotProfit:
    "Estos son gastos pagados registrados. No representan por sí solos costo total ni utilidad.",
  historyTitle: "Historial",
  filtersTitle: "Filtros y período",
  loadMore: cashUiCopy.loadMore,
  loadingMore: cashUiCopy.loadingMore,
  loading: boundaryCopy.loading,
  mutationFailedTitle: reviewCopy.failedTitle,
  noCategoryData: "No hay gastos registrados en este período.",
  periodTotal: "Total del período",
  periodScope: "El período actualiza el resumen; los filtros actualizan el historial.",
  posted: "Registrado",
  postedStatus: "Registrados",
  recordedExpenses: "Gastos registrados",
  registerExpense: "Registrar gasto",
  retry: boundaryCopy.retry,
  startDate: "Fecha inicial",
  statusFilter: "Estado",
  title: "Gastos",
  uncertainDescription: reviewCopy.uncertainDescription,
  uncertainTitle: reviewCopy.uncertainTitle,
  unavailableTitle: boundaryCopy.unavailableTitle,
  voidAction: "Anular",
  voided: "Anulado",
  voidedStatus: "Anulados",
});

export const expenseEditorCopy: ExpenseEditorCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  account: "Cuenta de pago",
  accountsEmptyDescription:
    "Crea una cuenta de efectivo activa antes de registrar un gasto pagado.",
  accountsEmptyTitle: "No hay una cuenta disponible",
  amount: "Monto",
  category: "Categoría",
  createAccount: "Crear cuenta",
  currency: "Moneda",
  date: "Fecha local",
  description: "Descripción",
  edit: reviewCopy.edit,
  eyebrow: "Gastos",
  newDescription: "Registra un gasto que ya fue pagado desde una cuenta real del negocio.",
  newTitle: "Nuevo gasto pagado",
  noPayee: "Sin destinatario",
  loadMore: "Cargar más",
  loadingMore: "Cargando más…",
  payee: "Destinatario",
  payeeOptional: "Destinatario opcional",
  review: "Revisar gasto",
  reviewDescription:
    "Comprueba el monto, la cuenta, la categoría y la fecha antes de afectar el saldo.",
  reviewTitle: "Revisar gasto",
  time: "Hora local",
};

export const expenseDetailCopy: ExpenseDetailCopy = {
  ...boundaryCopy,
  ...reviewCopy,
  account: "Cuenta de pago",
  amount: "Monto",
  cancel: "Cancelar",
  categories,
  category: "Categoría",
  date: "Fecha local",
  description: "Consulta el gasto y su efecto registrado en efectivo.",
  descriptionLabel: "Descripción",
  eyebrow: "Gastos",
  noPayee: "Sin destinatario",
  notFoundDescription: "El gasto no existe o no está disponible en este negocio.",
  notFoundTitle: "Gasto no encontrado",
  payee: "Destinatario",
  posted: "Registrado",
  reason: "Motivo",
  reviewVoid: "Revisar anulación",
  status: "Estado",
  time: "Hora local",
  title: "Detalle del gasto",
  voidDescription:
    "La anulación conservará el gasto original y agregará un movimiento que revierte su efecto.",
  voidEffect:
    "El gasto quedará anulado y el dinero volverá a la misma cuenta mediante un movimiento nuevo.",
  voidExpense: "Anular gasto",
  voidReason: "Motivo de anulación",
  voidTitle: "Anular gasto",
  voided: "Anulado",
};

export const expensesUiCopy = {
  accountFilter: "Cuenta",
  allAccounts: "Todas las cuentas",
  allCategories: "Todas las categorías",
  allStatuses: "Todos",
  applyPeriod: "Aplicar período",
  categoryFilter: "Categoría",
  createEffect:
    "La confirmación registrará el gasto y la salida de efectivo en una sola operación.",
  endDate: "Fecha final",
  filtersTitle: "Filtros y período",
  invalidPeriod:
    "Usa fechas válidas y asegúrate de que la fecha inicial no sea posterior a la final.",
  loadMore: cashUiCopy.loadMore,
  loadingMore: cashUiCopy.loadingMore,
  noCategoryData: "No hay gastos registrados en este período.",
  offline: cashUiCopy.offline,
  postedStatus: "Registrados",
  stale: cashUiCopy.stale,
  staleMutation: cashUiCopy.staleMutation,
  startDate: "Fecha inicial",
  statusFilter: "Estado",
  unavailable: "No pudimos consultar los gastos. Intenta nuevamente.",
  voidedStatus: "Anulados",
} as const;

export const expenseCategoryOptions = (
  Object.entries(categories) as [ExpenseCategory, string][]
).map(([value, label]) => ({ label, value }));

export function expenseIssueMessage(issue: CashDraftIssue): string {
  return cashIssueMessage(issue);
}

export function expenseErrorMessage(error: unknown): string {
  return cashErrorMessage(error, "No se pudo completar la operación de gasto.");
}
