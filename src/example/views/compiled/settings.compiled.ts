import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type SettingsCompiledViewProps = Parameters<
  typeof import("../../views-tsx/settings.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const settingsCompiledArtifact: CompiledViewArtifact<SettingsCompiledViewProps> = defineCompiledViewArtifact<SettingsCompiledViewProps>(
  compiledViewId("settings"),
  "settings",
  {
    template: "<p>Configure application settings and preferences.</p><section data-hx-id=\"settings-primitives-root\"><h2>User Management Settings</h2><form method=\"POST\" action=\"/settings\" novalidate><label>__HX_HTML_settings_1_hx-settings-slot-1__Auto-activate new users (read-only)\n          </label><label>Max users per page\n            __HX_HTML_settings_2_hx-settings-slot-2__</label><div class=\"toolbar\">__HX_HTML_settings_3_hx-settings-slot-3__</div>__HX_HTML_settings_4_hx-settings-slot-4__<p data-hx-id=\"settings-page-size-status\">Selected page size: 6 (read-only in demo mode)\n          </p><p style=\"opacity: 0.6; font-size: 0.9rem;\">Note: These settings are read-only in demo mode.\n          </p></form></section><section><h2>API Configuration</h2><dl><dt>Cache Duration</dt><dd>2 seconds (users), 5 seconds (user detail)</dd><dt>Revalidation</dt><dd>5 seconds</dd><dt>Deduplication</dt><dd>Inflight requests</dd></dl></section>",
    patches: [
    {
      kind: "html",
      token: "__HX_HTML_settings_1_hx-settings-slot-1__",
      targetId: "hx-settings-slot-1",
      evaluate: (props: SettingsCompiledViewProps) => (props.autoActivateInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_settings_2_hx-settings-slot-2__",
      targetId: "hx-settings-slot-2",
      evaluate: (props: SettingsCompiledViewProps) => (props.pageSizeControlHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_settings_3_hx-settings-slot-3__",
      targetId: "hx-settings-slot-3",
      evaluate: (props: SettingsCompiledViewProps) => (props.pageSizeHelpTriggerHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_settings_4_hx-settings-slot-4__",
      targetId: "hx-settings-slot-4",
      evaluate: (props: SettingsCompiledViewProps) => (props.pageSizeHelpTooltipHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const settingsCompiledViewId = settingsCompiledArtifact.id;

export function renderSettingsCompiledView(props: SettingsCompiledViewProps): string {
  return renderCompiledView(settingsCompiledArtifact, props);
}

export function buildSettingsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const settingsCompiledPatchTable = settingsCompiledArtifact.patches;
