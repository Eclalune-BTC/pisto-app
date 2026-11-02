import { createSaleRequestSchema } from "@pisto/contracts";

import type { Database } from "./client.ts";
import { parseInput } from "./errors.ts";
import { correctSale } from "./sales/corrections.ts";
import { postItemizedSale } from "./sales/itemized.ts";
import { postSale } from "./sales/posting.ts";
import { createSaleQueries } from "./sales/queries.ts";
import { createReviewCommands } from "./sales/reviews.ts";
import type { SalesRepository } from "./sales/types.ts";

export type {
  ItemizedSaleResult,
  SaleCorrectionResult,
  SalesRepository,
} from "./sales/types.ts";

export function createSalesRepository(db: Database): SalesRepository {
  return {
    ...createSaleQueries(db),
    ...createReviewCommands(db),
    async createSale(actor, rawCommand) {
      const command = parseInput(
        createSaleRequestSchema,
        rawCommand,
        "Sale confirmation is invalid",
      );
      return db.transaction((tx) => postSale(tx, actor, command));
    },
    createItemizedSale: (actor, command) =>
      db.transaction((tx) => postItemizedSale(tx, actor, command)),
    voidSale: (actor, saleId, command) =>
      db.transaction((tx) => correctSale(tx, actor, saleId, { kind: "void", command })),
    replaceSale: (actor, saleId, command) =>
      db.transaction((tx) => correctSale(tx, actor, saleId, { kind: "replacement", command })),
  };
}
