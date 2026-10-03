import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ReactElement } from "react";

import { DataTableSurface } from "./data-table-surface";

export type DataTableColumn<T> = ColumnDef<T, unknown> & {
  cell: (context: CellContext<T, unknown>) => ReactElement | null;
  header: string;
  meta?: { align?: "start" | "end"; primary?: boolean };
};

export type DataTableProps<T> = {
  caption: string;
  columns: DataTableColumn<T>[];
  data: T[];
  empty?: ReactElement | null;
  getRowId: (record: T) => string;
};

export function DataTable<T>({ caption, columns, data, empty, getRowId }: DataTableProps<T>) {
  "use no memo";
  // The server owns ordering and cursors; a loaded page is not the entire result set.
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
  });

  if (data.length === 0) return empty ?? null;

  return (
    <DataTableSurface
      caption={caption}
      empty={empty}
      headers={table.getFlatHeaders()}
      rows={table.getRowModel().rows}
    />
  );
}
