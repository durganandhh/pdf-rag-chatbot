import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { vectorStoreService } from "./vectorStore.js";

const SYSTEM_PROMPT = `You are a helpful assistant. Answer questions based ONLY on the provided context. If the context doesn't contain the answer, say so. Cite which parts of the context you used.`;

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.0-flash",
  temperature: 0.3,
});

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

  const response = await llm.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion: ${question}`,
    },
  ]);

  const sources = relevantDocs.map((doc) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
  }));

  return { answer: response.content, sources };
}
