import { flexRender } from "@tanstack/react-table";
import { useState } from "react";
import { View } from "react-native";

import type { DataTableColumn } from "./data-table";
import { DataTableRecords, type DataTableSurfaceProps } from "./data-table-records";

export function DataTableSurface<T>(props: DataTableSurfaceProps<T>) {
  const [width, setWidth] = useState(0);

  return (
    <View className="min-w-0" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width < 680 ? (
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
              </tr>
            </thead>
            <tbody>
              {props.rows.length === 0 ? (
                <tr>
                  <td colSpan={props.headers.length}>{props.empty}</td>
                </tr>
              ) : null}
              {props.rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      data-align={(cell.column.columnDef as DataTableColumn<T>).meta?.align}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </View>
  );
}
