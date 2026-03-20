import assert from "node:assert/strict";
import test from "node:test";
import { resetRuntimeGraph } from "../helix/graph.js";
import { createInvalidationChannel } from "../helix/invalidation-channel.js";
import { invalidateResourcesByTags } from "../helix/resource.js";

// ---------------------------------------------------------------------------
// Minimal mock EventSource / WebSocket
// ---------------------------------------------------------------------------

interface MockEventSourceHandle {
  emit(type: string, data?: string): void;
  emitError(): void;
}

class MockEventSource {
  static lastInstance: MockEventSource | null = null;
  private listeners: Map<string, Set<(e: Event) => void>> = new Map();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.lastInstance = this;
    // Simulate async open
    queueMicrotask(() => this._emit("open", undefined));
  }

  addEventListener(type: string, handler: (e: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  close(): void {}

  _emit(type: string, data: string | undefined): void {
    const handlers = this.listeners.get(type) ?? new Set();
    for (const h of handlers) {
      if (type === "message") {
        h(Object.assign(new Event("message"), { data }) as Event);
      } else {
        h(new Event(type));
      }
    }
  }

  handle(): MockEventSourceHandle {
    return {
      emit: (type: string, data?: string) => this._emit(type, data),
      emitError: () => this._emit("error", undefined),
    };
  }
}

interface MockWebSocketHandle {
  open(): void;
  send(data: string): void;
  close(code?: number): void;
}

class MockWebSocket {
  static lastInstance: MockWebSocket | null = null;
  private listeners: Map<string, Set<(e: Event) => void>> = new Map();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.lastInstance = this;
  }

  addEventListener(type: string, handler: (e: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  close(): void {}

  _emit(type: string, data?: string, code?: number): void {
    const handlers = this.listeners.get(type) ?? new Set();
    for (const h of handlers) {
      if (type === "message") {
        h(Object.assign(new Event("message"), { data }) as Event);
      } else if (type === "close") {
        h(Object.assign(new Event("close"), { code: code ?? 1000, wasClean: true }) as Event);
      } else {
        h(new Event(type));
      }
    }
  }

  handle(): MockWebSocketHandle {
    return {
      open: () => this._emit("open"),
      send: (data: string) => this._emit("message", data),
      close: (code = 1000) => this._emit("close", undefined, code),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers to patch and restore globals
// ---------------------------------------------------------------------------

function withMockEventSource(fn: () => Promise<void>): Promise<void> {
  const original = (globalThis as any).EventSource;
  (globalThis as any).EventSource = MockEventSource;
  return fn().finally(() => {
    if (original === undefined) delete (globalThis as any).EventSource;
    else (globalThis as any).EventSource = original;
  });
}

function withMockWebSocket(fn: () => Promise<void>): Promise<void> {
  const original = (globalThis as any).WebSocket;
  (globalThis as any).WebSocket = MockWebSocket;
  return fn().finally(() => {
    if (original === undefined) delete (globalThis as any).WebSocket;
    else (globalThis as any).WebSocket = original;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("SSE channel: connects and calls invalidateResourcesByTags on message", async () => {
  await withMockEventSource(async () => {
    resetRuntimeGraph();

    let invalidatedTags: string[] = [];
    // Intercept via onMessage
    const channel = createInvalidationChannel({
      type: "sse",
      url: "/events",
      onMessage: (tags) => {
        invalidatedTags = tags;
      },
      reconnectMs: 0,
    });

    channel.connect();
    await new Promise<void>((r) => queueMicrotask(r)); // let open fire

    assert.equal(channel.status(), "connected");

    const handle = MockEventSource.lastInstance!.handle();
    handle.emit("message", JSON.stringify({ tags: ["users", "posts:1"] }));

    assert.deepEqual(invalidatedTags, ["users", "posts:1"]);
    assert.equal(channel.messageCount(), 1);

    channel.disconnect();
    assert.equal(channel.status(), "closed");
  });
});

test("SSE channel: ignores malformed messages", async () => {
  await withMockEventSource(async () => {
    resetRuntimeGraph();

    let called = false;
    const channel = createInvalidationChannel({
      type: "sse",
      url: "/events",
      onMessage: () => { called = true; },
      reconnectMs: 0,
    });

    channel.connect();
    await new Promise<void>((r) => queueMicrotask(r));

    const handle = MockEventSource.lastInstance!.handle();
    handle.emit("message", "not-json");
    handle.emit("message", JSON.stringify({ wrong: "shape" }));

    assert.equal(called, false, "onMessage should not be called for malformed data");

    channel.disconnect();
  });
});

test("SSE channel: onMessage returning false suppresses invalidation", async () => {
  await withMockEventSource(async () => {
    resetRuntimeGraph();

    let messageCount = 0;
    const channel = createInvalidationChannel({
      type: "sse",
      url: "/events",
      onMessage: () => {
        messageCount++;
        return false; // suppress
      },
      reconnectMs: 0,
    });

    channel.connect();
    await new Promise<void>((r) => queueMicrotask(r));

    const handle = MockEventSource.lastInstance!.handle();
    handle.emit("message", JSON.stringify({ tags: ["x"] }));

    assert.equal(channel.messageCount(), 0, "suppressed message should not increment count");
    assert.equal(messageCount, 1, "onMessage should still have been called");

    channel.disconnect();
  });
});

test("WebSocket channel: connects and processes invalidation messages", async () => {
  await withMockWebSocket(async () => {
    resetRuntimeGraph();

    let receivedTags: string[] = [];
    const channel = createInvalidationChannel({
      type: "websocket",
      url: "ws://localhost/invalidation",
      onMessage: (tags) => { receivedTags = tags; },
      reconnectMs: 0,
    });

    channel.connect();
    assert.equal(channel.status(), "connecting");

    const handle = MockWebSocket.lastInstance!.handle();
    handle.open();
    assert.equal(channel.status(), "connected");

    handle.send(JSON.stringify({ tags: ["inventory"] }));
    assert.deepEqual(receivedTags, ["inventory"]);
    assert.equal(channel.messageCount(), 1);

    channel.disconnect();
    assert.equal(channel.status(), "closed");
  });
});

test("WebSocket channel: does not reconnect after intentional disconnect", async () => {
  await withMockWebSocket(async () => {
    resetRuntimeGraph();

    let connectCount = 0;
    const Original = MockWebSocket;
    class TrackingWS extends Original {
      constructor(url: string) {
        super(url);
        connectCount++;
      }
    }
    (globalThis as any).WebSocket = TrackingWS;

    const channel = createInvalidationChannel({
      type: "websocket",
      url: "ws://localhost/inv",
      reconnectMs: 10,
    });

    channel.connect();
    const handle = TrackingWS.lastInstance!.handle();
    handle.open();
    channel.disconnect();

    handle.close(1006); // abnormal close AFTER disconnect
    await new Promise<void>((r) => setTimeout(r, 20)); // wait past reconnect interval

    assert.equal(connectCount, 1, "should not reconnect after intentional disconnect");
  });
});

test("invalidateResourcesByTags is a no-op for unknown tags (no crash)", () => {
  resetRuntimeGraph();
  // Just verify it doesn't throw when no resources match these tags
  assert.doesNotThrow(() => invalidateResourcesByTags(["unknown-tag-xyz"]));
});
