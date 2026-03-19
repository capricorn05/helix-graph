let portalRoot: HTMLElement | null = null;

export function ensurePortalRoot(): HTMLElement {
  if (portalRoot) return portalRoot;

  portalRoot = document.createElement("div");
  portalRoot.id = "__hx-portal-root__";
  portalRoot.setAttribute("data-hx-portal", "true");
  document.body.appendChild(portalRoot);

  return portalRoot;
}

export function mountToPortal(element: HTMLElement): void {
  const root = ensurePortalRoot();
  root.appendChild(element);
}

export function unmountFromPortal(element: HTMLElement): void {
  const parent = element.parentElement;
  if (parent && parent.id === "__hx-portal-root__") {
    parent.removeChild(element);
  }
}
