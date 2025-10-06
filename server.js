import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Simple keyword check to decide which model to use
function needsRealtime(text) {
  const keywords = ["today", "latest", "notice", "exam", "result", "admit card", "update", "news"];
  return keywords.some(k => text.toLowerCase().includes(k));
}

// Gemini API call
async function callGemini(prompt) {
  const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }]}]
    })
  });
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
}

// Perplexity API call
async function callPerplexity(query) {
  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "pplx-70b-online",
      messages: [{ role: "user", content: query }]
    })
  });
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "No response from Perplexity.";
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    let reply;
    if (needsRealtime(message)) {
      const webAns = await callPerplexity(message);
      const combined = await callGemini(`Summarize this for students: ${webAns}`);
      reply = combined;
    } else {
      reply = await callGemini(message);
    }
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Stuni backend running on port ${port}`));
