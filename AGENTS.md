# Agent Rules: VisionMap Development

## Tech Stack
- Full-Stack React + Vite / Express Canvas Tooling
- Tailwind CSS v4 (Embedded as `@import "tailwindcss";` in `src/index.css`)
- `@xyflow/react` (React Flow) for the interactive infinite canvas
- `dagre` for the hierarchical graph layout calculation (Vertical vs Horizontal)
- `@google/genai` on the server-side proxy for vision extraction
- `zustand` for predictable, lightweight state management

## Architecture and Guidelines
1.  **Durable State Persistence**: Save current mind map structures automatically to the user's `localStorage` to prevent work loss.
2.  **Strict Security**: Never call Gemini directly from browser code. Proxy all requests through server-side `/api/analyze-image`. Access `process.env.GEMINI_API_KEY` only in `server.ts`.
3.  **No Extraneous Logs or Telemetry**: No terminal frames or unneeded margins. Keep UI extremely polished, beautiful, and focused entirely on the Mind Map canvas.
4.  **No Unsolicited Theme switchers**: Offer one exceptionally designed dark canvas layout matching a sleek modern dark vibe.
5.  **AADP Conformance**: Update the Grand Plan and session log frequently.
