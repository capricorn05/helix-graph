import { nextNodeId, runtimeGraph } from "./graph.js";
import type { HelixView } from "./types.js";

export function view<Props>(name: string, renderFn: (props: Props) => string): HelixView<Props> {
  const id = nextNodeId("view");
  runtimeGraph.addNode({
    id,
    type: "ViewNode",
    label: name
  });
  return {
    id,
    render: renderFn
  };
}