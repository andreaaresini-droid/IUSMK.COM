import Anthropic from "@anthropic-ai/sdk";

// API key comes from Vercel env var ANTHROPIC_API_KEY.
// The app starts even without it set; AI features fail gracefully at call time.
const apiKey = process.env.ANTHROPIC_API_KEY || "not-configured";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("[Anthropic] ANTHROPIC_API_KEY not set — AI assistant will be unavailable");
}

export const anthropic = new Anthropic({ apiKey });

// Model used by the customer-facing assistant. Haiku 4.5 is the cheapest Claude
// model ($1 / $5 per 1M tokens) — well suited to constrained, KB-grounded Q&A.
export const ASSISTANT_MODEL = "claude-haiku-4-5";
