import { resumeClientApp } from "../../helix/resume.js";
import { makeInitialState, type HelixClientRuntime } from "./runtime.js";

resumeClientApp<HelixClientRuntime>({
  createRuntime: ({ snapshot, bindings, patchRuntime, scheduler }) => ({
    snapshot,
    bindings,
    state: makeInitialState(snapshot),
    patchRuntime,
    scheduler
  }),
  devtoolsConfig: { position: "bottom-right", startOpen: false }
});