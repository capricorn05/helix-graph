import type { PatchOp } from "./types.js";

const STYLE_WHITELIST = new Set([
  "display",
  "visibility",
  "opacity",
  "transform",
  "color",
  "backgroundColor",
  "fontWeight"
]);

export class PatchRuntime {
  private readonly cache = new Map<string, Element>();

  constructor(
    private readonly root: ParentNode = document,
    private readonly maxCacheEntries = 500
  ) {}

  private pruneDisconnectedTargets(): void {
    for (const [targetId, element] of this.cache) {
      if (!element.isConnected) {
        this.cache.delete(targetId);
      }
    }
  }

  private enforceCacheLimit(): void {
    if (this.cache.size <= this.maxCacheEntries) {
      return;
    }

    this.pruneDisconnectedTargets();
    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) {
        return;
      }
      this.cache.delete(oldest);
    }
  }

  private resolveTarget(targetId: string): Element {
    const cached = this.cache.get(targetId);
    if (cached) {
      if (cached.isConnected) {
        return cached;
      }
      this.cache.delete(targetId);
    }

    const found = this.root.querySelector(`[data-hx-id="${targetId}"]`);
    if (!found) {
      throw new Error(`Patch target not found: ${targetId}`);
    }

    this.cache.set(targetId, found);
    this.enforceCacheLimit();
    return found;
  }

  apply(op: PatchOp): void {
    const target = this.resolveTarget(op.targetId);

    switch (op.op) {
      case "setText":
        target.textContent = op.value;
        break;
      case "setAttr":
        if (op.value === null) {
          target.removeAttribute(op.name);
        } else {
          target.setAttribute(op.name, op.value);
        }
        break;
      case "toggleClass":
        target.classList.toggle(op.className, op.enabled);
        break;
      case "setValue": {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
          throw new Error(`setValue requires a form control target: ${op.targetId}`);
        }
        target.value = op.value;
        break;
      }
      case "setChecked": {
        if (!(target instanceof HTMLInputElement)) {
          throw new Error(`setChecked requires an input target: ${op.targetId}`);
        }
        target.checked = op.value;
        break;
      }
      case "setStyle": {
        if (!STYLE_WHITELIST.has(op.prop)) {
          throw new Error(`Style property not allowed: ${op.prop}`);
        }
        const styleValue = op.value;
        (target as HTMLElement).style.setProperty(op.prop, styleValue);
        break;
      }
      default: {
        const exhaustive: never = op;
        throw new Error(`Unhandled patch op: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  applyBatch(batch: PatchOp[]): void {
    for (const op of batch) {
      this.apply(op);
    }
  }
}