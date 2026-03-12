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
  cellAttrs?:
    | HtmlAttributes
    | ((context: UIDataTableCellContext<TRow>) => HtmlAttributes);
}

export interface UIDataTableOptions<TRow> {
  data: TRow[];
  columns: UIDataTableColumnDef<TRow>[];
  rowAttrs?:
    | HtmlAttributes[]
    | ((row: TRow, rowIndex: number) => HtmlAttributes);
  headAttrs?: HtmlAttributes;
  bodyAttrs?: HtmlAttributes;
  className?: string;
  attrs?: HtmlAttributes;
}

export type UIEditableGridValueType = "string" | "number";

export interface UIEditableGridColumnDef<TRow> {
  id: string;
  header: string;
  accessorKey?: keyof TRow;
  value?: (row: TRow, rowIndex: number) => unknown;
  valueType?: UIEditableGridValueType;
  sortable?: boolean;
  editable?: boolean;
  format?: (context: UIDataTableCellContext<TRow>) => string;
  headerAttrs?: HtmlAttributes;
  cellAttrs?:
    | HtmlAttributes
    | ((context: UIDataTableCellContext<TRow>) => HtmlAttributes);
}

export interface UIEditableGridOptions<TRow> {
  data: TRow[];
  columns: UIEditableGridColumnDef<TRow>[];
  tableId: string;
  bodyId: string;
  listId: string;
  rowKey?: (row: TRow, rowIndex: number) => string;
  className?: string;
  attrs?: HtmlAttributes;
}

function resolveCellValue<TRow>(
  row: TRow,
  column: UIDataTableColumnDef<TRow>,
): unknown {
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
  rowIndex: number,
): HtmlAttributes {
  if (typeof rowAttrs === "function") {
    return rowAttrs(row, rowIndex);
  }

  return rowAttrs?.[rowIndex] ?? {};
}

function resolveCellAttrs<TRow>(
  cellAttrs: UIDataTableColumnDef<TRow>["cellAttrs"],
  context: UIDataTableCellContext<TRow>,
): HtmlAttributes {
  if (typeof cellAttrs === "function") {
    return cellAttrs(context);
  }

  return cellAttrs ?? {};
}

function resolveEditableGridCellValue<TRow>(
  row: TRow,
  rowIndex: number,
  column: UIEditableGridColumnDef<TRow>,
): unknown {
  if (column.value) {
    return column.value(row, rowIndex);
  }

  if (column.accessorKey !== undefined) {
    return row[column.accessorKey];
  }

  if (typeof row === "object" && row !== null && column.id in row) {
    return (row as Record<string, unknown>)[column.id];
  }

  return "";
}

function renderEditableGridHeader<TRow>(
  column: UIEditableGridColumnDef<TRow>,
): string {
  const safeLabel = escapeHtml(column.header);
  if (column.sortable === false) {
    return safeLabel;
  }

  const safeColumnId = escapeHtml(column.id);
  const valueType = escapeHtml(column.valueType ?? "string");

  return `<button type="button" class="grid-sort-btn" data-grid-sort="${safeColumnId}" data-grid-sort-type="${valueType}" data-grid-sort-label="${safeLabel}"><span>${safeLabel}</span><span class="grid-sort-indicator" data-grid-sort-indicator="${safeColumnId}">↕</span></button>`;
}

export function uiDataTable<TRow>(options: UIDataTableOptions<TRow>): string {
  const headersHtml = options.columns.map(
    (column) => column.headerHtml ?? escapeHtml(column.header ?? column.id),
  );
  const headerCellAttrs = options.columns.map(
    (column) => column.headerAttrs ?? {},
  );

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
        value,
      };

      const renderedCell = column.cell
        ? column.cell(context)
        : escapeHtml(
            value === null || value === undefined ? "" : String(value),
          );

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
    attrs: options.attrs,
  });
}

export function uiEditableGrid<TRow>(
  options: UIEditableGridOptions<TRow>,
): string {
  const headersHtml = options.columns.map((column) =>
    renderEditableGridHeader(column),
  );
  const headerCellAttrs = options.columns.map(
    (column) => column.headerAttrs ?? {},
  );

  const rowsHtml: string[][] = [];
  const rowAttrs: HtmlAttributes[] = [];
  const cellAttrs: HtmlAttributes[][] = [];

  for (let rowIndex = 0; rowIndex < options.data.length; rowIndex += 1) {
    const row = options.data[rowIndex];
    const rowKey = options.rowKey
      ? options.rowKey(row, rowIndex)
      : `grid-row-${rowIndex + 1}`;

    rowAttrs.push({
      "data-grid-row": rowKey,
      "data-hx-key": rowKey,
    });

    const renderedRowCells: string[] = [];
    const renderedCellAttrs: HtmlAttributes[] = [];

    for (const column of options.columns) {
      const value = resolveEditableGridCellValue(row, rowIndex, column);
      const context: UIDataTableCellContext<TRow> = {
        row,
        rowIndex,
        columnId: column.id,
        value,
      };

      const renderedCell = column.format
        ? column.format(context)
        : escapeHtml(
            value === null || value === undefined ? "" : String(value),
          );

      const isEditable = column.editable ?? true;
      const mergedCellAttrs = {
        "data-grid-col": column.id,
        "data-grid-value-type": column.valueType ?? "string",
        ...(isEditable ? { contenteditable: "true", spellcheck: "false" } : {}),
        ...resolveCellAttrs(column.cellAttrs, context),
      };

      renderedRowCells.push(renderedCell);
      renderedCellAttrs.push(mergedCellAttrs);
    }

    rowsHtml.push(renderedRowCells);
    cellAttrs.push(renderedCellAttrs);
  }

  return uiTable({
    headersHtml,
    headerCellAttrs,
    rowsHtml,
    rowAttrs,
    cellAttrs,
    bodyAttrs: {
      "data-hx-id": options.bodyId,
      "data-hx-list": options.listId,
    },
    className: options.className,
    attrs: {
      "data-hx-id": options.tableId,
      ...(options.attrs ?? {}),
    },
  });
}
