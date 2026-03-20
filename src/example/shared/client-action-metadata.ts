import { defineClientActionMetadata } from "../../helix/client-action-metadata.js";

export const appClientActionMetadata = defineClientActionMetadata({
  "app-nav": {
    actionId: "navigate",
    handlerExport: "onAppNavigate",
    preventDefault: true,
  },
  "create-user": {
    actionId: "createUser",
  },
  "external-detail-close": {
    actionId: "external-detail",
  },
  "external-detail-open": {
    actionId: "external-detail",
  },
  "external-media-detail-close": {
    actionId: "external-media-detail",
  },
  "external-media-detail-open": {
    actionId: "external-media-detail",
  },
  "external-media-page-next": {
    actionId: "external-media-page",
  },
  "external-media-page-prev": {
    actionId: "external-media-page",
  },
  "external-page-next": {
    actionId: "external-page",
  },
  "external-page-prev": {
    actionId: "external-page",
  },
  "load-users-panel": {
    actionId: "loadUsersPanel",
  },
  "page-next": {
    actionId: "setPage",
    handlerExport: "onNextPage",
  },
  "page-prev": {
    actionId: "setPage",
    handlerExport: "onPrevPage",
  },
  "posts-page-next": {
    actionId: "posts-page",
  },
  "posts-page-prev": {
    actionId: "posts-page",
  },
  "sort-email": {
    actionId: "setSort",
    handlerExport: "onSortByEmail",
  },
  "sort-name": {
    actionId: "setSort",
    handlerExport: "onSortByName",
  },
  "user-detail-close": {
    actionId: "user-detail",
  },
  "user-detail-open": {
    actionId: "user-detail",
  },
});
