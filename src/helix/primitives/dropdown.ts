import {
  createMenuController,
  type MenuController,
  type MenuOptions,
} from "./menu.js";

export interface DropdownOptions extends MenuOptions {}

export interface DropdownController extends MenuController {}

export function createDropdownController(
  triggerEl: HTMLElement,
  contentEl: HTMLElement,
  options?: DropdownOptions,
): DropdownController {
  triggerEl.setAttribute("data-hx-dropdown-trigger", "true");
  contentEl.setAttribute("data-hx-dropdown", "true");
  return createMenuController(triggerEl, contentEl, options);
}
