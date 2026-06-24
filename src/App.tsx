import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMapStore } from "./store/useMapStore";
import { useAuthStore } from "./store/useAuthStore";
import { MindMapNode } from "./components/MindMapNode";
import { AIUpload } from "./components/AIUpload";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  LayoutTemplate,
  Download,
  Upload,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Trash2,
  Plus,
  Sparkles,
  Map,
  Trash,
  LogOut,
  User,
  Loader2,
  ChartNoAxesGantt,
  Menu,
  Settings,
  Sun,
  Moon,
  Save,
} from "lucide-react";

export default function App() {
  const { user, signIn, logout, loading: authLoading } = useAuthStore();
  const {
    nodes,
    edges,
    direction,
    onNodesChange,
    onEdgesChange,
    onConnect,
    triggerAutoLayout,
    exportMapJson,
    importMapJson,
    resetMap,

    // Cloud States & Actions
    currentMapId,
    currentMapName,
    mapList,
    isSaving,
    isLoadingCloud,
    isDirty,
    createNewCloudMap,
    deleteCloudMap,
    renameCloudMap,
    selectMap,
    syncWithCloudAndLocal,
    saveCurrentMapToCloud
  } = useMapStore();

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Theme state: default false (light mode by default!)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("darkMode") === "true";
  });
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentMapName || "");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync tempName when currentMapName updates
  useEffect(() => {
    setTempName(currentMapName || "");
  }, [currentMapName]);

  // Handle document class injection for Tailwind dark selectors
  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize dynamic firebase sessions on load
  useEffect(() => {
    if (!authLoading) {
      syncWithCloudAndLocal(user ? user.uid : null);
    }
  }, [user, authLoading, syncWithCloudAndLocal]);

  // Node registration bindings
  const nodeTypes = useMemo(() => ({ mindmap: MindMapNode }), []);

  // Filter collapses and compute visible elements
  const { displayNodes, displayEdges } = useMemo(() => {
    const collapsedNodeIds = new Set(
      nodes.filter((n) => n.data.isCollapsed).map((n) => n.id)
    );

    const nodesWithChildren = new Set(edges.map((e) => e.source));

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

  // Export handlers
  const captureCanvas = async (): Promise<string | null> => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return null;

    try {
      const dataUrl = await toPng(el, {
        backgroundColor: darkMode ? "#090d1a" : "#fafafb",
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

        if (darkMode) {
          pdf.setFillColor(9, 13, 26);
        } else {
          pdf.setFillColor(250, 250, 251);
        }
        pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

        pdf.addImage(dataUrl, "PNG", x, y, width, height);
        pdf.save(`mindmap-${Date.now()}.pdf`);
      };
    } catch (e) {
      alert("Failed to export PDF file.");
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = importMapJson(content);
        if (ok) {
          e.target.value = ""; // reset
        } else {
          alert("Invalid mind map JSON file.");
        }
      }
    };
    reader.readAsText(file);
  };

  // Full Page loading state to shield session state
  if (authLoading) {
    return (
      <div className="w-full h-screen bg-slate-50 dark:bg-[#070b19] flex flex-col items-center justify-center gap-4 text-slate-800 dark:text-white font-sans">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400 animate-pulse">
          Starting VisionMap Pro session...
        </span>
      </div>
    );
  }

  // Pure login overlay screen guarding auth constraints
  if (!user) {
    return (
      <div className="w-full h-screen bg-[#070b19] text-white flex flex-col items-center justify-center font-sans select-none overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-indigo-950/20 rounded-full blur-[130px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[500px] h-[500px] bg-cyan-950/15 rounded-full blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        </div>

        <div className="w-[450px] max-w-[90%] p-8 bg-slate-950/60 border border-white/5 backdrop-blur-xl rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)] z-10 text-center flex flex-col gap-6 relative">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)]">
              <ChartNoAxesGantt className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              VisionMap <span className="text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/25">Pro</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 px-4 leading-relaxed">
              Collaborative Infinite Mind Maps synchronized with safe cloud backup & vision intelligence modeling.
            </p>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Clean glassmorphic sign in button */}
          <button
            onClick={signIn}
            className="w-full py-4 px-6 bg-[#4285F4] hover:bg-[#357ae8] text-white font-extrabold rounded-xl transition-all shadow-[0_4px_24px_rgba(66,133,244,0.3)] flex items-center justify-center gap-3 cursor-pointer text-base hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-3.3-4.53-6.16-4.53z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">
            Authorized NoSQL cloud workspace
          </div>
        </div>
      </div>
    );
  }

  // Dashboard render once profile identity is active
  return (
    <div className={`w-full h-screen flex flex-row font-sans select-none overflow-hidden antialiased relative transition-colors duration-150 ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-[#f8f9fa] text-slate-800"}`}>
      
      {/* Background Atmosphere Glows (Behind all layout controls) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {darkMode ? (
          <>
            <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-950/25 rounded-full blur-[130px]" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] bg-cyan-950/20 rounded-full blur-[110px]" />
          </>
        ) : (
          <>
            <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-[130px]" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] bg-cyan-100/25 rounded-full blur-[110px]" />
          </>
        )}
      </div>

      {/* LEFT SIDEBAR NAVIGATION BAR */}
      <aside
        className={`backdrop-blur-xl h-full flex flex-col justify-between z-30 transition-all duration-300 relative shadow-md ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${
          darkMode 
            ? "bg-slate-950/80 border-r border-white/5" 
            : "bg-white/95 border-r border-slate-200"
        }`}
      >
        <div className="flex flex-col gap-4 p-4 overflow-y-auto overflow-x-hidden flex-grow scrollbar-none">
          
          {/* Brand/Logo block */}
          <div className={`flex items-center gap-2.5 pb-3 border-b ${darkMode ? "border-white/5" : "border-slate-100"}`}>
            <div className="w-8.5 h-8.5 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <ChartNoAxesGantt className="w-4.5 h-4.5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="transition-all duration-300 opacity-100 whitespace-nowrap">
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                  VisionMap
                  <span className="text-[8px] font-extrabold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/20">
                    Pro
                  </span>
                </h1>
              </div>
            )}
          </div>

          {/* Create New Mind Map Button */}
          <button
            onClick={() => createNewCloudMap(user.uid, "Untitled Mind Map")}
            className={`w-full group transition-all rounded-lg font-bold text-xs tracking-wide shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
              darkMode
                ? "bg-gradient-to-tr from-indigo-500/20 to-indigo-600/10 border border-indigo-500/35 hover:border-indigo-400 hover:bg-slate-900/60 text-indigo-300"
                : "bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700"
            } ${sidebarCollapsed ? "h-10" : "px-3 py-2.5 text-left justify-start"}`}
            title="Create New Mind Map"
          >
            <Plus size={15} className="text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Create New Map</span>}
          </button>

          {/* AI Convert Trigger Button */}
          <button
            onClick={() => setAiModalOpen(true)}
            className={`w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs transition-all shadow rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
              sidebarCollapsed ? "h-10" : "px-3 py-2.5 text-left justify-start"
            }`}
            title="Convert Image with AI"
          >
            <Sparkles size={14} className="text-indigo-100 animate-pulse flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Convert Image with AI</span>}
          </button>

          {/* "My Mindmaps" section list */}
          {!sidebarCollapsed && (
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 select-none text-left">
                My Mindmaps ({mapList.length})
              </span>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {isLoadingCloud && mapList.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-500 text-[11px] p-1.5 flex items-center gap-2 font-medium">
                    <Loader2 size={11} className="animate-spin text-indigo-500" />
                    Loading maps...
                  </div>
                ) : mapList.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-550 text-[11px] p-2 leading-relaxed italic text-left">
                    No stored maps yet.
                  </div>
                ) : (
                  mapList.map((map) => {
                    const isSelected = map.id === currentMapId;
                    return (
                      <div
                        key={map.id}
                        className={`group flex items-center justify-between p-2 rounded-lg transition-all border text-xs cursor-pointer ${
                          isSelected
                            ? "bg-indigo-500/10 dark:bg-indigo-600/15 border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold"
                            : "bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                        onClick={() => selectMap(user.uid, map.id)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Map size={12} className={isSelected ? "text-indigo-500" : "text-slate-400 dark:text-slate-500"} />
                          <span className="truncate max-w-[120px]">{map.name}</span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = prompt("Rename Mind Map:", map.name);
                              if (newName) renameCloudMap(user.uid, map.id, newName);
                            }}
                            className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            title="Rename map"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Do you want to delete "${map.name}" permanently from Firestore?`)) {
                                deleteCloudMap(user.uid, map.id);
                              }
                            }}
                            className="p-0.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                            title="Delete map"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className={`w-full h-px ${darkMode ? "bg-white/5" : "bg-slate-100"} my-0.5`} />

          {/* Layout Formatting Section */}
          <div className="flex flex-col gap-1.5">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 select-none text-left">
                Layout Direction
              </span>
            )}
            
            {/* Horizontal Toggling Layout */}
            <button
              onClick={() => triggerAutoLayout("LR")}
              className={`w-full flex items-center rounded-lg transition-all font-semibold text-xs cursor-pointer ${
                direction === "LR"
                  ? "bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
              } ${sidebarCollapsed ? "h-9 justify-center" : "px-3 py-2 justify-start gap-2.5"}`}
              title="Layout Horizontal"
            >
              <LayoutTemplate size={14} className="text-slate-400 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Horizontal Layout</span>}
            </button>

            {/* Vertical Toggling Layout */}
            <button
              onClick={() => triggerAutoLayout("TB")}
              className={`w-full flex items-center rounded-lg transition-all font-semibold text-xs cursor-pointer ${
                direction === "TB"
                  ? "bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
              } ${sidebarCollapsed ? "h-9 justify-center" : "px-3 py-2 justify-start gap-2.5"}`}
              title="Layout Vertical"
            >
              <div className="rotate-90 flex-shrink-0">
                <LayoutTemplate size={14} className="text-slate-400" />
              </div>
              {!sidebarCollapsed && <span className="truncate">Vertical Layout</span>}
            </button>

            {/* Clean Chaos Layout */}
            <button
              onClick={() => triggerAutoLayout(direction)}
              className={`w-full flex items-center hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all font-semibold text-xs border border-transparent text-slate-600 dark:text-slate-300 cursor-pointer ${
                sidebarCollapsed ? "h-9 justify-center" : "px-3 py-2 justify-start gap-2.5"
              }`}
              title="Tidy canvas layout and spacing"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Clean Chaos</span>}
            </button>
          </div>

          {/* Backup & Files Section */}
          <div className="flex flex-col gap-1.5">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 select-none text-left">
                Data Operations
              </span>
            )}

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className={`w-full flex items-center rounded-lg transition-all font-semibold text-xs cursor-pointer ${
                  exportMenuOpen
                    ? "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
                } ${sidebarCollapsed ? "h-9 justify-center" : "px-3 py-2 justify-start gap-2.5"}`}
                title="Export Mind Map"
              >
                <Download size={14} className="text-slate-400 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate flex-1 text-left">Export Map</span>}
                {!sidebarCollapsed && (
                  <ChevronRight
                    size={12}
                    className={`text-slate-400 transition-transform ${exportMenuOpen ? "rotate-90" : ""}`}
                  />
                )}
              </button>

              {exportMenuOpen && (
                <div
                  className={`mt-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg flex flex-col gap-0.5 z-50 overflow-hidden ${
                    sidebarCollapsed ? "absolute left-14 top-0 w-44" : "w-full"
                  }`}
                >
                  <button
                    onClick={() => {
                      handleExportPDF();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-indigo-600/20 hover:text-slate-900 dark:hover:text-white rounded transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    PDF Document (.pdf)
                  </button>
                  <button
                    onClick={() => {
                      handleExportImage();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-indigo-600/20 hover:text-slate-900 dark:hover:text-white rounded transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    PNG Image (.png)
                  </button>
                  <button
                    onClick={() => {
                      handleExportJson();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-indigo-600/20 hover:text-slate-900 dark:hover:text-white rounded transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
              className={`w-full flex items-center hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all font-semibold text-xs text-slate-600 dark:text-slate-300 cursor-pointer ${
                sidebarCollapsed ? "h-9 justify-center" : "px-3 py-2 justify-start gap-2.5"
              }`}
              title="Import Map JSON File"
            >
              <Upload size={14} className="text-slate-400 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Import Map</span>}
            </button>
          </div>

          {/* Preferences / Theme segment */}
          {!sidebarCollapsed && (
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 select-none text-left">
                Preferences
              </span>
              <div className={`flex items-center justify-between p-2 rounded-lg border text-xs bg-slate-50 dark:bg-slate-900/40 ${darkMode ? "border-white/5" : "border-slate-100"}`}>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  {darkMode ? <Moon size={13} className="text-indigo-400" /> : <Sun size={13} className="text-amber-500" />}
                  <span>Dark Theme</span>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    darkMode ? "bg-indigo-600" : "bg-slate-300"
                  }`}
                  title="Toggle Display Theme Mode"
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadowring-0 transition duration-200 ease-in-out ${
                      darkMode ? "translate-x-3.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM SIDEBAR FOOTER & USER PROFILE */}
        <div className={`p-3 border-t flex flex-col gap-2.5 bg-slate-50/50 dark:bg-slate-950/40 ${darkMode ? "border-white/5" : "border-slate-150"}`}>
          {/* USER PROFILE SECTION AT THE BOTTOM */}
          <div className={`flex items-center justify-between ${sidebarCollapsed ? "justify-center" : ""} ${darkMode ? "border-white/5" : "border-slate-150"}`}>
            <div className="flex items-center gap-2 truncate">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile Avatar"
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 object-cover flex-shrink-0 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="flex flex-col text-left truncate max-w-[120px]">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">
                    {user.displayName || "Google User"}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight truncate">
                    {user.email}
                  </span>
                </div>
              )}
            </div>
            
            {!sidebarCollapsed && (
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-150 dark:hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT WORKSPACE CORE AREA */}
      <main className="flex-1 h-full flex flex-col relative z-10 overflow-hidden">
        
        {/* STICKY TOP HEADER/NAVBAR */}
        <header className={`sticky top-0 z-40 w-full h-14 border-b flex items-center justify-between px-5 transition-colors duration-150 ${
          darkMode 
            ? "bg-slate-950/80 border-white/5 text-white backdrop-blur-md" 
            : "bg-white/80 border-slate-200 text-slate-800 backdrop-blur-md"
        }`}>
          {/* Left: Collapsing indicator divider with Inline rename title breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            
            <div className={`h-4 w-px ${darkMode ? "bg-white/10" : "bg-slate-200"}`} />
            
            <div className="flex items-center group/headerBrand text-xs font-medium">
              {editingName ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tempName.trim()) {
                      renameCloudMap(user.uid, currentMapId!, tempName.trim());
                    }
                    setEditingName(false);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => {
                      if (tempName.trim() && tempName.trim() !== currentMapName) {
                        renameCloudMap(user.uid, currentMapId!, tempName.trim());
                      }
                      setEditingName(false);
                    }}
                    autoFocus
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded text-xs text-slate-900 dark:text-white font-extrabold outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </form>
              ) : (
                <div 
                  className="flex items-center gap-1.5 cursor-pointer"
                  onClick={() => setEditingName(true)}
                  title="Click to Rename Mindmap"
                >
                  <span className="font-extrabold text-sm text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    {currentMapName}
                  </span>
                  <svg className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover/headerBrand:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Right: Cloud save button & indicators */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 dark:text-slate-500 select-none hidden sm:inline-block">
              {isSaving ? "Saving changes..." : isDirty ? "Unsaved changes exist" : "All changes saved"}
            </span>

            {/* Save to Cloud active button */}
            <button
              onClick={async () => {
                if (user) {
                  setSaveFeedback("Saving...");
                  await saveCurrentMapToCloud(user.uid);
                  setSaveFeedback("Saved!");
                  setTimeout(() => setSaveFeedback(null), 2000);
                }
              }}
              disabled={!isDirty || isSaving}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                !isDirty
                  ? "bg-slate-200 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-300/30 dark:border-white/5 shadow-none"
                  : darkMode
                    ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-950/20"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-600/10"
              }`}
            >
              {isSaving || saveFeedback === "Saving..." ? (
                <>
                  <Loader2 size={13} className="animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : saveFeedback === "Saved!" ? (
                <>
                  <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-emerald-300">Saved</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save to Cloud</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* CONTROLLER & FLOW AREA */}
        <div className="flex-1 w-full relative z-10 bg-transparent">
          
          {/* Floating Shortcuts Guide Button on top right of Canvas */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`absolute top-4 right-4 z-40 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 shadow-md border hover:scale-110 active:scale-95 cursor-pointer ${
              darkMode
                ? "bg-slate-900/90 border-white/10 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800"
                : "bg-white/95 border-slate-200 text-indigo-650 hover:text-indigo-500 hover:bg-slate-50"
            }`}
            title="Keyboard Shortcuts & Guidance"
          >
            <HelpCircle size={18} />
          </button>

          {/* Help Panel overlay modal shifted down */}
          {showHelp && (
            <div className={`absolute top-16 right-4 z-40 p-4 rounded-xl shadow-lg w-72 backdrop-blur-md border ${
              darkMode 
                ? "bg-slate-900/95 border-white/10 text-slate-200" 
                : "bg-white/95 border-slate-200 text-slate-700"
            }`}>
              <h3 className="text-xs font-extrabold text-indigo-500 dark:text-indigo-400 mb-2.5 flex items-center gap-1.5 select-none">
                <HelpCircle size={15} /> Shortcuts & Controls
              </h3>
              <ul className="space-y-2 text-[11px] leading-relaxed text-left">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-500">•</span>
                  <span><strong>Double Click</strong> any node to edit text inline.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-500">•</span>
                  <span><strong>Plus (+) Button</strong>: Hover nodes to add parents, children, or siblings.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-500">•</span>
                  <span><strong>Mouse Wheel</strong>: Zoom the canvas in/out dynamically.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-500">•</span>
                  <span><strong>Drag Canvas</strong>: Click and drag on empty canvas space to pan around.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-red-500">•</span>
                  <span><strong>Trash Button</strong>: Hover and click red bin icons to delete.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Loading overlay for cloud map updates */}
          {isLoadingCloud && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 z-30 ${
              darkMode ? "bg-slate-950/70 backdrop-blur-xs" : "bg-white/70 backdrop-blur-xs"
            }`}>
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
              <span className="text-xs font-bold text-slate-500">Syncing workspace...</span>
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
            {/* Dynamic Grid Background Dots layout */}
            <Background color={darkMode ? "#334155" : "#94a3b8"} opacity={darkMode ? 0.3 : 0.4} gap={24} size={1} />
            
            {/* React Flow controls panel */}
            <Controls className={`!rounded-lg !shadow-md scale-90 origin-bottom-left border ${
              darkMode 
                ? "!bg-slate-900/90 !border-white/10 !text-white !fill-white" 
                : "!bg-white/95 !border-slate-200 !text-slate-700 !fill-slate-700"
            }`} />
            
            <MiniMap
              className={`scale-90 origin-bottom-right hidden sm:block !rounded-lg !shadow-md border ${
                darkMode
                  ? "!bg-slate-900/90 !border-white/10"
                  : "!bg-white/95 !border-slate-200"
              }`}
              nodeColor={darkMode ? "#1e293b" : "#cbd5e1"}
              maskColor={darkMode ? "rgba(7, 11, 19, 0.7)" : "rgba(255, 255, 255, 0.5)"}
              zoomable
              pannable
            />
          </ReactFlow>
        </div>
      </main>

      {/* Vision Upload Modal overlay */}
      {aiModalOpen && <AIUpload onClose={() => setAiModalOpen(false)} />}
    </div>
  );
}
