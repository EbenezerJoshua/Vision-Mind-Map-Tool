import React, { useState, useRef } from "react";
import { Upload, Sparkles, AlertCircle, RefreshCw, X } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { MindMapNode, MindMapEdge } from "../types";

interface AIUploadProps {
  onClose: () => void;
}

export const AIUpload: React.FC<AIUploadProps> = ({ onClose }) => {
  const { setElements, triggerAutoLayout, direction } = useMapStore();
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phrases = [
    "Analyzing image contours...",
    "Extracting branch nodes & labels...",
    "Detecting parent-child relations...",
    "Reconstructing spatial logic...",
    "Styling map lines...",
    "Formatting canvas tree layout...",
  ];

  const animatePhrases = () => {
    let index = 0;
    setLoadingPhrase(phrases[0]);
    const interval = setInterval(() => {
      index = (index + 1) % phrases.length;
      setLoadingPhrase(phrases[index]);
    }, 2500);
    return interval;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    setLoading(true);
    setError(null);
    const phraseInterval = animatePhrases();

    try {
      // Convert file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // POST to our secure server-side endpoint
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      const result = await response.json();
      clearInterval(phraseInterval);

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to process image structure.");
      }

      const extractedNodes = result.nodes;
      if (!Array.isArray(extractedNodes) || extractedNodes.length === 0) {
        throw new Error("No hierarchical nodes identified in the given mind map.");
      }

      // Convert Gemini output nodes to formal MindMapNodes
      // Find or establish the single center root node (first node with no parentId)
      let rootNodeFound = false;
      const formattedNodes: MindMapNode[] = extractedNodes.map((n: any, idx: number) => {
        // Let's decide of it acts as root
        const isThisRoot = !n.parentId && !rootNodeFound;
        if (isThisRoot) rootNodeFound = true;

        return {
          id: String(n.id),
          type: "mindmap",
          position: { x: 0, y: 0 }, // Position calculated automatically during Dagre laying
          data: {
            label: String(n.label),
            isRoot: isThisRoot,
          },
        } as MindMapNode;
      });

      // If no node had null/omitted parentId, make the very first node root as safety margin
      if (!rootNodeFound && formattedNodes.length > 0) {
        formattedNodes[0].data.isRoot = true;
      }

      // Re-map lines: connect parent to target structures
      const formattedEdges: MindMapEdge[] = extractedNodes
        .filter((n: any) => n.parentId && formattedNodes.some(fn => fn.id === String(n.parentId)) && String(n.id) !== String(n.parentId))
        .map((n: any) => ({
          id: `edge_${n.parentId}_${n.id}`,
          source: String(n.parentId),
          target: String(n.id),
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }));

      // Load reconstructed pieces into state
      setElements(formattedNodes, formattedEdges);
      // Clean structure layouts horizontal or vertical automatically
      triggerAutoLayout(direction);
      onClose(); // shut modal
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
      clearInterval(phraseInterval);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles size={20} className="animate-pulse text-indigo-400" />
            <span className="font-bold text-white tracking-wide">Vision-to-Map AI Engine</span>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-450 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6">
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Upload an image, sketch, or screenshot of an existing mind map. Our system will analyze the hierarchy, trace connection pathways, and output a dynamic, full-fledged editable digital board.
          </p>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-950/40 rounded-xl border border-white/5">
              <RefreshCw className="text-indigo-400 animate-spin mb-4" size={38} />
              <p className="text-white font-medium text-sm animate-pulse mb-1">{loadingPhrase}</p>
              <p className="text-xs text-slate-500">Retrieving hierarchical tree matrix via Google Gemini</p>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? "border-indigo-500 bg-indigo-950/20 shadow-inner"
                  : "border-white/10 hover:border-indigo-500/50 bg-slate-950/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleChange}
              />
              <div className="p-4 bg-indigo-550/10 text-indigo-400 rounded-xl mb-3">
                <Upload size={24} />
              </div>
              <p className="text-slate-200 text-sm font-semibold mb-1">
                Drag & drop your mind map image
              </p>
              <p className="text-slate-500 text-xs text-center">
                Supports PNG, JPG, WebP up to 15MB. Click to browse.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer info/controls */}
        <div className="bg-slate-950/80 px-6 py-4 flex items-center justify-between text-xs text-slate-500 border-t border-white/5">
          <span>Ensures zero exposed keys. Powered by server-side AI.</span>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition duration-155 cursor-pointer font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
