/**
 * Development Server Utilities
 *
 * Provides:
 *   - File watcher for client chunks and generated artifacts
 *   - Live reload signal injection into HTML responses
 *   - Incremental artifact regeneration on changes
 */

import { watch } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface DevServerConfig {
  workspaceRoot: string;
  watchDirs: string[];
  onFilesChanged?: (changedFiles: Set<string>) => Promise<void>;
}

interface ClientChange {
  type: "client-action" | "compiled-view" | "other";
  filePath: string;
  timestamp: number;
}

/**
 * Live reload session tracker.
 * Clients poll this to detect file changes.
 */
export class LiveReloadTracker {
  private changes: ClientChange[] = [];
  private lastPolledTimestamp: number = 0;
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();

  /**
   * Start watching directories for changes.
   */
  start(config: DevServerConfig): void {
    for (const dir of config.watchDirs) {
      const watcher = watch(
        dir,
        { recursive: true },
        async (eventType, filename) => {
          if (!filename) return;

          const changeType = this.classifyChange(filename);
          if (changeType === "other") return; // Ignore non-development files

          const change: ClientChange = {
            type: changeType,
            filePath: filename,
            timestamp: Date.now(),
          };

          this.changes.push(change);

          // Trigger regeneration hook if provided
          if (config.onFilesChanged) {
            // Debounce: wait a bit for batch changes
            await new Promise((resolve) => setTimeout(resolve, 100));
            const recentChanges = new Set(
              this.changes.slice(-10).map((c) => c.filePath),
            );
            await config.onFilesChanged(recentChanges);
          }
        },
      );

      this.watchers.set(dir, watcher);
    }
  }

  /**
   * Stop all watchers.
   */
  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Get new changes since last poll.
   */
  pollChanges(sinceTimestamp: number): ClientChange[] {
    const newChanges = this.changes.filter((c) => c.timestamp > sinceTimestamp);
    this.lastPolledTimestamp = Date.now();
    return newChanges;
  }

  /**
   * Classify a file change by its path.
   */
  private classifyChange(filename: string): ClientChange["type"] {
    if (filename.includes("client/actions")) return "client-action";
    if (filename.includes("views/compiled")) return "compiled-view";
    if (filename.endsWith(".test.ts")) return "other"; // Ignore test files
    if (filename.endsWith(".d.ts")) return "other"; // Ignore type definitions
    return "other";
  }
}

/**
 * Inject live-reload script into HTML response.
 * Script polls the /dev/poll-changes endpoint.
 */
export function injectLiveReloadScript(
  html: string,
  options?: { pollIntervalMs?: number },
): string {
  const pollInterval = options?.pollIntervalMs ?? 1000;

  const script = `
<script>
(function() {
  let lastPollTimestamp = Date.now();
  
  async function checkForChanges() {
    try {
      const response = await fetch('/dev/poll-changes?since=' + lastPollTimestamp);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.changes && data.changes.length > 0) {
        console.log('[HMR] Detected', data.changes.length, 'file change(s). Reloading...');
        // For now, do a full page refresh. In future: selective chunk reload
        window.location.reload();
      }
      lastPollTimestamp = data.timestamp;
    } catch (err) {
      console.warn('[HMR] Poll failed:', err);
    }
  }
  
  setInterval(checkForChanges, ${pollInterval});
})();
</script>
`;

  // Inject before closing </body> tag
  return html.replace("</body>", script + "\n</body>");
}

/**
 * Compute a simple hash of file contents for change detection.
 * Used to avoid false-positive change signals.
 */
export function hashFileContents(contents: string): string {
  let hash = 0;
  for (let i = 0; i < contents.length; i++) {
    const char = contents.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
