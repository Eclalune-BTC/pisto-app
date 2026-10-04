export type ProductErrorCode =
  | "BUSINESS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class ProductError extends Error {
  override readonly name = "ProductError";

  constructor(
    readonly code: ProductErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function parseInput<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", message);
  return parsed.data;
}
