import { create } from "zustand";
import { Connection, EdgeChange, NodeChange, addEdge, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { MindMapNode, MindMapEdge, LayoutDirection, CustomNodeData } from "../types";
import { getLayoutedElements } from "../lib/layout";

interface MapStore {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  direction: LayoutDirection;
  
  // React Flow handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Custom Actions
  initStore: () => void;
  setElements: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
  addChildNode: (parentId: string) => void;
  addSiblingNode: (sourceId: string) => void;
  addParentNode: (id: string) => void;
  deleteNode: (id: string) => void;
  updateNodeLabel: (id: string, newLabel: string) => void;
  toggleCollapseNode: (id: string) => void;
  triggerAutoLayout: (dir?: LayoutDirection) => void;
  exportMapJson: () => string;
  importMapJson: (jsonString: string) => boolean;
  resetMap: () => void;
  triggerAutoSave: () => void;
}

const STORAGE_KEY = "vision_mindmap_saved_state";

// Helper to find all descendants recursively
const getAllDescendants = (nodeId: string, edges: MindMapEdge[]): string[] => {
  const children = edges.filter((e) => e.source === nodeId).map((e) => e.target);
  let descendants = [...children];
  children.forEach((childId) => {
    descendants = [...descendants, ...getAllDescendants(childId, edges)];
  });
  return descendants;
};

export const useMapStore = create<MapStore>((set, get) => {
  // Utility to generate dynamic handlers to bind to node data
  const getHandlers = () => ({
    onLabelChange: (id: string, newLabel: string) => get().updateNodeLabel(id, newLabel),
    onAddChild: (parentId: string) => get().addChildNode(parentId),
    onAddSibling: (sourceId: string) => get().addSiblingNode(sourceId),
    onDeleteNode: (id: string) => get().deleteNode(id),
    onAddParent: (id: string) => get().addParentNode(id),
    onToggleCollapse: (id: string) => get().toggleCollapseNode(id),
  });

  return {
    nodes: [],
    edges: [],
    direction: "LR",

    onNodesChange: (changes) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes as any) as any,
      });
      get().triggerAutoSave();
    },

    onEdgesChange: (changes) => {
      set({
        edges: applyEdgeChanges(changes, get().edges) as MindMapEdge[],
      });
      get().triggerAutoSave();
    },

    onConnect: (connection) => {
      set({
        edges: addEdge(connection, get().edges) as MindMapEdge[],
      });
      get().triggerAutoSave();
    },

    setElements: (nodes, edges) => {
      // Re-bind callbacks to the incoming nodes array
      const handlers = getHandlers();
      const boundNodes = nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onLabelChange: handlers.onLabelChange,
          onAddChild: handlers.onAddChild,
          onAddSibling: handlers.onAddSibling,
          onDeleteNode: handlers.onDeleteNode,
          onAddParent: handlers.onAddParent,
          onToggleCollapse: handlers.onToggleCollapse,
        },
      }));
      set({ nodes: boundNodes, edges });
      get().triggerAutoSave();
    },

    initStore: () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.nodes && parsed.nodes.length > 0) {
            const dir = parsed.direction || "LR";
            set({ direction: dir });
            get().setElements(parsed.nodes, parsed.edges || []);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not load mindmap from storage:", err);
      }
      
      // Fallback: Default center topic
      get().resetMap();
    },

    addChildNode: (parentId) => {
      const parentNode = get().nodes.find((n) => n.id === parentId);
      if (!parentNode) return;

      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const handlers = getHandlers();

      const isHorizontal = get().direction === "LR";
      // Position adjacent to parent initially, auto-layout will format cleanly anyway
      const offset = 150;
      const newNode: MindMapNode = {
        id: newId,
        type: "mindmap",
        position: {
          x: parentNode.position.x + (isHorizontal ? offset : 0),
          y: parentNode.position.y + (isHorizontal ? 0 : offset),
        },
        data: {
          label: "New Branch",
          onLabelChange: handlers.onLabelChange,
          onAddChild: handlers.onAddChild,
          onAddSibling: handlers.onAddSibling,
          onDeleteNode: handlers.onDeleteNode,
          onAddParent: handlers.onAddParent,
          onToggleCollapse: handlers.onToggleCollapse,
        },
      };

      const newEdge: MindMapEdge = {
        id: `edge_${parentId}_${newId}`,
        source: parentId,
        target: newId,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      };

      set({
        nodes: [...get().nodes, newNode],
        edges: [...get().edges, newEdge],
      });

      // Automatically tidy up layout after addition to prevent overlapping nodes
      get().triggerAutoLayout(get().direction);
    },

    addSiblingNode: (sourceId) => {
      // Sibling nodes are nodes that share the same parent as the source node
      const parentEdge = get().edges.find((e) => e.target === sourceId);
      const handlers = getHandlers();

      if (!parentEdge) {
        // If there is no parent edge, creating a sibling adds a top-level child under root/center
        const rootNode = get().nodes.find((n) => n.data.isRoot);
        if (rootNode) get().addChildNode(rootNode.id);
        return;
      }

      const parentId = parentEdge.source;
      const parentNode = get().nodes.find((n) => n.id === parentId);
      if (!parentNode) return;

      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const isHorizontal = get().direction === "LR";
      const newNode: MindMapNode = {
        id: newId,
        type: "mindmap",
        position: {
          x: parentNode.position.x + (isHorizontal ? 150 : 0),
          y: parentNode.position.y + (isHorizontal ? 0 : 150),
        },
        data: {
          label: "New Sibling",
          onLabelChange: handlers.onLabelChange,
          onAddChild: handlers.onAddChild,
          onAddSibling: handlers.onAddSibling,
          onDeleteNode: handlers.onDeleteNode,
          onAddParent: handlers.onAddParent,
          onToggleCollapse: handlers.onToggleCollapse,
        },
      };

      const newEdge: MindMapEdge = {
        id: `edge_${parentId}_${newId}`,
        source: parentId,
        target: newId,
        animated: true,
        style: { stroke: "#818cf8", strokeWidth: 2 },
      };

      set({
        nodes: [...get().nodes, newNode],
        edges: [...get().edges, newEdge],
      });

      get().triggerAutoLayout(get().direction);
    },

    addParentNode: (id) => {
      const targetNode = get().nodes.find((n) => n.id === id);
      if (!targetNode) return;

      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const handlers = getHandlers();

      const isHorizontal = get().direction === "LR";
      const newNode: MindMapNode = {
        id: newId,
        type: "mindmap",
        position: {
          x: targetNode.position.x - (isHorizontal ? 180 : 0),
          y: targetNode.position.y - (isHorizontal ? 0 : 180),
        },
        data: {
          label: "New Parent",
          onLabelChange: handlers.onLabelChange,
          onAddChild: handlers.onAddChild,
          onAddSibling: handlers.onAddSibling,
          onDeleteNode: handlers.onDeleteNode,
          onAddParent: handlers.onAddParent,
          onToggleCollapse: handlers.onToggleCollapse,
        },
      };

      // Check if targetNode has a parent currently pointing to it, i.e. edge target matches id
      let updatedEdges = [...get().edges];
      const incomingEdges = updatedEdges.filter((e) => e.target === id);

      if (incomingEdges.length > 0) {
        // Splice/reroute previous incoming edges to go through the new intermediate parent
        incomingEdges.forEach((edge) => {
          // Remove old edge: Parent -> TargetNode
          updatedEdges = updatedEdges.filter((e) => e.id !== edge.id);
          // Add edge: Parent -> NewParent
          updatedEdges.push({
            id: `edge_${edge.source}_${newId}`,
            source: edge.source,
            target: newId,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          });
        });
      } else {
        // If it had no parent (previous root-ish), shift root status so layout starts correctly from new parent
        if (targetNode.data.isRoot) {
          newNode.data.isRoot = true;
          // targetNode is no longer root
          get().nodes.forEach((n) => {
            if (n.id === id) {
              n.data.isRoot = false;
            }
          });
        }
      }

      // Add edge: NewParent -> TargetNode
      const parentToChildEdge: MindMapEdge = {
        id: `edge_${newId}_${id}`,
        source: newId,
        target: id,
        animated: true,
        style: { stroke: "#818cf8", strokeWidth: 2 },
      };
      updatedEdges.push(parentToChildEdge);

      set({
        nodes: [...get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, isRoot: false } } : n), newNode],
        edges: updatedEdges,
      });

      get().triggerAutoLayout(get().direction);
    },

    deleteNode: (id) => {
      const nodeToDelete = get().nodes.find((n) => n.id === id);
      if (!nodeToDelete) return;
      if (nodeToDelete.data.isRoot) {
        // We do not delete the root center node; we just clear its text
        get().updateNodeLabel(id, "Central Idea");
        return;
      }

      // Find children and descendants of this node to delete recursively so we have clean graphs
      const descendants = getAllDescendants(id, get().edges);
      const allTargetIds = new Set([id, ...descendants]);

      const filteredNodes = get().nodes.filter((n) => !allTargetIds.has(n.id));
      const filteredEdges = get().edges.filter(
        (e) => !allTargetIds.has(e.source) && !allTargetIds.has(e.target)
      );

      set({
        nodes: filteredNodes,
        edges: filteredEdges,
      });

      get().triggerAutoLayout(get().direction);
    },

    updateNodeLabel: (id, newLabel) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
        ),
      });
      get().triggerAutoSave();
    },

    toggleCollapseNode: (id) => {
      const nodes = get().nodes;
      const targetNode = nodes.find((n) => n.id === id);
      if (!targetNode) return;

      const willCollapse = !targetNode.data.isCollapsed;

      if (willCollapse) {
        // Find descendants
        const descendants = getAllDescendants(id, get().edges);
        const descendantIds = new Set(descendants);

        set({
          nodes: nodes.map((n) => {
            if (n.id === id || descendantIds.has(n.id)) {
              return { ...n, data: { ...n.data, isCollapsed: true } };
            }
            return n;
          }),
        });
      } else {
        // Just expand this node (children remain collapsed)
        set({
          nodes: nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, isCollapsed: false } } : n
          ),
        });
      }
      get().triggerAutoSave();
    },

    triggerAutoLayout: (dir) => {
      const activeDir = dir || get().direction;
      const { nodes: formattedNodes, edges: formattedEdges } = getLayoutedElements(
        get().nodes,
        get().edges,
        activeDir
      );
      set({
        nodes: formattedNodes,
        edges: formattedEdges,
        direction: activeDir,
      });
      get().triggerAutoSave();
    },

    exportMapJson: () => {
      // Export nodes and edges structure clean from react-flow temporary states
      const dataToExport = {
        direction: get().direction,
        nodes: get().nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            label: n.data.label,
            isRoot: n.data.isRoot,
            isCollapsed: n.data.isCollapsed,
          },
        })),
        edges: get().edges,
      };
      return JSON.stringify(dataToExport, null, 2);
    },

    importMapJson: (jsonString) => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.nodes || !Array.isArray(parsed.nodes)) return false;

        const dir = parsed.direction || "LR";
        set({ direction: dir });
        
        // Re-construct matching types
        const loadedNodes: MindMapNode[] = parsed.nodes.map((n: any) => ({
          id: n.id,
          type: "mindmap",
          position: n.position || { x: 0, y: 0 },
          data: {
            label: n.data?.label || "Topic",
            isRoot: !!n.data?.isRoot,
            isCollapsed: !!n.data?.isCollapsed,
          },
        }));

        const loadedEdges: MindMapEdge[] = (parsed.edges || []).map((e: any) => ({
          ...e,
          style: e.style || { stroke: "#6366f1", strokeWidth: 2 },
        }));

        get().setElements(loadedNodes, loadedEdges);
        get().triggerAutoLayout(dir);
        return true;
      } catch (err) {
        console.error("Failed to parse map JSON import:", err);
        return false;
      }
    },

    resetMap: () => {
      const handlers = getHandlers();
      const defaultRoot: MindMapNode = {
        id: "root",
        type: "mindmap",
        position: { x: 0, y: 0 },
        data: {
          label: "Central Idea",
          isRoot: true,
          onLabelChange: handlers.onLabelChange,
          onAddChild: handlers.onAddChild,
          onAddSibling: handlers.onAddSibling,
          onDeleteNode: handlers.onDeleteNode,
          onAddParent: handlers.onAddParent,
          onToggleCollapse: handlers.onToggleCollapse,
        },
      };
      set({
        nodes: [defaultRoot],
        edges: [],
        direction: "LR",
      });
      get().triggerAutoSave();
    },

    // Side effects helper - Auto-save
    triggerAutoSave: () => {
      try {
        const payload = {
          direction: get().direction,
          nodes: get().nodes.map((n) => ({
            id: n.id,
            position: n.position,
            data: { label: n.data.label, isRoot: n.data.isRoot, isCollapsed: n.data.isCollapsed },
          })),
          edges: get().edges,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn("Storage write failed", e);
      }
    },
  };
});
