// Module-level singleton for managing layer stack
// Ensures correct Escape key ordering when layers are nested

const layerStack: symbol[] = [];

export function pushLayer(id: symbol): void {
  layerStack.push(id);
}

export function popLayer(id: symbol): void {
  const index = layerStack.lastIndexOf(id);
  if (index !== -1) {
    layerStack.splice(index, 1);
  }
}

export function isTopmostLayer(id: symbol): boolean {
  return layerStack.length > 0 && layerStack[layerStack.length - 1] === id;
}
