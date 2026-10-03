import { flexRender, type Header, type Row } from "@tanstack/react-table";
import type { ReactElement } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

import { cn } from "@/lib/cn";
import { Card, CardContent } from "./card";
import type { DataTableColumn } from "./data-table";

export type DataTableSurfaceProps<T> = {
  caption: string;
  empty?: ReactElement | null;
  headers: Header<T, unknown>[];
  rows: Row<T>[];
};

export function DataTableRecords<T>({ caption, empty, rows }: DataTableSurfaceProps<T>) {
  return (
    <View accessibilityLabel={caption} className="gap-3" role="list">
      {rows.length === 0 ? empty : null}
      {rows.map((row) => (
        <Card className="gap-0 py-4 shadow-none" key={row.id} role="listitem">
          <CardContent className="min-w-0 gap-3 px-4">
            {row.getVisibleCells().map((cell) => {
              const column = cell.column.columnDef as DataTableColumn<T>;
              return (
                <View
                  className={cn(
                    "min-w-0 gap-1",
                    !column.meta?.primary &&
                      "flex-row flex-wrap items-start justify-between gap-x-4",
                  )}
                  key={cell.id}
                >
                  <Text className="font-sans text-sm text-muted-foreground">{column.header}</Text>
                  <View className={cn("min-w-0 max-w-full", !column.meta?.primary && "shrink")}>
                    {flexRender(column.cell, cell.getContext())}
                  </View>
                </View>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </View>
  );
}
