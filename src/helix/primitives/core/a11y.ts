export function setDialogAttrs(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  contentId: string,
  isOpen: boolean,
): void {
  contentEl.id = contentId;
  contentEl.setAttribute("role", "dialog");
  contentEl.setAttribute("aria-modal", "true");
  triggerEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
  triggerEl.setAttribute("aria-controls", contentId);
}

export function setPopoverAttrs(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  contentId: string,
  isOpen: boolean,
): void {
  contentEl.id = contentId;
  contentEl.setAttribute("role", "region");
  triggerEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
  triggerEl.setAttribute("aria-haspopup", "true");
  triggerEl.setAttribute("aria-controls", contentId);
}

export function setMenuAttrs(
  triggerEl: HTMLElement,
  menuEl: HTMLElement,
  menuId: string,
  isOpen: boolean,
): void {
  menuEl.id = menuId;
  menuEl.setAttribute("role", "menu");
  triggerEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
  triggerEl.setAttribute("aria-haspopup", "menu");
  triggerEl.setAttribute("aria-controls", menuId);
}

export function setTabsAttrs(
  tablistEl: HTMLElement,
  tabs: HTMLElement[],
  panels: HTMLElement[],
  activeIndex: number,
): void {
  tablistEl.setAttribute("role", "tablist");

  tabs.forEach((tab, index) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
    const panelId = `panel-${index}`;
    if (panels[index]) {
      panels[index].id = panelId;
      tab.setAttribute("aria-controls", panelId);
    }
  });

  panels.forEach((panel, index) => {
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${index}`);
  });
}
