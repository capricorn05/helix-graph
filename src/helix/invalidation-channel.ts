/**
 * Live resource invalidation via SSE or WebSocket.
 *
 * The server pushes JSON messages of shape `{ tags: string[] }`. On receipt,
 * `invalidateResourcesByTags(tags)` is called, which evicts those cache entries
 * so the next `resource.get()` call re-fetches fresh data.
 *
 * SSE example:
 * ```ts
 * const channel = createInvalidationChannel({
 *   type: "sse",
 *   url: "/api/invalidation-stream",
 * });
 * channel.connect();
 * ```
 *
 * WebSocket example:
 * ```ts
 * const channel = createInvalidationChannel({
 *   type: "websocket",
 *   url: "wss://example.com/invalidation",
 * });
 * channel.connect();
 * ```
 *
 * Message format expected from the server (JSON):
 * ```json
 * { "tags": ["users", "posts:42"] }
 * ```
 */

import { invalidateResourcesByTags } from "./resource.js";

export type InvalidationChannelType = "sse" | "websocket";

export interface InvalidationChannelOptions {
  /** Transport type. */
  type: InvalidationChannelType;
  /** URL of the SSE endpoint or WebSocket server. */
  url: string;
  /**
   * Called when a message arrives before tags are processed.
   * Return `false` to suppress invalidation for that message.
   */
  onMessage?: (tags: string[]) => boolean | void;
  /**
   * Called when the connection opens. */
  onOpen?: () => void;
  /**
   * Called when the connection closes or errors. Receives the raw event. */
  onClose?: (event: Event | CloseEvent) => void;
  /**
   * Milliseconds to wait before attempting a reconnect after an unexpected
   * close. Set to `0` to disable auto-reconnect. Default: 3000.
   */
  reconnectMs?: number;
}

export type InvalidationChannelStatus = "disconnected" | "connecting" | "connected" | "closed";

export interface InvalidationChannel {
  /** Connect to the invalidation source. Safe to call multiple times. */
  connect(): void;
  /** Disconnect and disable reconnection. */
  disconnect(): void;
  /** Current connection status. */
  status(): InvalidationChannelStatus;
  /** Number of invalidation messages received since connect(). */
  messageCount(): number;
}

function parseTagMessage(raw: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "tags" in parsed &&
      Array.isArray((parsed as Record<string, unknown>)["tags"])
    ) {
      return (parsed as { tags: unknown[] })["tags"].filter(
        (t): t is string => typeof t === "string",
      );
    }
  } catch {
    // Ignore malformed messages
  }
  return null;
}

function createSseChannel(
  options: InvalidationChannelOptions,
): InvalidationChannel {
  let source: EventSource | null = null;
  let status: InvalidationChannelStatus = "disconnected";
  let messageCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionallyClosed = false;
  const reconnectMs = options.reconnectMs ?? 3000;

  function cleanup(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (source) {
      source.close();
      source = null;
    }
  }

  function scheduleReconnect(): void {
    if (intentionallyClosed || reconnectMs === 0) return;
    reconnectTimer = setTimeout(() => {
      if (!intentionallyClosed) {
        connect();
      }
    }, reconnectMs);
  }

  function connect(): void {
    if (status === "connected" || status === "connecting") return;
    intentionallyClosed = false;
    status = "connecting";

    const es = new EventSource(options.url);
    source = es;

    es.addEventListener("open", () => {
      status = "connected";
      options.onOpen?.();
    });

    es.addEventListener("message", (event: MessageEvent) => {
      const tags = parseTagMessage(event.data as string);
      if (!tags) return;

      const suppress = options.onMessage?.(tags);
      if (suppress === false) return;

      messageCount++;
      invalidateResourcesByTags(tags);
    });

    es.addEventListener("error", (event: Event) => {
      status = "disconnected";
      options.onClose?.(event);
      cleanup();
      scheduleReconnect();
    });
  }

  return {
    connect,
    disconnect(): void {
      intentionallyClosed = true;
      status = "closed";
      cleanup();
    },
    status(): InvalidationChannelStatus {
      return status;
    },
    messageCount(): number {
      return messageCount;
    },
  };
}

function createWebSocketChannel(
  options: InvalidationChannelOptions,
): InvalidationChannel {
  let ws: WebSocket | null = null;
  let status: InvalidationChannelStatus = "disconnected";
  let messageCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionallyClosed = false;
  const reconnectMs = options.reconnectMs ?? 3000;

  function cleanup(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function scheduleReconnect(): void {
    if (intentionallyClosed || reconnectMs === 0) return;
    reconnectTimer = setTimeout(() => {
      if (!intentionallyClosed) {
        connect();
      }
    }, reconnectMs);
  }

  function connect(): void {
    if (status === "connected" || status === "connecting") return;
    intentionallyClosed = false;
    status = "connecting";

    const socket = new WebSocket(options.url);
    ws = socket;

    socket.addEventListener("open", () => {
      status = "connected";
      options.onOpen?.();
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      const tags = parseTagMessage(event.data as string);
      if (!tags) return;

      const suppress = options.onMessage?.(tags);
      if (suppress === false) return;

      messageCount++;
      invalidateResourcesByTags(tags);
    });

    socket.addEventListener("close", (event: CloseEvent) => {
      if (ws !== socket) return; // superseded
      status = "disconnected";
      options.onClose?.(event);
      cleanup();
      scheduleReconnect();
    });

    socket.addEventListener("error", (event: Event) => {
      if (ws !== socket) return;
      options.onClose?.(event);
    });
  }

  return {
    connect,
    disconnect(): void {
      intentionallyClosed = true;
      status = "closed";
      cleanup();
    },
    status(): InvalidationChannelStatus {
      return status;
    },
    messageCount(): number {
      return messageCount;
    },
  };
}

export function createInvalidationChannel(
  options: InvalidationChannelOptions,
): InvalidationChannel {
  if (options.type === "sse") {
    return createSseChannel(options);
  }
  return createWebSocketChannel(options);
}
