import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeBaseTable, unansweredQuestionsTable, aiChatLogsTable } from "@workspace/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { anthropic, ASSISTANT_MODEL } from "../lib/anthropic.js";
import { sanitizeInput, normalizeText, buildSystemPrompt } from "../lib/kb-search.js";
import { KB_DOCUMENT } from "../lib/kb-document.js";

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

const ERRORE_TECNICO = "ERRORE_TECNICO";

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
    // ── Carica l'INTERA knowledge base (voci pubblicate + attive) ────────────────
    const entries = await db
      .select({ id: knowledgeBaseTable.id, title: knowledgeBaseTable.title, content: knowledgeBaseTable.content })
      .from(knowledgeBaseTable)
      .where(and(eq(knowledgeBaseTable.isPublished, true), eq(knowledgeBaseTable.isActive, true)));

    const dbText = entries
      .map((e) => `### ${e.title}\n${e.content}`)
      .join("\n\n---\n\n")
      .trim();

    // Se il DB ha contenuti li usa (self-service admin); altrimenti il documento
    // KB incorporato nel backend, così l'assistente conosce comunque tutto.
    const knowledgeText = dbText || KB_DOCUMENT;

    dbg(`[AI] fonte KB: ${dbText ? "db" : "incorporata"} | voci DB: ${entries.length} | caratteri: ${knowledgeText.length}`);
    console.log(debugLines.join("\n"));

    // L'intero documento va a Claude: nessun filtro per parole chiave.
    const completion = await anthropic.messages.create({
      model:      ASSISTANT_MODEL,
      max_tokens: 700,
      system:     buildSystemPrompt(knowledgeText, lang),
      messages: [
        { role: "user", content: sanitized },
      ],
    });

    let fullReply = completion.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!fullReply) fullReply = fallbackMsg;

    // L'assistente non ha trovato la risposta nel documento → segnala al team.
    const unanswered = /non trovo questa informazione|i can'?t find this information|i cannot find this information/i.test(fullReply);
    if (unanswered) {
      await saveUnansweredQuestion(sanitized, normalized, {
        pageUrl, sessionId, customerName, customerEmail, aiFallbackMessage: fullReply,
      });
    }

    // 26/10: il log si salva PRIMA di rispondere. Se il telefono è andato in
    // sottofondo e la risposta si è persa, il widget la ritrova qui
    // (GET /api/ai/chat/answer). La funzione non si ferma se il cliente si
    // scollega: la chiamata a Claude non è legata alla richiesta.
    await saveChatLog({
      sessionId, userMessage: sanitized, aiReply: fullReply,
      sourceKnowledgeIds: entries.map((e) => e.id),
      confidenceScore:    unanswered ? 0 : 1,
      usedFallback:       unanswered, escalatedToAdmin: unanswered, pageUrl, ipAddress: ip,
    });

    res.json({
      answer:       fullReply,
      confidence:   unanswered ? "low" : "high",
      usedItems:    entries.slice(0, 20).map((e) => ({ id: e.id, title: e.title })),
      usedFallback: unanswered,
    });

  } catch (err) {
    console.error("[AI] Error in /chat:", err);
    await saveChatLog({
      sessionId, userMessage: sanitized, aiReply: ERRORE_TECNICO,
      sourceKnowledgeIds: [], confidenceScore: 0,
      usedFallback: true, escalatedToAdmin: false, pageUrl, ipAddress: ip,
    });
    res.json({ answer: "Si è verificato un errore tecnico. Riprova tra un momento.", confidence: "error", usedFallback: true });
  }
});

// ─── GET /api/ai/chat/answer ──────────────────────────────────────────────────
// 26/10: il widget chiede «la risposta alla mia domanda è pronta?» quando la
// risposta diretta si è persa (telefono in tasca, app in sottofondo).
// Si cerca nel log per sessione + testo della domanda, negli ultimi 15 minuti.
router.get("/chat/answer", async (req, res) => {
  const sessionId = String(req.query.sessionId ?? "").slice(0, 128);
  const question  = String(req.query.question ?? "");
  const sanitized = sanitizeInput(question).slice(0, 1000);
  if (sessionId.length < 6 || sanitized.length < 2) {
    res.status(400).json({ error: "Richiesta non valida." });
    return;
  }
  try {
    const [log] = await db
      .select({ aiReply: aiChatLogsTable.aiReply, usedFallback: aiChatLogsTable.usedFallback })
      .from(aiChatLogsTable)
      .where(and(
        eq(aiChatLogsTable.sessionId, sessionId),
        eq(aiChatLogsTable.userMessage, sanitized),
        gte(aiChatLogsTable.createdAt, new Date(Date.now() - 15 * 60_000)),
      ))
      .orderBy(desc(aiChatLogsTable.id))
      .limit(1);

    if (!log) { res.json({ status: "pending" }); return; }
    if (log.aiReply === ERRORE_TECNICO) { res.json({ status: "error" }); return; }
    res.json({ status: "ready", answer: log.aiReply, confidence: log.usedFallback ? "low" : "high" });
  } catch (err) {
    console.error("[AI] Error in /chat/answer:", err);
    res.status(500).json({ error: "Errore tecnico." });
  }
});

export default router;
