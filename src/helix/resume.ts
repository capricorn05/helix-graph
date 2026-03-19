import { runtimeGraph } from "./graph.js";
import { initializeDevtools, type DevtoolsConfig } from "./devtools.js";
import { installPopStateListener } from "./client-router.js";
import { PatchRuntime } from "./patch.js";
import { HelixScheduler } from "./scheduler.js";
import type { BindingMap, GraphSnapshot, HelixEventBinding } from "./types.js";

export interface ResumableRuntimeBase {
  snapshot: GraphSnapshot;
  bindings: BindingMap;
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

export interface RuntimeFactoryContext {
  snapshot: GraphSnapshot;
  bindings: BindingMap;
  patchRuntime: PatchRuntime;
  scheduler: HelixScheduler;
}

export interface HelixClientHandlerContext<
  TRuntime,
  TBinding extends HelixEventBinding = HelixEventBinding,
> {
  event: Event;
  element: HTMLElement;
  binding: TBinding;
  runtime: TRuntime;
}

type ModuleLoader = (chunk: string) => Promise<Record<string, unknown>>;

type HandlerFunction<
  TRuntime,
  TBinding extends HelixEventBinding = HelixEventBinding,
> = (
  ctx: HelixClientHandlerContext<TRuntime, TBinding>,
) => Promise<void> | void;

type ClientOnlyMountFunction<TRuntime> = (ctx: {
  element: HTMLElement;
  props: unknown;
  runtime: TRuntime;
}) => Promise<void> | void;

export interface DelegatorOptions {
  root?: Document | HTMLElement;
  bindingSelector?: string;
  importModule?: ModuleLoader;
  preventDefaultEvents?: string[];
}

export interface ResumeClientOptions<TRuntime extends ResumableRuntimeBase> {
  createRuntime: (context: RuntimeFactoryContext) => TRuntime;
  globalRuntimeKey?: string;
  snapshotScriptId?: string;
  bindingMapScriptId?: string;
  schedulerSliceBudgetMs?: number;
  patchRoot?: ParentNode;
  hydrateGraph?: boolean;
  installPopState?: boolean;
  enableDevtools?: boolean;
  devtoolsConfig?: DevtoolsConfig;
  devtoolsToggleKey?: string;
  delegatorOptions?: DelegatorOptions;
}

const mountedClientOnlyElements = new WeakSet<HTMLElement>();

export function readJsonScript<T>(id: string, root: ParentNode = document): T {
  const script = root.querySelector(`#${id}`);
  if (!(script instanceof HTMLScriptElement)) {
    throw new Error(`Missing Helix script payload: ${id}`);
  }

  const text = script.textContent;
  if (!text) {
    throw new Error(`Empty Helix script payload: ${id}`);
  }

  return JSON.parse(text) as T;
}

function scheduleIdleMount(callback: () => void): void {
  const idleScheduler = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (fn: () => void) => number;
    }
  ).requestIdleCallback;

  if (typeof idleScheduler === "function") {
    idleScheduler(callback);
    return;
  }

  setTimeout(callback, 0);
}

function readClientOnlyProps(element: HTMLElement): unknown {
  const raw = element.dataset.hxClientProps;
  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw);
}

async function mountClientOnlyElement<TRuntime>(
  element: HTMLElement,
  runtime: TRuntime,
  importModule: ModuleLoader,
): Promise<void> {
  if (mountedClientOnlyElements.has(element)) {
    return;
  }

  const chunk = element.dataset.hxClientModule;
  if (!chunk) {
    throw new Error("clientOnly placeholder is missing data-hx-client-module");
  }

  const loadedChunk = await importModule(chunk);
  const mount = (loadedChunk.mount ?? loadedChunk.default) as
    | ClientOnlyMountFunction<TRuntime>
    | undefined;

  if (typeof mount !== "function") {
    throw new Error(
      `Missing clientOnly mount export from ${chunk}. Expected \`mount\` or default export`,
    );
  }

  const props = readClientOnlyProps(element);
  await mount({
    element,
    props,
    runtime,
  });

  mountedClientOnlyElements.add(element);
  element.dataset.hxClientMounted = "true";
}

function installClientOnlyMounts<TRuntime>(
  runtime: TRuntime,
  options: DelegatorOptions = {},
): void {
  const root = options.root ?? document;
  const importModule =
    options.importModule ??
    ((chunk: string) => import(chunk) as Promise<Record<string, unknown>>);

  const scheduleMount = (element: HTMLElement): void => {
    if (mountedClientOnlyElements.has(element)) {
      return;
    }

    scheduleIdleMount(() => {
      void mountClientOnlyElement(element, runtime, importModule).catch(
        (error: unknown) => {
          console.error("[Helix] clientOnly mount error", error);
        },
      );
    });
  };

  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-hx-client-only]",
  )) {
    scheduleMount(element);
  }

  if (typeof MutationObserver === "undefined") {
    return;
  }

  const observerRoot = root instanceof Document ? root.body : root;
  if (!(observerRoot instanceof Node)) {
    return;
  }

  const observer = new MutationObserver((entries) => {
    for (const entry of entries) {
      for (const addedNode of entry.addedNodes) {
        if (!(addedNode instanceof HTMLElement)) {
          continue;
        }

        if (addedNode.matches("[data-hx-client-only]")) {
          scheduleMount(addedNode);
        }

        for (const island of addedNode.querySelectorAll<HTMLElement>(
          "[data-hx-client-only]",
        )) {
          scheduleMount(island);
        }
      }
    }
  });

  observer.observe(observerRoot, {
    childList: true,
    subtree: true,
  });
}

export function hydrateRuntimeGraph(snapshot: GraphSnapshot): void {
  for (const node of snapshot.nodes ?? []) {
    runtimeGraph.addNode(node);
  }

  for (const edge of snapshot.edges ?? []) {
    runtimeGraph.addEdge(edge);
  }
}

export function installBindingDelegator<TRuntime>(
  bindings: BindingMap,
  runtime: TRuntime,
  options: DelegatorOptions = {},
): void {
  const root = options.root ?? document;
  const bindingSelector = options.bindingSelector ?? "[data-hx-bind]";
  const importModule =
    options.importModule ??
    ((chunk: string) => import(chunk) as Promise<Record<string, unknown>>);
  const preventDefaultEvents = new Set(
    options.preventDefaultEvents ?? ["submit"],
  );

  const eventTypes = new Set(
    Object.values(bindings.events).map((entry) => entry.event),
  );

  for (const eventType of eventTypes) {
    root.addEventListener(eventType, async (event) => {
      const rawTarget = event.target;
      if (!(rawTarget instanceof Element)) {
        return;
      }

      const element = rawTarget.closest<HTMLElement>(bindingSelector);
      if (!element) {
        return;
      }

      const bindingId = element.dataset.hxBind;
      if (!bindingId) {
        return;
      }

      const binding = bindings.events[bindingId];
      if (!binding || binding.event !== event.type) {
        return;
      }

      if (preventDefaultEvents.has(event.type) || binding.preventDefault) {
        event.preventDefault();
      }

      const loadedChunk = await importModule(binding.chunk);
      const handler = loadedChunk[binding.handlerExport] as
        | HandlerFunction<TRuntime>
        | undefined;

      if (typeof handler !== "function") {
        throw new Error(
          `Missing handler export "${binding.handlerExport}" from ${binding.chunk}`,
        );
      }

      await handler({
        event,
        element,
        binding,
        runtime,
      });
    });
  }
}

export function resumeClientApp<TRuntime extends ResumableRuntimeBase>(
  options: ResumeClientOptions<TRuntime>,
): TRuntime {
  const snapshotScriptId = options.snapshotScriptId ?? "__HELIX_SNAPSHOT__";
  const bindingMapScriptId = options.bindingMapScriptId ?? "__HELIX_BINDINGS__";

  const snapshot = readJsonScript<GraphSnapshot>(snapshotScriptId);
  const bindings = readJsonScript<BindingMap>(bindingMapScriptId);

  if (options.hydrateGraph ?? true) {
    hydrateRuntimeGraph(snapshot);
  }

  const scheduler = new HelixScheduler(options.schedulerSliceBudgetMs ?? 3);
  const patchRuntime = new PatchRuntime(options.patchRoot ?? document);

  const runtime = options.createRuntime({
    snapshot,
    bindings,
    patchRuntime,
    scheduler,
  });

  const globalRuntimeKey = options.globalRuntimeKey ?? "__HELIX_RUNTIME__";
  (window as unknown as Record<string, unknown>)[globalRuntimeKey] = runtime;

  if (options.enableDevtools ?? true) {
    const devtools = initializeDevtools(options.devtoolsConfig);
    devtools.setScheduler(scheduler);

    const toggleKey = options.devtoolsToggleKey ?? "m";
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === toggleKey) {
        event.preventDefault();
        devtools.toggle();
      }
    });
  }

  if (options.installPopState ?? true) {
    installPopStateListener();
  }

  installBindingDelegator(bindings, runtime, options.delegatorOptions);
  installClientOnlyMounts(runtime, options.delegatorOptions);
  return runtime;
}
