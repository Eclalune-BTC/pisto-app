import type {
  ArchiveCashAccountRequest,
  CashAccountListQuery,
  CashMovementListQuery,
  CreateCashAccountRequest,
  ExpenseListQuery,
  ExpensePeriodQuery,
  PostExpenseRequest,
  RecordCashAdjustmentRequest,
  ReverseCashMovementRequest,
  TransferCashRequest,
  UpdateCashAccountRequest,
  VoidExpenseRequest,
} from "@pisto/contracts";
import {
  archiveCashAccountRequestSchema,
  cashAccountDetailResponseSchema,
  cashAccountListResponseSchema,
  cashAccountResponseSchema,
  cashMovementListResponseSchema,
  cashMovementResponseSchema,
  cashTransferResponseSchema,
  createCashAccountRequestSchema,
  expenseDetailResponseSchema,
  expenseListResponseSchema,
  expensePeriodSummaryResponseSchema,
  expenseResponseSchema,
  postExpenseRequestSchema,
  recordCashAdjustmentRequestSchema,
  reverseCashMovementRequestSchema,
  transferCashRequestSchema,
  updateCashAccountRequestSchema,
  voidExpenseRequestSchema,
} from "@pisto/contracts";
import type { ZodType, z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";

type CashAccountResponse = z.infer<typeof cashAccountResponseSchema>;
type CashAccountDetailResponse = z.infer<typeof cashAccountDetailResponseSchema>;
type CashAccountListResponse = z.infer<typeof cashAccountListResponseSchema>;
type CashMovementResponse = z.infer<typeof cashMovementResponseSchema>;
type CashMovementListResponse = z.infer<typeof cashMovementListResponseSchema>;
type CashTransferResponse = z.infer<typeof cashTransferResponseSchema>;
type ExpenseResponse = z.infer<typeof expenseResponseSchema>;
type ExpenseDetailResponse = z.infer<typeof expenseDetailResponseSchema>;
type ExpenseListResponse = z.infer<typeof expenseListResponseSchema>;
type ExpensePeriodSummaryResponse = z.infer<typeof expensePeriodSummaryResponseSchema>;

function parseCommand<T>(schema: ZodType<T>, command: unknown): T {
  const parsed = schema.safeParse(command);
  if (!parsed.success) {
    throw new ApiClientError("The request payload is invalid.", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}

function pathWithQuery(path: `/${string}`, query: Record<string, unknown>): `/${string}` {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return search ? `${path}?${search}` : path;
}

export const cashApi = {
  accounts: {
    list: (query: CashAccountListQuery = {}) =>
      apiRequest<CashAccountListResponse, CashAccountListResponse["data"]>(
        pathWithQuery("/v1/cash/accounts", query),
        { authenticated: true },
        cashAccountListResponseSchema,
      ),
    get: (accountId: string) =>
      apiRequest<CashAccountDetailResponse, CashAccountDetailResponse["data"]>(
        `/v1/cash/accounts/${encodeURIComponent(accountId)}`,
        { authenticated: true },
        cashAccountDetailResponseSchema,
      ),
    create: (command: CreateCashAccountRequest) =>
      apiRequest<CashAccountResponse, CashAccountResponse["data"]>(
        "/v1/cash/accounts",
        {
          authenticated: true,
          body: parseCommand(createCashAccountRequestSchema, command),
          method: "POST",
        },
        cashAccountResponseSchema,
      ),
    update: (accountId: string, command: UpdateCashAccountRequest) =>
      apiRequest<CashAccountResponse, CashAccountResponse["data"]>(
        `/v1/cash/accounts/${encodeURIComponent(accountId)}/update`,
        {
          authenticated: true,
          body: parseCommand(updateCashAccountRequestSchema, command),
          method: "POST",
        },
        cashAccountResponseSchema,
      ),
    archive: (accountId: string, command: ArchiveCashAccountRequest) =>
      apiRequest<CashAccountResponse, CashAccountResponse["data"]>(
        `/v1/cash/accounts/${encodeURIComponent(accountId)}/archive`,
        {
          authenticated: true,
          body: parseCommand(archiveCashAccountRequestSchema, command),
          method: "POST",
        },
        cashAccountResponseSchema,
      ),
  },
  movements: {
    list: (query: CashMovementListQuery = {}) =>
      apiRequest<CashMovementListResponse, CashMovementListResponse["data"]>(
        pathWithQuery("/v1/cash/movements", query),
        { authenticated: true },
        cashMovementListResponseSchema,
      ),
    recordAdjustment: (command: RecordCashAdjustmentRequest) =>
      apiRequest<CashMovementResponse, CashMovementResponse["data"]>(
        "/v1/cash/adjustments",
        {
          authenticated: true,
          body: parseCommand(recordCashAdjustmentRequestSchema, command),
          method: "POST",
        },
        cashMovementResponseSchema,
      ),
    reverse: (movementId: string, command: ReverseCashMovementRequest) =>
      apiRequest<CashMovementResponse, CashMovementResponse["data"]>(
        `/v1/cash/movements/${encodeURIComponent(movementId)}/reverse`,
        {
          authenticated: true,
          body: parseCommand(reverseCashMovementRequestSchema, command),
          method: "POST",
        },
        cashMovementResponseSchema,
      ),
    transfer: (command: TransferCashRequest) =>
      apiRequest<CashTransferResponse, CashTransferResponse["data"]>(
        "/v1/cash/transfers",
        {
          authenticated: true,
          body: parseCommand(transferCashRequestSchema, command),
          method: "POST",
        },
        cashTransferResponseSchema,
      ),
  },
  expenses: {
    list: (query: ExpenseListQuery = {}) =>
      apiRequest<ExpenseListResponse, ExpenseListResponse["data"]>(
        pathWithQuery("/v1/expenses", query),
        { authenticated: true },
        expenseListResponseSchema,
      ),
    get: (expenseId: string) =>
      apiRequest<ExpenseDetailResponse, ExpenseDetailResponse["data"]>(
        `/v1/expenses/${encodeURIComponent(expenseId)}`,
        { authenticated: true },
        expenseDetailResponseSchema,
      ),
    summary: (query: ExpensePeriodQuery) =>
      apiRequest<ExpensePeriodSummaryResponse, ExpensePeriodSummaryResponse["data"]>(
        pathWithQuery("/v1/expenses/summary", query),
        { authenticated: true },
        expensePeriodSummaryResponseSchema,
      ),
    post: (command: PostExpenseRequest) =>
      apiRequest<ExpenseResponse, ExpenseResponse["data"]>(
        "/v1/expenses",
        {
          authenticated: true,
          body: parseCommand(postExpenseRequestSchema, command),
          method: "POST",
        },
        expenseResponseSchema,
      ),
    void: (expenseId: string, command: VoidExpenseRequest) =>
      apiRequest<ExpenseResponse, ExpenseResponse["data"]>(
        `/v1/expenses/${encodeURIComponent(expenseId)}/void`,
        {
          authenticated: true,
          body: parseCommand(voidExpenseRequestSchema, command),
          method: "POST",
        },
        expenseResponseSchema,
      ),
  },
} as const;
