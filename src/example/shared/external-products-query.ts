export const EXTERNAL_PRODUCTS_SORT_COLUMNS = [
  "id",
  "title",
  "brand",
  "category",
  "price",
  "stock",
  "rating",
] as const;

export type ExternalProductsSortColumn =
  (typeof EXTERNAL_PRODUCTS_SORT_COLUMNS)[number];

export type ExternalProductsFilters = Partial<
  Record<ExternalProductsSortColumn, string>
>;
