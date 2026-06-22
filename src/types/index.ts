import { Node, Edge } from "@xyflow/react";

export type LayoutDirection = "LR" | "TB"; // LR: Left-to-Right (Horizontal), TB: Top-to-Bottom (Vertical)

export interface CustomNodeData extends Record<string, any> {
  label: string;
  isRoot?: boolean;
  isCollapsed?: boolean;
  onLabelChange: (id: string, newLabel: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (sourceId: string) => void;
  onDeleteNode: (id: string) => void;
  onAddParent: (id: string) => void;
  onToggleCollapse?: (id: string) => void;
}

export type MindMapNode = Node<CustomNodeData>;
export type MindMapEdge = Edge;
