import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type PrimitivesCompiledViewProps = Parameters<
  typeof import("../../views-tsx/primitives.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {},
  lists: {},
};

export const primitivesCompiledArtifact: CompiledViewArtifact<PrimitivesCompiledViewProps> =
  defineCompiledViewArtifact<PrimitivesCompiledViewProps>(
    compiledViewId("primitives"),
    "primitives",
    {
      template:
        '<div data-hx-id="primitives-demo-root" class="primitive-demo-root"><p>Live playground for every headless primitive. Interact with each sample\n        to verify keyboard behavior, dismissal, and state updates.\n      </p><section><h2>Dialog</h2><div class="toolbar"><button type="button" data-hx-id="demo-dialog-trigger">Open Dialog\n          </button></div><div data-hx-id="demo-dialog-content" class="modal-overlay" style="display: none;"><div class="modal-card" aria-labelledby="demo-dialog-title"><div class="modal-header"><h3 id="demo-dialog-title">Dialog Primitive</h3><button type="button" data-hx-id="demo-dialog-close">Close\n              </button></div><p>Escape key, outside click, and the close button all dismiss this\n              layer.\n            </p></div></div></section><section><h2>Popover &amp; Tooltip</h2><div class="toolbar"><button type="button" data-hx-id="demo-popover-trigger">Toggle Popover\n          </button><button type="button" data-hx-id="demo-tooltip-trigger">Hover for Tooltip\n          </button></div><div data-hx-id="demo-popover-content" class="primitive-surface" style="display: none;">Popover content anchored to its trigger.\n        </div><div data-hx-id="demo-tooltip-content" class="primitive-surface primitive-tooltip" style="display: none;">Tooltip appears on hover/focus and closes on Escape.\n        </div></section><section><h2>Menu &amp; Dropdown</h2><div class="toolbar"><button type="button" data-hx-id="demo-menu-trigger">Open Menu\n          </button><button type="button" data-hx-id="demo-dropdown-trigger">Open Dropdown\n          </button></div><div data-hx-id="demo-menu-content" class="primitive-listbox" style="display: none;"><button type="button" role="menuitem" class="primitive-option">Edit\n          </button><button type="button" role="menuitem" class="primitive-option">Duplicate\n          </button><button type="button" role="menuitem" class="primitive-option">Archive\n          </button></div><div data-hx-id="demo-dropdown-content" class="primitive-listbox" style="display: none;"><button type="button" role="menuitem" class="primitive-option">Active\n          </button><button type="button" role="menuitem" class="primitive-option">Paused\n          </button><button type="button" role="menuitem" class="primitive-option">Archived\n          </button></div></section><section><h2>Tabs &amp; Accordion</h2><div data-hx-id="demo-tabs-root" class="primitive-tabs"><div class="toolbar"><button type="button" data-hx-tab>Overview\n            </button><button type="button" data-hx-tab>Activity\n            </button><button type="button" data-hx-tab>Settings\n            </button></div><div data-hx-panel><p>Overview panel content.</p></div><div data-hx-panel><p>Activity panel content.</p></div><div data-hx-panel><p>Settings panel content.</p></div></div><div data-hx-id="demo-accordion-root" class="primitive-accordion"><div data-hx-accordion-item><button type="button" data-hx-accordion-trigger>What does this demo cover?\n            </button><div data-hx-accordion-content>Dialog, floating layers, listbox controls, and keyboard-first UI\n              behavior.\n            </div></div><div data-hx-accordion-item><button type="button" data-hx-accordion-trigger>Is this framework-specific?\n            </button><div data-hx-accordion-content>The primitives use plain DOM APIs and can be mounted in any Helix\n              page.\n            </div></div></div></section><section><h2>Toast, Select &amp; Combobox</h2><div class="toolbar"><button type="button" data-hx-id="demo-toast-trigger">Show Toast\n          </button></div><div data-hx-id="demo-toast-viewport"></div><div class="primitive-form-row"><label>Select Priority\n            <button type="button" data-hx-id="demo-select-trigger" data-hx-select-label="true">Medium\n            </button></label><div data-hx-id="demo-select-list" class="primitive-listbox" style="display: none;"><div data-hx-option data-hx-value="low" class="primitive-option">Low\n            </div><div data-hx-option data-hx-value="medium" class="primitive-option">Medium\n            </div><div data-hx-option data-hx-value="high" class="primitive-option">High\n            </div></div><p data-hx-id="demo-select-value">Selected: Medium</p></div><div class="primitive-form-row"><label>Combobox Search\n            <input type="text" data-hx-id="demo-combobox-input" placeholder="Type a category" /></label><div data-hx-id="demo-combobox-list" class="primitive-listbox" style="display: none;"><div data-hx-option data-hx-value="electronics" class="primitive-option">Electronics\n            </div><div data-hx-option data-hx-value="furniture" class="primitive-option">Furniture\n            </div><div data-hx-option data-hx-value="groceries" class="primitive-option">Groceries\n            </div><div data-hx-option data-hx-value="accessories" class="primitive-option">Accessories\n            </div></div><p data-hx-id="demo-combobox-value">Selected: -</p></div></section></div>',
      patches: [],
      bindingMap: compiledBindingMap,
    },
  );

export const primitivesCompiledViewId = primitivesCompiledArtifact.id;

export function renderPrimitivesCompiledView(
  _props: PrimitivesCompiledViewProps,
): string {
  return renderCompiledView(primitivesCompiledArtifact, _props);
}

export function buildPrimitivesCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const primitivesCompiledPatchTable = primitivesCompiledArtifact.patches;
