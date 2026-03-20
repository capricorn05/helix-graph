import type { MongoAirbnbListingsPage } from "../resources/mongo-airbnb.resource.js";
import {
  renderMongoAirbnbCards,
  renderMongoAirbnbControls,
  renderMongoAirbnbPager,
} from "../shared/mongo-airbnb.js";
import { renderMongoAirbnbCompiledView } from "./compiled/mongo-airbnb.compiled.js";

function resolveSourceLabel(source: MongoAirbnbListingsPage["source"]): string {
  return source === "mongodb"
    ? "Source: MongoDB Atlas sample_airbnb.listingsAndReviews"
    : "Source: Offline fallback listings (set MONGODB_URI to use MongoDB)";
}

export function renderMongoAirbnbPage(page: MongoAirbnbListingsPage): string {
  return renderMongoAirbnbCompiledView({
    totalListings: page.total,
    sourceLabel: resolveSourceLabel(page.source),
    controlsHtml: renderMongoAirbnbControls(page),
    listingsGridHtml: renderMongoAirbnbCards(page.rows),
    pagerHtml: renderMongoAirbnbPager(page),
  });
}
