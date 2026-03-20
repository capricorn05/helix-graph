import { toCamelCase, toPascalCase } from "./compiler-utils.js";
import type { BindingEvent, BindingRecord } from "./binding-map-compiler.js";
import type { BindingMapEventEntry } from "./codegen-emitters.js";

export interface ClientActionMetadataEntry {
  actionId?: string;
  event?: BindingEvent;
  handlerExport?: string;
  preventDefault?: boolean;
  chunk?: string;
}

export type ClientActionMetadata = Record<string, ClientActionMetadataEntry>;

export interface ResolveClientActionEventEntriesOptions {
  bindings: readonly BindingRecord[];
  availableHandlers: ReadonlySet<string>;
  metadata?: Readonly<ClientActionMetadata>;
  defaultChunk: string;
}

export function defineClientActionMetadata<
  const T extends ClientActionMetadata,
>(metadata: T): T {
  return metadata;
}

export function inferClientHandlerCandidates(bindingId: string): string[] {
  const parts = bindingId.split("-").filter(Boolean);
  const candidates = new Set<string>();
  candidates.add(`on${toPascalCase(bindingId)}`);

  if (parts.length >= 2) {
    candidates.add(
      `on${toPascalCase(parts[0])}By${toPascalCase(parts.slice(1).join("-"))}`,
    );
  }

  if (parts.length === 2 && parts[1] === "nav") {
    candidates.add(`on${toPascalCase(parts[0])}Navigate`);
  }

  return Array.from(candidates);
}

function resolveHandlerExport(
  bindingId: string,
  availableHandlers: ReadonlySet<string>,
  metadataEntry?: ClientActionMetadataEntry,
): string {
  if (metadataEntry?.handlerExport) {
    if (!availableHandlers.has(metadataEntry.handlerExport)) {
      throw new Error(
        `Client action metadata for "${bindingId}" references missing handler export "${metadataEntry.handlerExport}"`,
      );
    }

    return metadataEntry.handlerExport;
  }

  const candidates = inferClientHandlerCandidates(bindingId);
  for (const candidate of candidates) {
    if (availableHandlers.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No exported client handler found for binding "${bindingId}". Expected one of: ${candidates.join(", ")}`,
  );
}

function validateNoStaleMetadataKeys(
  discoveredBindingIds: ReadonlySet<string>,
  metadata?: Readonly<ClientActionMetadata>,
): void {
  if (!metadata) {
    return;
  }

  const staleKeys = Object.keys(metadata)
    .filter((bindingId) => !discoveredBindingIds.has(bindingId))
    .sort((left, right) => left.localeCompare(right));

  if (staleKeys.length === 0) {
    return;
  }

  throw new Error(
    `Client action metadata contains stale binding ids with no discovered bindings: ${staleKeys.join(", ")}`,
  );
}

export function resolveClientActionEventEntries(
  options: ResolveClientActionEventEntriesOptions,
): BindingMapEventEntry[] {
  const discoveredBindingIds = new Set(
    options.bindings.map((binding) => binding.id),
  );
  validateNoStaleMetadataKeys(discoveredBindingIds, options.metadata);

  return options.bindings.map((binding) => {
    const metadataEntry = options.metadata?.[binding.id];

    const entry: BindingMapEventEntry = {
      id: binding.id,
      event: metadataEntry?.event ?? binding.event,
      actionId: metadataEntry?.actionId ?? toCamelCase(binding.id),
      chunk: metadataEntry?.chunk ?? options.defaultChunk,
      handlerExport: resolveHandlerExport(
        binding.id,
        options.availableHandlers,
        metadataEntry,
      ),
    };

    if (metadataEntry && "preventDefault" in metadataEntry) {
      entry.preventDefault = metadataEntry.preventDefault;
    }

    return entry;
  });
}
