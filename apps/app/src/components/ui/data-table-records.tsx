import { flexRender, type Header, type Row } from "@tanstack/react-table";
import { type Href, Link } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { DataTableColumn } from "./data-table";
import { PressableSurface } from "./pressable-surface";

export type DataTableSurfaceProps<T> = {
  caption: string;
  getRowHref?: (record: T) => Href;
  headers: Header<T, unknown>[];
  onRowPress?: (record: T) => void;
  rowActions?: (record: T) => ReactElement | null;
  rows: Row<T>[];
};

function columnOf<T>(cell: { column: { columnDef: unknown } }) {
  return cell.column.columnDef as DataTableColumn<T>;
}

/** Compact records: one dense row per record, with the primary value and the first figure on top. */
export function DataTableRecords<T>({
  caption,
  getRowHref,
  onRowPress,
  rowActions,
  rows,
}: DataTableSurfaceProps<T>) {
  return (
    <View
      accessibilityLabel={caption}
      className="overflow-hidden rounded-lg border border-border bg-card"
      role="list"
    >
      {rows.map((row, index) => {
        const cells = row.getVisibleCells();
        const primary = cells.find((cell) => columnOf<T>(cell).meta?.primary) ?? cells[0];
        const figure =
          cells.find((cell) => cell !== primary && columnOf<T>(cell).meta?.figure) ??
          cells.find((cell) => cell !== primary && columnOf<T>(cell).meta?.align === "end");
        const details = cells.filter(
          (cell) => cell !== primary && cell !== figure && !columnOf<T>(cell).meta?.hideOnCompact,
        );
        const href = getRowHref?.(row.original);
        const actions = rowActions?.(row.original);
        const content: ReactNode = (
          <View className="min-w-0 gap-1 px-3 py-2.5">
            <View className="min-w-0 flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                {primary ? (
                  <>
                    <Text className="sr-only">{columnOf<T>(primary).header}</Text>
                    {flexRender(columnOf<T>(primary).cell, primary.getContext())}
                  </>
                ) : null}
              </View>
              {figure ? (
                <View className="shrink-0 items-end">
                  <Text className="sr-only">{columnOf<T>(figure).header}</Text>
                  {flexRender(columnOf<T>(figure).cell, figure.getContext())}
                </View>
              ) : null}
            </View>
            {details.length ? (
              <View className="min-w-0 flex-row flex-wrap gap-x-4 gap-y-1">
                {details.map((cell) => (
                  <View className="min-w-0 max-w-full flex-row items-center gap-1.5" key={cell.id}>
                    <Text className="text-xs text-muted-foreground">
                      {columnOf<T>(cell).header}
                    </Text>
                    <View className="min-w-0 shrink">
                      {flexRender(columnOf<T>(cell).cell, cell.getContext())}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
        return (
          <View
            className={cn("min-w-0 flex-row items-center", index > 0 && "border-t border-border")}
            key={row.id}
            role="listitem"
          >
            <View className="min-w-0 flex-1">
              {href ? (
                <Link asChild href={href}>
                  <PressableSurface accessibilityRole="link">{content}</PressableSurface>
                </Link>
              ) : onRowPress ? (
                <PressableSurface
                  accessibilityRole="button"
                  onPress={() => onRowPress(row.original)}
                >
                  {content}
                </PressableSurface>
              ) : (
                content
              )}
            </View>
            {rowActions ? <View className="w-9 shrink-0 items-center pr-1">{actions}</View> : null}
          </View>
        );
      })}
    </View>
  );
}
