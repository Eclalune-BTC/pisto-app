import type { InventoryMovement, Product } from "@pisto/contracts";
import type { CellContext } from "@tanstack/react-table";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { DataTableColumn } from "@/components/ui/data-table";

const table = vi.hoisted(() => ({
  columns: [] as DataTableColumn<InventoryMovement>[],
  width: 1280,
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("@/lib/use-measured-width", () => ({
  useMeasuredWidth: () => ({ onLayout: () => undefined, width: table.width }),
}));
vi.mock("@/components/ui/data-table", () => ({
  DataTable: ({ columns }: { columns: DataTableColumn<InventoryMovement>[] }) => {
    table.columns = columns;
    return null;
  },
}));

import { i18n } from "@/i18n/config";
import { MovementTable } from "./movement-table";

const timestamp = "2026-09-27T18:00:00.000Z";
const product = { id: "product-a", name: "Coffee", unitKind: "kilogram" } as Product;
const original: InventoryMovement = {
  id: "movement-a",
  productId: product.id,
  action: "receive",
  quantityMinorUnits: "1500",
  deltaMinorUnits: "1500",
  quantityPrecision: 3,
  reason: "Delivery",
  occurredAt: timestamp,
  occurredLocalDate: "2026-09-27",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  createdByUserId: "user-a",
  reversesMovementId: null,
  reversedByMovementId: "movement-b",
  createdAt: timestamp,
};
const reversal: InventoryMovement = {
  ...original,
  id: "movement-b",
  action: "reverse",
  deltaMinorUnits: "-1500",
  occurredLocalTime: "13:30",
  reason: "Counted twice",
  reversesMovementId: original.id,
  reversedByMovementId: null,
};
const plain: InventoryMovement = { ...original, id: "movement-c", reversedByMovementId: null };

function columnsAt(width: number, movements: InventoryMovement[]) {
  table.width = width;
  renderToStaticMarkup(
    createElement(MovementTable, {
      caption: "Movimientos",
      empty: createElement("p"),
      movements,
      product,
    }),
  );
  return table.columns;
}

function cell(column: DataTableColumn<InventoryMovement> | undefined, row: InventoryMovement) {
  if (!column) throw new Error("The column is missing.");
  const element = column.cell({ row: { original: row } } as CellContext<
    InventoryMovement,
    unknown
  >);
  return element ? renderToStaticMarkup(element) : "";
}

const reverses = i18n.t("inventory.history.reverses", {
  action: i18n.t("inventory.movementActions.receive"),
  date: "27 sept 2026, 12:00",
});

describe("movement table", () => {
  test("names the reversed movement in its own column only while the table has room", () => {
    const wide = columnsAt(1280, [reversal, original]);
    expect(wide.map(({ id }) => id)).toEqual([
      "type",
      "occurredAt",
      "reason",
      "reference",
      "quantity",
    ]);
    expect(cell(wide[3], reversal)).toContain(reverses);
    expect(cell(wide[0], reversal)).not.toContain(reverses);
    // A row without a link shows a dash that says what is missing.
    expect(cell(wide[3], plain)).toContain(i18n.t("inventory.history.noReference"));

    for (const width of [400, 700]) {
      const narrow = columnsAt(width, [reversal, original]);
      expect(narrow.map(({ id }) => id)).toEqual(["type", "occurredAt", "reason", "quantity"]);
      expect(cell(narrow[0], reversal)).toContain(reverses);
      expect(cell(narrow[0], plain)).not.toContain(i18n.t("inventory.history.noReference"));
    }
    expect(columnsAt(1280, [plain]).map(({ id }) => id)).toEqual([
      "type",
      "occurredAt",
      "reason",
      "quantity",
    ]);
  });

  test("marks a reversed movement and keeps its quantity readable as text", () => {
    const [type, , , , quantity] = columnsAt(1280, [reversal, original]);
    expect(cell(type, original)).toContain(i18n.t("inventory.history.reversed"));
    expect(cell(type, reversal)).not.toContain(i18n.t("inventory.history.reversed"));
    expect(cell(quantity, original)).toContain("+1.500 kg");
    expect(cell(quantity, reversal)).toContain("−1.500 kg");
  });
});
