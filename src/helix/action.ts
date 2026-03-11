import { nextNodeId, runtimeGraph } from "./graph.js";
import { invalidateResourcesByTags } from "./resource.js";
import type { ActionPolicy } from "./types.js";

export interface ActionContext {
  capabilities?: string[];
  [key: string]: unknown;
}

export interface ActionHandle<I, O, Ctx extends ActionContext = ActionContext> {
  id: string;
  run(input: I, ctx: Ctx): Promise<O>;
}

function resolveInvalidatedTags<I, Ctx extends ActionContext>(
  policy: ActionPolicy<I>,
  ctx: Ctx,
  input: I
): string[] {
  if (!policy.invalidates) {
    return [];
  }
  return typeof policy.invalidates === "function" ? policy.invalidates(ctx, input) : policy.invalidates;
}

function enforceCapabilities<I, Ctx extends ActionContext>(policy: ActionPolicy<I>, ctx: Ctx): void {
  const required = policy.capabilities ?? [];
  if (required.length === 0) {
    return;
  }

  const granted = new Set(ctx.capabilities ?? []);
  for (const capability of required) {
    if (!granted.has(capability)) {
      throw new Error(`Missing capability: ${capability}`);
    }
  }
}

export function action<I, O, Ctx extends ActionContext = ActionContext>(
  name: string,
  handler: (input: I, ctx: Ctx) => O | Promise<O>,
  policy: ActionPolicy<I>
): ActionHandle<I, O, Ctx> {
  const id = nextNodeId("action");
  runtimeGraph.addNode({
    id,
    type: "ActionNode",
    label: name,
    meta: {
      policy
    }
  });

  return {
    id,
    run: async (input: I, ctx: Ctx): Promise<O> => {
      enforceCapabilities(policy, ctx);
      const output = await handler(input, ctx);
      const invalidatedTags = resolveInvalidatedTags(policy, ctx, input);
      invalidateResourcesByTags(invalidatedTags);
      return output;
    }
  };
}