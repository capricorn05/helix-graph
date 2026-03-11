import { escapeHtml } from "../html.js";
import { uiTable } from "../ui.js";
import type { HtmlAttributes } from "../ui.js";

export interface UIDataTableCellContext<TRow> {
  row: TRow;
  rowIndex: number;
  columnId: string;
  value: unknown;
}

export interface UIDataTableColumnDef<TRow> {
  id: string;
  header?: string;
  headerHtml?: string;
  accessorKey?: keyof TRow;
  cell?: (context: UIDataTableCellContext<TRow>) => string;
  headerAttrs?: HtmlAttributes;
  cellAttrs?: HtmlAttributes | ((context: UIDataTableCellContext<TRow>) => HtmlAttributes);
}

export interface UIDataTableOptions<TRow> {
  data: TRow[];
  columns: UIDataTableColumnDef<TRow>[];
  rowAttrs?: HtmlAttributes[] | ((row: TRow, rowIndex: number) => HtmlAttributes);
  headAttrs?: HtmlAttributes;
  bodyAttrs?: HtmlAttributes;
  className?: string;
  attrs?: HtmlAttributes;
}

function resolveCellValue<TRow>(row: TRow, column: UIDataTableColumnDef<TRow>): unknown {
  if (column.accessorKey !== undefined) {
    return row[column.accessorKey];
  }

  if (typeof row === "object" && row !== null && column.id in row) {
    return (row as Record<string, unknown>)[column.id];
  }

  return "";
}

function resolveRowAttrs<TRow>(
  rowAttrs: UIDataTableOptions<TRow>["rowAttrs"],
  row: TRow,
  rowIndex: number
): HtmlAttributes {
  if (typeof rowAttrs === "function") {
    return rowAttrs(row, rowIndex);
  }

  return rowAttrs?.[rowIndex] ?? {};
}

function resolveCellAttrs<TRow>(
  cellAttrs: UIDataTableColumnDef<TRow>["cellAttrs"],
  context: UIDataTableCellContext<TRow>
): HtmlAttributes {
  if (typeof cellAttrs === "function") {
    return cellAttrs(context);
  }

  return cellAttrs ?? {};
}

export function uiDataTable<TRow>(options: UIDataTableOptions<TRow>): string {
  const headersHtml = options.columns.map((column) => column.headerHtml ?? escapeHtml(column.header ?? column.id));
  const headerCellAttrs = options.columns.map((column) => column.headerAttrs ?? {});

  const rowsHtml: string[][] = [];
  const rowAttrs: HtmlAttributes[] = [];
  const cellAttrs: HtmlAttributes[][] = [];

  for (let rowIndex = 0; rowIndex < options.data.length; rowIndex += 1) {
    const row = options.data[rowIndex];
    const renderedRowCells: string[] = [];
    const renderedCellAttrs: HtmlAttributes[] = [];

    for (const column of options.columns) {
      const value = resolveCellValue(row, column);
      const context: UIDataTableCellContext<TRow> = {
        row,
        rowIndex,
        columnId: column.id,
        value
      };

      const renderedCell = column.cell
        ? column.cell(context)
        : escapeHtml(value === null || value === undefined ? "" : String(value));

      renderedRowCells.push(renderedCell);
      renderedCellAttrs.push(resolveCellAttrs(column.cellAttrs, context));
    }

    rowsHtml.push(renderedRowCells);
    rowAttrs.push(resolveRowAttrs(options.rowAttrs, row, rowIndex));
    cellAttrs.push(renderedCellAttrs);
  }

  return uiTable({
    headersHtml,
    headerCellAttrs,
    rowsHtml,
    rowAttrs,
    cellAttrs,
    headAttrs: options.headAttrs,
    bodyAttrs: options.bodyAttrs,
    className: options.className,
    attrs: options.attrs
  });
}
