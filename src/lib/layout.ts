import dagre from "dagre";
import { Position } from "@xyflow/react";
import { MindMapNode, MindMapEdge, LayoutDirection } from "../types";

const nodeWidth = 200;
const nodeHeight = 70;

/**
 * Calculates a clean layout using the dagre library to position nodes
 * deterministically based on their hierarchy.
 */
export const getLayoutedElements = (
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  direction: LayoutDirection = "LR"
): { nodes: MindMapNode[]; edges: MindMapEdge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";

  // ranksep: distance between levels, nodesep: distance between adjacent nodes in a level
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeInfo = dagreGraph.node(node.id);
    if (!nodeInfo) return node;

    return {
      ...node,
      // Hook up direction specific connectors for neat edge routing
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        // Center-align visual displacement coordinates
        x: nodeInfo.x - nodeWidth / 2,
        y: nodeInfo.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
