import { flexRender } from "@tanstack/react-table";
import { Link, useRouter } from "expo-router";
import type { MouseEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { Text } from "@/components/ui/text";
import type { DataTableColumn } from "./data-table";
import { DataTableRecords, type DataTableSurfaceProps } from "./data-table-records";

const TABLE_MIN_WIDTH = 640;

function isInteractiveTarget(event: MouseEvent<HTMLTableRowElement>) {
  return (event.target as HTMLElement).closest("a,button,input,select,textarea,[role=menuitem]");
}

export function DataTableSurface<T>(props: DataTableSurfaceProps<T>) {
  const { t } = useTranslation();
  const router = useRouter();
  const window = useWindowDimensions();
  // Seed from the window so a wide screen paints the table immediately; layout refines it.
  const [width, setWidth] = useState(window.width);
  const { getRowHref, rowActions } = props;
  return (
    <View className="min-w-0" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width < TABLE_MIN_WIDTH ? (
        <DataTableRecords {...props} />
      ) : (
        <div className="pisto-data-table-container">
          <table className="pisto-data-table">
            <caption className="sr-only">{props.caption}</caption>
            <thead>
              <tr>
                {props.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    data-align={(header.column.columnDef as DataTableColumn<T>).meta?.align}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {rowActions ? (
                  <th scope="col" style={{ width: 48 }}>
                    <span className="sr-only">{t("dataTable.columns.actions")}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => {
                const href = getRowHref?.(row.original);
                return (
                  <tr
                    data-href={href ? "" : undefined}
                    key={row.id}
                    onClick={
                      href
                        ? (event) => {
                            if (!isInteractiveTarget(event)) router.push(href);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const column = cell.column.columnDef as DataTableColumn<T>;
                      const content = flexRender(column.cell, cell.getContext());
                      return (
                        <td key={cell.id} data-align={column.meta?.align}>
                          {href && column.meta?.primary ? (
                            <Link asChild href={href}>
                              <Text className="font-ui text-[13px] text-foreground web:hover:underline web:underline-offset-4">
                                {content}
                              </Text>
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                    {rowActions ? <td data-align="end">{rowActions(row.original)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </View>
  );
}
