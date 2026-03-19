import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type UserEditCompiledViewProps = Parameters<
  typeof import("../../views-tsx/user-edit.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {

  },
  lists: {

  },
};

export const userEditCompiledArtifact: CompiledViewArtifact<UserEditCompiledViewProps> = defineCompiledViewArtifact<UserEditCompiledViewProps>(
  compiledViewId("user-edit"),
  "user-edit",
  {
    template: "<main><nav><a href=\"/\">← All users</a></nav><h2>Edit User</h2><form method=\"POST\" action=\"__HX_ATTR_user-edit_action_1_hx-user-edit-slot-1__\" novalidate data-hx-id=\"hx-user-edit-slot-1\"><label>Name\n          <input name=\"name\" value=\"__HX_ATTR_user-edit_value_2_hx-user-edit-slot-2__\" required data-hx-id=\"hx-user-edit-slot-2\" /></label><label>Email\n          <input name=\"email\" type=\"email\" value=\"__HX_ATTR_user-edit_value_3_hx-user-edit-slot-3__\" required data-hx-id=\"hx-user-edit-slot-3\" /></label><label>Status\n          <select name=\"status\">__HX_HTML_user-edit_4_hx-user-edit-slot-4__</select></label><button type=\"submit\">Save Changes</button></form></main>",
    patches: [
    {
      kind: "attr",
      token: "__HX_ATTR_user-edit_action_1_hx-user-edit-slot-1__",
      targetId: "hx-user-edit-slot-1",
      attrName: "action",
      evaluate: (props: UserEditCompiledViewProps) => (`/api/users/${props.userId}`),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_user-edit_value_2_hx-user-edit-slot-2__",
      targetId: "hx-user-edit-slot-2",
      attrName: "value",
      evaluate: (props: UserEditCompiledViewProps) => (props.userName),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_user-edit_value_3_hx-user-edit-slot-3__",
      targetId: "hx-user-edit-slot-3",
      attrName: "value",
      evaluate: (props: UserEditCompiledViewProps) => (props.userEmail),
    },
    {
      kind: "html",
      token: "__HX_HTML_user-edit_4_hx-user-edit-slot-4__",
      targetId: "hx-user-edit-slot-4",
      evaluate: (props: UserEditCompiledViewProps) => (props.statusOptionsHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const userEditCompiledViewId = userEditCompiledArtifact.id;

export function renderUserEditCompiledView(props: UserEditCompiledViewProps): string {
  return renderCompiledView(userEditCompiledArtifact, props);
}

export function buildUserEditCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const userEditCompiledPatchTable = userEditCompiledArtifact.patches;
