import { resumeClientApp } from "../../helix/resume.js";
import { createInvalidationChannel } from "../../helix/invalidation-channel.js";
import {
  createClientViewScope,
  makeCreateUserFormDerivedState,
  makeCreateUserFormStateCell,
  makeDerivedState,
  makeExternalDerivedState,
  makeExternalDetailDerivedState,
  makeExternalDetailStateCell,
  makeExternalStateCell,
  makePrimitiveMessageFormDerivedState,
  makePrimitiveMessageFormStateCell,
  makePostsDerivedState,
  makePostsStateCell,
  makeStateCell,
  type HelixClientRuntime,
} from "./runtime.js";
import "./interactions.js";
import "./external-grid.js";
import "./host-listings.js";
import "./mongo-airbnb.js";
import "./posts-reorder.js";
import {
  initializePrimitiveEnhancements,
  syncPrimitiveMessageStateFromDom,
} from "./primitives-demo.js";
import { syncCreateUserFormStateFromDom } from "./actions-users.js";

let invalidationChannel: ReturnType<typeof createInvalidationChannel> | null =
  null;

function installLiveInvalidationChannel(): void {
  if (invalidationChannel || typeof window === "undefined") {
    return;
  }

  invalidationChannel = createInvalidationChannel({
    type: "sse",
    url: "/api/invalidation-stream",
    reconnectMs: 3_000,
  });
  invalidationChannel.connect();

  window.addEventListener(
    "beforeunload",
    () => {
      invalidationChannel?.disconnect();
      invalidationChannel = null;
    },
    { once: true },
  );
}

function defineCellBackedProperty<T>(
  target: object,
  key: string,
  stateCell: { get(): T; set(next: T): void },
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get: () => stateCell.get(),
    set: (next: T) => {
      stateCell.set(next);
    },
  });
}

const runtime = resumeClientApp<HelixClientRuntime>({
  createRuntime: ({ snapshot, bindings, patchRuntime, scheduler }) => {
    const viewScope = createClientViewScope();
    const stateCell = makeStateCell(snapshot);
    const postsStateCell = makePostsStateCell(snapshot);
    const externalStateCell = makeExternalStateCell(snapshot);
    const externalDetailStateCell = makeExternalDetailStateCell();
    const createUserFormStateCell = makeCreateUserFormStateCell();
    const primitiveMessageFormStateCell = makePrimitiveMessageFormStateCell();

    const runtime = {
      snapshot,
      bindings,
      viewScope,
      state: stateCell.get(),
      stateCell,
      derived: makeDerivedState(stateCell),
      postsState: postsStateCell.get(),
      postsStateCell,
      postsDerived: makePostsDerivedState(postsStateCell),
      externalState: externalStateCell.get(),
      externalStateCell,
      externalDerived: makeExternalDerivedState(externalStateCell),
      externalDetail: externalDetailStateCell.get(),
      externalDetailStateCell,
      externalDetailDerived: makeExternalDetailDerivedState(
        externalDetailStateCell,
      ),
      createUserForm: createUserFormStateCell.get(),
      createUserFormStateCell,
      createUserFormDerived: makeCreateUserFormDerivedState(
        createUserFormStateCell,
      ),
      primitiveMessageForm: primitiveMessageFormStateCell.get(),
      primitiveMessageFormStateCell,
      primitiveMessageFormDerived: makePrimitiveMessageFormDerivedState(
        primitiveMessageFormStateCell,
      ),
      patchRuntime,
      scheduler,
    } as HelixClientRuntime;

    defineCellBackedProperty(runtime, "state", stateCell);
    defineCellBackedProperty(runtime, "postsState", postsStateCell);
    defineCellBackedProperty(runtime, "externalState", externalStateCell);
    defineCellBackedProperty(
      runtime,
      "externalDetail",
      externalDetailStateCell,
    );
    defineCellBackedProperty(
      runtime,
      "createUserForm",
      createUserFormStateCell,
    );
    defineCellBackedProperty(
      runtime,
      "primitiveMessageForm",
      primitiveMessageFormStateCell,
    );

    return runtime;
  },
  devtoolsConfig: { position: "bottom-right", startOpen: false },
});

syncPrimitiveMessageStateFromDom(runtime);
syncCreateUserFormStateFromDom(runtime);
initializePrimitiveEnhancements();
installLiveInvalidationChannel();
