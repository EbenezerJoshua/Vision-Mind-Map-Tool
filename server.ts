import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with a generous limit to accept base64 image uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API endpoint to process mind map image parsing via Gemini
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image file or base64 string provided" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "Google Gemini API Key is missing. Please select/add your key under 'Settings > Secrets' on the AI Studio panel.",
        });
      }

      // Initialize the recommended GoogleGenAI client (with strict server user-agent header as per guidelines)
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Split off metadata prefix if uploaded as a data URL (e.g. data:image/png;base64,xxxx)
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      const mimeType = image.includes(":") ? image.split(";")[0].split(":")[1] : "image/png";

      const prompt = `
        Analyze this mind map image meticulously. Identify the logical nodes, their text/labels, and parent-to-child paths (hierarchy).
        - Find the main core topic node (this will be the only node without any parentId).
        - Trace all surrounding branch nodes.
        - Identify which node connects to which parent.
        - Format the output strictly as a structured JSON object.
        Do not add markdown backticks (\`\`\`json) or any conversational text. Return only the JSON object.
      `;

      // Utilize 'gemini-3.5-flash' for robust multi-modal structure extraction
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          prompt,
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nodes: {
                type: Type.ARRAY,
                description: "Array of extracted mindmap nodes",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "Unique sequential identifier, e.g. '1', '2', '3'" },
                    label: { type: Type.STRING, description: "Clean descriptive text of this node" },
                    parentId: { type: Type.STRING, description: "The parent node's ID. MUST be omitted or set to null ONLY for the central root node." },
                  },
                  required: ["id", "label"],
                },
              },
            },
            required: ["nodes"],
          },
        },
      });

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("Empty response returned from the Gemini Model.");
      }

      const mindmapJson = JSON.parse(textOutput.trim());
      return res.json(mindmapJson);
    } catch (err: any) {
      console.error("Gemini Vision Parser Error:", err);
      return res.status(500).json({ error: err.message || "An error occurred while analyzing the mind map image." });
    }
  });

  // Load Vite Dev Middleware or Serve Built Production Static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VisionMap Server] Port 3000 listening successfully in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer();
