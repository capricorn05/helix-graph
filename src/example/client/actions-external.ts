import { reconcileKeyed } from "../../helix/reconciler.js";
import {
  createDialogController,
  type DialogController,
} from "../../helix/primitives/dialog.js";
import type { Lane, PatchOp } from "../../helix/types.js";
import {
  HelixClientHandlerContext,
  HelixClientRuntime,
  makeInitialExternalDetailState,
} from "./runtime.js";
import {
  parseNumeric,
  schedulePatchBatch,
  scheduleReactivePatches,
} from "./actions-shared.js";

interface ExternalProductRow {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

interface ExternalProductsApiResponse {
  rows: ExternalProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExternalProductDetailApiResponse extends ExternalProductRow {
  description: string;
  thumbnail: string;
  sourceId: number;
}

interface ExternalMediaProductRow extends ExternalProductDetailApiResponse {}

interface ExternalMediaProductsApiResponse {
  rows: ExternalMediaProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExternalMediaPageState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type ExternalMediaPriceBand = "budget" | "mid" | "premium";
type ExternalMediaStockBand = "empty" | "low" | "healthy";
type ExternalMediaRatingBand = "low" | "mid" | "high";

const externalRuntimeReactivityInstalled = new WeakSet<HelixClientRuntime>();
let externalDetailDialog: DialogController | null = null;
let externalMediaDetailDialog: DialogController | null = null;

function ensureExternalDetailDialog(
  runtime: HelixClientRuntime,
): DialogController | null {
  if (externalDetailDialog) {
    return externalDetailDialog;
  }

  const overlayEl = document.querySelector<HTMLElement>(
    '[data-hx-id="external-modal-overlay"]',
  );
  const closeBtn = document.querySelector<HTMLElement>(
    '[data-hx-id="external-modal-close-btn"]',
  );
  if (!overlayEl || !closeBtn) {
    return null;
  }

  externalDetailDialog = createDialogController(closeBtn, overlayEl, {
    portal: false,
    defaultValue: false,
    openDisplay: "flex",
    onChange: (isOpen) => {
      if (!isOpen) {
        const current = runtime.externalDetailStateCell.get();
        if (current.open) {
          runtime.externalDetail = makeInitialExternalDetailState();
        }
      }
    },
  });

  return externalDetailDialog;
}

function ensureExternalMediaDetailDialog(): DialogController | null {
  if (externalMediaDetailDialog) {
    return externalMediaDetailDialog;
  }

  const overlayEl = document.querySelector<HTMLElement>(
    '[data-hx-id="external-media-modal-overlay"]',
  );
  const closeBtn = document.querySelector<HTMLElement>(
    '[data-hx-id="external-media-modal-close-btn"]',
  );
  if (!overlayEl || !closeBtn) {
    return null;
  }

  externalMediaDetailDialog = createDialogController(closeBtn, overlayEl, {
    portal: false,
    defaultValue: false,
    openDisplay: "flex",
  });

  return externalMediaDetailDialog;
}

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

function getExternalMediaPriceLabel(band: ExternalMediaPriceBand): string {
  switch (band) {
    case "budget":
      return "Budget";
    case "premium":
      return "Premium";
    default:
      return "Standard";
  }
}

function getExternalMediaStockLabel(band: ExternalMediaStockBand): string {
  switch (band) {
    case "empty":
      return "Out";
    case "low":
      return "Low";
    default:
      return "Ready";
  }
}

function getExternalMediaRatingLabel(band: ExternalMediaRatingBand): string {
  switch (band) {
    case "high":
      return "Top";
    case "low":
      return "Risk";
    default:
      return "Solid";
  }
}

function formatExternalMediaRatingStars(rating: number): string {
  const safeRating = Math.max(0, Math.min(5, rating));
  const filledStars = Math.max(0, Math.min(5, Math.round(safeRating)));
  return `${"★".repeat(filledStars)}${"☆".repeat(5 - filledStars)}`;
}

function truncateExternalMediaTitleForCell(title: string): string {
  const limit = 52;
  if (title.length <= limit) {
    return title;
  }

  return `${title.slice(0, limit - 1)}…`;
}

function installExternalRuntimeStateReactivity(
  runtime: HelixClientRuntime,
): void {
  if (externalRuntimeReactivityInstalled.has(runtime)) {
    return;
  }

  externalRuntimeReactivityInstalled.add(runtime);

  runtime.externalDerived.pageLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-state:page-label", [
      { op: "setText", targetId: "external-page-label", value },
    ]);
  });

  runtime.externalDerived.totalLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-state:total-label", [
      { op: "setText", targetId: "external-total-label", value },
    ]);
  });

  runtime.externalDerived.prevDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "external-state:prev-disabled", [
      {
        op: "setAttr",
        targetId: "external-prev-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.externalDerived.nextDisabled.subscribe((disabled) => {
    scheduleReactivePatches(runtime, "external-state:next-disabled", [
      {
        op: "setAttr",
        targetId: "external-next-btn",
        name: "disabled",
        value: disabled ? "disabled" : null,
      },
    ]);
  });

  runtime.externalStateCell.subscribe((state) => {
    scheduleReactivePatches(runtime, "external-state:attrs", [
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-page",
        value: String(state.page),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-page-size",
        value: String(state.pageSize),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-total",
        value: String(state.total),
      },
      {
        op: "setAttr",
        targetId: "external-page-state",
        name: "data-total-pages",
        value: String(state.totalPages),
      },
    ]);
  });

  runtime.externalDetailStateCell.subscribe((detail) => {
    scheduleReactivePatches(runtime, "external-detail:content", [
      { op: "setText", targetId: "external-modal-title", value: detail.title },
      { op: "setText", targetId: "external-modal-brand", value: detail.brand },
      {
        op: "setText",
        targetId: "external-modal-category",
        value: detail.category,
      },
      {
        op: "setText",
        targetId: "external-modal-description",
        value: detail.description,
      },
      {
        op: "setAttr",
        targetId: "external-modal-thumbnail",
        name: "src",
        value: detail.thumbnail || null,
      },
      {
        op: "setAttr",
        targetId: "external-modal-thumbnail",
        name: "alt",
        value: detail.thumbnailAlt,
      },
    ]);
  });

  runtime.externalDetailDerived.idLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:id", [
      { op: "setText", targetId: "external-modal-id", value },
    ]);
  });

  runtime.externalDetailDerived.priceLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:price", [
      { op: "setText", targetId: "external-modal-price", value },
    ]);
  });

  runtime.externalDetailDerived.stockLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:stock", [
      { op: "setText", targetId: "external-modal-stock", value },
    ]);
  });

  runtime.externalDetailDerived.ratingLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:rating", [
      { op: "setText", targetId: "external-modal-rating", value },
    ]);
  });

  runtime.externalDetailDerived.sourceLabel.subscribe((value) => {
    scheduleReactivePatches(runtime, "external-detail:source", [
      { op: "setText", targetId: "external-modal-source", value },
    ]);
  });

  ensureExternalDetailDialog(runtime);
}

export function syncExternalStateFromDom(runtime: HelixClientRuntime): void {
  installExternalRuntimeStateReactivity(runtime);

  const stateElement = document.querySelector(
    '[data-hx-id="external-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return;
  }

  runtime.externalState = {
    page: Math.max(
      1,
      Math.floor(
        parseNumeric(stateElement.dataset.page, runtime.externalState.page),
      ),
    ),
    pageSize: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.pageSize,
          runtime.externalState.pageSize,
        ),
      ),
    ),
    total: Math.max(
      0,
      Math.floor(
        parseNumeric(stateElement.dataset.total, runtime.externalState.total),
      ),
    ),
    totalPages: Math.max(
      1,
      Math.floor(
        parseNumeric(
          stateElement.dataset.totalPages,
          runtime.externalState.totalPages,
        ),
      ),
    ),
  };
}

export function readExternalMediaStateFromDom(): ExternalMediaPageState | null {
  const stateElement = document.querySelector(
    '[data-hx-id="external-media-page-state"]',
  );
  if (!(stateElement instanceof HTMLElement)) {
    return null;
  }

  return {
    page: Math.max(1, Math.floor(parseNumeric(stateElement.dataset.page, 1))),
    pageSize: Math.max(
      1,
      Math.floor(parseNumeric(stateElement.dataset.pageSize, 100)),
    ),
    total: Math.max(0, Math.floor(parseNumeric(stateElement.dataset.total, 0))),
    totalPages: Math.max(
      1,
      Math.floor(parseNumeric(stateElement.dataset.totalPages, 1)),
    ),
  };
}

export function syncExternalDetailStateFromDom(
  runtime: HelixClientRuntime,
): void {
  installExternalRuntimeStateReactivity(runtime);

  const overlay = document.querySelector(
    '[data-hx-id="external-modal-overlay"]',
  );
  if (!(overlay instanceof HTMLElement)) {
    return;
  }

  runtime.externalDetail = makeInitialExternalDetailState();
}

function createExternalProductRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-key", String(id));

  const idCell = document.createElement("td");
  idCell.setAttribute("data-hx-id", `external-row-${id}-id`);
  row.appendChild(idCell);

  const titleCell = document.createElement("td");
  titleCell.setAttribute("data-hx-id", `external-row-${id}-title`);
  row.appendChild(titleCell);

  const brandCell = document.createElement("td");
  brandCell.setAttribute("data-hx-id", `external-row-${id}-brand`);
  row.appendChild(brandCell);

  const categoryCell = document.createElement("td");
  categoryCell.setAttribute("data-hx-id", `external-row-${id}-category`);
  row.appendChild(categoryCell);

  const priceCell = document.createElement("td");
  priceCell.setAttribute("data-hx-id", `external-row-${id}-price`);
  row.appendChild(priceCell);

  const stockCell = document.createElement("td");
  stockCell.setAttribute("data-hx-id", `external-row-${id}-stock`);
  row.appendChild(stockCell);

  const ratingCell = document.createElement("td");
  ratingCell.setAttribute("data-hx-id", `external-row-${id}-rating`);
  row.appendChild(ratingCell);

  const actionCell = document.createElement("td");
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.textContent = "Details";
  detailButton.setAttribute("data-hx-id", `external-row-${id}-action`);
  detailButton.setAttribute("data-hx-bind", "external-detail-open");
  detailButton.setAttribute("data-row-id", String(id));
  actionCell.appendChild(detailButton);
  row.appendChild(actionCell);

  return row;
}

function createExternalMediaProductRowNode(key: string): Node {
  const id = Number(key);
  const row = document.createElement("tr");
  row.setAttribute("data-hx-id", `external-media-row-${id}`);
  row.setAttribute("data-hx-key", String(id));
  row.className = "external-media-row";

  const idCell = document.createElement("td");
  idCell.setAttribute("data-hx-id", `external-media-row-${id}-id`);
  row.appendChild(idCell);

  const previewCell = document.createElement("td");
  previewCell.setAttribute("data-hx-id", `external-media-row-${id}-preview`);
  previewCell.className = "external-media-preview-cell";
  const thumbWrap = document.createElement("div");
  thumbWrap.setAttribute("data-hx-id", `external-media-row-${id}-thumb-wrap`);
  thumbWrap.className = "external-media-thumb-wrap";

  const thumb = document.createElement("img");
  thumb.setAttribute("data-hx-id", `external-media-row-${id}-thumb`);
  thumb.className = "external-media-thumb";
  thumb.setAttribute("loading", "lazy");
  thumb.setAttribute("decoding", "async");
  thumb.alt = "";
  thumbWrap.appendChild(thumb);

  const thumbChip = document.createElement("span");
  thumbChip.setAttribute("data-hx-id", `external-media-row-${id}-thumb-chip`);
  thumbChip.className = "external-media-thumb-chip";
  thumbWrap.appendChild(thumbChip);
  previewCell.appendChild(thumbWrap);
  row.appendChild(previewCell);

  const titleCell = document.createElement("td");
  titleCell.setAttribute("data-hx-id", `external-media-row-${id}-title-cell`);
  const titleText = document.createElement("span");
  titleText.setAttribute("data-hx-id", `external-media-row-${id}-title`);
  titleCell.appendChild(titleText);
  row.appendChild(titleCell);

  const brandCell = document.createElement("td");
  brandCell.setAttribute("data-hx-id", `external-media-row-${id}-brand`);
  row.appendChild(brandCell);

  const categoryCell = document.createElement("td");
  categoryCell.setAttribute("data-hx-id", `external-media-row-${id}-category`);
  row.appendChild(categoryCell);

  const priceCell = document.createElement("td");
  priceCell.setAttribute("data-hx-id", `external-media-row-${id}-price`);
  const priceStack = document.createElement("div");
  priceStack.className = "external-media-cell-stack";
  const priceMain = document.createElement("span");
  priceMain.setAttribute("data-hx-id", `external-media-row-${id}-price-main`);
  priceMain.className = "external-media-main";
  priceStack.appendChild(priceMain);
  const pricePill = document.createElement("span");
  pricePill.setAttribute("data-hx-id", `external-media-row-${id}-price-pill`);
  pricePill.className = "external-media-pill";
  priceStack.appendChild(pricePill);
  priceCell.appendChild(priceStack);
  row.appendChild(priceCell);

  const stockCell = document.createElement("td");
  stockCell.setAttribute("data-hx-id", `external-media-row-${id}-stock`);
  const stockStack = document.createElement("div");
  stockStack.className = "external-media-cell-stack";
  const stockMain = document.createElement("span");
  stockMain.setAttribute("data-hx-id", `external-media-row-${id}-stock-main`);
  stockMain.className = "external-media-main";
  stockStack.appendChild(stockMain);
  const stockPill = document.createElement("span");
  stockPill.setAttribute("data-hx-id", `external-media-row-${id}-stock-pill`);
  stockPill.className = "external-media-pill";
  stockStack.appendChild(stockPill);
  stockCell.appendChild(stockStack);
  row.appendChild(stockCell);

  const ratingCell = document.createElement("td");
  ratingCell.setAttribute("data-hx-id", `external-media-row-${id}-rating`);
  const ratingStack = document.createElement("div");
  ratingStack.className = "external-media-cell-stack";
  const ratingMain = document.createElement("span");
  ratingMain.setAttribute("data-hx-id", `external-media-row-${id}-rating-main`);
  ratingMain.className = "external-media-main";
  ratingStack.appendChild(ratingMain);
  const ratingStars = document.createElement("span");
  ratingStars.setAttribute(
    "data-hx-id",
    `external-media-row-${id}-rating-stars`,
  );
  ratingStars.className = "external-media-stars";
  ratingStack.appendChild(ratingStars);
  const ratingPill = document.createElement("span");
  ratingPill.setAttribute("data-hx-id", `external-media-row-${id}-rating-pill`);
  ratingPill.className = "external-media-pill";
  ratingStack.appendChild(ratingPill);
  ratingCell.appendChild(ratingStack);
  row.appendChild(ratingCell);

  const actionCell = document.createElement("td");
  actionCell.setAttribute("data-hx-id", `external-media-row-${id}-actions`);
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.textContent = "Details";
  detailButton.className = "hx-btn hx-btn--secondary";
  detailButton.setAttribute("data-hx-id", `external-media-row-${id}-action`);
  detailButton.setAttribute("data-hx-bind", "external-media-detail-open");
  detailButton.setAttribute("data-row-id", String(id));
  actionCell.appendChild(detailButton);
  row.appendChild(actionCell);

  return row;
}

function applyExternalProductsPage(
  runtime: HelixClientRuntime,
  productsPage: ExternalProductsApiResponse,
  trigger: string,
  lane: Lane,
): void {
  installExternalRuntimeStateReactivity(runtime);

  runtime.externalState = {
    page: productsPage.page,
    pageSize: productsPage.pageSize,
    total: productsPage.total,
    totalPages: productsPage.totalPages,
  };
  runtime.externalDetail = makeInitialExternalDetailState();

  const container = document.querySelector(
    '[data-hx-id="external-products-body"]',
  );
  if (!(container instanceof Element)) {
    throw new Error("Missing external products container");
  }

  const nextKeys = productsPage.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createExternalProductRowNode);

  const patches: PatchOp[] = [];

  for (const row of productsPage.rows) {
    patches.push(
      {
        op: "setText",
        targetId: `external-row-${row.id}-id`,
        value: String(row.id),
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-title`,
        value: row.title,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-brand`,
        value: row.brand,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-category`,
        value: row.category,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-price`,
        value: `$${row.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-stock`,
        value: String(row.stock),
      },
      {
        op: "setText",
        targetId: `external-row-${row.id}-rating`,
        value: row.rating.toFixed(1),
      },
      {
        op: "setAttr",
        targetId: `external-row-${row.id}-action`,
        name: "data-row-id",
        value: String(row.id),
      },
    );
  }

  schedulePatchBatch(runtime, trigger, lane, patches, [
    "external-products-body",
  ]);
}

async function refreshExternalProducts(
  runtime: HelixClientRuntime,
  page: number,
  trigger: string,
  lane: Lane,
): Promise<void> {
  const response = await fetch(`/api/external-data?page=${page}`);
  if (!response.ok) {
    throw new Error(
      `External products fetch failed with status ${response.status}`,
    );
  }

  const productsPage = (await response.json()) as ExternalProductsApiResponse;
  applyExternalProductsPage(runtime, productsPage, trigger, lane);

  window.history.replaceState(
    {},
    "",
    `/external-data?page=${productsPage.page}`,
  );
}

function applyExternalMediaProductsPage(
  runtime: HelixClientRuntime,
  productsPage: ExternalMediaProductsApiResponse,
  trigger: string,
  lane: Lane,
): void {
  const container = document.querySelector(
    '[data-hx-id="external-media-products-body"]',
  );
  if (!(container instanceof Element)) {
    throw new Error("Missing external rich products container");
  }

  const nextKeys = productsPage.rows.map((row) => row.id);
  reconcileKeyed(container, nextKeys, createExternalMediaProductRowNode);

  const patches: PatchOp[] = [];

  for (const row of productsPage.rows) {
    const priceBand = getExternalMediaPriceBand(row.price);
    const stockBand = getExternalMediaStockBand(row.stock);
    const ratingBand = getExternalMediaRatingBand(row.rating);
    const hasThumbnail = row.thumbnail.trim().length > 0;

    patches.push(
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-id`,
        value: String(row.id),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-title`,
        value: truncateExternalMediaTitleForCell(row.title),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-brand`,
        value: row.brand,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-category`,
        value: row.category,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-price-main`,
        value: `$${row.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-stock-main`,
        value: String(row.stock),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-main`,
        value: row.rating.toFixed(1),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-stars`,
        value: formatExternalMediaRatingStars(row.rating),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-price-pill`,
        value: getExternalMediaPriceLabel(priceBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-stock-pill`,
        value: getExternalMediaStockLabel(stockBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        value: getExternalMediaStockLabel(stockBand),
      },
      {
        op: "setText",
        targetId: `external-media-row-${row.id}-rating-pill`,
        value: getExternalMediaRatingLabel(ratingBand),
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-thumb`,
        name: "src",
        value: hasThumbnail ? row.thumbnail : null,
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-thumb`,
        name: "alt",
        value: hasThumbnail ? `${row.title} thumbnail` : "No thumbnail",
      },
      {
        op: "setAttr",
        targetId: `external-media-row-${row.id}-action`,
        name: "data-row-id",
        value: String(row.id),
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-budget",
        enabled: priceBand === "budget",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-mid",
        enabled: priceBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--price-premium",
        enabled: priceBand === "premium",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--stock-healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-low",
        enabled: ratingBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-mid",
        enabled: ratingBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--rating-high",
        enabled: ratingBand === "high",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}`,
        className: "external-media-row--missing-thumb",
        enabled: !hasThumbnail,
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--budget",
        enabled: priceBand === "budget",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--mid",
        enabled: priceBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-price-pill`,
        className: "external-media-pill--premium",
        enabled: priceBand === "premium",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-stock-pill`,
        className: "external-media-pill--healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--empty",
        enabled: stockBand === "empty",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--low",
        enabled: stockBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-thumb-chip`,
        className: "external-media-thumb-chip--healthy",
        enabled: stockBand === "healthy",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-low",
        enabled: ratingBand === "low",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-mid",
        enabled: ratingBand === "mid",
      },
      {
        op: "toggleClass",
        targetId: `external-media-row-${row.id}-rating-pill`,
        className: "external-media-pill--rating-high",
        enabled: ratingBand === "high",
      },
    );
  }

  patches.push(
    {
      op: "setText",
      targetId: "external-media-page-label",
      value: `Page ${productsPage.page} / ${productsPage.totalPages}`,
    },
    {
      op: "setText",
      targetId: "external-media-total-label",
      value: `(Total rows: ${productsPage.total})`,
    },
    {
      op: "setAttr",
      targetId: "external-media-prev-btn",
      name: "disabled",
      value: productsPage.page <= 1 ? "disabled" : null,
    },
    {
      op: "setAttr",
      targetId: "external-media-next-btn",
      name: "disabled",
      value: productsPage.page >= productsPage.totalPages ? "disabled" : null,
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-page",
      value: String(productsPage.page),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-page-size",
      value: String(productsPage.pageSize),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-total",
      value: String(productsPage.total),
    },
    {
      op: "setAttr",
      targetId: "external-media-page-state",
      name: "data-total-pages",
      value: String(productsPage.totalPages),
    },
  );

  schedulePatchBatch(runtime, trigger, lane, patches, [
    "external-media-products-body",
  ]);
  ensureExternalMediaDetailDialog()?.close();
}

async function refreshExternalMediaProducts(
  runtime: HelixClientRuntime,
  page: number,
  trigger: string,
  lane: Lane,
): Promise<void> {
  const response = await fetch(`/api/external-data-rich?page=${page}`);
  if (!response.ok) {
    throw new Error(
      `External rich products fetch failed with status ${response.status}`,
    );
  }

  const productsPage =
    (await response.json()) as ExternalMediaProductsApiResponse;
  applyExternalMediaProductsPage(runtime, productsPage, trigger, lane);

  window.history.replaceState(
    {},
    "",
    `/external-data-rich?page=${productsPage.page}`,
  );
}

async function openExternalMediaDetail(
  runtime: HelixClientRuntime,
  rowId: number,
): Promise<void> {
  const dialog = ensureExternalMediaDetailDialog();
  const response = await fetch(`/api/external-data/${rowId}`);
  if (!response.ok) {
    throw new Error(
      `External detail fetch failed with status ${response.status}`,
    );
  }

  const detail = (await response.json()) as ExternalProductDetailApiResponse;

  schedulePatchBatch(
    runtime,
    "external-media-detail-open",
    "network",
    [
      {
        op: "setText",
        targetId: "external-media-modal-title",
        value: detail.title,
      },
      {
        op: "setText",
        targetId: "external-media-modal-id",
        value: String(detail.id),
      },
      {
        op: "setText",
        targetId: "external-media-modal-brand",
        value: detail.brand,
      },
      {
        op: "setText",
        targetId: "external-media-modal-category",
        value: detail.category,
      },
      {
        op: "setText",
        targetId: "external-media-modal-price",
        value: `$${detail.price.toFixed(2)}`,
      },
      {
        op: "setText",
        targetId: "external-media-modal-stock",
        value: String(detail.stock),
      },
      {
        op: "setText",
        targetId: "external-media-modal-rating",
        value: detail.rating.toFixed(1),
      },
      {
        op: "setText",
        targetId: "external-media-modal-source",
        value: `Seed Product #${detail.sourceId}`,
      },
      {
        op: "setText",
        targetId: "external-media-modal-description",
        value: detail.description,
      },
      {
        op: "setAttr",
        targetId: "external-media-modal-thumbnail",
        name: "src",
        value: detail.thumbnail || null,
      },
      {
        op: "setAttr",
        targetId: "external-media-modal-thumbnail",
        name: "alt",
        value: detail.thumbnail ? `${detail.title} thumbnail` : "No thumbnail",
      },
    ],
    ["external-media-modal-overlay"],
  );
  dialog?.open();
}

function closeExternalMediaDetail(runtime: HelixClientRuntime): void {
  void runtime;
  ensureExternalMediaDetailDialog()?.close();
}

async function openExternalDetail(
  runtime: HelixClientRuntime,
  rowId: number,
): Promise<void> {
  installExternalRuntimeStateReactivity(runtime);
  const dialog = ensureExternalDetailDialog(runtime);

  const response = await fetch(`/api/external-data/${rowId}`);
  if (!response.ok) {
    throw new Error(
      `External detail fetch failed with status ${response.status}`,
    );
  }

  const detail = (await response.json()) as ExternalProductDetailApiResponse;

  runtime.externalDetail = {
    open: true,
    title: detail.title,
    id: detail.id,
    brand: detail.brand,
    category: detail.category,
    price: detail.price,
    stock: detail.stock,
    rating: detail.rating,
    sourceId: detail.sourceId,
    description: detail.description,
    thumbnail: detail.thumbnail,
    thumbnailAlt: detail.title,
  };

  dialog?.open();
}

function closeExternalDetail(runtime: HelixClientRuntime): void {
  installExternalRuntimeStateReactivity(runtime);
  const dialog = ensureExternalDetailDialog(runtime);
  if (!runtime.externalDetail.open) {
    return;
  }
  runtime.externalDetail = makeInitialExternalDetailState();
  dialog?.close();
}

export async function onExternalPagePrev({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncExternalStateFromDom(runtime);

  const state = runtime.externalState;
  if (state.page <= 1) {
    return;
  }
  await refreshExternalProducts(
    runtime,
    state.page - 1,
    "external-page-prev",
    "network",
  );
}

export async function onExternalPageNext({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  syncExternalStateFromDom(runtime);

  const state = runtime.externalState;
  if (state.page >= state.totalPages) {
    return;
  }
  await refreshExternalProducts(
    runtime,
    state.page + 1,
    "external-page-next",
    "network",
  );
}

export async function onExternalMediaPagePrev({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  const state = readExternalMediaStateFromDom();
  if (!state || state.page <= 1) {
    return;
  }

  await refreshExternalMediaProducts(
    runtime,
    state.page - 1,
    "external-media-page-prev",
    "network",
  );
}

export async function onExternalMediaPageNext({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  const state = readExternalMediaStateFromDom();
  if (!state || state.page >= state.totalPages) {
    return;
  }

  await refreshExternalMediaProducts(
    runtime,
    state.page + 1,
    "external-media-page-next",
    "network",
  );
}

export async function onExternalDetailOpen({
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const rowId = Number(element.dataset.rowId ?? "0");
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return;
  }
  await openExternalDetail(runtime, rowId);
}

export async function onExternalDetailClose({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  closeExternalDetail(runtime);
}

export async function onExternalMediaDetailOpen({
  runtime,
  element,
}: HelixClientHandlerContext): Promise<void> {
  const rowId = Number(element.dataset.rowId ?? "0");
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return;
  }

  await openExternalMediaDetail(runtime, rowId);
}

export async function onExternalMediaDetailClose({
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  closeExternalMediaDetail(runtime);
}
