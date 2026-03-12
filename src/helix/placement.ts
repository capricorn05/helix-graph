import type { ActionPolicy, ResourcePolicy } from "./types.js";

export type RuntimePlacement = "server" | "client";
export type PolicyPlacement = ResourcePolicy["where"] | ActionPolicy["where"];

export function detectRuntimePlacement(): RuntimePlacement {
  return typeof window === "undefined" ? "server" : "client";
}

export function isPlacementAllowed(
  where: PolicyPlacement,
  runtime: RuntimePlacement,
): boolean {
  if (where === "any") {
    return true;
  }

  if (runtime === "client") {
    return where === "client";
  }

  return where === "server" || where === "edge";
}

export function enforcePolicyPlacement(
  kind: "resource" | "action",
  label: string,
  where: PolicyPlacement,
  runtime: RuntimePlacement = detectRuntimePlacement(),
): void {
  if (isPlacementAllowed(where, runtime)) {
    return;
  }

  throw new Error(
    `Invalid ${kind} placement for "${label}": where="${where}" cannot execute in runtime="${runtime}"`,
  );
}

export function enforceResourcePlacement(
  label: string,
  policy: ResourcePolicy,
  runtime?: RuntimePlacement,
): void {
  enforcePolicyPlacement("resource", label, policy.where, runtime);
}

export function enforceActionPlacement<I>(
  label: string,
  policy: ActionPolicy<I>,
  runtime?: RuntimePlacement,
): void {
  enforcePolicyPlacement("action", label, policy.where, runtime);
}
