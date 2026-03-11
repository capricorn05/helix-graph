import { PatchRuntime } from "../../helix/patch.js";
import { HelixScheduler } from "../../helix/scheduler.js";
import type {
  BindingMap,
  GraphSnapshot,
  HelixEventBinding,
} from "../../helix/types.js";
import {
  cell,
  derived,
  type Cell,
  type Derived,
} from "../../helix/reactive.js";

const DEFAULT_USERS_PAGE_SIZE = 6;
const DEFAULT_POSTS_PAGE_SIZE = 10;
const DEFAULT_EXTERNAL_PAGE_SIZE = 30;

interface PagerClientState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UsersClientState extends PagerClientState {
  sortCol: "name" | "email";
  sortDir: "asc" | "desc";
}

export interface PostsClientState extends PagerClientState {}

export interface ExternalDataClientState extends PagerClientState {}

export interface ExternalDetailState {
  open: boolean;
  title: string;
  id: number | null;
  brand: string;
  category: string;
  price: number | null;
  stock: number | null;
  rating: number | null;
  sourceId: number | null;
  description: string;
  thumbnail: string;
  thumbnailAlt: string;
}

export interface CreateUserFormState {
  status: string;
  submitting: boolean;
  nameError: string;
  emailError: string;
  formError: string;
}

export interface UsersClientDerivedState {
  pageLabel: Derived<string>;
  prevDisabled: Derived<boolean>;
  nextDisabled: Derived<boolean>;
  sortNameIndicator: Derived<string>;
  sortEmailIndicator: Derived<string>;
}

export interface PostsClientDerivedState {
  pageLabel: Derived<string>;
  totalLabel: Derived<string>;
  prevDisabled: Derived<boolean>;
  nextDisabled: Derived<boolean>;
}

export interface ExternalDataDerivedState {
  pageLabel: Derived<string>;
  totalLabel: Derived<string>;
  prevDisabled: Derived<boolean>;
  nextDisabled: Derived<boolean>;
}

export interface ExternalDetailDerivedState {
  overlayDisplay: Derived<string>;
  idLabel: Derived<string>;
  priceLabel: Derived<string>;
  stockLabel: Derived<string>;
  ratingLabel: Derived<string>;
  sourceLabel: Derived<string>;
}

export interface CreateUserFormDerivedState {
  submitDisabled: Derived<boolean>;
  nameInvalid: Derived<boolean>;
  emailInvalid: Derived<boolean>;
}

export interface HelixClientRuntime {
  snapshot: GraphSnapshot;
  bindings: BindingMap;
  state: UsersClientState;
  stateCell: Cell<UsersClientState>;
  derived: UsersClientDerivedState;
  postsState: PostsClientState;
  postsStateCell: Cell<PostsClientState>;
  postsDerived: PostsClientDerivedState;
  externalState: ExternalDataClientState;
  externalStateCell: Cell<ExternalDataClientState>;
  externalDerived: ExternalDataDerivedState;
  externalDetail: ExternalDetailState;
  externalDetailStateCell: Cell<ExternalDetailState>;
  externalDetailDerived: ExternalDetailDerivedState;
  createUserForm: CreateUserFormState;
  createUserFormStateCell: Cell<CreateUserFormState>;
  createUserFormDerived: CreateUserFormDerivedState;
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

export interface HelixClientHandlerContext {
  event: Event;
  element: HTMLElement;
  binding: HelixEventBinding;
  runtime: HelixClientRuntime;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

declare global {
  interface Window {
    __HELIX_RUNTIME__?: HelixClientRuntime;
  }
}

export function makeInitialState(snapshot: GraphSnapshot): UsersClientState {
  const cells = snapshot.cells;
  return {
    page: Number(cells.page ?? 1),
    pageSize: Number(cells.pageSize ?? DEFAULT_USERS_PAGE_SIZE),
    total: Number(cells.total ?? 0),
    totalPages: Number(cells.totalPages ?? 1),
    sortCol: cells.sortCol === "email" ? "email" : "name",
    sortDir: cells.sortDir === "desc" ? "desc" : "asc",
  };
}

export function makeInitialPostsState(
  snapshot: GraphSnapshot,
): PostsClientState {
  const posts = asRecord(snapshot.cells.posts);
  return {
    page: normalizePositiveInteger(posts?.page, 1),
    pageSize: normalizePositiveInteger(
      posts?.pageSize,
      DEFAULT_POSTS_PAGE_SIZE,
    ),
    total: normalizeNonNegativeInteger(posts?.total, 0),
    totalPages: normalizePositiveInteger(posts?.totalPages, 1),
  };
}

export function makeInitialExternalState(
  snapshot: GraphSnapshot,
): ExternalDataClientState {
  const externalData = asRecord(snapshot.cells.externalData);
  return {
    page: normalizePositiveInteger(externalData?.page, 1),
    pageSize: normalizePositiveInteger(
      externalData?.pageSize,
      DEFAULT_EXTERNAL_PAGE_SIZE,
    ),
    total: normalizeNonNegativeInteger(externalData?.total, 0),
    totalPages: normalizePositiveInteger(externalData?.totalPages, 1),
  };
}

export function makeInitialExternalDetailState(): ExternalDetailState {
  return {
    open: false,
    title: "Product Details",
    id: null,
    brand: "-",
    category: "-",
    price: null,
    stock: null,
    rating: null,
    sourceId: null,
    description: "-",
    thumbnail: "",
    thumbnailAlt: "",
  };
}

export function makeInitialCreateUserFormState(): CreateUserFormState {
  return {
    status: "",
    submitting: false,
    nameError: "",
    emailError: "",
    formError: "",
  };
}

export function makeStateCell(snapshot: GraphSnapshot): Cell<UsersClientState> {
  return cell(makeInitialState(snapshot), {
    scope: "view",
    name: "users-client-state",
    clientOnly: true,
    serializable: false,
  });
}

export function makePostsStateCell(
  snapshot: GraphSnapshot,
): Cell<PostsClientState> {
  return cell(makeInitialPostsState(snapshot), {
    scope: "view",
    name: "posts-client-state",
    clientOnly: true,
    serializable: false,
  });
}

export function makeExternalStateCell(
  snapshot: GraphSnapshot,
): Cell<ExternalDataClientState> {
  return cell(makeInitialExternalState(snapshot), {
    scope: "view",
    name: "external-client-state",
    clientOnly: true,
    serializable: false,
  });
}

export function makeExternalDetailStateCell(): Cell<ExternalDetailState> {
  return cell(makeInitialExternalDetailState(), {
    scope: "view",
    name: "external-detail-state",
    clientOnly: true,
    serializable: false,
  });
}

export function makeCreateUserFormStateCell(): Cell<CreateUserFormState> {
  return cell(makeInitialCreateUserFormState(), {
    scope: "view",
    name: "create-user-form-state",
    clientOnly: true,
    serializable: false,
  });
}

export function makeDerivedState(
  stateCell: Cell<UsersClientState>,
): UsersClientDerivedState {
  return {
    pageLabel: derived(
      () => {
        const state = stateCell.get();
        return `Page ${state.page} / ${state.totalPages}`;
      },
      { scope: "view", name: "users-page-label" },
    ),
    prevDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page <= 1;
      },
      { scope: "view", name: "users-prev-disabled" },
    ),
    nextDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page >= state.totalPages;
      },
      { scope: "view", name: "users-next-disabled" },
    ),
    sortNameIndicator: derived(
      () => {
        const state = stateCell.get();
        return state.sortCol === "name"
          ? state.sortDir === "asc"
            ? "▲"
            : "▼"
          : "·";
      },
      { scope: "view", name: "users-sort-name-indicator" },
    ),
    sortEmailIndicator: derived(
      () => {
        const state = stateCell.get();
        return state.sortCol === "email"
          ? state.sortDir === "asc"
            ? "▲"
            : "▼"
          : "·";
      },
      { scope: "view", name: "users-sort-email-indicator" },
    ),
  };
}

export function makePostsDerivedState(
  stateCell: Cell<PostsClientState>,
): PostsClientDerivedState {
  return {
    pageLabel: derived(
      () => {
        const state = stateCell.get();
        return `Page ${state.page} / ${state.totalPages}`;
      },
      { scope: "view", name: "posts-page-label" },
    ),
    totalLabel: derived(
      () => {
        const state = stateCell.get();
        return `(${state.total} total)`;
      },
      { scope: "view", name: "posts-total-label" },
    ),
    prevDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page <= 1;
      },
      { scope: "view", name: "posts-prev-disabled" },
    ),
    nextDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page >= state.totalPages;
      },
      { scope: "view", name: "posts-next-disabled" },
    ),
  };
}

export function makeExternalDerivedState(
  stateCell: Cell<ExternalDataClientState>,
): ExternalDataDerivedState {
  return {
    pageLabel: derived(
      () => {
        const state = stateCell.get();
        return `Page ${state.page} / ${state.totalPages}`;
      },
      { scope: "view", name: "external-page-label" },
    ),
    totalLabel: derived(
      () => {
        const state = stateCell.get();
        return `(Total rows: ${state.total})`;
      },
      { scope: "view", name: "external-total-label" },
    ),
    prevDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page <= 1;
      },
      { scope: "view", name: "external-prev-disabled" },
    ),
    nextDisabled: derived(
      () => {
        const state = stateCell.get();
        return state.page >= state.totalPages;
      },
      { scope: "view", name: "external-next-disabled" },
    ),
  };
}

export function makeExternalDetailDerivedState(
  stateCell: Cell<ExternalDetailState>,
): ExternalDetailDerivedState {
  return {
    overlayDisplay: derived(() => (stateCell.get().open ? "flex" : "none"), {
      scope: "view",
      name: "external-detail-display",
    }),
    idLabel: derived(
      () => {
        const id = stateCell.get().id;
        return id === null ? "-" : String(id);
      },
      { scope: "view", name: "external-detail-id" },
    ),
    priceLabel: derived(
      () => {
        const price = normalizeNullableNumber(stateCell.get().price);
        return price === null ? "-" : `$${price.toFixed(2)}`;
      },
      { scope: "view", name: "external-detail-price" },
    ),
    stockLabel: derived(
      () => {
        const stock = normalizeNullableNumber(stateCell.get().stock);
        return stock === null ? "-" : String(Math.floor(stock));
      },
      { scope: "view", name: "external-detail-stock" },
    ),
    ratingLabel: derived(
      () => {
        const rating = normalizeNullableNumber(stateCell.get().rating);
        return rating === null ? "-" : rating.toFixed(1);
      },
      { scope: "view", name: "external-detail-rating" },
    ),
    sourceLabel: derived(
      () => {
        const sourceId = stateCell.get().sourceId;
        return sourceId === null ? "-" : `Seed Product #${sourceId}`;
      },
      { scope: "view", name: "external-detail-source" },
    ),
  };
}

export function makeCreateUserFormDerivedState(
  stateCell: Cell<CreateUserFormState>,
): CreateUserFormDerivedState {
  return {
    submitDisabled: derived(() => stateCell.get().submitting, {
      scope: "view",
      name: "create-user-submit-disabled",
    }),
    nameInvalid: derived(() => stateCell.get().nameError.length > 0, {
      scope: "view",
      name: "create-user-name-invalid",
    }),
    emailInvalid: derived(() => stateCell.get().emailError.length > 0, {
      scope: "view",
      name: "create-user-email-invalid",
    }),
  };
}
