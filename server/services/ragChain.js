import { GoogleGenerativeAI } from "@google/generative-ai";
import { vectorStoreService } from "./vectorStore.js";

const SYSTEM_PROMPT = `You are a helpful assistant. Answer questions based ONLY on the provided context. If the context doesn't contain the answer, say so. Cite which parts of the context you used.`;

let model = null;

function getModel() {
  if (!model) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
}

export async function query(question) {
  const relevantDocs = await vectorStoreService.search(question, 4);

  if (relevantDocs.length === 0) {
    return {
      answer: "No documents have been uploaded yet, or no relevant context was found. Please upload a PDF first.",
      sources: [],
    };
  }

  const context = relevantDocs
    .map((doc, i) => `[Source ${i + 1}] ${doc.pageContent}`)
    .join("\n\n");

  const result = await getModel().generateContent({
    contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${context}\n\nQuestion: ${question}` }] }],
    generationConfig: { temperature: 0.3 },
  });

  const answer = result.response.text();

  const sources = relevantDocs.map((doc) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
  }));

  return { answer, sources };
}
