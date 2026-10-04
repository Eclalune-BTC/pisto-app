import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Href } from "expo-router";
import type { ReactElement } from "react";
import { DataTableSurface } from "./data-table-surface";

export type DataTableColumn<T> = ColumnDef<T, unknown> & {
  cell: (context: CellContext<T, unknown>) => ReactElement | null;
  header: string;
  meta?: {
    align?: "start" | "end";
    /** The record's name; it becomes the row's link when the table opens records. */
    primary?: boolean;
    /** The figure opposite the primary value in compact rows; defaults to the first end-aligned column. */
    figure?: boolean;
    /** Omit from compact rows when the value is already part of the primary cell. */
    hideOnCompact?: boolean;
    /** Fixed width in pixels on the wide table, so columns do not shift between filters. */
    width?: number;
  };
};

export type DataTableProps<T> = {
  caption: string;
  columns: DataTableColumn<T>[];
  data: T[];
  empty?: ReactElement | null;
  getRowId: (record: T) => string;
  /** Destination of the whole row. The primary cell is rendered as a real link to it. */
  getRowHref?: (record: T) => Href;
  /** Opens the record in place (for example a dialog) when it has no route of its own. */
  onRowPress?: (record: T) => void;
  /** Trailing per-row actions, usually a `RowActions` menu. */
  rowActions?: (record: T) => ReactElement | null;
};

export function DataTable<T>({
  caption,
  columns,
  data,
  empty,
  getRowHref,
  getRowId,
  onRowPress,
  rowActions,
}: DataTableProps<T>) {
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
      getRowHref={getRowHref}
      headers={table.getFlatHeaders()}
      onRowPress={onRowPress}
      rowActions={rowActions}
      rows={table.getRowModel().rows}
    />
  );
}
