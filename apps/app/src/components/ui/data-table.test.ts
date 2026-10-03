import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));

import { DataTable, type DataTableColumn, type DataTableProps } from "./data-table";
import { Text } from "./text";

type Record = { id: string; name: string; amount: string };
const columns: DataTableColumn<Record>[] = [
  {
    id: "name",
    header: "Name",
    meta: { primary: true },
    cell: ({ row }) => createElement(Text, {}, row.original.name),
  },
  {
    id: "amount",
    header: "Amount",
    meta: { align: "end" },
    cell: ({ row }) => createElement(Text, {}, row.original.amount),
  },
];

describe("shared record table", () => {
  test("keeps server order, complete labels and exact values in compact records", () => {
    const data = [
      { id: "b", name: "A complete long record name", amount: "9007199254740993" },
      { id: "a", name: "Second record", amount: "0" },
    ];
    const html = renderToStaticMarkup(
      createElement(DataTable<Record>, {
        caption: "History",
        columns,
        data,
        getRowId: (row) => row.id,
      }),
    );
    expect(html).toContain("History");
    expect(html).toContain("Name");
    expect(html).toContain("Amount");
    expect(html).toContain("9007199254740993");
    expect(html.indexOf("A complete long record name")).toBeLessThan(html.indexOf("Second record"));
    expect(html).not.toContain("aria-sort");
  });

  test("renders only the caller's genuine empty state for an empty page", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Record>, {
        caption: "History",
        columns,
        data: [],
        getRowId: (row) => row.id,
        empty: createElement(Text, {}, "No matching records"),
      }),
    );
    expect(html).toContain("No matching records");
    expect(html).not.toContain('role="listitem"');
  });

  test("requires native-safe cells and empty elements at the shared boundary", () => {
    // @ts-expect-error Accessor-only columns use TanStack's scalar default, which is unsafe under a native View.
    const accessorOnly: DataTableColumn<Record> = { header: "Name", accessorKey: "name" };
    // @ts-expect-error Scalar cell output must be explicitly wrapped in Text.
    const scalarCell: DataTableColumn<Record> = { header: "Name", cell: () => "unsafe" };
    // @ts-expect-error An empty label must also be rendered inside a native-safe element.
    const scalarEmpty: DataTableProps<Record>["empty"] = "unsafe";
    expect([accessorOnly, scalarCell, scalarEmpty]).toHaveLength(3);
  });
});
