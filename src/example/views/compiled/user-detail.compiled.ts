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

export const userDetailCompiledArtifact: CompiledViewArtifact<any> = {
  template: "<main><nav><a href=\"/\">← All users</a></nav><h1><span data-hx-id=\"hx-user-detail-slot-1\">__HX_TEXT_user-detail_1_hx-user-detail-slot-1__</span></h1><dl><dt>Email</dt><dd><span data-hx-id=\"hx-user-detail-slot-2\">__HX_TEXT_user-detail_2_hx-user-detail-slot-2__</span></dd><dt>Status</dt><dd><span class=\"__HX_ATTR_user-detail_class_3_hx-user-detail-slot-3__\" data-hx-id=\"hx-user-detail-slot-3\"><span data-hx-id=\"hx-user-detail-slot-4\">__HX_TEXT_user-detail_4_hx-user-detail-slot-4__</span></span></dd><dt>ID</dt><dd><span data-hx-id=\"hx-user-detail-slot-5\">__HX_TEXT_user-detail_5_hx-user-detail-slot-5__</span></dd></dl></main>",
  patches: [
    {
      kind: "text",
      token: "__HX_TEXT_user-detail_1_hx-user-detail-slot-1__",
      targetId: "hx-user-detail-slot-1",
      evaluate: (props: any) => (props.userName),
    },
    {
      kind: "text",
      token: "__HX_TEXT_user-detail_2_hx-user-detail-slot-2__",
      targetId: "hx-user-detail-slot-2",
      evaluate: (props: any) => (props.userEmail),
    },
    {
      kind: "attr",
      token: "__HX_ATTR_user-detail_class_3_hx-user-detail-slot-3__",
      targetId: "hx-user-detail-slot-3",
      attrName: "class",
      evaluate: (props: any) => (props.userStatusClass),
    },
    {
      kind: "text",
      token: "__HX_TEXT_user-detail_4_hx-user-detail-slot-4__",
      targetId: "hx-user-detail-slot-4",
      evaluate: (props: any) => (props.userStatus),
    },
    {
      kind: "text",
      token: "__HX_TEXT_user-detail_5_hx-user-detail-slot-5__",
      targetId: "hx-user-detail-slot-5",
      evaluate: (props: any) => (props.userId),
    }
  ],
  bindingMap: compiledBindingMap,
};

export function renderUserDetailCompiledView(props: any): string {
  return renderCompiledView(userDetailCompiledArtifact, props);
}

export function buildUserDetailCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const userDetailCompiledPatchTable = userDetailCompiledArtifact.patches;
