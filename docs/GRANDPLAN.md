# 🗺️ Project Grand Plan: VisionMap

VisionMap is a highly polished, full-stack interactive mind mapping tool that allows users to create elegant mind maps from scratch, format them neatly via layout engines, or automatically convert static screenshots/images of prebuilt maps into fully editable digital graphs using Google's Gemini 3.5 Vision API.

## 🛠️ Tech Stack
-   **Frontend**: React (v19), `@xyflow/react` (React Flow v12 for beautiful graph canvases), Lucide Icons, Framer Motion, Tailwind CSS v4.
-   **Backend**: Node.js/Express (v4.21), integrated with Vite in dev mode, bundling with esbuild for production containers.
-   **AI Interface**: `@google/genai` on server side, querying `gemini-3.5-flash` with real structures.
-   **Layout Algorithms**: `dagre` for top-to-bottom and left-to-right hierarchy layout formatting.
-   **State Management**: `zustand` for real-time reactivity, seamlessly integrated with React Flow.

---

## 📅 Roadmap

### Phase 1: Foundation & Project Structures ✅
-   [x] Set up package dependencies and initialize workspace configuration.
-   [x] Establish custom types for Nodes, Edges, and Document schema definitions.
-   [x] Draft `AGENTS.md` and `GRANDPLAN.md`.

### Phase 2: Full-Stack Express Server & Development Pipeline ✅
-   [x] Modify `package.json` to configure full-stack `tsx server.ts` dev, build, and start commands.
-   [x] Construct `server.ts` with Vite development middleware and production static folder hosting.
-   [x] Set up safe `/api/analyze-image` route to interact with Gemini safely.

### Phase 3: Infinite React Flow Canvas & Custom Nodes ✅
-   [x] Implement Zustand (`useMapStore.ts`) to manage mind map nodes, connections, quick adds, deletions, edits.
-   [x] Assemble `MindMapNode.tsx` - a custom node displaying a high-contrast layout, text editing input, dynamic children spawners, sibling quick adds, and recursive delete buttons.
-   [x] Build elegant floating action toolbar (Layout Direction toggle, Re-layout/Format Grid, Export, Upload image).

### Phase 4: Auto-Layout Engine (Dagre Integration) ✅
-   [x] Implement automatic formatting algorithm in `src/lib/layout.ts` allowing instant alignment horizontally (`LR` - left to right) or vertically (`TB` - top to bottom).
-   [x] Enable manual drag positioning alongside a powerful "Reset to Clean Alignment" layout button.

### Phase 5: Vision Analyzer (Gemini AI Integration) ✅
-   [x] Formulate reliable prompt & JSON responses returning formal node-link structures.
-   [x] Connect "Upload Mind Map Image" modal with server action proxy.
-   [x] Convert Gemini JSON payload instantly into polished node-edge coordinates using Dagre before loading onto the canvas.

### Phase 6: Core Polish & Features ✅
-   [x] Export to structured JSON files.
-   [x] Local storage automatic saving and restoration.
-   [x] Interactive UI touches: visual indicators, responsive handles, keyboard shortcuts.

---

## 📝 Session Log

| Session | Date       | Focus                               | Status      |
| ------- | ---------- | ----------------------------------- | ----------- |
| 001     | 2026-06-22 | Project setup & Foundation plans     | Completed   |
| 002     | 2026-06-22 | Full-stack server, Canvas, & AI Gen | Completed   |
