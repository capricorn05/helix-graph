import type { ExternalProductsPage } from "../resources/external-products.resource.js";
import {
  renderHostListingsCards,
  renderHostListingsPager,
  type HostListingRow,
} from "../shared/host-listings.js";
import { renderHostListingsCompiledView } from "./compiled/host-listings.compiled.js";

export function renderHostListingsPage(
  productsPage: ExternalProductsPage,
  rows: readonly HostListingRow[],
): string {
  return renderHostListingsCompiledView({
    totalListings: productsPage.total,
    listingsGridHtml: renderHostListingsCards(rows),
    pagerHtml: renderHostListingsPager(productsPage),
  });
}
