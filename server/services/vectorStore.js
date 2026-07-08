import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
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

class InMemoryVectorStore {
  constructor(embeddings) {
    this.embeddings = embeddings;
    this.vectors = [];
  }

  async addDocuments(docs) {
    const texts = docs.map((d) => d.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    for (let i = 0; i < docs.length; i++) {
      this.vectors.push({ embedding: embeddings[i], document: docs[i] });
    }
  }

  async similaritySearch(query, k = 4) {
    if (this.vectors.length === 0) return [];
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const scored = this.vectors.map((v) => ({
      score: cosineSimilarity(queryEmbedding, v.embedding),
      document: v.document,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.document);
  }

  async save(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const data = this.vectors.map((v) => ({
      embedding: v.embedding,
      pageContent: v.document.pageContent,
      metadata: v.document.metadata,
    }));
    fs.writeFileSync(path.join(dir, "store.json"), JSON.stringify(data));
  }

  static async load(dir, embeddings) {
    const store = new InMemoryVectorStore(embeddings);
    const filePath = path.join(dir, "store.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      for (const item of data) {
        store.vectors.push({
          embedding: item.embedding,
          document: { pageContent: item.pageContent, metadata: item.metadata },
        });
      }
    }
    return store;
  }
}

class VectorStoreService {
  constructor() {
    this.store = null;
    this.embeddings = null;
    this.documentMeta = new Map();
  }

  async initialize() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: "text-embedding-004",
    });
    fs.mkdirSync(STORE_DIR, { recursive: true });
    this._loadMeta();

    try {
      this.store = await InMemoryVectorStore.load(STORE_DIR, this.embeddings);
    } catch (err) {
      console.warn("Could not load existing store, starting fresh:", err.message);
      this.store = new InMemoryVectorStore(this.embeddings);
    }
    console.log(`Vector store initialized (${this.documentMeta.size} documents)`);
  }

  async addDocuments(docs, documentId, fileName) {
    for (const doc of docs) {
      doc.metadata = { ...doc.metadata, documentId, fileName };
    }

    if (!this.store) {
      this.store = new InMemoryVectorStore(this.embeddings);
    }
    await this.store.addDocuments(docs);

    this.documentMeta.set(documentId, { fileName, chunkCount: docs.length });
    await this._save();
  }

  async search(query, k = 4) {
    if (!this.store) return [];
    return this.store.similaritySearch(query, k);
  }

  async removeDocument(documentId) {
    if (!this.documentMeta.has(documentId)) return false;

    if (this.store) {
      this.store.vectors = this.store.vectors.filter(
        (v) => v.document.metadata?.documentId !== documentId
      );
    }

    this.documentMeta.delete(documentId);
    await this._save();
    return true;
  }

  getDocuments() {
    const docs = [];
    for (const [id, meta] of this.documentMeta) {
      docs.push({ id, fileName: meta.fileName, chunkCount: meta.chunkCount });
    }
    return docs;
  }

  async _save() {
    this._saveMeta();
    if (this.store) {
      await this.store.save(STORE_DIR);
    }
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
