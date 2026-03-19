const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
}

export function trapFocus(root: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusables = getFocusableElements(root);
    if (focusables.length === 0) return;

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = focusables.indexOf(activeElement || document.body);
    let nextIndex: number;

    if (e.shiftKey) {
      // Shift+Tab: move backwards with wrapping
      nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
    } else {
      // Tab: move forwards with wrapping
      nextIndex = currentIndex < focusables.length - 1 ? currentIndex + 1 : 0;
    }

    e.preventDefault();
    focusables[nextIndex].focus();
  };

  root.addEventListener("keydown", handleKeyDown);

  return () => {
    root.removeEventListener("keydown", handleKeyDown);
    restoreFocus(previouslyFocused);
  };
}

export function restoreFocus(element: HTMLElement | null): void {
  if (element && typeof element.focus === "function") {
    element.focus();
  }
}
