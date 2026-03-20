import type {
  ExternalProductDetail,
  ExternalProductsPage,
} from "../resources/external-products.resource.js";
import { uiButton } from "../../helix/ui.js";
import { uiDataTable } from "../../helix/components/table.js";
import type { UIDataTableColumnDef } from "../../helix/components/table.js";
import { escapeHtml } from "../../helix/html.js";
import { renderExternalProductsRichCompiledView } from "./compiled/external-products-rich.compiled.js";

const EXTERNAL_MEDIA_TITLE_TRUNCATE_LIMIT = 52;

function formatExternalMediaPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatExternalMediaRatingStars(rating: number): string {
  const safeRating = Math.max(0, Math.min(5, rating));
  const filled = Math.max(0, Math.min(5, Math.round(safeRating)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

type ExternalMediaPriceBand = "budget" | "mid" | "premium";
type ExternalMediaStockBand = "empty" | "low" | "healthy";
type ExternalMediaRatingBand = "low" | "mid" | "high";

function getExternalMediaPriceBand(price: number): ExternalMediaPriceBand {
  if (price >= 120) {
    return "premium";
  }

  if (price <= 30) {
    return "budget";
  }

  return "mid";
}

function getExternalMediaStockBand(stock: number): ExternalMediaStockBand {
  if (stock <= 0) {
    return "empty";
  }

  if (stock <= 15) {
    return "low";
  }

  return "healthy";
}

function getExternalMediaRatingBand(rating: number): ExternalMediaRatingBand {
  if (rating >= 4.5) {
    return "high";
  }

  if (rating < 3.8) {
    return "low";
  }

  return "mid";
}

function formatExternalMediaPriceBandLabel(
  band: ExternalMediaPriceBand,
): string {
  switch (band) {
    case "budget":
      return "Budget";
    case "premium":
      return "Premium";
    default:
      return "Standard";
  }
}

function formatExternalMediaStockBandLabel(
  band: ExternalMediaStockBand,
): string {
  switch (band) {
    case "empty":
      return "Out";
    case "low":
      return "Low";
    default:
      return "Ready";
  }
}

function formatExternalMediaRatingBandLabel(
  band: ExternalMediaRatingBand,
): string {
  switch (band) {
    case "high":
      return "Top";
    case "low":
      return "Risk";
    default:
      return "Solid";
  }
}

function getExternalMediaRowClass(row: ExternalProductDetail): string {
  const classes = ["external-media-row"];

  const priceBand = getExternalMediaPriceBand(row.price);
  const stockBand = getExternalMediaStockBand(row.stock);
  const ratingBand = getExternalMediaRatingBand(row.rating);

  classes.push(`external-media-row--price-${priceBand}`);
  classes.push(`external-media-row--stock-${stockBand}`);
  classes.push(`external-media-row--rating-${ratingBand}`);

  if (row.thumbnail.trim().length === 0) {
    classes.push("external-media-row--missing-thumb");
  }

  return classes.join(" ");
}

function truncateExternalMediaTitle(title: string): string {
  if (title.length <= EXTERNAL_MEDIA_TITLE_TRUNCATE_LIMIT) {
    return title;
  }

  return `${title.slice(0, EXTERNAL_MEDIA_TITLE_TRUNCATE_LIMIT - 1)}…`;
}

function renderExternalMediaPreviewCell(row: ExternalProductDetail): string {
  const stockBand = getExternalMediaStockBand(row.stock);

  return `<div class="external-media-thumb-wrap" data-hx-id="external-media-row-${row.id}-thumb-wrap">
    <img
      class="external-media-thumb"
      data-hx-id="external-media-row-${row.id}-thumb"
      src="${escapeHtml(row.thumbnail)}"
      alt="${escapeHtml(`${row.title} thumbnail`)}"
      loading="lazy"
      decoding="async"
    />
    <span class="external-media-thumb-chip external-media-thumb-chip--${stockBand}" data-hx-id="external-media-row-${row.id}-thumb-chip">${escapeHtml(
      formatExternalMediaStockBandLabel(stockBand),
    )}</span>
  </div>`;
}

function renderExternalMediaPriceCell(row: ExternalProductDetail): string {
  const priceBand = getExternalMediaPriceBand(row.price);
  return `<div class="external-media-cell-stack">
    <span class="external-media-main" data-hx-id="external-media-row-${row.id}-price-main">${escapeHtml(formatExternalMediaPrice(row.price))}</span>
    <span class="external-media-pill external-media-pill--${priceBand}" data-hx-id="external-media-row-${row.id}-price-pill">${escapeHtml(
      formatExternalMediaPriceBandLabel(priceBand),
    )}</span>
  </div>`;
}

function renderExternalMediaStockCell(row: ExternalProductDetail): string {
  const stockBand = getExternalMediaStockBand(row.stock);
  return `<div class="external-media-cell-stack">
    <span class="external-media-main" data-hx-id="external-media-row-${row.id}-stock-main">${escapeHtml(String(row.stock))}</span>
    <span class="external-media-pill external-media-pill--${stockBand}" data-hx-id="external-media-row-${row.id}-stock-pill">${escapeHtml(
      formatExternalMediaStockBandLabel(stockBand),
    )}</span>
  </div>`;
}

function renderExternalMediaRatingCell(row: ExternalProductDetail): string {
  const ratingBand = getExternalMediaRatingBand(row.rating);
  return `<div class="external-media-cell-stack">
    <span class="external-media-main" data-hx-id="external-media-row-${row.id}-rating-main">${escapeHtml(
      row.rating.toFixed(1),
    )}</span>
    <span class="external-media-stars" data-hx-id="external-media-row-${row.id}-rating-stars">${escapeHtml(
      formatExternalMediaRatingStars(row.rating),
    )}</span>
    <span class="external-media-pill external-media-pill--rating-${ratingBand}" data-hx-id="external-media-row-${row.id}-rating-pill">${escapeHtml(
      formatExternalMediaRatingBandLabel(ratingBand),
    )}</span>
  </div>`;
}

function renderExternalMediaTitleCell(row: ExternalProductDetail): string {
  return `<span data-hx-id="external-media-row-${row.id}-title">${escapeHtml(
    truncateExternalMediaTitle(row.title),
  )}</span>`;
}

const externalProductRichColumns: UIDataTableColumnDef<ExternalProductDetail>[] =
  [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-id`,
      }),
    },
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => renderExternalMediaPreviewCell(row),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-preview`,
        class: "external-media-preview-cell",
      }),
    },
    {
      id: "title",
      header: "Title",
      cell: ({ row }) => renderExternalMediaTitleCell(row),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-title-cell`,
      }),
    },
    {
      id: "brand",
      header: "Brand",
      accessorKey: "brand",
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-brand`,
      }),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-category`,
      }),
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => renderExternalMediaPriceCell(row),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-price`,
      }),
    },
    {
      id: "stock",
      header: "Stock",
      cell: ({ row }) => renderExternalMediaStockCell(row),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-stock`,
      }),
    },
    {
      id: "rating",
      header: "Rating",
      cell: ({ row }) => renderExternalMediaRatingCell(row),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-rating`,
      }),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) =>
        uiButton({
          label: "Details",
          bind: "external-media-detail-open",
          variant: "secondary",
          attrs: {
            "data-hx-id": `external-media-row-${row.id}-action`,
            "data-row-id": row.id,
          },
        }),
      cellAttrs: ({ row }) => ({
        "data-hx-id": `external-media-row-${row.id}-actions`,
      }),
    },
  ];

function renderExternalProductsRichTable(
  productsPage: ExternalProductsPage,
  rows: readonly ExternalProductDetail[],
): string {
  const tableHtml = uiDataTable({
    data: [...rows],
    columns: externalProductRichColumns,
    className: "external-media-table",
    rowAttrs: (row) => ({
      "data-hx-id": `external-media-row-${row.id}`,
      "data-hx-key": row.id,
      class: getExternalMediaRowClass(row),
    }),
    bodyAttrs: {
      "data-hx-id": "external-media-products-body",
      "data-hx-list": "external-media-products-body",
    },
  });

  return `<section>
  <h2>Products (Rich Rendering Mode)</h2>
  ${tableHtml}

  <div class="pager">
    ${uiButton({
      label: "← Prev",
      bind: "external-media-page-prev",
      variant: "secondary",
      disabled: productsPage.page <= 1,
      attrs: { "data-hx-id": "external-media-prev-btn" },
    })}
    <span data-hx-id="external-media-page-label">Page ${productsPage.page} / ${productsPage.totalPages}</span>
    ${uiButton({
      label: "Next →",
      bind: "external-media-page-next",
      variant: "secondary",
      disabled: productsPage.page >= productsPage.totalPages,
      attrs: { "data-hx-id": "external-media-next-btn" },
    })}
    <span data-hx-id="external-media-total-label">(Total rows: ${productsPage.total})</span>
    <span data-hx-id="external-media-page-state" data-page="${productsPage.page}" data-page-size="${productsPage.pageSize}" data-total="${productsPage.total}" data-total-pages="${productsPage.totalPages}" hidden></span>
  </div>
</section>

<div data-hx-id="external-media-modal-overlay" class="drawer-overlay" style="display: none;">
  <div data-hx-id="external-media-modal-panel" class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="external-media-modal-title">
    <div class="drawer-header">
      <h2 data-hx-id="external-media-modal-title">Product Details</h2>
      ${uiButton({ label: "Close", bind: "external-media-detail-close", variant: "ghost", attrs: { "data-hx-id": "external-media-modal-close-btn" } })}
    </div>

    <img data-hx-id="external-media-modal-thumbnail" class="drawer-thumb" alt="" src="" />

    <dl class="drawer-grid">
      <dt>ID</dt><dd data-hx-id="external-media-modal-id">-</dd>
      <dt>Brand</dt><dd data-hx-id="external-media-modal-brand">-</dd>
      <dt>Category</dt><dd data-hx-id="external-media-modal-category">-</dd>
      <dt>Price</dt><dd data-hx-id="external-media-modal-price">-</dd>
      <dt>Stock</dt><dd data-hx-id="external-media-modal-stock">-</dd>
      <dt>Rating</dt><dd data-hx-id="external-media-modal-rating">-</dd>
      <dt>Source</dt><dd data-hx-id="external-media-modal-source">-</dd>
    </dl>

    <section>
      <h3>Description</h3>
      <p data-hx-id="external-media-modal-description">-</p>
    </section>
  </div>
</div>`;
}

export function renderExternalProductsRichPage(
  productsPage: ExternalProductsPage,
  rows: readonly ExternalProductDetail[],
): string {
  return renderExternalProductsRichCompiledView({
    tableAndModal: renderExternalProductsRichTable(productsPage, rows),
  });
}
