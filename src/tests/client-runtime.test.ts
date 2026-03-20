import assert from "node:assert/strict";
import test from "node:test";
import type { GraphSnapshot } from "../helix/types.js";
import {
  createClientViewScope,
  makeCreateUserFormDerivedState,
  makeCreateUserFormStateCell,
  makeExternalDerivedState,
  makeExternalDetailDerivedState,
  makeExternalDetailStateCell,
  makeExternalStateCell,
  rotateClientViewScope,
  type HelixClientRuntime,
  makeInitialExternalDetailState,
  makePrimitiveMessageFormDerivedState,
  makePrimitiveMessageFormStateCell,
  makePostsDerivedState,
  makePostsStateCell,
} from "../example/client/runtime.js";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

function createSnapshot(): GraphSnapshot {
  return {
    version: "0.1",
    cells: {
      posts: {
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      },
      externalData: {
        page: 4,
        pageSize: 30,
        total: 120,
        totalPages: 4,
      },
    },
    resources: {},
    tags: {},
    createdAt: Date.now(),
  };
}

test("rotateClientViewScope disposes prior scope and assigns a new one", () => {
  const initialScope = createClientViewScope();
  let disposeCallbacks = 0;
  initialScope.onDispose(() => {
    disposeCallbacks += 1;
  });

  const runtime = {
    viewScope: initialScope,
  } as unknown as HelixClientRuntime;

  const nextScope = rotateClientViewScope(runtime);

  assert.equal(initialScope.disposed, true);
  assert.equal(disposeCallbacks, 1);
  assert.equal(nextScope.disposed, false);
  assert.equal(runtime.viewScope.id, nextScope.id);
  assert.notEqual(runtime.viewScope.id, initialScope.id);
});

test("posts and external client derived state reflect pager metadata", async () => {
  const snapshot = createSnapshot();

  const postsStateCell = makePostsStateCell(snapshot);
  const postsDerived = makePostsDerivedState(postsStateCell);

  assert.equal(postsDerived.pageLabel.get(), "Page 2 / 3");
  assert.equal(postsDerived.totalLabel.get(), "(25 total)");
  assert.equal(postsDerived.prevDisabled.get(), false);
  assert.equal(postsDerived.nextDisabled.get(), false);

  postsStateCell.set({
    ...postsStateCell.get(),
    page: 3,
  });

  await flushMicrotasks();

  assert.equal(postsDerived.pageLabel.get(), "Page 3 / 3");
  assert.equal(postsDerived.nextDisabled.get(), true);

  const externalStateCell = makeExternalStateCell(snapshot);
  const externalDerived = makeExternalDerivedState(externalStateCell);

  assert.equal(externalDerived.pageLabel.get(), "Page 4 / 4");
  assert.equal(externalDerived.totalLabel.get(), "(Total rows: 120)");
  assert.equal(externalDerived.prevDisabled.get(), false);
  assert.equal(externalDerived.nextDisabled.get(), true);
});

test("external detail and create-user form derived state track UI flags", async () => {
  const detailStateCell = makeExternalDetailStateCell();
  const detailDerived = makeExternalDetailDerivedState(detailStateCell);

  assert.equal(detailDerived.overlayDisplay.get(), "none");
  assert.equal(detailDerived.idLabel.get(), "-");
  assert.equal(detailDerived.priceLabel.get(), "-");

  detailStateCell.set({
    ...makeInitialExternalDetailState(),
    open: true,
    title: "Widget",
    id: 42,
    brand: "Acme",
    category: "Tools",
    price: 12.5,
    stock: 8,
    rating: 4.2,
    sourceId: 7,
    description: "Useful widget",
    thumbnail: "/widget.png",
    thumbnailAlt: "Widget",
  });

  await flushMicrotasks();

  assert.equal(detailDerived.overlayDisplay.get(), "flex");
  assert.equal(detailDerived.idLabel.get(), "42");
  assert.equal(detailDerived.priceLabel.get(), "$12.50");
  assert.equal(detailDerived.stockLabel.get(), "8");
  assert.equal(detailDerived.ratingLabel.get(), "4.2");
  assert.equal(detailDerived.sourceLabel.get(), "Seed Product #7");

  const createUserFormStateCell = makeCreateUserFormStateCell();
  const createUserFormDerived = makeCreateUserFormDerivedState(
    createUserFormStateCell,
  );

  assert.equal(createUserFormDerived.submitDisabled.get(), false);
  assert.equal(createUserFormDerived.nameInvalid.get(), false);
  assert.equal(createUserFormDerived.emailInvalid.get(), false);

  createUserFormStateCell.set({
    status: "Creating user…",
    submitting: true,
    nameError: "Name is required",
    emailError: "",
    formError: "",
  });

  await flushMicrotasks();

  assert.equal(createUserFormDerived.submitDisabled.get(), true);
  assert.equal(createUserFormDerived.nameInvalid.get(), true);
  assert.equal(createUserFormDerived.emailInvalid.get(), false);

  const primitiveMessageFormStateCell = makePrimitiveMessageFormStateCell();
  const primitiveMessageFormDerived = makePrimitiveMessageFormDerivedState(
    primitiveMessageFormStateCell,
  );

  assert.equal(
    primitiveMessageFormDerived.messageLabel.get(),
    "Typed message: -",
  );
  assert.equal(primitiveMessageFormDerived.submitDisabled.get(), false);

  primitiveMessageFormStateCell.set({
    message: "Hello Helix",
    submitting: true,
    response: "Sending message…",
  });

  await flushMicrotasks();

  assert.equal(
    primitiveMessageFormDerived.messageLabel.get(),
    "Typed message: Hello Helix",
  );
  assert.equal(primitiveMessageFormDerived.submitDisabled.get(), true);
});
