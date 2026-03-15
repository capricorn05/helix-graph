import type { BindingMap } from "../../../helix/types.js";
import {
  renderCompiledView,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const settingsCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<p>Configure application settings and preferences.</p><section><h2>User Management Settings</h2><form method=\"POST\" action=\"/settings\" novalidate><label>__HX_HTML_settings_1_hx-settings-slot-1__Auto-activate new users (read-only)\n          </label><label>Max users per page\n            __HX_HTML_settings_2_hx-settings-slot-2__</label><p style=\"opacity: 0.6; font-size: 0.9rem;\">Note: These settings are read-only in demo mode.\n          </p></form></section><section><h2>API Configuration</h2><dl><dt>Cache Duration</dt><dd>2 seconds (users), 5 seconds (user detail)</dd><dt>Revalidation</dt><dd>5 seconds</dd><dt>Deduplication</dt><dd>Inflight requests</dd></dl></section>",
  patches: [
    {
      kind: "html",
      token: "__HX_HTML_settings_1_hx-settings-slot-1__",
      targetId: "hx-settings-slot-1",
      evaluate: (props: any) => (props.autoActivateInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_settings_2_hx-settings-slot-2__",
      targetId: "hx-settings-slot-2",
      evaluate: (props: any) => (props.pageSizeSelectHtml),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderSettingsCompiledView(props: any): string {
  return renderCompiledView(settingsCompiledArtifact, props);
}

export function buildSettingsCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const settingsCompiledPatchTable = settingsCompiledArtifact.patches;
