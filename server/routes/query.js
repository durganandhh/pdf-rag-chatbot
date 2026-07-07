import { query as ragQuery } from "../services/ragChain.js";

export async function queryRoute(req, res) {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ error: "A non-empty 'question' field is required" });
    }

    const result = await ragQuery(question.trim());
    res.json(result);
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "Failed to process query", details: err.message });
  }
}
