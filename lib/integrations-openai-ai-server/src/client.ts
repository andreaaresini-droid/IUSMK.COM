import OpenAI from "openai";

// Support both standard OpenAI env vars and Replit-proxied vars.
// App starts even without these set; AI features will fail gracefully at call time.
const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "not-configured";
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;

if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.warn("[OpenAI] OPENAI_API_KEY not set — AI features will be unavailable");
}

export const openai = new OpenAI({ apiKey, baseURL });
