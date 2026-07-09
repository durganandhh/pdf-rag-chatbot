import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, "..", "vector-store");
const META_FILE = path.join(STORE_DIR, "metadata.json");

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

class VectorStoreService {
  constructor() {
    this.vectors = [];
    this.documentMeta = new Map();
    this.embeddingModel = null;
  }

  async initialize() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    fs.mkdirSync(STORE_DIR, { recursive: true });
    this._loadMeta();
    this._loadVectors();
    console.log(`Vector store initialized (${this.documentMeta.size} documents, ${this.vectors.length} vectors)`);
  }

  async _embed(texts) {
    const model = this.genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const results = [];
    for (const text of texts) {
      const res = await model.embedContent(text);
      results.push(res.embedding.values);
    }
    return results;
  }

  async addDocuments(docs, documentId, fileName) {
    const texts = docs.map((d) => d.pageContent);
    const batchSize = 50;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this._embed(batch);
      allEmbeddings.push(...embeddings);
    }

    for (let i = 0; i < docs.length; i++) {
      this.vectors.push({
        embedding: allEmbeddings[i],
        pageContent: docs[i].pageContent,
        metadata: { ...docs[i].metadata, documentId, fileName },
      });
    }

    this.documentMeta.set(documentId, { fileName, chunkCount: docs.length });
    this._save();
  }

  async search(query, k = 4) {
    if (this.vectors.length === 0) return [];
    const [queryEmbedding] = await this._embed([query]);
    const scored = this.vectors.map((v) => ({
      score: cosineSimilarity(queryEmbedding, v.embedding),
      pageContent: v.pageContent,
      metadata: v.metadata,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  removeDocument(documentId) {
    if (!this.documentMeta.has(documentId)) return false;
    this.vectors = this.vectors.filter((v) => v.metadata?.documentId !== documentId);
    this.documentMeta.delete(documentId);
    this._save();
    return true;
  }

  getDocuments() {
    const docs = [];
    for (const [id, meta] of this.documentMeta) {
      docs.push({ id, fileName: meta.fileName, chunkCount: meta.chunkCount });
    }
    return docs;
  }

  _save() {
    this._saveMeta();
    fs.writeFileSync(path.join(STORE_DIR, "vectors.json"), JSON.stringify(this.vectors));
  }

  _loadVectors() {
    try {
      const fp = path.join(STORE_DIR, "vectors.json");
      if (fs.existsSync(fp)) {
        this.vectors = JSON.parse(fs.readFileSync(fp, "utf-8"));
      }
    } catch { this.vectors = []; }
  }

  _loadMeta() {
    try {
      if (fs.existsSync(META_FILE)) {
        const data = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
        for (const [k, v] of Object.entries(data)) {
          this.documentMeta.set(k, v);
        }
      }
    } catch { /* start fresh */ }
  }

  _saveMeta() {
    const obj = Object.fromEntries(this.documentMeta);
    fs.writeFileSync(META_FILE, JSON.stringify(obj, null, 2));
  }
}

export const vectorStoreService = new VectorStoreService();
