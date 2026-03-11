export type Key = string | number;

export interface ReconcileOptions {
  keyAttribute?: string;
}

export interface ReconcileResult {
  keys: string[];
  inserted: string[];
  removed: string[];
  moved: string[];
}

export function reconcileKeyed(
  container: Element,
  nextKeys: readonly Key[],
  createNode: (key: string) => Node,
  options?: ReconcileOptions
): ReconcileResult {
  const keyAttr = options?.keyAttribute ?? "data-hx-key";
  const existingChildren = Array.from(container.children);
  const existingMap = new Map<string, Element>();

  for (const child of existingChildren) {
    const key = child.getAttribute(keyAttr);
    if (key) {
      existingMap.set(key, child);
    }
  }

  const normalizedNext = nextKeys.map((key) => String(key));
  const nextKeySet = new Set(normalizedNext);

  const inserted: string[] = [];
  const moved: string[] = [];
  const removed: string[] = [];

  for (const key of normalizedNext) {
    const existing = existingMap.get(key);
    if (existing) {
      container.appendChild(existing);
      moved.push(key);
      continue;
    }

    const node = createNode(key);
    if (node instanceof Element && !node.hasAttribute(keyAttr)) {
      node.setAttribute(keyAttr, key);
    }
    container.appendChild(node);
    inserted.push(key);
  }

  for (const [key, node] of existingMap) {
    if (!nextKeySet.has(key)) {
      node.remove();
      removed.push(key);
    }
  }

  return {
    keys: normalizedNext,
    inserted,
    removed,
    moved
  };
}