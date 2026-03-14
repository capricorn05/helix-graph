import { escapeHtml } from "../html.js";
import { uiInput, uiSelect, uiTable } from "../ui.js";
import type { HtmlAttributes } from "../ui.js";

export interface UIDataTableCellContext<TRow> {
  row: TRow;
  rowIndex: number;
  columnId: string;
  value: unknown;
}

export type UITableColumnFilterType = "text" | "search" | "number" | "select";

export interface UITableColumnFilterOption {
  value: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface UITableColumnFilterDef {
  type?: UITableColumnFilterType;
  name?: string;
  placeholder?: string;
  value?: string;
  options?: UITableColumnFilterOption[];
  attrs?: HtmlAttributes;
}

export interface UIDataTableColumnDef<TRow> {
  id: string;
  header?: string;
  headerHtml?: string;
  accessorKey?: keyof TRow;
  cell?: (context: UIDataTableCellContext<TRow>) => string;
  filter?: boolean | UITableColumnFilterDef;
  headerAttrs?: HtmlAttributes;
  cellAttrs?:
    | HtmlAttributes
    | ((context: UIDataTableCellContext<TRow>) => HtmlAttributes);
  /** When false, disables wrapping and clips overflow. Defaults to true (wrapping enabled). */
  wrap?: boolean;
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
  filter?: boolean | UITableColumnFilterDef;
  headerAttrs?: HtmlAttributes;
  cellAttrs?:
    | HtmlAttributes
    | ((context: UIDataTableCellContext<TRow>) => HtmlAttributes);
  /** When false, disables wrapping and clips overflow. Defaults to true (wrapping enabled). */
  wrap?: boolean;
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

function mergeStyle(
  attrs: HtmlAttributes,
  declaration: string,
): HtmlAttributes {
  const current = attrs["style"];
  if (
    current === undefined ||
    current === null ||
    current === false ||
    current === ""
  ) {
    return {
      ...attrs,
      style: declaration,
    };
  }

  return {
    ...attrs,
    style: `${String(current)};${declaration}`,
  };
}

function applyWrap(
  attrs: HtmlAttributes,
  wrap: boolean | undefined,
): HtmlAttributes {
  if (wrap !== false) {
    return attrs;
  }

  return {
    ...mergeStyle(attrs, "white-space:nowrap"),
    "data-hx-nowrap": "true",
  };
}

function resolveColumnFilter(
  filter: boolean | UITableColumnFilterDef | undefined,
  fallbackType: UITableColumnFilterType,
): UITableColumnFilterDef | null {
  if (!filter) {
    return null;
  }

  if (filter === true) {
    return { type: fallbackType };
  }

  return {
    ...filter,
    type: filter.type ?? fallbackType,
  };
}

function renderColumnFilter(
  columnId: string,
  label: string,
  filter: boolean | UITableColumnFilterDef | undefined,
  fallbackType: UITableColumnFilterType,
): string {
  const resolvedFilter = resolveColumnFilter(filter, fallbackType);
  if (!resolvedFilter) {
    return "";
  }

  const filterType = resolvedFilter.type ?? fallbackType;
  const value = resolvedFilter.value ?? "";
  const attrs: HtmlAttributes = {
    "data-hx-column-filter": columnId,
    "data-hx-column-filter-type": filterType,
    "aria-label": `Filter ${label}`,
    ...(resolvedFilter.attrs ?? {}),
  };

  if (filterType === "select") {
    const hasExplicitValue = resolvedFilter.value !== undefined;
    const options = [
      {
        value: "",
        label: resolvedFilter.placeholder ?? "All",
        selected: value === "",
      },
      ...(resolvedFilter.options ?? []).map((option) => ({
        ...option,
        selected: hasExplicitValue
          ? option.value === value
          : (option.selected ?? false),
      })),
    ];

    return uiSelect({
      name: resolvedFilter.name ?? columnId,
      className: "hx-table__filter-control",
      options,
      attrs,
    });
  }

  return uiInput({
    name: resolvedFilter.name ?? columnId,
    type: filterType,
    value,
    placeholder:
      resolvedFilter.placeholder ??
      (filterType === "number" ? `Filter ${label}` : `Search ${label}`),
    className: "hx-table__filter-control",
    attrs,
  });
}

function hasRenderedFilters(filterCellsHtml: string[]): boolean {
  return filterCellsHtml.some((cellHtml) => cellHtml.length > 0);
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
  const filterCellsHtml = options.columns.map((column) =>
    renderColumnFilter(
      column.id,
      column.header ?? column.id,
      column.filter,
      "search",
    ),
  );
  const hasFilters = hasRenderedFilters(filterCellsHtml);

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
      renderedCellAttrs.push(
        applyWrap(resolveCellAttrs(column.cellAttrs, context), column.wrap),
      );
    }

    rowsHtml.push(renderedRowCells);
    rowAttrs.push(resolveRowAttrs(options.rowAttrs, row, rowIndex));
    cellAttrs.push(renderedCellAttrs);
  }

  return uiTable({
    headersHtml: hasFilters ? undefined : headersHtml,
    headerCellAttrs: hasFilters ? undefined : headerCellAttrs,
    headRowsHtml: hasFilters ? [headersHtml, filterCellsHtml] : undefined,
    headRowAttrs: hasFilters
      ? [{}, { class: "hx-table__filter-row" }]
      : undefined,
    headCellAttrs: hasFilters
      ? [headerCellAttrs, options.columns.map(() => ({}))]
      : undefined,
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
  const filterCellsHtml = options.columns.map((column) =>
    renderColumnFilter(
      column.id,
      column.header,
      column.filter,
      column.valueType === "number" ? "number" : "search",
    ),
  );
  const hasFilters = hasRenderedFilters(filterCellsHtml);

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
      const mergedCellAttrs = applyWrap(
        {
          "data-grid-col": column.id,
          "data-grid-value-type": column.valueType ?? "string",
          ...(isEditable
            ? { contenteditable: "true", spellcheck: "false" }
            : {}),
          ...resolveCellAttrs(column.cellAttrs, context),
        },
        column.wrap,
      );

      renderedRowCells.push(renderedCell);
      renderedCellAttrs.push(mergedCellAttrs);
    }

    rowsHtml.push(renderedRowCells);
    cellAttrs.push(renderedCellAttrs);
  }

  return uiTable({
    headersHtml: hasFilters ? undefined : headersHtml,
    headerCellAttrs: hasFilters ? undefined : headerCellAttrs,
    headRowsHtml: hasFilters ? [headersHtml, filterCellsHtml] : undefined,
    headRowAttrs: hasFilters
      ? [{}, { class: "hx-table__filter-row" }]
      : undefined,
    headCellAttrs: hasFilters
      ? [headerCellAttrs, options.columns.map(() => ({}))]
      : undefined,
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
