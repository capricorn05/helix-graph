import type { SortColumn, SortDirection } from "../domain.js";
import {
  EXTERNAL_PRODUCTS_SORT_COLUMNS,
  type ExternalProductsFilters,
  type ExternalProductsSortColumn,
} from "../shared/external-products-query.js";
import {
  MONGO_AIRBNB_MARKET_OPTIONS,
  MONGO_AIRBNB_ROOM_TYPE_OPTIONS,
  MONGO_AIRBNB_SORT_COLUMNS,
  type MongoAirbnbFilters,
  type MongoAirbnbQuery,
  type MongoAirbnbSortColumn,
} from "../shared/mongo-airbnb-query.js";

export { EXTERNAL_PRODUCTS_SORT_COLUMNS };
export type { ExternalProductsFilters, ExternalProductsSortColumn };
export {
  MONGO_AIRBNB_MARKET_OPTIONS,
  MONGO_AIRBNB_ROOM_TYPE_OPTIONS,
  MONGO_AIRBNB_SORT_COLUMNS,
};
export type { MongoAirbnbFilters, MongoAirbnbQuery, MongoAirbnbSortColumn };

export const PAGE_SIZE = 6;

export interface ExternalProductsQuery {
  page: number;
  pageSize: number;
  sortCol: ExternalProductsSortColumn;
  sortDir: SortDirection;
  filters: ExternalProductsFilters;
}

export interface UsersResourceContext {
  page: number;
  pageSize: number;
  sortCol: SortColumn;
  sortDir: SortDirection;
}

function parseOptionalTextFilter(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 80);
}

function parseOptionalPositiveNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function parseSortColumn(value: string | null): SortColumn {
  return value === "email" ? "email" : "name";
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

export function parseExternalProductsSortColumn(
  value: string | null,
): ExternalProductsSortColumn {
  return EXTERNAL_PRODUCTS_SORT_COLUMNS.includes(
    value as ExternalProductsSortColumn,
  )
    ? (value as ExternalProductsSortColumn)
    : "id";
}

export function parseMongoAirbnbSortColumn(
  value: string | null,
): MongoAirbnbSortColumn {
  return MONGO_AIRBNB_SORT_COLUMNS.includes(value as MongoAirbnbSortColumn)
    ? (value as MongoAirbnbSortColumn)
    : "reviewScore";
}

export function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function resolveExternalProductsFilters(
  searchParams: URLSearchParams,
): ExternalProductsFilters {
  const filters: ExternalProductsFilters = {};

  for (const column of EXTERNAL_PRODUCTS_SORT_COLUMNS) {
    const value = searchParams.get(column)?.trim();
    if (value) {
      filters[column] = value;
    }
  }

  return filters;
}

export function resolveMongoAirbnbFilters(
  searchParams: URLSearchParams,
): MongoAirbnbFilters {
  const market = parseOptionalTextFilter(searchParams.get("market"));
  const roomType = parseOptionalTextFilter(searchParams.get("roomType"));
  const maxPrice = parseOptionalPositiveNumber(searchParams.get("maxPrice"));
  const minGuests = parseOptionalPositiveNumber(searchParams.get("minGuests"));

  const filters: MongoAirbnbFilters = {};

  if (
    market &&
    MONGO_AIRBNB_MARKET_OPTIONS.includes(
      market as (typeof MONGO_AIRBNB_MARKET_OPTIONS)[number],
    )
  ) {
    filters.market = market;
  }

  if (
    roomType &&
    MONGO_AIRBNB_ROOM_TYPE_OPTIONS.includes(
      roomType as (typeof MONGO_AIRBNB_ROOM_TYPE_OPTIONS)[number],
    )
  ) {
    filters.roomType = roomType;
  }

  if (maxPrice !== undefined) {
    filters.maxPrice = Math.min(Math.floor(maxPrice), 5_000);
  }

  if (minGuests !== undefined) {
    filters.minGuests = Math.min(Math.floor(minGuests), 16);
  }

  return filters;
}

export function createExternalProductsQuery(
  pageSize: number,
  overrides: Partial<ExternalProductsQuery> = {},
): ExternalProductsQuery {
  return {
    page: overrides.page ?? 1,
    pageSize,
    sortCol: overrides.sortCol ?? "id",
    sortDir: overrides.sortDir ?? "asc",
    filters: overrides.filters ?? {},
  };
}

export function createMongoAirbnbQuery(
  pageSize: number,
  overrides: Partial<MongoAirbnbQuery> = {},
): MongoAirbnbQuery {
  return {
    page: overrides.page ?? 1,
    pageSize,
    sortCol: overrides.sortCol ?? "reviewScore",
    sortDir: overrides.sortDir ?? "desc",
    filters: overrides.filters ?? {},
  };
}

export function resolveExternalProductsQuery(
  url: URL,
  pageSize: number,
): ExternalProductsQuery {
  return createExternalProductsQuery(pageSize, {
    page: parsePage(url.searchParams.get("page")),
    sortCol: parseExternalProductsSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir")),
    filters: resolveExternalProductsFilters(url.searchParams),
  });
}

export function resolveMongoAirbnbQuery(
  url: URL,
  pageSize: number,
): MongoAirbnbQuery {
  return createMongoAirbnbQuery(pageSize, {
    page: parsePage(url.searchParams.get("page")),
    sortCol: parseMongoAirbnbSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir")),
    filters: resolveMongoAirbnbFilters(url.searchParams),
  });
}

export function resolveUsersQuery(url: URL): UsersResourceContext {
  return {
    page: parsePage(url.searchParams.get("page")),
    pageSize: PAGE_SIZE,
    sortCol: parseSortColumn(url.searchParams.get("sortCol")),
    sortDir: parseSortDirection(url.searchParams.get("sortDir")),
  };
}
