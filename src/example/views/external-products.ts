import type {
  ExternalProductRow,
  ExternalProductsPage,
} from "../resources/external-products.resource.js";
import { uiButton } from "../../helix/ui.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";

const externalProductColumns: UIDataTableColumnDef<ExternalProductRow>[] = [
  {
    id: "id",
    header: "ID",
    accessorKey: "id",
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-id` }),
  },
  {
    id: "title",
    header: "Title",
    accessorKey: "title",
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-title` }),
  },
  {
    id: "brand",
    header: "Brand",
    accessorKey: "brand",
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-brand` }),
  },
  {
    id: "category",
    header: "Category",
    accessorKey: "category",
    cellAttrs: ({ row }) => ({
      "data-hx-id": `external-row-${row.id}-category`,
    }),
  },
  {
    id: "price",
    header: "Price",
    accessorKey: "price",
    cell: ({ row }) => `$${row.price.toFixed(2)}`,
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-price` }),
  },
  {
    id: "stock",
    header: "Stock",
    accessorKey: "stock",
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-stock` }),
  },
  {
    id: "rating",
    header: "Rating",
    accessorKey: "rating",
    cell: ({ row }) => row.rating.toFixed(1),
    cellAttrs: ({ row }) => ({ "data-hx-id": `external-row-${row.id}-rating` }),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) =>
      uiButton({
        label: "Details",
        bind: "external-detail-open",
        variant: "secondary",
        attrs: {
          "data-hx-id": `external-row-${row.id}-action`,
          "data-row-id": row.id,
        },
      }),
  },
];

function renderExternalProductsDataTable(
  productsPage: ExternalProductsPage,
): string {
  const tableHtml = uiDataTable({
    data: productsPage.rows,
    columns: externalProductColumns,
    rowAttrs: (row) => ({ "data-hx-key": row.id }),
    bodyAttrs: {
      "data-hx-id": "external-products-body",
      "data-hx-list": "external-products-body",
    },
  });

  return `
  <section>
  <h2>Products</h2>
  ${tableHtml}

  <div class="pager">
    ${uiButton({
      label: "← Prev",
      bind: "external-page-prev",
      variant: "secondary",
      disabled: productsPage.page <= 1,
      attrs: { "data-hx-id": "external-prev-btn" },
    })}
    <span data-hx-id="external-page-label">Page ${productsPage.page} / ${productsPage.totalPages}</span>
    ${uiButton({
      label: "Next →",
      bind: "external-page-next",
      variant: "secondary",
      disabled: productsPage.page >= productsPage.totalPages,
      attrs: { "data-hx-id": "external-next-btn" },
    })}
    <span data-hx-id="external-total-label">(Total rows: ${productsPage.total})</span>
    <span data-hx-id="external-page-state" data-page="${productsPage.page}" data-total-pages="${productsPage.totalPages}" hidden></span>
  </div>
</section>

<div data-hx-id="external-modal-overlay" class="modal-overlay" style="display: none;">
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="external-modal-title">
    <div class="modal-header">
      <h2 data-hx-id="external-modal-title">Product Details</h2>
      ${uiButton({ label: "Close", bind: "external-detail-close", variant: "ghost" })}
    </div>

    <img data-hx-id="external-modal-thumbnail" class="modal-thumb" alt="" src="" />

    <dl class="modal-grid">
      <dt>ID</dt><dd data-hx-id="external-modal-id">-</dd>
      <dt>Brand</dt><dd data-hx-id="external-modal-brand">-</dd>
      <dt>Category</dt><dd data-hx-id="external-modal-category">-</dd>
      <dt>Price</dt><dd data-hx-id="external-modal-price">-</dd>
      <dt>Stock</dt><dd data-hx-id="external-modal-stock">-</dd>
      <dt>Rating</dt><dd data-hx-id="external-modal-rating">-</dd>
      <dt>Source</dt><dd data-hx-id="external-modal-source">-</dd>
    </dl>

    <section>
      <h3>Description</h3>
      <p data-hx-id="external-modal-description">-</p>
    </section>
  </div>
</div>`;
}

export function renderExternalProductsPage(
  productsPage: ExternalProductsPage,
): string {
  const tableAndModal = renderExternalProductsDataTable(productsPage);

  return `<p>
  Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized <strong>10,000-row</strong> dataset with 30 rows per page.
</p>

${tableAndModal}`;
}

export function renderExternalProductsComponent(
  productsPage: ExternalProductsPage,
): string {
  return `<article>
  <h3>External Data View</h3>
  <p>
    Backend source: <strong>DummyJSON Products API</strong>. Showing a synthesized <strong>10,000-row</strong> dataset with 30 rows per page.
  </p>
  ${renderExternalProductsDataTable(productsPage)}
</article>`;
}
