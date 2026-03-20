import { escapeHtml } from "../../helix/html.js";
import type { SortDirection } from "../domain.js";
import {
  MONGO_AIRBNB_MARKET_OPTIONS,
  MONGO_AIRBNB_ROOM_TYPE_OPTIONS,
  type MongoAirbnbFilters,
  type MongoAirbnbSortColumn,
} from "./mongo-airbnb-query.js";

export interface MongoAirbnbListingRow {
  id: string;
  name: string;
  summary: string;
  propertyType: string;
  roomType: string;
  market: string;
  country: string;
  hostName: string;
  imageUrl: string;
  price: number;
  reviewScore: number;
  reviewsCount: number;
  accommodates: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
}

export interface MongoAirbnbPageState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortCol: MongoAirbnbSortColumn;
  sortDir: SortDirection;
  filters: MongoAirbnbFilters;
  source: "mongodb" | "offline-sample";
}

interface MongoAirbnbHrefOverrides {
  page?: number;
  sortCol?: MongoAirbnbSortColumn;
  sortDir?: SortDirection;
  filters?: Partial<MongoAirbnbFilters>;
}

const DEFAULT_SORT_COL: MongoAirbnbSortColumn = "reviewScore";
const DEFAULT_SORT_DIR: SortDirection = "desc";

function toDomToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function toSummary(summary: string): string {
  const normalized = summary.trim();
  if (normalized.length <= 175) {
    return normalized;
  }

  return `${normalized.slice(0, 172)}...`;
}

function formatNightlyPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) {
    return "Price unavailable";
  }

  return `$${price.toFixed(0)} / night`;
}

function normalizeReviewToFiveScale(reviewScore: number): number {
  if (!Number.isFinite(reviewScore)) {
    return 0;
  }

  if (reviewScore > 5) {
    return Math.max(0, Math.min(5, reviewScore / 20));
  }

  return Math.max(0, Math.min(5, reviewScore));
}

function formatReviewLabel(reviewScore: number, reviewCount: number): string {
  const score = normalizeReviewToFiveScale(reviewScore);
  return `${score.toFixed(1)} · ${reviewCount} reviews`;
}

function renderImage(row: MongoAirbnbListingRow): string {
  if (row.imageUrl.trim().length > 0) {
    return `<img class="airbnb-mongo-card__image" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(`${row.name} photo`)}" loading="lazy" decoding="async" />`;
  }

  return '<div class="airbnb-mongo-card__image airbnb-mongo-card__image--empty" aria-hidden="true">No photo</div>';
}

function renderFilterChip(
  label: string,
  href: string,
  active: boolean,
  kind: "market" | "room" | "budget" | "guests" | "sort" | "reset",
): string {
  const activeClass = active ? " is-active" : "";
  return `<a href="${escapeHtml(href)}" class="airbnb-mongo-chip${activeClass}" data-airbnb-mongo-nav="${kind}">${escapeHtml(label)}</a>`;
}

function hasActiveFilters(filters: MongoAirbnbFilters): boolean {
  return Boolean(
    filters.market ||
    filters.roomType ||
    typeof filters.maxPrice === "number" ||
    typeof filters.minGuests === "number",
  );
}

export function buildMongoAirbnbPageHref(
  state: MongoAirbnbPageState,
  overrides: MongoAirbnbHrefOverrides = {},
): string {
  const nextFilters: MongoAirbnbFilters = {
    ...state.filters,
    ...(overrides.filters ?? {}),
  };

  if (
    nextFilters.market !== undefined &&
    nextFilters.market.trim().length === 0
  ) {
    delete nextFilters.market;
  }

  if (
    nextFilters.roomType !== undefined &&
    nextFilters.roomType.trim().length === 0
  ) {
    delete nextFilters.roomType;
  }

  if (
    nextFilters.maxPrice !== undefined &&
    (!Number.isFinite(nextFilters.maxPrice) || nextFilters.maxPrice <= 0)
  ) {
    delete nextFilters.maxPrice;
  }

  if (
    nextFilters.minGuests !== undefined &&
    (!Number.isFinite(nextFilters.minGuests) || nextFilters.minGuests <= 0)
  ) {
    delete nextFilters.minGuests;
  }

  const page = overrides.page ?? state.page;
  const sortCol = overrides.sortCol ?? state.sortCol;
  const sortDir = overrides.sortDir ?? state.sortDir;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));

  if (sortCol !== DEFAULT_SORT_COL) {
    searchParams.set("sortCol", sortCol);
  }

  if (sortDir !== DEFAULT_SORT_DIR) {
    searchParams.set("sortDir", sortDir);
  }

  if (nextFilters.market) {
    searchParams.set("market", nextFilters.market);
  }

  if (nextFilters.roomType) {
    searchParams.set("roomType", nextFilters.roomType);
  }

  if (typeof nextFilters.maxPrice === "number") {
    searchParams.set("maxPrice", String(Math.floor(nextFilters.maxPrice)));
  }

  if (typeof nextFilters.minGuests === "number") {
    searchParams.set("minGuests", String(Math.floor(nextFilters.minGuests)));
  }

  return `/airbnb-mongo?${searchParams.toString()}`;
}

function renderMarketChips(state: MongoAirbnbPageState): string {
  const chips = [
    renderFilterChip(
      "Any market",
      buildMongoAirbnbPageHref(state, {
        page: 1,
        filters: { market: undefined },
      }),
      !state.filters.market,
      "market",
    ),
  ];

  for (const market of MONGO_AIRBNB_MARKET_OPTIONS) {
    chips.push(
      renderFilterChip(
        market,
        buildMongoAirbnbPageHref(state, {
          page: 1,
          filters: { market },
        }),
        state.filters.market === market,
        "market",
      ),
    );
  }

  return chips.join("");
}

function renderRoomTypeChips(state: MongoAirbnbPageState): string {
  const chips = [
    renderFilterChip(
      "Any room",
      buildMongoAirbnbPageHref(state, {
        page: 1,
        filters: { roomType: undefined },
      }),
      !state.filters.roomType,
      "room",
    ),
  ];

  for (const roomType of MONGO_AIRBNB_ROOM_TYPE_OPTIONS) {
    chips.push(
      renderFilterChip(
        roomType,
        buildMongoAirbnbPageHref(state, {
          page: 1,
          filters: { roomType },
        }),
        state.filters.roomType === roomType,
        "room",
      ),
    );
  }

  return chips.join("");
}

function renderBudgetChips(state: MongoAirbnbPageState): string {
  const presets = [180, 280, 420] as const;

  return presets
    .map((maxPrice) =>
      renderFilterChip(
        `Under $${maxPrice}`,
        buildMongoAirbnbPageHref(state, {
          page: 1,
          filters: { maxPrice },
        }),
        state.filters.maxPrice === maxPrice,
        "budget",
      ),
    )
    .join("");
}

function renderGuestChips(state: MongoAirbnbPageState): string {
  const presets = [2, 4, 6] as const;

  return presets
    .map((minGuests) =>
      renderFilterChip(
        `${minGuests}+ guests`,
        buildMongoAirbnbPageHref(state, {
          page: 1,
          filters: { minGuests },
        }),
        state.filters.minGuests === minGuests,
        "guests",
      ),
    )
    .join("");
}

function renderSortChips(state: MongoAirbnbPageState): string {
  const sortPresets: Array<{
    label: string;
    sortCol: MongoAirbnbSortColumn;
    sortDir: SortDirection;
  }> = [
    { label: "Top Rated", sortCol: "reviewScore", sortDir: "desc" },
    { label: "Most Reviewed", sortCol: "reviews", sortDir: "desc" },
    { label: "Price Low", sortCol: "price", sortDir: "asc" },
    { label: "Price High", sortCol: "price", sortDir: "desc" },
    { label: "Spacious", sortCol: "accommodates", sortDir: "desc" },
  ];

  return sortPresets
    .map((preset) =>
      renderFilterChip(
        preset.label,
        buildMongoAirbnbPageHref(state, {
          page: 1,
          sortCol: preset.sortCol,
          sortDir: preset.sortDir,
        }),
        state.sortCol === preset.sortCol && state.sortDir === preset.sortDir,
        "sort",
      ),
    )
    .join("");
}

export function renderMongoAirbnbControls(state: MongoAirbnbPageState): string {
  const activeFilters = hasActiveFilters(state.filters);

  return `<div class="airbnb-mongo-controls" data-hx-id="airbnb-mongo-controls">
    <div class="airbnb-mongo-controls__group">
      <span class="airbnb-mongo-controls__label">Market</span>
      <div class="airbnb-mongo-controls__chips">${renderMarketChips(state)}</div>
    </div>

    <div class="airbnb-mongo-controls__group">
      <span class="airbnb-mongo-controls__label">Room Type</span>
      <div class="airbnb-mongo-controls__chips">${renderRoomTypeChips(state)}</div>
    </div>

    <div class="airbnb-mongo-controls__group">
      <span class="airbnb-mongo-controls__label">Quick Filters</span>
      <div class="airbnb-mongo-controls__chips">${renderBudgetChips(state)}${renderGuestChips(state)}</div>
    </div>

    <div class="airbnb-mongo-controls__group airbnb-mongo-controls__group--sort">
      <span class="airbnb-mongo-controls__label">Sort</span>
      <div class="airbnb-mongo-controls__chips">${renderSortChips(state)}</div>
      ${
        activeFilters
          ? renderFilterChip(
              "Reset filters",
              buildMongoAirbnbPageHref(state, {
                page: 1,
                filters: {
                  market: undefined,
                  roomType: undefined,
                  maxPrice: undefined,
                  minGuests: undefined,
                },
              }),
              false,
              "reset",
            )
          : ""
      }
    </div>
  </div>`;
}

export function renderMongoAirbnbCard(row: MongoAirbnbListingRow): string {
  const domToken = toDomToken(row.id);

  return `<article class="airbnb-mongo-card" data-hx-id="airbnb-mongo-card-${domToken}" data-hx-key="airbnb-mongo-card-${escapeHtml(row.id)}">
    <div class="airbnb-mongo-card__media">
      ${renderImage(row)}
      <span class="airbnb-mongo-card__market">${escapeHtml(row.market)}, ${escapeHtml(row.country)}</span>
    </div>

    <div class="airbnb-mongo-card__content">
      <div class="airbnb-mongo-card__header">
        <h3 class="airbnb-mongo-card__title" data-hx-id="airbnb-mongo-card-title-${domToken}">${escapeHtml(row.name)}</h3>
        <span class="airbnb-mongo-card__price" data-hx-id="airbnb-mongo-card-price-${domToken}">${escapeHtml(formatNightlyPrice(row.price))}</span>
      </div>

      <p class="airbnb-mongo-card__meta" data-hx-id="airbnb-mongo-card-meta-${domToken}">${escapeHtml(row.propertyType)} · ${escapeHtml(row.roomType)} · Hosted by ${escapeHtml(row.hostName)}</p>
      <p class="airbnb-mongo-card__summary" data-hx-id="airbnb-mongo-card-summary-${domToken}">${escapeHtml(toSummary(row.summary))}</p>

      <div class="airbnb-mongo-card__stats">
        <span class="airbnb-mongo-card__stat">${escapeHtml(formatReviewLabel(row.reviewScore, row.reviewsCount))}</span>
        <span class="airbnb-mongo-card__stat">${row.accommodates} guests</span>
        <span class="airbnb-mongo-card__stat">${row.bedrooms} bed${row.bedrooms === 1 ? "" : "rooms"}</span>
        <span class="airbnb-mongo-card__stat">${row.bathrooms.toFixed(1)} baths</span>
      </div>
    </div>
  </article>`;
}

export function renderMongoAirbnbCards(
  rows: readonly MongoAirbnbListingRow[],
): string {
  if (rows.length === 0) {
    return `<div class="airbnb-mongo-empty" data-hx-id="airbnb-mongo-empty">
      <h3>No stays matched this filter set</h3>
      <p>Try widening the budget or clearing one of the active filters.</p>
    </div>`;
  }

  return rows.map((row) => renderMongoAirbnbCard(row)).join("");
}

export function renderMongoAirbnbPager(state: MongoAirbnbPageState): string {
  const prevControl =
    state.page > 1
      ? `<a href="${buildMongoAirbnbPageHref(state, { page: state.page - 1 })}" class="admin-nav-link airbnb-mongo-pager__link" data-airbnb-mongo-nav="pager">← Prev</a>`
      : '<span class="admin-nav-link airbnb-mongo-pager__link is-disabled" aria-disabled="true">← Prev</span>';

  const nextControl =
    state.page < state.totalPages
      ? `<a href="${buildMongoAirbnbPageHref(state, { page: state.page + 1 })}" class="admin-nav-link airbnb-mongo-pager__link" data-airbnb-mongo-nav="pager">Next →</a>`
      : '<span class="admin-nav-link airbnb-mongo-pager__link is-disabled" aria-disabled="true">Next →</span>';

  return `<div class="airbnb-mongo-pager">
    ${prevControl}
    <span class="airbnb-mongo-pager__label" data-hx-id="airbnb-mongo-page-label">Page ${state.page} / ${state.totalPages}</span>
    ${nextControl}
    <span class="airbnb-mongo-pager__total" data-hx-id="airbnb-mongo-total-label">${state.total} stays</span>
    <span class="airbnb-mongo-pager__source" data-hx-id="airbnb-mongo-source-label">Source: ${state.source === "mongodb" ? "MongoDB sample_airbnb" : "Offline curated sample"}</span>
    <span
      data-hx-id="airbnb-mongo-page-state"
      data-page="${state.page}"
      data-page-size="${state.pageSize}"
      data-total="${state.total}"
      data-total-pages="${state.totalPages}"
      data-sort-col="${escapeHtml(state.sortCol)}"
      data-sort-dir="${escapeHtml(state.sortDir)}"
      data-market="${escapeHtml(state.filters.market ?? "")}" 
      data-room-type="${escapeHtml(state.filters.roomType ?? "")}"
      data-max-price="${typeof state.filters.maxPrice === "number" ? state.filters.maxPrice : ""}"
      data-min-guests="${typeof state.filters.minGuests === "number" ? state.filters.minGuests : ""}"
      data-source="${escapeHtml(state.source)}"
      hidden
    ></span>
  </div>`;
}
