import assert from "node:assert/strict";
import test from "node:test";
import {
  createIdleTrigger,
  createVisibilityTrigger,
} from "../helix/lazy-activation.js";

class MockIntersectionObserver {
  static lastInstance: MockIntersectionObserver | null = null;
  private readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.lastInstance = this;
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  unobserve(element: Element): void {
    this.observed.delete(element);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }

  emit(entry: Partial<IntersectionObserverEntry> & { target: Element }): void {
    this.callback(
      [
        {
          isIntersecting: false,
          intersectionRatio: 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
          ...entry,
        },
      ] as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

test("createVisibilityTrigger: invokes callback when element becomes visible", () => {
  const original = (globalThis as any).IntersectionObserver;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;

  try {
    const element = { nodeType: 1 } as Element;
    let seen: Element | null = null;

    const trigger = createVisibilityTrigger((el) => {
      seen = el;
    });

    trigger.observe(element);
    MockIntersectionObserver.lastInstance!.emit({
      target: element,
      isIntersecting: true,
    });

    assert.equal(seen, element);
    assert.equal(
      MockIntersectionObserver.lastInstance!.observed.has(element),
      false,
    );
  } finally {
    if (original === undefined) delete (globalThis as any).IntersectionObserver;
    else (globalThis as any).IntersectionObserver = original;
  }
});

test("createVisibilityTrigger: once=false keeps observing after visibility", () => {
  const original = (globalThis as any).IntersectionObserver;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;

  try {
    const element = { nodeType: 1 } as Element;
    let count = 0;

    const trigger = createVisibilityTrigger(
      () => {
        count++;
      },
      { once: false },
    );

    trigger.observe(element);
    MockIntersectionObserver.lastInstance!.emit({
      target: element,
      isIntersecting: true,
    });
    MockIntersectionObserver.lastInstance!.emit({
      target: element,
      isIntersecting: true,
    });

    assert.equal(count, 2);
    assert.equal(
      MockIntersectionObserver.lastInstance!.observed.has(element),
      true,
    );
  } finally {
    if (original === undefined) delete (globalThis as any).IntersectionObserver;
    else (globalThis as any).IntersectionObserver = original;
  }
});

test("createVisibilityTrigger: unobserve and disconnect delegate to observer", () => {
  const original = (globalThis as any).IntersectionObserver;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;

  try {
    const element = { nodeType: 1 } as Element;
    const trigger = createVisibilityTrigger(() => {});

    trigger.observe(element);
    assert.equal(
      MockIntersectionObserver.lastInstance!.observed.has(element),
      true,
    );

    trigger.unobserve(element);
    assert.equal(
      MockIntersectionObserver.lastInstance!.observed.has(element),
      false,
    );

    trigger.disconnect();
    assert.equal(MockIntersectionObserver.lastInstance!.disconnected, true);
  } finally {
    if (original === undefined) delete (globalThis as any).IntersectionObserver;
    else (globalThis as any).IntersectionObserver = original;
  }
});

test("createIdleTrigger: uses requestIdleCallback when available", async () => {
  const originalRic = (globalThis as any).requestIdleCallback;
  const originalCancel = (globalThis as any).cancelIdleCallback;

  let cancelledHandle: number | null = null;
  let storedCallback: ((deadline?: IdleDeadline) => void) | null = null;

  (globalThis as any).requestIdleCallback = (
    cb: (deadline?: IdleDeadline) => void,
  ) => {
    storedCallback = cb;
    return 42;
  };
  (globalThis as any).cancelIdleCallback = (handle: number) => {
    cancelledHandle = handle;
  };

  try {
    let called = false;
    const trigger = createIdleTrigger(
      () => {
        called = true;
      },
      { timeout: 100 },
    );

    assert.ok(storedCallback);
    const idleCallback = storedCallback as (deadline?: IdleDeadline) => void;
    idleCallback(undefined);
    assert.equal(called, true);

    trigger.cancel();
    assert.equal(cancelledHandle, 42);
  } finally {
    if (originalRic === undefined)
      delete (globalThis as any).requestIdleCallback;
    else (globalThis as any).requestIdleCallback = originalRic;

    if (originalCancel === undefined)
      delete (globalThis as any).cancelIdleCallback;
    else (globalThis as any).cancelIdleCallback = originalCancel;
  }
});

test("createIdleTrigger: falls back to setTimeout when requestIdleCallback is unavailable", async () => {
  const originalRic = (globalThis as any).requestIdleCallback;
  const originalCancel = (globalThis as any).cancelIdleCallback;
  delete (globalThis as any).requestIdleCallback;
  delete (globalThis as any).cancelIdleCallback;

  try {
    let called = false;
    await new Promise<void>((resolve) => {
      createIdleTrigger(
        () => {
          called = true;
          resolve();
        },
        { timeout: 5 },
      );
    });

    assert.equal(called, true);
  } finally {
    if (originalRic !== undefined)
      (globalThis as any).requestIdleCallback = originalRic;
    if (originalCancel !== undefined)
      (globalThis as any).cancelIdleCallback = originalCancel;
  }
});
