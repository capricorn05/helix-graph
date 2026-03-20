import { defineRoute, createRouter } from "../../helix/index.js";
import { sendJson } from "../utils/http.js";

// Page handlers
import {
  handleHome,
  handleUserDetail,
  handleUserEdit,
} from "../handlers/users.handler.js";
import {
  handleDashboard,
  handleSettings,
  handleAbout,
  handleSearch,
  handleReports,
  handleInteractions,
  handlePrimitives,
  handleExternalGrid,
  handlePosts,
  handlePostsNew,
  handleExternalData,
  handleExternalDataRich,
  handleHostListings,
  handleAirbnbMongo,
  handleUsersPanelComponent,
  handleAppCoreComponent,
} from "../handlers/pages.handler.js";

// API handlers
import {
  handleUsersApi,
  handleUserDetailApi,
  handleUsersSuggestApi,
  handleCreateUser,
  handleCreatePost,
  handleReorderPosts,
  handleUserStats,
  handleExternalDataApi,
  handleExternalDataRichApi,
  handleHostListingsApi,
  handleMongoAirbnbApi,
  handleExternalDataDetailApi,
  handlePostsApi,
  handleInvalidationStream,
  handleDeleteUser,
  handleActivateUser,
  handleUpdateUser,
  handleSubmitPrimitiveMessage,
} from "../handlers/api.handler.js";

// Utility handlers
import { handleStaticFile } from "../handlers/static.handler.js";

// ---------------------------------------------------------------------------
// Route declarations — each call registers a RouteNode in the UnifiedGraph
// ---------------------------------------------------------------------------

// Pages
const postsRoute = defineRoute("GET", "/posts", handlePosts);
const postsNewRoute = defineRoute("GET", "/posts/new", handlePostsNew);
const homeRoute = defineRoute("GET", "/", handleHome);
const userDetailRoute = defineRoute("GET", "/users/:id", handleUserDetail);
const userEditRoute = defineRoute("GET", "/users/:id/edit", handleUserEdit);
const dashboardRoute = defineRoute("GET", "/dashboard", handleDashboard);
const settingsRoute = defineRoute("GET", "/settings", handleSettings);
const aboutRoute = defineRoute("GET", "/about", handleAbout);
const searchRoute = defineRoute("GET", "/search", handleSearch);
const reportsRoute = defineRoute("GET", "/reports", handleReports);
const interactionsRoute = defineRoute(
  "GET",
  "/interactions",
  handleInteractions,
);
const primitivesRoute = defineRoute("GET", "/primitives", handlePrimitives);
const externalGridRoute = defineRoute(
  "GET",
  "/external-grid",
  handleExternalGrid,
);
const externalDataRoute = defineRoute(
  "GET",
  "/external-data",
  handleExternalData,
);
const externalDataRichRoute = defineRoute(
  "GET",
  "/external-data-rich",
  handleExternalDataRich,
);
const hostListingsRoute = defineRoute(
  "GET",
  "/host-listings",
  handleHostListings,
);
const airbnbMongoRoute = defineRoute("GET", "/airbnb-mongo", handleAirbnbMongo);
const usersPanelComponentRoute = defineRoute(
  "GET",
  "/components/users-panel",
  handleUsersPanelComponent,
);
const appCoreComponentRoute = defineRoute(
  "GET",
  "/components/app-core",
  handleAppCoreComponent,
);

// API
const apiUsersRoute = defineRoute("GET", "/api/users", handleUsersApi);
const apiUsersSuggestRoute = defineRoute(
  "GET",
  "/api/users/suggest",
  handleUsersSuggestApi,
);
const apiUserDetailRoute = defineRoute(
  "GET",
  "/api/users/:id",
  handleUserDetailApi,
);
const apiInvalidationStreamRoute = defineRoute(
  "GET",
  "/api/invalidation-stream",
  handleInvalidationStream,
);
const apiStatsRoute = defineRoute("GET", "/api/stats", handleUserStats);
const apiExternalDataRoute = defineRoute(
  "GET",
  "/api/external-data",
  handleExternalDataApi,
);
const apiExternalDataRichRoute = defineRoute(
  "GET",
  "/api/external-data-rich",
  handleExternalDataRichApi,
);
const apiHostListingsRoute = defineRoute(
  "GET",
  "/api/host-listings",
  handleHostListingsApi,
);
const apiAirbnbMongoRoute = defineRoute(
  "GET",
  "/api/airbnb-mongo",
  handleMongoAirbnbApi,
);
const apiExternalDataDetailRoute = defineRoute(
  "GET",
  "/api/external-data/:id",
  handleExternalDataDetailApi,
);
const apiPostsRoute = defineRoute("GET", "/api/posts", handlePostsApi);
const createUserRoute = defineRoute(
  "POST",
  "/actions/create-user",
  handleCreateUser,
);
const createPostRoute = defineRoute(
  "POST",
  "/actions/create-post",
  handleCreatePost,
);
const reorderPostsRoute = defineRoute(
  "POST",
  "/actions/reorder-posts",
  handleReorderPosts,
);
const submitPrimitiveMessageRoute = defineRoute(
  "POST",
  "/actions/submit-primitive-message",
  handleSubmitPrimitiveMessage,
);
const updateUserRoute = defineRoute("POST", "/api/users/:id", handleUpdateUser);
const deleteUserRoute = defineRoute(
  "DELETE",
  "/api/users/:id",
  handleDeleteUser,
);
const activateUserRoute = defineRoute(
  "POST",
  "/api/users/:id/activate",
  handleActivateUser,
);

// Utility
const healthRoute = defineRoute("GET", "/health", (ctx) =>
  sendJson(ctx, 200, { ok: true }),
);
const staticClientRoute = defineRoute("GET", "/client/*", handleStaticFile);
const staticSharedRoute = defineRoute("GET", "/shared/*", handleStaticFile);
const staticHelixRoute = defineRoute("GET", "/helix/*", handleStaticFile);

// ---------------------------------------------------------------------------
// Router — compiled route table, tested in declaration order
// ---------------------------------------------------------------------------

export const router = createRouter([
  // Pages (specific before wildcard)
  homeRoute,
  userDetailRoute,
  userEditRoute,
  dashboardRoute,
  settingsRoute,
  aboutRoute,
  searchRoute,
  reportsRoute,
  primitivesRoute,
  interactionsRoute,
  externalGridRoute,
  externalDataRoute,
  externalDataRichRoute,
  hostListingsRoute,
  airbnbMongoRoute,
  postsNewRoute,
  postsRoute,
  usersPanelComponentRoute,
  appCoreComponentRoute,
  // API
  apiUsersRoute,
  apiUsersSuggestRoute,
  apiUserDetailRoute,
  apiInvalidationStreamRoute,
  apiStatsRoute,
  apiExternalDataRoute,
  apiExternalDataRichRoute,
  apiHostListingsRoute,
  apiAirbnbMongoRoute,
  apiExternalDataDetailRoute,
  apiPostsRoute,
  createUserRoute,
  createPostRoute,
  reorderPostsRoute,
  submitPrimitiveMessageRoute,
  updateUserRoute,
  deleteUserRoute,
  activateUserRoute,
  // Utility
  healthRoute,
  staticClientRoute,
  staticSharedRoute,
  staticHelixRoute,
]);
