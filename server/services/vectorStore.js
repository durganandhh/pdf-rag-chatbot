import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, "..", "faiss-store");
const META_FILE = path.join(STORE_DIR, "metadata.json");

// Try to load faiss-node; fall back to in-memory cosine similarity
let FaissStore = null;
try {
  const faissModule = await import("@langchain/community/vectorstores/faiss");
  FaissStore = faissModule.FaissStore;
  console.log("Using FAISS vector store backend");
} catch {
  console.log("faiss-node not available — using in-memory cosine similarity fallback");
}

// ---------- In-memory fallback ----------

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
    this.vectors = [];   // { embedding: number[], document: Document }
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
    fs.writeFileSync(path.join(dir, "memory-store.json"), JSON.stringify(data));
  }

  static async load(dir, embeddings) {
    const store = new InMemoryVectorStore(embeddings);
    const filePath = path.join(dir, "memory-store.json");
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

// ---------- Singleton service ----------

class VectorStoreService {
  constructor() {
    this.store = null;
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: "text-embedding-004",
    });
    this.documentMeta = new Map(); // documentId -> { fileName, chunkCount }
    this.useFaiss = !!FaissStore;
  }

  async initialize() {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    this._loadMeta();

    try {
      if (this.useFaiss && fs.existsSync(path.join(STORE_DIR, "faiss.index"))) {
        this.store = await FaissStore.load(STORE_DIR, this.embeddings);
      } else if (!this.useFaiss) {
        this.store = await InMemoryVectorStore.load(STORE_DIR, this.embeddings);
      }
    } catch (err) {
      console.warn("Could not load existing store, starting fresh:", err.message);
      this.store = null;
    }
    console.log(`Vector store initialized (${this.documentMeta.size} documents)`);
  }

  async addDocuments(docs, documentId, fileName) {
    // Tag every chunk with its document identity
    for (const doc of docs) {
      doc.metadata = { ...doc.metadata, documentId, fileName };
    }

    if (!this.store) {
      if (this.useFaiss) {
        this.store = await FaissStore.fromDocuments(docs, this.embeddings);
      } else {
        this.store = new InMemoryVectorStore(this.embeddings);
        await this.store.addDocuments(docs);
      }
    } else {
      await this.store.addDocuments(docs);
    }

    this.documentMeta.set(documentId, { fileName, chunkCount: docs.length });
    await this._save();
  }

  async search(query, k = 4) {
    if (!this.store) return [];
    return this.store.similaritySearch(query, k);
  }

  async removeDocument(documentId) {
    if (!this.documentMeta.has(documentId)) return false;

    if (this.useFaiss) {
      // FAISS doesn't support selective deletion — rebuild from remaining vectors
      // For the in-memory store we can filter directly
      const remaining = await this._getAllDocsExcept(documentId);
      this.store = null;
      if (remaining.length > 0) {
        this.store = await FaissStore.fromDocuments(remaining, this.embeddings);
      }
    } else if (this.store) {
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

  // -- private helpers --

  async _getAllDocsExcept(excludeId) {
    // Rebuild document list from the in-memory representation of the FAISS store
    // This is a workaround because FAISS doesn't expose stored documents directly.
    // We keep a metadata file on disk to reconstruct.
    // For a full rebuild we re-embed — but since we already have embeddings stored
    // in FAISS, the simplest correct approach is to keep raw docs in metadata.
    // In practice, for the fallback store we filter vectors directly (see above).
    // For FAISS, we need to iterate the docstore.
    if (!this.store) return [];
    const allDocs = [];
    if (this.store._docs) {
      // Internal docstore in @langchain/community FAISS wrapper
      for (const doc of this.store._docs) {
        if (doc.metadata?.documentId !== excludeId) {
          allDocs.push(doc);
        }
      }
    } else if (this.store.docstore?._docs) {
      for (const [, doc] of this.store.docstore._docs) {
        if (doc.metadata?.documentId !== excludeId) {
          allDocs.push(doc);
        }
      }
    }
    return allDocs;
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
