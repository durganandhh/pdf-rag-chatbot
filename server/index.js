import "./env.js";
import express from "express";
import cors from "cors";
import { uploadRoute } from "./routes/upload.js";
import { queryRoute } from "./routes/query.js";
import { vectorStoreService } from "./services/vectorStore.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

// Initialize vector store before accepting requests
await vectorStoreService.initialize();

// Routes
app.post("/api/upload", uploadRoute);
app.post("/api/query", queryRoute);

app.get("/api/documents", (req, res) => {
  try {
    const documents = vectorStoreService.getDocuments();
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: "Failed to list documents", details: err.message });
  }
});

app.delete("/api/documents/:id", async (req, res) => {
  try {
    const removed = await vectorStoreService.removeDocument(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json({ success: true, message: "Document removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove document", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
