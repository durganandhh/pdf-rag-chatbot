import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { vectorStoreService } from "../services/vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function splitText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ pageContent: chunk, metadata: {} });
    }
    start += chunkSize - overlap;
  }
  return chunks;
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
}).single("file");

export function uploadRoute(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const pdfBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(pdfBuffer);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        return res.status(400).json({ error: "PDF contains no extractable text" });
      }

      const docs = splitText(pdfData.text);
      const documentId = uuidv4();
      await vectorStoreService.addDocuments(docs, documentId, req.file.originalname);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        documentId,
        fileName: req.file.originalname,
        chunks: docs.length,
      });
    } catch (parseErr) {
      console.error("Upload processing error:", parseErr);
      res.status(500).json({ error: "Failed to process PDF", details: parseErr.message });
    }
  });
}
