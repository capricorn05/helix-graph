import { KEY, createKeyboardHandler } from "./keyboard.js";
import { isTopmostLayer, popLayer, pushLayer } from "./layer-stack.js";

export interface DismissableLayerOptions {
  element: HTMLElement;
  onDismiss: (reason: "escape" | "outside-click") => void;
  disableEscape?: boolean;
  disableOutsideClick?: boolean;
}

export interface DismissableLayer {
  mount(): void;
  destroy(): void;
}

export function createDismissableLayer(
  options: DismissableLayerOptions,
): DismissableLayer {
  const {
    element,
    onDismiss,
    disableEscape = false,
    disableOutsideClick = false,
  } = options;

  const layerId = Symbol("dismissable-layer");
  let isMounted = false;

  const handleKeyDown = createKeyboardHandler({
    [KEY.Escape]: (e) => {
      if (disableEscape || !isTopmostLayer(layerId)) return;
      e.preventDefault();
      onDismiss("escape");
    },
  });

  const handlePointerDown = (e: PointerEvent) => {
    if (disableOutsideClick || !isTopmostLayer(layerId)) return;

    // Check if click is outside the element
    if (!element.contains(e.target as Node)) {
      onDismiss("outside-click");
    }
  };

  return {
    mount(): void {
      if (isMounted) return;
      isMounted = true;

      pushLayer(layerId);

      if (!disableEscape) {
        document.addEventListener("keydown", handleKeyDown);
      }
      if (!disableOutsideClick) {
        document.addEventListener("pointerdown", handlePointerDown, true); // capture phase
      }
    },

    destroy(): void {
      if (!isMounted) return;
      isMounted = false;

      popLayer(layerId);

      if (!disableEscape) {
        document.removeEventListener("keydown", handleKeyDown);
      }
      if (!disableOutsideClick) {
        document.removeEventListener("pointerdown", handlePointerDown, true);
      }
    },
  };
}
