import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

export type TableColumnMeta = {
  align?: "left" | "right";
  /** Extra classes on header and body cells */
  className?: string;
  headerClassName?: string;
  nowrap?: boolean;
  minWidth?: string;
};

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  defaultSort?: SortingState;
  dense?: boolean;
  stickyFirstColumn?: boolean;
  /** Which column index is sticky when stickyFirstColumn is true (default 0). */
  stickyColumnIndex?: number;
  /** Use fixed layout for predictable column widths on wide tables. */
  tableLayout?: "auto" | "fixed";
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** When set, enables client-side paging (recommended for large lists). */
  pageSize?: number;
  pageSizeOptions?: number[];
};

function columnAlign(meta: unknown, colIndex: number): "left" | "right" {
  const m = meta as TableColumnMeta | undefined;
  if (m?.align === "right") return "right";
  if (m?.align === "left") return "left";
  return colIndex === 0 ? "left" : "right";
}

export function SortableTable<T>({
  data,
  columns,
  defaultSort,
  dense,
  stickyFirstColumn,
  stickyColumnIndex = 0,
  tableLayout = "auto",
  onRowClick,
  emptyMessage = "No rows for this view.",
  pageSize: pageSizeProp,
  pageSizeOptions = [25, 50, 100],
}: Props<T>) {
  const pagingEnabled = pageSizeProp != null && pageSizeProp > 0;
  const defaultPageSize = pageSizeProp ?? 25;

  const [sorting, setSorting] = useState<SortingState>(
    defaultSort ?? [{ id: columns[0]?.id ?? "label", desc: true }]
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [data.length]);

  useEffect(() => {
    if (pagingEnabled) {
      setPagination((p) => ({ ...p, pageSize: defaultPageSize }));
    }
  }, [defaultPageSize, pagingEnabled]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(pagingEnabled ? { pagination } : {}) },
    onSortingChange: setSorting,
    onPaginationChange: pagingEnabled ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagingEnabled ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const cellPad = dense ? "px-2.5 py-2" : "px-4 py-2.5";
  const rowAlign = dense ? "align-top" : "align-middle";
  const stickyIdx = stickyFirstColumn ? stickyColumnIndex : -1;
  const stickyTh =
    stickyIdx >= 0
      ? "sticky left-0 z-20 bg-slate-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
      : "";
  const stickyTd =
    stickyIdx >= 0
      ? "sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] group-hover:bg-slate-50"
      : "";

  function metaFor(columnDef: { meta?: unknown }): TableColumnMeta | undefined {
    return columnDef.meta as TableColumnMeta | undefined;
  }

  const rows = table.getRowModel().rows;
  const total = data.length;
  const pageCount = pagingEnabled ? table.getPageCount() : 1;
  const pageIndex = pagingEnabled ? pagination.pageIndex : 0;
  const pageSize = pagingEnabled ? pagination.pageSize : total;
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          className={`w-full text-sm ${tableLayout === "fixed" ? "table-fixed" : "table-auto min-w-max"}`}
        >
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, i) => {
                  const meta = metaFor(h.column.columnDef);
                  const align = columnAlign(h.column.columnDef.meta, i);
                  return (
                    <th
                      key={h.id}
                      style={meta?.minWidth ? { minWidth: meta.minWidth, width: meta.minWidth } : undefined}
                      className={`${cellPad} text-xs font-semibold text-slate-600 align-bottom ${
                        meta?.nowrap !== false ? "whitespace-nowrap" : ""
                      } ${align === "right" ? "text-right" : "text-left"} ${
                        i === stickyIdx ? stickyTh : ""
                      } ${meta?.headerClassName ?? ""} ${meta?.className ?? ""}`}
                    >
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={`flex items-center gap-1 hover:text-slate-900 w-full ${
                            align === "right" ? "justify-end" : "justify-start"
                          }`}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`group ${rowAlign} ${
                  onRowClick ? "cursor-pointer hover:bg-brand-50/50" : "hover:bg-slate-50/80"
                }`}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell, i) => {
                  const meta = metaFor(cell.column.columnDef);
                  const align = columnAlign(cell.column.columnDef.meta, i);
                  return (
                    <td
                      key={cell.id}
                      style={meta?.minWidth ? { minWidth: meta.minWidth, width: meta.minWidth } : undefined}
                      className={`${cellPad} text-slate-700 ${rowAlign} ${
                        meta?.nowrap ? "whitespace-nowrap" : ""
                      } ${align === "right" ? "text-right tabular-nums" : "text-left"} ${
                        i === stickyIdx ? `font-medium text-slate-900 ${stickyTd}` : ""
                      } ${meta?.className ?? ""}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!total && (
        <p className="p-8 text-center text-slate-500 text-sm">{emptyMessage}</p>
      )}

      {pagingEnabled && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-sm text-slate-600">
          <span>
            Showing <span className="font-medium text-slate-800">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-medium text-slate-800">{total}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Per page</span>
              <select
                value={pageSize}
                onChange={(e) =>
                  table.setPageSize(Number(e.target.value))
                }
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-500 tabular-nums">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
