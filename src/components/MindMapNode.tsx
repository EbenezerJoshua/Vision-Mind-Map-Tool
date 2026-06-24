import React, { memo, useRef, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Trash2, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { CustomNodeData } from "../types";
import { useMapStore } from "../store/useMapStore";

export const MindMapNode = memo(({ id, data, selected, targetPosition, sourcePosition }: NodeProps<any>) => {
  const { 
    label, 
    isRoot, 
    isCollapsed, 
    hasChildren, 
    onLabelChange, 
    onAddChild, 
    onAddSibling, 
    onDeleteNode, 
    onAddParent,
    onToggleCollapse 
  } = data as CustomNodeData & { hasChildren?: boolean };

  const [val, setVal] = useState(label);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const direction = useMapStore((state) => state.direction);
  const isHorizontal = direction === "LR";

  // Sync state if label is modified from outside
  useEffect(() => {
    setVal(label);
  }, [label]);

  const handleBlur = () => {
    setIsEditing(false);
    if (val.trim() !== "") {
      onLabelChange(id, val.trim());
    } else {
      setVal(label); // restore original
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur();
      e.stopPropagation();
    }
  };

  // Auto focus input on edit state
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative min-w-[200px] max-w-[260px] rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all duration-300 backdrop-blur-md flex flex-col justify-center border text-left ${
        isRoot
          ? "p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 shadow-[0_0_25px_rgba(99,102,241,0.12)] dark:shadow-[0_0_35px_rgba(99,102,241,0.25)]"
          : "p-4 bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-white/10 hover:border-indigo-500/50 dark:hover:border-indigo-500/50"
      } ${selected ? "!border-indigo-400 !ring-4 !ring-indigo-500/30 dark:!ring-indigo-500/20 scale-[1.02]" : ""}`}
    >
      {/* Invisible Handles so React Flow draws connecting edges beautifully, with zero edge-connector clutter */}
      <Handle
        type="target"
        position={targetPosition || Position.Left}
        className="!w-0 !h-0 !opacity-0 !border-0 !p-0 !min-w-0 !min-h-0 pointer-events-none"
      />
      <Handle
        type="source"
        position={sourcePosition || Position.Right}
        className="!w-0 !h-0 !opacity-0 !border-0 !p-0 !min-w-0 !min-h-0 pointer-events-none"
      />

      {/* Main Node Content Body */}
      {isRoot ? (
        <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 rounded-[10px] w-full h-full relative font-sans">
          <span className="text-[8px] font-extrabold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400 block mb-1 select-none">
            Center Origin
          </span>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="nodrag nopan w-full bg-transparent text-slate-800 dark:text-white text-base font-bold text-left border-0 focus:border-0 outline-none focus:outline-none ring-0 focus:ring-0 shadow-none p-0 m-0"
              style={{ border: "none" }}
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="text-slate-800 dark:text-white text-base font-bold select-none cursor-default hover:text-indigo-600 dark:hover:text-indigo-200 transition-colors py-1 w-full"
              title="Double click to edit text"
            >
              {val}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full relative font-sans">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="nodrag nopan w-full bg-transparent text-slate-700 dark:text-white text-sm font-semibold text-left border-0 focus:border-0 outline-none focus:outline-none ring-0 focus:ring-0 shadow-none p-0 m-0"
              style={{ border: "none" }}
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="text-slate-705 dark:text-white text-sm font-medium select-none cursor-default hover:text-indigo-600 dark:hover:text-indigo-200 transition-colors py-1 w-full break-words"
              title="Double click to edit text"
            >
              {val}
            </div>
          )}

          {/* Inline Delete branch button appearing inside non-root nodes on hover */}
          {isHovered && (
            <button
              onClick={() => onDeleteNode(id)}
              className="nodrag nopan absolute -top-1.5 -right-1.5 p-1 bg-red-100 dark:bg-red-950/90 border border-red-300 dark:border-red-900/60 hover:bg-red-500 hover:text-white dark:hover:bg-red-900 text-red-700 dark:text-red-100 rounded transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 z-[105]"
              title="Delete Node & Children"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* Collapse/Expand Arrow Button on the edge (shifted out to avoid overlay) */}
      {(hasChildren || isCollapsed) && onToggleCollapse && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(id);
          }}
          className={`absolute nodrag nopan z-[130] w-5 h-5 rounded-full bg-white dark:bg-slate-950 hover:bg-indigo-600 dark:hover:bg-indigo-600 border border-slate-200 dark:border-indigo-500/50 hover:border-indigo-400 text-slate-500 dark:text-white hover:text-white dark:hover:text-white flex items-center justify-center cursor-pointer transition-all duration-150 shadow-md hover:scale-110 active:scale-95 ${
            isHorizontal 
              ? "right-[-26px] top-1/2 -translate-y-1/2" 
              : "bottom-[-26px] left-1/2 -translate-x-1/2"
          }`}
          title={isCollapsed ? "Expand Subnodes" : "Collapse Subnodes"}
        >
          {isCollapsed ? (
            isHorizontal ? <ChevronRight size={12} /> : <ChevronDown size={12} />
          ) : (
            isHorizontal ? <ChevronLeft size={12} /> : <ChevronUp size={12} />
          )}
        </button>
      )}

      {/* IMMERSIVE DIRECTIONAL ADD ROUNDED BUTTONS (Available via opacity transition on hover) */}
      {/* LEFT: ADD PARENT (Horizontal) / ADD SIBLING (Vertical) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isHorizontal) {
            onAddParent(id);
          } else {
            onAddSibling(id);
          }
        }}
        className="absolute nodrag nopan z-[120] left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-950/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600/90 border border-slate-200 dark:border-white/10 hover:border-indigo-400 text-slate-500 dark:text-indigo-200 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)] select-none cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md"
        title={isHorizontal ? "Add Parent Node (Left)" : "Add Sibling Node (Left)"}
      >
        <Plus size={14} />
      </button>

      {/* RIGHT: ADD CHILD (Horizontal) / ADD SIBLING (Vertical) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isHorizontal) {
            onAddChild(id);
          } else {
            onAddSibling(id);
          }
        }}
        className="absolute nodrag nopan z-[120] right-0 translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-950/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600/90 border border-slate-200 dark:border-white/10 hover:border-indigo-400 text-slate-500 dark:text-indigo-200 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)] select-none cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md"
        title={isHorizontal ? "Add Child Node (Right)" : "Add Sibling Node (Right)"}
      >
        <Plus size={14} />
      </button>

      {/* TOP: ADD SIBLING (Horizontal) / ADD PARENT (Vertical) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isHorizontal) {
            onAddSibling(id);
          } else {
            onAddParent(id);
          }
        }}
        className="absolute nodrag nopan z-[120] top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-950/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600/90 border border-slate-200 dark:border-white/10 hover:border-indigo-400 text-slate-500 dark:text-indigo-200 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)] select-none cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md"
        title={isHorizontal ? "Add Sibling Node Above" : "Add Parent Node Above"}
      >
        <Plus size={14} />
      </button>

      {/* BOTTOM: ADD SIBLING (Horizontal) / ADD CHILD (Vertical) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isHorizontal) {
            onAddSibling(id);
          } else {
            onAddChild(id);
          }
        }}
        className="absolute nodrag nopan z-[120] bottom-0 translate-y-1/2 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-950/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600/90 border border-slate-200 dark:border-white/10 hover:border-indigo-400 text-slate-500 dark:text-indigo-200 hover:text-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)] select-none cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md"
        title={isHorizontal ? "Add Sibling Node Below" : "Add Child Node Below"}
      >
        <Plus size={14} />
      </button>
    </div>
  );
});

MindMapNode.displayName = "MindMapNode";
