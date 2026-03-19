export interface PrimitivesPageProps {}

export default function PrimitivesPageView(_props: PrimitivesPageProps) {
  return (
    <div data-hx-id="primitives-demo-root" className="primitive-demo-root">
      <p>
        Live playground for every headless primitive. Interact with each sample
        to verify keyboard behavior, dismissal, and state updates.
      </p>

      <section>
        <h2>Dialog</h2>
        <div className="toolbar">
          <button type="button" data-hx-id="demo-dialog-trigger">
            Open Dialog
          </button>
        </div>

        <div
          data-hx-id="demo-dialog-content"
          className="modal-overlay"
          style="display: none;"
        >
          <div className="modal-card" aria-labelledby="demo-dialog-title">
            <div className="modal-header">
              <h3 id="demo-dialog-title">Dialog Primitive</h3>
              <button type="button" data-hx-id="demo-dialog-close">
                Close
              </button>
            </div>
            <p>
              Escape key, outside click, and the close button all dismiss this
              layer.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Popover & Tooltip</h2>
        <div className="toolbar">
          <button type="button" data-hx-id="demo-popover-trigger">
            Toggle Popover
          </button>
          <button type="button" data-hx-id="demo-tooltip-trigger">
            Hover for Tooltip
          </button>
        </div>

        <div
          data-hx-id="demo-popover-content"
          className="primitive-surface"
          style="display: none;"
        >
          Popover content anchored to its trigger.
        </div>

        <div
          data-hx-id="demo-tooltip-content"
          className="primitive-surface primitive-tooltip"
          style="display: none;"
        >
          Tooltip appears on hover/focus and closes on Escape.
        </div>
      </section>

      <section>
        <h2>Menu & Dropdown</h2>
        <div className="toolbar">
          <button type="button" data-hx-id="demo-menu-trigger">
            Open Menu
          </button>
          <button type="button" data-hx-id="demo-dropdown-trigger">
            Open Dropdown
          </button>
        </div>

        <div
          data-hx-id="demo-menu-content"
          className="primitive-listbox"
          style="display: none;"
        >
          <button type="button" role="menuitem" className="primitive-option">
            Edit
          </button>
          <button type="button" role="menuitem" className="primitive-option">
            Duplicate
          </button>
          <button type="button" role="menuitem" className="primitive-option">
            Archive
          </button>
        </div>

        <div
          data-hx-id="demo-dropdown-content"
          className="primitive-listbox"
          style="display: none;"
        >
          <button type="button" role="menuitem" className="primitive-option">
            Active
          </button>
          <button type="button" role="menuitem" className="primitive-option">
            Paused
          </button>
          <button type="button" role="menuitem" className="primitive-option">
            Archived
          </button>
        </div>
      </section>

      <section>
        <h2>Tabs & Accordion</h2>
        <div data-hx-id="demo-tabs-root" className="primitive-tabs">
          <div className="toolbar">
            <button type="button" data-hx-tab>
              Overview
            </button>
            <button type="button" data-hx-tab>
              Activity
            </button>
            <button type="button" data-hx-tab>
              Settings
            </button>
          </div>
          <div data-hx-panel>
            <p>Overview panel content.</p>
          </div>
          <div data-hx-panel>
            <p>Activity panel content.</p>
          </div>
          <div data-hx-panel>
            <p>Settings panel content.</p>
          </div>
        </div>

        <div data-hx-id="demo-accordion-root" className="primitive-accordion">
          <div data-hx-accordion-item>
            <button type="button" data-hx-accordion-trigger>
              What does this demo cover?
            </button>
            <div data-hx-accordion-content>
              Dialog, floating layers, listbox controls, and keyboard-first UI
              behavior.
            </div>
          </div>
          <div data-hx-accordion-item>
            <button type="button" data-hx-accordion-trigger>
              Is this framework-specific?
            </button>
            <div data-hx-accordion-content>
              The primitives use plain DOM APIs and can be mounted in any Helix
              page.
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Toast, Select & Combobox</h2>
        <div className="toolbar">
          <button type="button" data-hx-id="demo-toast-trigger">
            Show Toast
          </button>
        </div>
        <div data-hx-id="demo-toast-viewport"></div>

        <div className="primitive-form-row">
          <label>
            Select Priority
            <button
              type="button"
              data-hx-id="demo-select-trigger"
              data-hx-select-label="true"
            >
              Medium
            </button>
          </label>
          <div
            data-hx-id="demo-select-list"
            className="primitive-listbox"
            style="display: none;"
          >
            <div data-hx-option data-hx-value="low" className="primitive-option">
              Low
            </div>
            <div
              data-hx-option
              data-hx-value="medium"
              className="primitive-option"
            >
              Medium
            </div>
            <div data-hx-option data-hx-value="high" className="primitive-option">
              High
            </div>
          </div>
          <p data-hx-id="demo-select-value">Selected: Medium</p>
        </div>

        <div className="primitive-form-row">
          <label>
            Combobox Search
            <input
              type="text"
              data-hx-id="demo-combobox-input"
              placeholder="Type a category"
            />
          </label>
          <div
            data-hx-id="demo-combobox-list"
            className="primitive-listbox"
            style="display: none;"
          >
            <div
              data-hx-option
              data-hx-value="electronics"
              className="primitive-option"
            >
              Electronics
            </div>
            <div
              data-hx-option
              data-hx-value="furniture"
              className="primitive-option"
            >
              Furniture
            </div>
            <div
              data-hx-option
              data-hx-value="groceries"
              className="primitive-option"
            >
              Groceries
            </div>
            <div
              data-hx-option
              data-hx-value="accessories"
              className="primitive-option"
            >
              Accessories
            </div>
          </div>
          <p data-hx-id="demo-combobox-value">Selected: -</p>
        </div>
      </section>
    </div>
  );
}
