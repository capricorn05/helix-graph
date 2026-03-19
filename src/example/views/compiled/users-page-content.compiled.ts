import type { BindingMap } from "../../../helix/types.js";
import {
  compiledViewId,
  defineCompiledViewArtifact,
  renderCompiledView,
  serializeClientOnlyProps,
  type CompiledViewArtifact,
} from "../../../helix/view-compiler.js";

export type UsersPageContentCompiledViewProps = Parameters<
  typeof import("../../views-tsx/users-page-content.view.js").default
>[0];

const compiledBindingMap: BindingMap = {
  events: {
    "create-user": {
      id: "create-user",
      event: "submit",
      actionId: "createUser",
      chunk: "/client/actions.js",
      handlerExport: "onCreateUser",
      preventDefault: true,
    }
  },
  lists: {

  },
};

export const usersPageContentCompiledArtifact: CompiledViewArtifact<UsersPageContentCompiledViewProps> = defineCompiledViewArtifact<UsersPageContentCompiledViewProps>(
  compiledViewId("users-page-content"),
  "users-page-content",
  {
    template: "<p>Streaming SSR + resumable activation + patch-first updates.</p>__HX_HTML_users-page-content_1_hx-users-page-content-slot-1__<section><h2>Add user</h2><form data-hx-id=\"create-user-form\" data-hx-bind=\"create-user\" novalidate><label>Name\n            __HX_HTML_users-page-content_2_hx-users-page-content-slot-2__</label><p class=\"error\" data-hx-id=\"error-name\"></p><label>Email\n            __HX_HTML_users-page-content_3_hx-users-page-content-slot-3__</label><p class=\"error\" data-hx-id=\"error-email\"></p>__HX_HTML_users-page-content_4_hx-users-page-content-slot-4__<p class=\"error\" data-hx-id=\"error-form\"></p><p data-hx-id=\"form-status\"></p></form></section><section><h2>Live component load</h2><p>Load server-rendered content into this section without a full page reload.</p><div class=\"toolbar\">__HX_HTML_users-page-content_5_hx-users-page-content-slot-5____HX_HTML_users-page-content_6_hx-users-page-content-slot-6____HX_HTML_users-page-content_7_hx-users-page-content-slot-7____HX_HTML_users-page-content_8_hx-users-page-content-slot-8__</div><div data-hx-id=\"users-live-panel\" aria-live=\"polite\"><p>Select a panel above to load this section in place.</p></div></section>",
    patches: [
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_1_hx-users-page-content-slot-1__",
      targetId: "hx-users-page-content-slot-1",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.usersSectionHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_2_hx-users-page-content-slot-2__",
      targetId: "hx-users-page-content-slot-2",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.nameInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_3_hx-users-page-content-slot-3__",
      targetId: "hx-users-page-content-slot-3",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.emailInputHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_4_hx-users-page-content-slot-4__",
      targetId: "hx-users-page-content-slot-4",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.submitButtonHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_5_hx-users-page-content-slot-5__",
      targetId: "hx-users-page-content-slot-5",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.summaryPanelButtonHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_6_hx-users-page-content-slot-6__",
      targetId: "hx-users-page-content-slot-6",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.reportsPanelButtonHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_7_hx-users-page-content-slot-7__",
      targetId: "hx-users-page-content-slot-7",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.externalDataPanelButtonHtml),
    },
    {
      kind: "html",
      token: "__HX_HTML_users-page-content_8_hx-users-page-content-slot-8__",
      targetId: "hx-users-page-content-slot-8",
      evaluate: (props: UsersPageContentCompiledViewProps) => (props.helpPanelButtonHtml),
    }
    ],
    bindingMap: compiledBindingMap,
  },
);

export const usersPageContentCompiledViewId = usersPageContentCompiledArtifact.id;

export function renderUsersPageContentCompiledView(props: UsersPageContentCompiledViewProps): string {
  return renderCompiledView(usersPageContentCompiledArtifact, props);
}

export function buildUsersPageContentCompiledBindingMap(): BindingMap {
  return compiledBindingMap;
}

export const usersPageContentCompiledPatchTable = usersPageContentCompiledArtifact.patches;
