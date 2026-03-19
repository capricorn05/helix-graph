import assert from "node:assert/strict";
import test from "node:test";
import {
  connectRouteViewResources,
  resetRuntimeGraph,
  runtimeGraph,
} from "../helix/graph.js";
import { resource } from "../helix/resource.js";
import { defineRoute } from "../helix/router.js";
import { view } from "../helix/view.js";

test("connectRouteViewResources wires route->view and resource->view edges", () => {
  resetRuntimeGraph();

  const demoRoute = defineRoute("GET", "/demo", () => undefined);
  const demoView = view("demo-view", () => "<div>Demo</div>");
  const demoResource = resource(
    "demo-resource",
    () => ["demo"],
    async () => ({ ok: true }),
    {
      where: "server",
      cache: "memory",
      tags: ["demo"],
    },
  );

  connectRouteViewResources(demoRoute.id, [demoView.id], [demoResource.id]);

  const { edges } = runtimeGraph.toJSON();
  assert.ok(
    edges.some(
      (edge) =>
        edge.type === "renders" &&
        edge.from === demoRoute.id &&
        edge.to === demoView.id,
    ),
  );
  assert.ok(
    edges.some(
      (edge) =>
        edge.type === "dependsOn" &&
        edge.from === demoResource.id &&
        edge.to === demoView.id,
    ),
  );
});
