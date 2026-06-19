import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { unansweredQuestionsTable, aiChatLogsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { anthropic, ASSISTANT_MODEL } from "../lib/anthropic.js";
import {
  sanitizeInput,
  normalizeText,
  searchKB,
  buildContext,
  buildSystemPrompt,
  MIN_SCORE_THRESHOLD,
} from "../lib/kb-search.js";

const router: IRouter = Router();

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 15) return false;
  entry.count++;
  return true;
}

// ─── Save / dedup unanswered question ────────────────────────────────────────
async function saveUnansweredQuestion(
  question: string,
  normalized: string,
  extras: { pageUrl: string; sessionId: string; customerName: string; customerEmail: string; aiFallbackMessage: string }
) {
  const [existing] = await db
    .select({ id: unansweredQuestionsTable.id, occurrences: unansweredQuestionsTable.occurrences })
    .from(unansweredQuestionsTable)
    .where(eq(unansweredQuestionsTable.normalizedQuestion, normalized))
    .limit(1);

  if (existing) {
    await db
      .update(unansweredQuestionsTable)
      .set({ occurrences: (existing.occurrences ?? 1) + 1, lastAskedAt: new Date(), updatedAt: new Date() })
      .where(eq(unansweredQuestionsTable.id, existing.id));
  } else {
    await db.insert(unansweredQuestionsTable).values({
      question,
      normalizedQuestion:  normalized,
      pageUrl:             extras.pageUrl,
      customerSessionId:   extras.sessionId,
      customerName:        extras.customerName,
      customerEmail:       extras.customerEmail,
      aiFallbackMessage:   extras.aiFallbackMessage,
      status:              "new",
      occurrences:         1,
      lastAskedAt:         new Date(),
    });
  }
}

// ─── Save chat log ────────────────────────────────────────────────────────────
async function saveChatLog(data: {
  sessionId: string; userMessage: string; aiReply: string;
  sourceKnowledgeIds: number[]; confidenceScore: number;
  usedFallback: boolean; escalatedToAdmin: boolean; pageUrl: string; ipAddress: string;
}) {
  try {
    await db.insert(aiChatLogsTable).values({
      sessionId:          data.sessionId,
      userMessage:        data.userMessage.slice(0, 1000),
      aiReply:            data.aiReply.slice(0, 2000),
      sourceKnowledgeIds: JSON.stringify(data.sourceKnowledgeIds),
      confidenceScore:    data.confidenceScore,
      usedFallback:       data.usedFallback,
      escalatedToAdmin:   data.escalatedToAdmin,
      pageUrl:            data.pageUrl,
      ipAddress:          data.ipAddress,
    });
  } catch {
    console.warn("[ai] saveChatLog failed");
  }
}

const FALLBACK_MSG: Record<string, string> = {
  it: "Al momento non sono in grado di darti questa informazione con certezza. Ho segnalato la tua richiesta al team, così potremo aggiornare l'assistente.",
  en: "At the moment I'm not able to provide this information with certainty. I've forwarded your request to the team.",
};

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post("/chat", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "Troppe richieste. Riprova tra un minuto." });
    return;
  }

  const {
    question      = "",
    sessionId     = "",
    pageUrl       = "",
    customerName  = "",
    customerEmail = "",
    language      = "it",
  } = req.body as Record<string, string>;

  const lang = (language === "en" ? "en" : "it") as "it" | "en";
  const fallbackMsg = FALLBACK_MSG[lang];

  const sanitized = sanitizeInput(question);
  if (sanitized.length < 2) {
    res.status(400).json({ error: "Domanda troppo corta." });
    return;
  }
  const normalized = normalizeText(sanitized);

  // Collect debug lines and flush to server console
  const debugLines: string[] = [];
  const dbg = (msg: string) => debugLines.push(msg);
  dbg(`[AI] Q: "${sanitized}"`);

  try {
    const relevantItems = await searchKB(sanitized, dbg);
    const topScore      = relevantItems[0]?.score ?? 0;
    const hasContext    = topScore >= MIN_SCORE_THRESHOLD;

    dbg(`[AI] topScore=${topScore} threshold=${MIN_SCORE_THRESHOLD} hasContext=${hasContext}`);
    if (hasContext) {
      dbg(`[AI] Using: ${relevantItems.map((i) => `"${i.title}"(${i.score})`).join(", ")}`);
    }
    console.log(debugLines.join("\n"));

    // ── FALLBACK path ──────────────────────────────────────────────────────────
    if (!hasContext) {
      await saveUnansweredQuestion(sanitized, normalized, {
        pageUrl, sessionId, customerName, customerEmail, aiFallbackMessage: fallbackMsg,
      });
      await saveChatLog({
        sessionId, userMessage: sanitized, aiReply: fallbackMsg,
        sourceKnowledgeIds: [], confidenceScore: topScore,
        usedFallback: true, escalatedToAdmin: true, pageUrl, ipAddress: ip,
      });
      res.json({ answer: fallbackMsg, confidence: "low", usedItems: [], usedFallback: true });
      return;
    }

    // ── AI path (risposta singola JSON — compatibile con Vercel serverless) ──────
    const context = buildContext(relevantItems);

    const completion = await anthropic.messages.create({
      model:      ASSISTANT_MODEL,
      max_tokens: 700,
      system:     buildSystemPrompt(context, lang),
      messages: [
        { role: "user", content: sanitized },
      ],
    });

    let fullReply = completion.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    // Modello ha restituito risposta vuota — sintetizza dalla KB
    if (!fullReply && relevantItems.length > 0) {
      const synthesized = relevantItems
        .slice(0, 2)
        .map((i) => i.content.split(".")[0].trim())
        .join(". ")
        .replace(/\s+/g, " ")
        .slice(0, 300);
      fullReply = synthesized
        ? synthesized + "."
        : "Per maggiori informazioni puoi contattare Giuseppe tramite la sezione Contatto del sito o tramite email e Instagram.";
    }

    res.json({
      answer:      fullReply,
      confidence:  "high",
      usedItems:   relevantItems.map((i) => ({ id: i.id, title: i.title })),
      usedFallback: false,
    });

    // fire-and-forget log
    saveChatLog({
      sessionId, userMessage: sanitized, aiReply: fullReply,
      sourceKnowledgeIds: relevantItems.map((i) => i.id),
      confidenceScore:    topScore,
      usedFallback:       false, escalatedToAdmin: false, pageUrl, ipAddress: ip,
    });

  } catch (err) {
    console.error("[AI] Error in /chat:", err);
    saveChatLog({
      sessionId, userMessage: sanitized, aiReply: "ERRORE_TECNICO",
      sourceKnowledgeIds: [], confidenceScore: 0,
      usedFallback: true, escalatedToAdmin: false, pageUrl, ipAddress: ip,
    });
    res.json({ answer: "Si è verificato un errore tecnico. Riprova tra un momento.", confidence: "error", usedFallback: true });
  }
});

export default router;
