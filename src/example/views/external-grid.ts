import type {
  ExternalProductRow,
  ExternalProductsPage,
} from "../resources/external-products.resource.js";
import {
  uiEditableGrid,
  type UIEditableGridColumnDef,
} from "../../helix/components/table.js";
import { uiButton } from "../../helix/ui.js";
import { renderExternalGridCompiledView } from "./compiled/external-grid.compiled.js";

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFilterValue(
  productsPage: ExternalProductsPage,
  columnId: string,
): string {
  return (
    productsPage.filters[columnId as keyof typeof productsPage.filters] ?? ""
  );
}

function createExternalGridColumns(
  productsPage: ExternalProductsPage,
): UIEditableGridColumnDef<ExternalProductRow>[] {
  return [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
      valueType: "number",
      filter: {
        value: getFilterValue(productsPage, "id"),
      },
      format: ({ value }) => String(Math.floor(toNumber(value))),
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      valueType: "string",
      filter: {
        value: getFilterValue(productsPage, "title"),
      },
      wrap: false,
    },
    {
      id: "brand",
      header: "Brand",
      accessorKey: "brand",
      valueType: "string",
      filter: {
        value: getFilterValue(productsPage, "brand"),
      },
      wrap: false,
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      valueType: "string",
      filter: {
        value: getFilterValue(productsPage, "category"),
      },
      wrap: false,
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      valueType: "number",
      filter: {
        value: getFilterValue(productsPage, "price"),
      },
      format: ({ value }) => toNumber(value).toFixed(2),
    },
    {
      id: "stock",
      header: "Stock",
      accessorKey: "stock",
      valueType: "number",
      filter: {
        value: getFilterValue(productsPage, "stock"),
      },
      format: ({ value }) => String(Math.floor(toNumber(value))),
    },
    {
      id: "rating",
      header: "Rating",
      accessorKey: "rating",
      valueType: "number",
      filter: {
        value: getFilterValue(productsPage, "rating"),
      },
      format: ({ value }) => toNumber(value).toFixed(1),
    },
  ];
}

function renderGridPager(productsPage: ExternalProductsPage): string {
  return `<div class="pager">
    ${uiButton({
      label: "← Prev",
      type: "button",
      variant: "secondary",
      disabled: productsPage.page <= 1,
      attrs: { "data-grid-page": "prev", "data-hx-id": "external-grid-prev" },
    })}
    <span data-hx-id="external-grid-page-label">Page ${productsPage.page} / ${productsPage.totalPages}</span>
    ${uiButton({
      label: "Next →",
      type: "button",
      variant: "secondary",
      disabled: productsPage.page >= productsPage.totalPages,
      attrs: { "data-grid-page": "next", "data-hx-id": "external-grid-next" },
    })}
    <span data-hx-id="external-grid-total-label">(${productsPage.total} total)</span>
    <span
      data-hx-id="external-grid-page-state"
      data-page="${productsPage.page}"
      data-page-size="${productsPage.pageSize}"
      data-total="${productsPage.total}"
      data-total-pages="${productsPage.totalPages}"
      data-sort-col="${productsPage.sortCol}"
      data-sort-dir="${productsPage.sortDir}"
      hidden
    ></span>
  </div>`;
}

function renderGridTable(productsPage: ExternalProductsPage): string {
  const tableHtml = uiEditableGrid<ExternalProductRow>({
    data: productsPage.rows,
    columns: createExternalGridColumns(productsPage),
    tableId: "external-grid-table",
    bodyId: "external-grid-body",
    listId: "external-grid-body",
    className: "excel-grid",
    rowKey: (row) => `external-grid-row-${row.id}`,
  });

  return `${tableHtml}${renderGridPager(productsPage)}`;
}

export function renderExternalGridPage(
  productsPage: ExternalProductsPage,
): string {
  return renderExternalGridCompiledView({
    gridTableHtml: renderGridTable(productsPage),
    rowCount: productsPage.rows.length,
    page: productsPage.page,
    totalRows: productsPage.total,
  });
}
