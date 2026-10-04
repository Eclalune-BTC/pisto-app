import { Platform } from "react-native";

import type { DataTableColumn } from "@/components/ui/data-table";

/** Mirrors the container width below which the shared web DataTable renders compact records. */
export const COMPACT_TABLE_WIDTH = 640;

export type FittedColumn<T> = {
  column: DataTableColumn<T>;
  /** Widest expected rendering in pixels, cell padding included. */
  estimate: number;
  /** Optional columns leave the table by ascending rank until the rest fits its container. */
  dropRank?: number;
  /** Restricts the column to compact records or to the table. */
  only?: "compact" | "table";
};

/** Native always renders compact records; the web renders a table once its container is wide. */
export function rendersCompactRecords(width: number): boolean {
  return Platform.OS !== "web" || width < COMPACT_TABLE_WIDTH;
}

/**
 * The columns a table can show without clipping at the measured container width. The shared table
 * neither scrolls horizontally nor truncates auto-sized cells, so a column that does not fit is
 * omitted rather than cut off. Compact records keep every column meant for them.
 */
export function fitColumns<T>(
  entries: readonly FittedColumn<T>[],
  width: number,
  compact: boolean = rendersCompactRecords(width),
): DataTableColumn<T>[] {
  const visible = entries.filter(
    (entry) => entry.only === undefined || entry.only === (compact ? "compact" : "table"),
  );
  if (compact) return visible.map((entry) => entry.column);
  const kept = new Set(visible);
  let total = visible.reduce((sum, entry) => sum + entry.estimate, 0);
  const optional = visible
    .filter((entry) => entry.dropRank !== undefined)
    .sort((a, b) => (a.dropRank ?? 0) - (b.dropRank ?? 0));
  for (const entry of optional) {
    if (total <= width) break;
    kept.delete(entry);
    total -= entry.estimate;
  }
  return visible.filter((entry) => kept.has(entry)).map((entry) => entry.column);
}
