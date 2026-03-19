import type { FormActionError, Lane, PatchOp } from "../../helix/types.js";
import type { HelixClientRuntime } from "./runtime.js";

export function parseNumeric(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export function schedulePatchBatch(
  runtime: HelixClientRuntime,
  trigger: string,
  lane: Lane,
  patches: PatchOp[],
  nodes: string[],
): void {
  runtime.scheduler.schedule({
    trigger,
    lane,
    patches,
    nodes,
    run: (batch) => runtime.patchRuntime.applyBatch(batch),
  });
}

function hasPatchTarget(targetId: string): boolean {
  return (
    document.querySelector(`[data-hx-id="${targetId}"]`) instanceof Element
  );
}

export function scheduleReactivePatches(
  runtime: HelixClientRuntime,
  trigger: string,
  patches: PatchOp[],
): void {
  const presentPatches = patches.filter((patch) =>
    hasPatchTarget(patch.targetId),
  );
  if (presentPatches.length === 0) {
    return;
  }

  schedulePatchBatch(
    runtime,
    trigger,
    "input",
    presentPatches,
    Array.from(new Set(presentPatches.map((patch) => patch.targetId))),
  );
}

export function isPrimaryNavigationEvent(event: Event): boolean {
  if (!(event instanceof MouseEvent)) {
    return true;
  }

  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function normalizeNavPath(pathname: string): string {
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return "/";
  }
  return pathname;
}

export function updateActiveAdminNav(pathname: string): void {
  const normalizedPath = normalizeNavPath(pathname);

  for (const link of document.querySelectorAll("[data-nav-link]")) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const linkPath = link.dataset.navPath ?? "";
    const active = linkPath === normalizedPath;

    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

export class ServerActionError extends Error {
  constructor(public readonly body: FormActionError) {
    super(body.formError ?? "Server action failed");
    this.name = "ServerActionError";
  }
}
