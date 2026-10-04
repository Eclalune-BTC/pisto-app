import { createAccountCommands } from "./cash/account-commands.ts";
import { createExpenseCommands } from "./cash/expense-commands.ts";
import { createMovementCommands } from "./cash/movement-commands.ts";
import { createCashQueries } from "./cash/queries.ts";
import type { CashRepository } from "./cash/types.ts";
import type { Database } from "./client.ts";

export type { CashRepository } from "./cash/types.ts";

export function createCashRepository(db: Database): CashRepository {
  return {
    ...createCashQueries(db),
    ...createAccountCommands(db),
    ...createExpenseCommands(db),
    ...createMovementCommands(db),
  };
}
