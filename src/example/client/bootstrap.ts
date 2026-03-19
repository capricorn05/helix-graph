import { resumeClientApp } from "../../helix/resume.js";
import {
  makeCreateUserFormDerivedState,
  makeCreateUserFormStateCell,
  makeDerivedState,
  makeExternalDerivedState,
  makeExternalDetailDerivedState,
  makeExternalDetailStateCell,
  makeExternalStateCell,
  makePostsDerivedState,
  makePostsStateCell,
  makeStateCell,
  type HelixClientRuntime,
} from "./runtime.js";
import "./interactions.js";
import "./external-grid.js";
import "./host-listings.js";
import "./primitives-demo.js";

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

resumeClientApp<HelixClientRuntime>({
  createRuntime: ({ snapshot, bindings, patchRuntime, scheduler }) => {
    const stateCell = makeStateCell(snapshot);
    const postsStateCell = makePostsStateCell(snapshot);
    const externalStateCell = makeExternalStateCell(snapshot);
    const externalDetailStateCell = makeExternalDetailStateCell();
    const createUserFormStateCell = makeCreateUserFormStateCell();

    const runtime = {
      snapshot,
      bindings,
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

    return runtime;
  },
  devtoolsConfig: { position: "bottom-right", startOpen: false },
});
