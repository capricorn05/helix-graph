import { escapeHtml } from "../../helix/html.js";
import {
  EXTERNAL_PRODUCTS_SORT_COLUMNS,
  type ExternalProductsFilters,
  type ExternalProductsSortColumn,
} from "./external-products-query.js";

export type HostListingsSortColumn = ExternalProductsSortColumn;
export type HostListingsFilters = ExternalProductsFilters;
export type HostListingsSortDirection = "asc" | "desc";

export interface HostListingRow {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  description: string;
  thumbnail: string;
  sourceId: number;
}

export interface HostListingsPageState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: HostListingsSortColumn;
  sortDir: HostListingsSortDirection;
  filters: HostListingsFilters;
}

export function truncateHostListingDescription(description: string): string {
  const normalized = description.trim();
  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
}

function renderHostListingMedia(
  row: Pick<HostListingRow, "title" | "thumbnail">,
): string {
  if (row.thumbnail.trim().length > 0) {
    return `<img class="host-listing-card__image" src="${escapeHtml(row.thumbnail)}" alt="${escapeHtml(`${row.title} thumbnail`)}" loading="lazy" />`;
  }

  return '<div class="host-listing-card__image host-listing-card__image--empty" aria-hidden="true">No image</div>';
}

export function renderHostListingCard(
  row: HostListingRow,
  rowIndex: number,
): string {
  return `<article class="host-listing-card" data-hx-id="host-listing-card-${row.id}" data-hx-key="host-listing-card-${row.id}">
    ${renderHostListingMedia(row)}
    <div class="host-listing-card__content">
      <div class="host-listing-card__title-row">
        <h3 class="host-listing-card__title" data-hx-id="host-listing-title-${row.id}">${escapeHtml(row.title)}</h3>
        <span class="host-listing-card__rating" data-hx-id="host-listing-rating-${row.id}">★ ${row.rating.toFixed(1)}</span>
      </div>
      <p class="host-listing-card__meta" data-hx-id="host-listing-meta-${row.id}">${escapeHtml(row.brand)} · ${escapeHtml(row.category)}</p>
      <p class="host-listing-card__description" data-hx-id="host-listing-description-${row.id}">${escapeHtml(truncateHostListingDescription(row.description))}</p>
      <p class="host-listing-card__price" data-hx-id="host-listing-price-${row.id}"><strong>$${row.price.toFixed(2)}</strong> / night</p>
      <p class="host-listing-card__stock" data-hx-id="host-listing-stock-${row.id}">${row.stock} available</p>
      <p class="host-listing-card__location" data-hx-id="host-listing-location-${row.id}">Hosted by ${escapeHtml(row.brand)} · Listing ${rowIndex + 1}</p>
    </div>
  </article>`;
}

export function renderHostListingsCards(
  rows: readonly HostListingRow[],
): string {
  return rows
    .map((row, rowIndex) => renderHostListingCard(row, rowIndex))
    .join("");
}

export function buildHostListingsPageHref(
  productsPage: HostListingsPageState,
  page: number,
): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));

  if (productsPage.sortCol !== "id") {
    searchParams.set("sortCol", productsPage.sortCol);
  }

  if (productsPage.sortDir !== "asc") {
    searchParams.set("sortDir", productsPage.sortDir);
  }

  for (const column of EXTERNAL_PRODUCTS_SORT_COLUMNS) {
    const value = productsPage.filters[column]?.trim();
    if (!value) {
      continue;
    }

    searchParams.set(column, value);
  }

  return `/host-listings?${searchParams.toString()}`;
}

export function renderHostListingsPager(
  productsPage: HostListingsPageState,
): string {
  const prevPage = productsPage.page - 1;
  const nextPage = productsPage.page + 1;

  const prevControl =
    productsPage.page > 1
      ? `<a href="${buildHostListingsPageHref(productsPage, prevPage)}" class="admin-nav-link host-listings-pager__link" data-host-listings-page="prev">← Prev</a>`
      : '<span class="admin-nav-link host-listings-pager__link is-disabled" aria-disabled="true">← Prev</span>';

  const nextControl =
    productsPage.page < productsPage.totalPages
      ? `<a href="${buildHostListingsPageHref(productsPage, nextPage)}" class="admin-nav-link host-listings-pager__link" data-host-listings-page="next">Next →</a>`
      : '<span class="admin-nav-link host-listings-pager__link is-disabled" aria-disabled="true">Next →</span>';

  return `<div class="host-listings-pager">
    ${prevControl}
    <span class="host-listings-pager__label" data-hx-id="host-listings-page-label">Page ${productsPage.page} / ${productsPage.totalPages}</span>
    ${nextControl}
    <span class="host-listings-pager__total" data-hx-id="host-listings-total-label">(${productsPage.total} listings)</span>
    <span
      data-hx-id="host-listings-page-state"
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
