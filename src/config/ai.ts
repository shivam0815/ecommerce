// src/ai.ts
import axios from "axios";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function composeAnswer(userMessage: string, products: any[]) {
  // Keep "products" compact to save tokens
  const productLines = products.map((p, i) =>
    `${i + 1}. ${p.name} | ₹${p.price ?? "—"} | ${p.brand ?? ""} ${p.category ? "• " + p.category : ""} | stock:${p.stock ?? "—"}`
  ).join("\n");

  const system = `
You are a helpful ecommerce assistant for an Indian store.
- Be concise, friendly, and practical.
- Currency is INR (₹). If price is missing, say "Contact for price".
- When recommending, list 3–5 items max with: Name, key features, Price (₹), and Availability.
- Don't invent specs; only use what is provided.
- If no exact matches, explain briefly and suggest close alternatives or filters.
`;

  const user = `
Customer message: ${userMessage}

Products (top candidates):
${productLines || "(none)"}  
Craft the answer now.
`;

  const resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  return resp.data?.choices?.[0]?.message?.content?.trim() || "I'm here to help.";
}
