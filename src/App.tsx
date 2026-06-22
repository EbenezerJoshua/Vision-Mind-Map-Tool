import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useMapStore } from "./store/useMapStore";
import { MindMapNode } from "./components/MindMapNode";
import { AIUpload } from "./components/AIUpload";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  LayoutTemplate,
  Download,
  Upload,
  Sparkles,
  Trash2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  RotateCcw,
  Layers,
  Map,
  ChartNoAxesGantt,
} from "lucide-react";

export default function App() {
  const {
    nodes,
    edges,
    direction,
    onNodesChange,
    onEdgesChange,
    onConnect,
    initStore,
    triggerAutoLayout,
    exportMapJson,
    importMapJson,
    resetMap,
  } = useMapStore();

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard controls keydown & keyup tracking for control-based scrolling zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setCtrlPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Initialize store and fetch local storage mind map on load
  useEffect(() => {
    initStore();
  }, [initStore]);

  const nodeTypes = useMemo(() => ({ mindmap: MindMapNode }), []);

  // Compute display nodes & edges with collapse and layout logic
  const { displayNodes, displayEdges } = useMemo(() => {
    // 1. Find all node IDs that are explicitly marked as collapsed
    const collapsedNodeIds = new Set(
      nodes.filter((n) => n.data.isCollapsed).map((n) => n.id)
    );

    // 2. Map of node ID to list of child IDs derived from edges
    const nodesWithChildren = new Set(edges.map((e) => e.source));

    // 3. Recursive helper to see if any ancestor of a node is collapsed
    const isAncestorCollapsed = (nodeId: string): boolean => {
      let currentId = nodeId;
      while (true) {
        const parentEdge = edges.find((e) => e.target === currentId);
        if (!parentEdge) break;
        const parentId = parentEdge.source;
        if (collapsedNodeIds.has(parentId)) return true;
        currentId = parentId;
      }
      return false;
    };

    // 4. Construct processed nodes list
    const processedNodes = nodes.map((n) => {
      const hasChildren = nodesWithChildren.has(n.id);
      const shouldHide = isAncestorCollapsed(n.id);
      return {
        ...n,
        hidden: shouldHide,
        data: {
          ...n.data,
          hasChildren,
        },
      };
    });

    // 5. Construct processed edges list
    const processedEdges = edges.map((e) => {
      const sourceNode = processedNodes.find((n) => n.id === e.source);
      const targetNode = processedNodes.find((n) => n.id === e.target);
      const isSourceCollapsed = collapsedNodeIds.has(e.source);

      const shouldHide =
        (sourceNode && sourceNode.hidden) ||
        (targetNode && targetNode.hidden) ||
        isSourceCollapsed;

      return {
        ...e,
        hidden: !!shouldHide,
      };
    });

    return { displayNodes: processedNodes, displayEdges: processedEdges };
  }, [nodes, edges]);

  const captureCanvas = async (): Promise<string | null> => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return null;

    try {
      const dataUrl = await toPng(el, {
        backgroundColor: "#070b19",
        filter: (node: any) => {
          if (node.classList) {
            if (
              node.classList.contains("react-flow__controls") ||
              node.classList.contains("react-flow__minimap") ||
              node.tagName === "ASIDE" ||
              node.classList.contains("ai-modal")
            ) {
              return false;
            }
          }
          return true;
        },
        quality: 0.95,
        pixelRatio: 2,
      });
      return dataUrl;
    } catch (error) {
      console.error("Canvas capture failed:", error);
      return null;
    }
  };

  const handleExportJson = () => {
    try {
      const jsonStr = exportMapJson();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mindmap-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export JSON mind map.");
    }
  };

  const handleExportImage = async () => {
    try {
      const dataUrl = await captureCanvas();
      if (!dataUrl) {
        alert("Failed to capture node canvas image.");
        return;
      }
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `mindmap-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Failed to export PNG mind map image.");
    }
  };

  const handleExportPDF = async () => {
    try {
      const dataUrl = await captureCanvas();
      if (!dataUrl) {
        alert("Failed to capture mind map layout for PDF.");
        return;
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = img.width || 800;
        const imgHeight = img.height || 600;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

        const width = imgWidth * ratio;
        const height = imgHeight * ratio;

        const x = (pdfWidth - width) / 2;
        const y = (pdfHeight - height) / 2;

        pdf.setFillColor(7, 11, 25);
        pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

        pdf.addImage(dataUrl, "PNG", x, y, width, height);
        pdf.save(`mindmap-${Date.now()}.pdf`);
      };
    } catch (e) {
      alert("Failed to export PDF file.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const txt = event.target?.result as string;
      if (txt) {
        const ok = importMapJson(txt);
        if (ok) {
          e.target.value = ""; // reset file input
        } else {
          alert("Invalid mind map JSON file.");
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full h-screen bg-[#070b19] text-white flex flex-row font-sans select-none overflow-hidden antialiased relative">
      
      {/* Background Atmosphere Glows (Behind all layout controls) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-950/20 rounded-full blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] bg-cyan-950/15 rounded-full blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      </div>

      {/* LEFT SIDEBAR STUCK NAVIGATION BAR */}
      <aside
        className={`bg-slate-950/70 border-r border-white/5 backdrop-blur-xl h-full flex flex-col justify-between z-30 transition-all duration-300 relative shadow-2xl relative ${
          sidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        <div className="flex flex-col gap-6 p-5 overflow-y-auto overflow-x-hidden flex-grow scrollbar-none">
          
          {/* Brand/Logo block */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] flex-shrink-0">
              <ChartNoAxesGantt className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="transition-all duration-300 opacity-100 whitespace-nowrap">
                <h1 className="text-base font-bold tracking-tight text-white/95 flex items-center gap-2 leading-none">
                  VisionMap
                  <span className="text-[9px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/20">
                    Pro
                  </span>
                </h1>
              </div>
            )}
          </div>

          {/* Primary Action Button - "Create New Mind Map" (Increased padding & prominent styling) */}
          <button
            onClick={resetMap}
            className={`w-full group bg-gradient-to-tr from-indigo-500/25 to-indigo-600/15 border border-indigo-500/40 hover:border-indigo-400 hover:bg-slate-900/60 transition-all rounded-xl font-extrabold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              sidebarCollapsed ? "h-14" : "px-6 py-4.5 text-left justify-start"
            }`}
            title="Create New Mind Map (Reset Canvas)"
          >
            <Plus size={18} className="text-indigo-400 group-hover:scale-115 transition-transform" />
            {!sidebarCollapsed && <span className="truncate">Create New Mind Map</span>}
          </button>

          {/* Secondary Action - AI Transform Trigger Button */}
          <button
            onClick={() => setAiModalOpen(true)}
            className={`w-full bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer animate-shimmer ${
              sidebarCollapsed ? "h-11" : "px-4 py-3"
            }`}
            title="Convert Image with AI"
          >
            <Sparkles size={16} className="animate-pulse text-indigo-100 flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Convert Image with AI</span>}
          </button>

          {/* Spacer Section Line */}
          <div className="w-full h-px bg-white/5 my-1" />

          {/* Layout formatting section */}
          <div className="flex flex-col gap-2">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 mb-1">
                Visual Format
              </span>
            )}
            
            {/* Horizontal Toggling Layout */}
            <button
              onClick={() => triggerAutoLayout("LR")}
              className={`w-full flex items-center hover:bg-white/5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                direction === "LR"
                  ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300"
                  : "text-slate-300 hover:text-white border border-transparent"
              } ${sidebarCollapsed ? "h-11 justify-center" : "px-3.5 py-2.5 justify-start gap-3"}`}
              title="Layout Horizontal"
            >
              <LayoutTemplate size={16} className="text-slate-400 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Horizontal</span>}
            </button>

            {/* Vertical Toggling Layout */}
            <button
              onClick={() => triggerAutoLayout("TB")}
              className={`w-full flex items-center hover:bg-white/5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                direction === "TB"
                  ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300"
                  : "text-slate-300 hover:text-white border border-transparent"
              } ${sidebarCollapsed ? "h-11 justify-center" : "px-3.5 py-2.5 justify-start gap-3"}`}
              title="Layout Vertical"
            >
              <div className="rotate-90 flex-shrink-0">
                <LayoutTemplate size={16} className="text-slate-400" />
              </div>
              {!sidebarCollapsed && <span className="truncate">Vertical</span>}
            </button>

            {/* Clean Chaos instant format settle */}
            <button
              onClick={() => triggerAutoLayout(direction)}
              className={`w-full flex items-center hover:bg-white/5 rounded-xl transition-all font-semibold text-sm border border-transparent text-slate-300 hover:text-white cursor-pointer ${
                sidebarCollapsed ? "h-11 justify-center" : "px-3.5 py-2.5 justify-start gap-3"
              }`}
              title="Tidy canvas layout and spacing"
            >
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Clean Chaos</span>}
            </button>
          </div>

          {/* Backup & Files Section */}
          <div className="flex flex-col gap-2 mt-2">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 mb-1">
                Data Operations
              </span>
            )}

            {/* Export Multi-Format Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className={`w-full flex items-center hover:bg-white/5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                  exportMenuOpen
                    ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-300"
                    : "text-slate-300 hover:text-white border border-transparent"
                } ${sidebarCollapsed ? "h-11 justify-center" : "px-3.5 py-2.5 justify-start gap-3"}`}
                title="Export Mind Map Options (PDF, Image, JSON)"
              >
                <Download size={16} className="text-slate-400 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate flex-1 text-left">Export Map</span>}
                {!sidebarCollapsed && (
                  <ChevronRight
                    size={14}
                    className={`text-indigo-400 transition-transform ${exportMenuOpen ? "rotate-90" : ""}`}
                  />
                )}
              </button>

              {exportMenuOpen && (
                <div
                  className={`mt-1.5 p-1 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl flex flex-col gap-1 z-50 ${
                    sidebarCollapsed ? "absolute left-22 top-0 w-44" : "w-full"
                  }`}
                >
                  <button
                    onClick={() => {
                      handleExportPDF();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    PDF Document (.pdf)
                  </button>
                  <button
                    onClick={() => {
                      handleExportImage();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    PNG Image (.png)
                  </button>
                  <button
                    onClick={() => {
                      handleExportJson();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    JSON Backup (.json)
                  </button>
                </div>
              )}
            </div>

            {/* Import mapping JSON */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileChange}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              className={`w-full flex items-center hover:bg-white/5 rounded-xl transition-all font-semibold text-sm text-slate-300 hover:text-white cursor-pointer ${
                sidebarCollapsed ? "h-11 justify-center" : "px-3.5 py-2.5 justify-start gap-3"
              }`}
              title="Import Map JSON File"
            >
              <Upload size={16} className="text-slate-400 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Import Map</span>}
            </button>
          </div>

        </div>

        {/* BOTTOM SIDEBAR BAR FOOTER CONTROLS */}
        <div className="p-4 border-t border-white/5 bg-slate-950/40 flex flex-col gap-3.5">
          {/* Quick shortcuts / Help indicator */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`w-full flex items-center hover:bg-white/5 rounded-xl font-semibold text-xs text-slate-400 hover:text-white transition-all cursor-pointer ${
              sidebarCollapsed ? "h-10 justify-center" : "px-3 py-2 justify-start gap-3"
            }`}
            title="Keyboard Shortcuts & Guidance"
          >
            <HelpCircle size={16} className="text-slate-400 flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">How to Use</span>}
          </button>

          {/* Reset Workspace Area completely */}
          <button
            onClick={resetMap}
            className={`w-full flex items-center hover:bg-red-950/20 rounded-xl font-semibold text-xs text-slate-400 hover:text-red-400 transition-all cursor-pointer ${
              sidebarCollapsed ? "h-10 justify-center" : "px-3 py-2 justify-start gap-3"
            }`}
            title="Reset Canvas Map"
          >
            <Trash2 size={16} className="text-slate-400 flex-shrink-0 hover:text-red-400" />
            {!sidebarCollapsed && <span className="truncate">Clear Map</span>}
          </button>

          {/* Sidebar Expand / Collapse arrow layout */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2.5 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer shadow-inner mt-1"
            title={sidebarCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Canvas Node Section */}
      <main className="flex-1 h-full relative z-10">
        
        {/* Help Panel overlay modal */}
        {showHelp && (
          <div className="absolute top-6 right-6 z-40 bg-slate-900/95 border border-white/10 p-5 rounded-2xl shadow-2xl w-80 backdrop-blur-md">
            <h3 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2">
              <HelpCircle size={16} /> Canvas Controls & shortcuts
            </h3>
            <ul className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-slate-400 font-mono flex-shrink-0 select-none">
                  Double Click
                </span>
                <span>Double click any node's text to rename it. Press <span className="text-indigo-400">Enter</span> to apply.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 font-bold select-none">
                  +
                </span>
                <span>Hover over a node to access directional buttons and add Parents, Siblings or Children.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 font-mono select-none">
                  Mouse Wheel
                </span>
                <span>Scroll wheel vertically to zoom the mind map canvas in and out dynamically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 font-mono select-none">
                  Drag Background
                </span>
                <span>Hold and drag the empty background with the mouse left-click button to pan around the map.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#128465;</span>
                <span>Hover and click the tiny red trash button on any non-root node to delete.</span>
              </li>
            </ul>
          </div>
        )}

        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          zoomOnScroll={true}
          panOnScroll={false}
          panOnDrag={true}
        >
          {/* Dots grid layout with dark style background */}
          <Background color="#334155" opacity={0.3} gap={24} size={1} />
          
          {/* Default React Flow controls panel positioned nicely */}
          <Controls className="!bg-slate-900/80 !border-white/10 !text-white !fill-white rounded-xl shadow-2xl scale-95 origin-bottom-left" />
          
          <MiniMap
            className="!bg-slate-900/80 !border-white/10 rounded-xl shadow-2xl scale-90 origin-bottom-right hidden sm:block"
            nodeColor="#1e293b"
            maskColor="rgba(7, 11, 19, 0.7)"
            zoomable
            pannable
          />
        </ReactFlow>
      </main>

      {/* Vision Upload Modal overlay */}
      {aiModalOpen && <AIUpload onClose={() => setAiModalOpen(false)} />}
    </div>
  );
}
