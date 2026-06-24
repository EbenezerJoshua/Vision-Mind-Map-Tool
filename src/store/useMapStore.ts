import { create } from "zustand";
import { Connection, EdgeChange, NodeChange, addEdge, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { MindMapNode, MindMapEdge, LayoutDirection } from "../types";
import { getLayoutedElements } from "../lib/layout";
import { db, auth } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

interface MapStore {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  direction: LayoutDirection;
  
  // Cloud Sync Fields
  currentMapId: string | null;
  currentMapName: string;
  mapList: { id: string; name: string; updatedAt: any }[];
  isSaving: boolean;
  isLoadingCloud: boolean;
  isDirty: boolean;

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

  // Cloud Actions
  setCurrentMapId: (id: string | null) => void;
  setCurrentMapName: (name: string) => void;
  fetchUserMaps: (userId: string) => Promise<void>;
  selectMap: (userId: string, mapId: string) => Promise<void>;
  saveCurrentMapToCloud: (userId: string) => Promise<void>;
  createNewCloudMap: (userId: string, name?: string) => Promise<string | null>;
  deleteCloudMap: (userId: string, id: string) => Promise<void>;
  renameCloudMap: (userId: string, id: string, name: string) => Promise<void>;
  syncWithCloudAndLocal: (userId: string | null) => Promise<void>;
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

    // Cloud States
    currentMapId: null,
    currentMapName: "Local Map",
    mapList: [],
    isSaving: false,
    isLoadingCloud: false,
    isDirty: false,

    setCurrentMapId: (id) => set({ currentMapId: id }),
    setCurrentMapName: (name) => set({ currentMapName: name }),

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
            get().triggerAutoLayout(dir);
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

      get().triggerAutoLayout(get().direction);
    },

    addSiblingNode: (sourceId) => {
      const parentEdge = get().edges.find((e) => e.target === sourceId);
      const handlers = getHandlers();

      if (!parentEdge) {
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

      // Find the index of the parentEdge (the sibling we clicked)
      const currentEdges = [...get().edges];
      const edgeIndex = currentEdges.findIndex((e) => e.id === parentEdge.id);
      
      // Insert newEdge right after parentEdge
      if (edgeIndex !== -1) {
        currentEdges.splice(edgeIndex + 1, 0, newEdge);
      } else {
        currentEdges.push(newEdge);
      }

      // Find the index of the sourceId node and insert newNode right after it
      const currentNodes = [...get().nodes];
      const nodeIndex = currentNodes.findIndex((n) => n.id === sourceId);
      if (nodeIndex !== -1) {
        currentNodes.splice(nodeIndex + 1, 0, newNode);
      } else {
        currentNodes.push(newNode);
      }

      set({
        nodes: currentNodes,
        edges: currentEdges,
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

      let updatedEdges = [...get().edges];
      const incomingEdges = updatedEdges.filter((e) => e.target === id);

      if (incomingEdges.length > 0) {
        incomingEdges.forEach((edge) => {
          updatedEdges = updatedEdges.filter((e) => e.id !== edge.id);
          updatedEdges.push({
            id: `edge_${edge.source}_${newId}`,
            source: edge.source,
            target: newId,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          });
        });
      } else {
        if (targetNode.data.isRoot) {
          newNode.data.isRoot = true;
          get().nodes.forEach((n) => {
            if (n.id === id) {
              n.data.isRoot = false;
            }
          });
        }
      }

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
        get().updateNodeLabel(id, "Central Idea");
        return;
      }

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
        
        // Set dirty flag to enable Manual Save button in the header
        set({ isDirty: true });
      } catch (e) {
        console.warn("Storage write failed", e);
      }
    },

    // CLOUD MANIFEST ACTIONS
    fetchUserMaps: async (userId) => {
      try {
        const q = query(
          collection(db, "mindmaps"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        const maps = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let updatedAtDate: Date;
          if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
            updatedAtDate = data.updatedAt.toDate();
          } else if (data.updatedAt && data.updatedAt.seconds) {
            updatedAtDate = new Date(data.updatedAt.seconds * 1000);
          } else if (data.updatedAt) {
            updatedAtDate = new Date(data.updatedAt);
          } else {
            updatedAtDate = new Date(0);
          }
          return {
            id: docSnap.id,
            name: data.name || "Untitled Mind Map",
            updatedAt: updatedAtDate,
          };
        });

        // Ensure maps are sorted descending by updatedAt in memory
        maps.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        set({ mapList: maps });
      } catch (e) {
        console.error("Error fetching user maps:", e);
      }
    },

    selectMap: async (userId, mapId) => {
      try {
        set({ isLoadingCloud: true });
        const docRef = doc(db, "mindmaps", mapId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const dir = data.direction || "LR";

          const loadedNodes: any[] = (data.nodes || []).map((n: any) => ({
            id: n.id,
            type: "mindmap",
            position: n.position || { x: 0, y: 0 },
            data: {
              label: n.data?.label || "Topic",
              isRoot: !!n.data?.isRoot,
              isCollapsed: !!n.data?.isCollapsed,
            },
          }));

          const loadedEdges: MindMapEdge[] = (data.edges || []).map((e: any) => ({
            ...e,
            style: e.style || { stroke: "#6366f1", strokeWidth: 2 },
          }));

          set({
            direction: dir,
            currentMapId: mapId,
            currentMapName: data.name || "Untitled Mind Map",
            isDirty: false,
          });
          get().setElements(loadedNodes, loadedEdges);
          get().triggerAutoLayout(dir);
        }
      } catch (e) {
        console.error("Error selecting map:", e);
      } finally {
        set({ isLoadingCloud: false });
      }
    },

    saveCurrentMapToCloud: async (userId) => {
      const { currentMapId, currentMapName, nodes, edges, direction } = get();
      if (!userId || !currentMapId) return;

      try {
        set({ isSaving: true });
        const docRef = doc(db, "mindmaps", currentMapId);
        await setDoc(docRef, {
          id: currentMapId,
          userId: userId,
          name: currentMapName,
          direction: direction,
          nodes: nodes.map((n) => ({
            id: n.id,
            position: n.position,
            data: { label: n.data.label, isRoot: !!n.data.isRoot, isCollapsed: !!n.data.isCollapsed },
          })),
          edges: edges,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const updatedList = get().mapList.map((m) =>
          m.id === currentMapId ? { ...m, name: currentMapName, updatedAt: new Date() } : m
        );
        set({ mapList: updatedList, isDirty: false });
      } catch (e) {
        console.error("Error saving map to cloud:", e);
      } finally {
        set({ isSaving: false });
      }
    },

    createNewCloudMap: async (userId, name = "Untitled Mind Map") => {
      if (!userId) return null;
      try {
        set({ isLoadingCloud: true });
        const newDocRef = doc(collection(db, "mindmaps"));
        const newId = newDocRef.id;

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

        await setDoc(newDocRef, {
          id: newId,
          userId: userId,
          name: name,
          direction: "LR",
          nodes: [{
            id: defaultRoot.id,
            position: defaultRoot.position,
            data: {
              label: defaultRoot.data.label,
              isRoot: defaultRoot.data.isRoot,
              isCollapsed: defaultRoot.data.isCollapsed
            },
          }],
          edges: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        set({
          currentMapId: newId,
          currentMapName: name,
          nodes: [defaultRoot],
          edges: [],
          direction: "LR",
          isDirty: false,
        });

        await get().fetchUserMaps(userId);
        return newId;
      } catch (e) {
        console.error("Error creating new cloud map:", e);
        return null;
      } finally {
        set({ isLoadingCloud: false });
      }
    },

    deleteCloudMap: async (userId, id) => {
      if (!userId) return;
      try {
        await deleteDoc(doc(db, "mindmaps", id));
        
        if (get().currentMapId === id) {
          const remaining = get().mapList.filter((m) => m.id !== id);
          if (remaining.length > 0) {
            await get().selectMap(userId, remaining[0].id);
          } else {
            await get().createNewCloudMap(userId);
          }
        } else {
          await get().fetchUserMaps(userId);
        }
      } catch (e) {
        console.error("Error deleting cloud map:", e);
      }
    },

    renameCloudMap: async (userId, id, name) => {
      if (!userId) return;
      try {
        const docRef = doc(db, "mindmaps", id);
        await updateDoc(docRef, {
          name: name,
          updatedAt: serverTimestamp(),
        });

        if (get().currentMapId === id) {
          set({ currentMapName: name });
        }

        await get().fetchUserMaps(userId);
      } catch (e) {
        console.error("Error renaming cloud map:", e);
      }
    },

    syncWithCloudAndLocal: async (userId) => {
      if (!userId) {
        set({ currentMapId: null, currentMapName: "Local Map", mapList: [] });
        get().initStore();
        return;
      }

      try {
        set({ isLoadingCloud: true });
        const q = query(
          collection(db, "mindmaps"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        const maps = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let updatedAtDate: Date;
          if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
            updatedAtDate = data.updatedAt.toDate();
          } else if (data.updatedAt && data.updatedAt.seconds) {
            updatedAtDate = new Date(data.updatedAt.seconds * 1000);
          } else if (data.updatedAt) {
            updatedAtDate = new Date(data.updatedAt);
          } else {
            updatedAtDate = new Date(0);
          }
          return {
            id: docSnap.id,
            name: data.name || "Untitled Mind Map",
            updatedAt: updatedAtDate,
          };
        });

        // Ensure maps are sorted descending by updatedAt in memory
        maps.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        set({ mapList: maps });

        if (maps.length > 0) {
          await get().selectMap(userId, maps[0].id);
        } else {
          // Sync existing work from localStorage first so they don't lose it on login
          const saved = localStorage.getItem(STORAGE_KEY);
          let name = "My Mind Map";
          let localNodes: MindMapNode[] = [];
          let localEdges: MindMapEdge[] = [];
          let localDir: LayoutDirection = "LR";

          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.nodes && parsed.nodes.length > 0) {
                localNodes = parsed.nodes;
                localEdges = parsed.edges || [];
                localDir = parsed.direction || "LR";
              }
            } catch (e) {
              console.warn("Parse local state in sync failed:", e);
            }
          }

          const newDocRef = doc(collection(db, "mindmaps"));
          const newId = newDocRef.id;

          const uploadNodes = localNodes.length > 0 ? localNodes : [{
            id: "root",
            position: { x: 0, y: 0 },
            data: { label: "Central Idea", isRoot: true }
          }];

          await setDoc(newDocRef, {
            id: newId,
            userId: userId,
            name: name,
            direction: localDir,
            nodes: uploadNodes.map((n: any) => ({
              id: n.id,
              position: n.position,
              data: { label: n.data.label, isRoot: !!n.data.isRoot, isCollapsed: !!n.data.isCollapsed },
            })),
            edges: localEdges,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          set({
            currentMapId: newId,
            currentMapName: name,
            direction: localDir,
            isDirty: false,
          });

          const handlers = getHandlers();
          const loadedNodes: any[] = uploadNodes.map((n: any) => ({
            id: n.id,
            type: "mindmap",
            position: n.position || { x: 0, y: 0 },
            data: {
              label: n.data?.label || "Topic",
              isRoot: !!n.data?.isRoot,
              isCollapsed: !!n.data?.isCollapsed,
            },
          }));

          const loadedEdges: MindMapEdge[] = localEdges.map((e: any) => ({
            ...e,
            style: e.style || { stroke: "#6366f1", strokeWidth: 2 },
          }));

          get().setElements(loadedNodes, loadedEdges);
          get().triggerAutoLayout(localDir);
          await get().fetchUserMaps(userId);
        }
      } catch (e) {
        console.error("Error synchronizing maps with Firebase:", e);
      } finally {
        set({ isLoadingCloud: false });
      }
    },
  };
});
