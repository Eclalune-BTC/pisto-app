import { describe, expect, test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  catalogCategory,
  catalogOperation,
  catalogProduct,
  inventoryMovement,
} from "../src/schema/catalog.ts";

describe("catalog and inventory persistence model", () => {
  test("owns mutable references separately from the append-only movement ledger", () => {
    expect(getTableName(catalogCategory)).toBe("catalog_category");
    expect(getTableName(catalogProduct)).toBe("catalog_product");
    expect(getTableName(inventoryMovement)).toBe("inventory_movement");
    expect(getTableName(catalogOperation)).toBe("catalog_operation");

    const productColumns = getTableColumns(catalogProduct);
    expect(productColumns).toHaveProperty("sellingPriceCurrency");
    expect(productColumns).toHaveProperty("sellingPriceCurrencyMinorUnitDigits");
    expect(productColumns).toHaveProperty("quantityPrecision");
    expect(productColumns).not.toHaveProperty("quantityOnHand");
  });

  test("keeps movements exact, attributable, reversible, and time-zone snapshotted", () => {
    const columns = getTableColumns(inventoryMovement);
    expect(columns).toHaveProperty("quantityMinorUnits");
    expect(columns).toHaveProperty("deltaMinorUnits");
    expect(columns).toHaveProperty("quantityPrecision");
    expect(columns).toHaveProperty("createdByUserId");
    expect(columns).toHaveProperty("reversesMovementId");
    expect(columns).toHaveProperty("occurredLocalDate");
    expect(columns).toHaveProperty("occurredLocalTime");
    expect(columns).toHaveProperty("timeZone");
  });

  test("has database constraints for tenant links, replay identity, and one reversal", () => {
    const movementConfig = getTableConfig(inventoryMovement);
    const operationConfig = getTableConfig(catalogOperation);
    expect(movementConfig.foreignKeys.length).toBeGreaterThanOrEqual(3);
    expect(
      movementConfig.indexes.some(
        (index) => index.config.name === "inventory_movement_reverses_once_unique",
      ),
    ).toBe(true);
    expect(
      operationConfig.indexes.some(
        (index) => index.config.name === "catalog_operation_actor_key_unique",
      ),
    ).toBe(true);
    expect(operationConfig.checks.length).toBeGreaterThanOrEqual(3);
  });
});
