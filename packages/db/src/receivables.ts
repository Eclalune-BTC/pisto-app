import type { Database } from "./client.ts";
import { createCustomerCommands } from "./receivables/customer-commands.ts";
import { createCustomerQueries } from "./receivables/customer-queries.ts";
import { createReceivableCommands } from "./receivables/receivable-commands.ts";
import { createReceivableQueries } from "./receivables/receivable-queries.ts";
import type { ReceivablesRepository } from "./receivables/types.ts";

export { deriveReceivableBalance } from "./receivables/mappers.ts";
export type { ReceivablesRepository } from "./receivables/types.ts";

export function createReceivablesRepository(db: Database): ReceivablesRepository {
  return {
    ...createCustomerCommands(db),
    ...createCustomerQueries(db),
    ...createReceivableCommands(db),
    ...createReceivableQueries(db),
  };
}
