import type { SortDirection } from "../domain.js";

export const MONGO_AIRBNB_SORT_COLUMNS = [
  "reviewScore",
  "price",
  "reviews",
  "accommodates",
  "name",
] as const;

export type MongoAirbnbSortColumn = (typeof MONGO_AIRBNB_SORT_COLUMNS)[number];

export const MONGO_AIRBNB_MARKET_OPTIONS = [
  "Barcelona",
  "Istanbul",
  "Montreal",
  "New York",
  "Portland",
  "Rio De Janeiro",
  "Sydney",
] as const;

export const MONGO_AIRBNB_ROOM_TYPE_OPTIONS = [
  "Entire home/apt",
  "Private room",
  "Shared room",
  "Hotel room",
] as const;

export interface MongoAirbnbFilters {
  market?: string;
  roomType?: string;
  maxPrice?: number;
  minGuests?: number;
}

export interface MongoAirbnbQuery {
  page: number;
  pageSize: number;
  sortCol: MongoAirbnbSortColumn;
  sortDir: SortDirection;
  filters: MongoAirbnbFilters;
}
