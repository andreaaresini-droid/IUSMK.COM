import { db } from "@workspace/db";
import { knowledgeBaseTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

// ─── Italian stopwords ────────────────────────────────────────────────────────
export const IT_STOPWORDS = new Set([
  "il","lo","la","i","gli","le","un","uno","una","del","dello","della",
  "dei","degli","delle","al","allo","alla","ai","agli","alle","dal","dallo",
  "dalla","dai","dagli","dalle","nel","nello","nella","nei","negli","nelle",
  "sul","sullo","sulla","sui","sugli","sulle","per","tra","fra","con","su",
  "non","che","chi","cui","dove","quando","come","cosa","sei","mio","mia",
  "suo","sua","miei","tuoi","its","the","and","for","are","was","you","can",
  "all","this","has","had","but","not","from","they","will","one","have",
  "riesco","voglio","cerco","trovo","riesci","devo","posso","riesce","potrei",
  "mi","me","ti","si","ci","vi","ne","lo","li","le","gli","loro","mio","tuo",
  "questo","questa","questi","queste","quello","quella","quelli","quelle",
  "anche","solo","già","sempre","mai","più","ancora","molto","poco","tanto",
  "bene","male","ora","poi","dopo","prima","adesso","subito","circa",
  "ho","hai","ha","abbiamo","avete","hanno","è","sono","siamo","siete",
  "fare","faccio","fai","fa","facciamo","fate","fanno",
  // English stopwords
  "is","in","to","of","it","at","be","do","if","or","an","as","by","up",
  "so","my","we","he","she","its","did","does","done","also","that","with",
  "there","their","what","when","which","about","after","into","than","then",
  "just","like","more","some","such","your","them","these","those","over",
  "even","want","need","help","make","give","take","know","go","got","use",
  "via","well","tell","show","very","much","here","only","now","out","how",
]);

// ─── Synonym expansion map ────────────────────────────────────────────────────
export const SYNONYMS: Record<string, string[]> = {
  // acquisto / corsi
  "acquistare":  ["acquisto","corso","comprare","videocorso","prodotto","corsi"],
  "acquisto":    ["acquistare","corso","comprare","videocorso","corsi"],
  "comprare":    ["acquistare","acquisto","corso","corsi","videocorso"],
  "compro":      ["acquistare","acquisto","corso","comprare","corsi"],
  "comprato":    ["acquistato","corso","accesso","codice"],
  "acquistato":  ["acquisto","corso","codice","notifiche"],
  "ordine":      ["acquisto","corso","comprare"],
  "ordinare":    ["acquistare","corso"],
  "pagamento":   ["acquisto","corso","comprare","stripe"],
  "pagare":      ["acquistare","corso","acquisto"],
  "comprarlo":   ["acquistare","corso","acquisto"],
  "prenderlo":   ["acquistare","corso","acquisto"],
  "dove":        ["menu","sezione","sito","trovare","notifiche"],

  // sblocco / codice / accesso corso
  "sbloccare":   ["codice","corso","accesso","notifiche","sblocco"],
  "sblocco":     ["codice","corso","accesso","notifiche"],
  "sblocca":     ["codice","corso","notifiche"],
  "aprire":      ["accesso","corso","codice"],
  "codice":      ["accesso","corso","sblocco","notifiche","sbloccare"],
  "accedere":    ["accesso","codice","corso","login","password","entrare"],
  "entrare":     ["accesso","login","account","password","codice"],
  "inserire":    ["codice","accesso","corso"],

  // contatti
  "contatto":    ["contatti","giuseppe","email","instagram","modulo"],
  "contattare":  ["contatti","giuseppe","email","instagram"],
  "chiamare":    ["telefono","giuseppe","contatti"],
  "whatsapp":    ["contatti","giuseppe","telefono","numero"],
  "numero":      ["telefono","contatti","giuseppe"],
  "parlare":     ["contatti","giuseppe","email"],
  "scrivere":    ["contatti","giuseppe","email","instagram"],
  "giuseppe":    ["contatti","email","instagram","supporto"],
  "iusmk":       ["contatti","sito","chi","barber","giuseppe"],
  "assistenza":  ["supporto","contatti","giuseppe"],
  "aiuto":       ["supporto","assistenza","contatti"],
  "email":       ["contatti","giuseppe","supporto"],
  "instagram":   ["contatti","giuseppe","social"],
  "telefono":    ["contatti","giuseppe","home","schermata"],

  // prenotazioni
  "prenotare":   ["prenotazione","appuntamento","taglio","booking","sito"],
  "prenotazione":["prenotare","appuntamento","tagli","sito"],
  "prenotazioni":["prenotare","appuntamento","tagli","booking"],
  "appuntamento":["prenotazione","prenotare","taglio","booking"],
  "taglio":      ["prenotazione","prenotare","appuntamento","sito","tagli"],
  "tagli":       ["taglio","prenotazione","prenotare"],
  "booking":     ["prenotazione","prenotare","appuntamento"],
  "visita":      ["appuntamento","prenotazione","presenza"],
  "fissare":     ["prenotazione","appuntamento","prenotare"],

  // sede / studio / indirizzo / location
  "studio":      ["sede","indirizzo","dove","studio","location","posizione","luogo"],
  "sede":        ["studio","indirizzo","dove","location","posizione","luogo"],
  "indirizzo":   ["sede","studio","dove","location","posizione"],
  "milano":      ["sede","studio","dove","italia","location"],
  "londra":      ["sede","studio","dove","estero","location"],
  "italia":      ["sede","dove","paese","location"],
  "estero":      ["sede","dove","londra","internazionale","location"],
  "location":    ["sede","studio","indirizzo","dove"],
  "luogo":       ["sede","studio","dove","indirizzo"],
  "posizione":   ["sede","studio","dove","indirizzo"],
  "salone":      ["sede","studio","dove","prenotazione"],
  "negozio":     ["sede","studio","dove","prenotazione"],
  "bottega":     ["sede","studio","dove","prenotazione"],
  "apre":        ["sede","studio","dove","orari"],
  "orari":       ["sede","studio","dove","orario"],
  "orario":      ["sede","studio","dove","apre"],
  "abita":       ["sede","dove","giuseppe"],
  "vive":        ["sede","dove","giuseppe"],

  // resi / rimborsi
  "reso":        ["rimborso","restituzione","giuseppe","policy","resi"],
  "resi":        ["reso","rimborso","giuseppe","policy"],
  "rimborso":    ["reso","restituzione","giuseppe","policy"],
  "restituire":  ["reso","rimborso","giuseppe"],
  "restituzione":["reso","rimborso","giuseppe"],
  "soldi":       ["rimborso","reso","pagamento"],
  "indietro":    ["rimborso","reso"],
  "riavere":     ["rimborso","reso","restituzione"],

  // account / login / password
  "account":     ["login","accesso","password","profilo","cliente","registrazione"],
  "login":       ["accesso","account","password","entrare"],
  "password":    ["recupero","accesso","login","account","reset","dimenticata"],
  "recupero":    ["password","accesso","reset","account"],
  "dimenticato": ["password","recupero","accesso","reset"],
  "dimenticata": ["password","recupero","accesso","reset"],
  "reset":       ["password","recupero","accesso","email"],
  "profilo":     ["account","accesso","cliente"],
  "registrarsi": ["account","accesso","registrazione"],
  "registrazione":["account","accesso"],
  "registrati":  ["account","registrazione","accesso"],
  "iscriversi":  ["account","registrazione"],

  // notifiche e push
  "notifiche":   ["notifica","account","codice","cliente","menu","push"],
  "notifica":    ["notifiche","account","codice","push"],
  "messaggi":    ["notifiche","account"],
  "trovare":     ["notifiche","codice","account","menu","sezione"],
  "trovo":       ["notifiche","codice","account","trovare"],
  "trovato":     ["notifiche","codice","account"],
  "push":        ["notifiche","notifica","attivare","abilitare"],
  "attivare":    ["push","notifiche","abilitare","schermata","home"],
  "attivo":      ["attivare","notifiche","push","abilitare"],
  "attiva":      ["attivare","notifiche","push"],
  "abilita":     ["attivare","notifiche","push"],
  "abilitare":   ["attivare","notifiche","push"],
  "ricevere":    ["notifiche","push","account"],

  // home screen / installare app
  "home":        ["schermata","installare","aggiungere","telefono","app","applicazione"],
  "schermata":   ["home","installare","aggiungere","telefono","app"],
  "installare":  ["home","schermata","aggiungere","telefono","app","applicazione"],
  "installo":    ["installare","home","schermata","aggiungere","app"],
  "installa":    ["installare","home","schermata","aggiungere","app"],
  "aggiungere":  ["home","schermata","installare","telefono","app"],
  "aggiungo":    ["aggiungere","home","schermata","installare","app"],
  "aggiungi":    ["aggiungere","home","schermata","installare"],
  "applicazione":["home","schermata","installare","app","aggiungere","telefono"],
  "app":         ["applicazione","home","schermata","installare","aggiungere"],
  "safari":      ["iphone","home","schermata","installare"],
  "chrome":      ["android","home","schermata","installare"],
  "iphone":      ["home","schermata","safari","installare","aggiungere"],
  "android":     ["home","schermata","chrome","installare","aggiungere"],
  "icona":       ["home","schermata","installare","aggiungere","telefono"],
  "condividi":   ["iphone","home","schermata","safari"],

  // download / salvataggio video (policy)
  "scaricare":   ["download","video","corso","salvare","offline","policy"],
  "scarico":     ["scaricare","download","video","corso","offline"],
  "scarica":     ["scaricare","download","video","offline"],
  "scaricarlo":  ["scaricare","download","video","corso","offline"],
  "scaricarli":  ["scaricare","download","corsi","offline"],
  "download":    ["scaricare","salvare","video","corso","offline","policy"],
  "salvare":     ["salva","download","scaricare","video","offline","policy"],
  "salva":       ["salvare","download","scaricare","video","offline"],
  "salvarlo":    ["salvare","download","video","offline"],
  "salvarli":    ["salvare","download","corsi","offline"],
  "registrare":  ["registrazione","video","corso","download","salvare","policy"],
  "registra":    ["registrare","video","corso","download","salvare"],
  "registrarlo": ["registrare","video","download","salvare"],
  "registrali":  ["registrare","video","download","salvare"],
  "offline":     ["scaricare","download","salvare","video","corso","policy"],
  "copiare":     ["download","scaricare","salvare","video","policy"],
  "copia":       ["copiare","download","scaricare","video"],
  "mettere":     ["salvare","download","scaricare","video","home","schermata"],
  "portare":     ["salvare","download","offline","video"],
  "tenere":      ["salvare","download","scaricare","offline"],

  // corsi / contenuti
  "corso":       ["corsi","videocorso","acquisto","codice","accesso","academy"],
  "corsi":       ["corso","videocorso","acquisto","accesso","academy"],
  "videocorso":  ["corso","acquistare","contenuto","video"],
  "video":       ["corso","videocorso","contenuto"],
  "contenuto":   ["corso","videocorso","accesso"],
  "formazione":  ["corso","corsi","barber","academy"],
  "barber":      ["iusmk","giuseppe","corso","tagli"],
  "academy":     ["corsi","corso","formazione","videocorso"],
  "lezione":     ["corso","corsi","videocorso","formazione"],

  // ── English → Italian keyword bridges ────────────────────────────────────────
  // purchase / buy → acquisto
  "buy":         ["acquistare","comprare","acquisto","corso","corsi"],
  "purchase":    ["acquistare","acquisto","corso","comprare"],
  "order":       ["acquisto","acquistare","comprare"],
  "pay":         ["acquistare","pagamento","acquisto"],
  "payment":     ["acquisto","pagamento","comprare"],
  "paid":        ["acquistato","acquisto","pagamento"],

  // course → corso
  "course":      ["corso","corsi","videocorso","accesso","academy"],
  "courses":     ["corsi","corso","videocorso","academy"],
  "class":       ["corso","corsi","formazione","academy"],
  "masterclass": ["corso","corsi","academy","formazione"],
  "lesson":      ["corso","corsi","videocorso","formazione"],

  // code → codice
  "code":        ["codice","accesso","corso","notifiche","sblocco"],
  "unlock":      ["sbloccare","codice","corso","accesso"],

  // access / login → accesso
  "access":      ["accesso","codice","corso","login","entrare"],
  "log":         ["login","accesso","account","password"],
  "sign":        ["registrazione","accesso","account","login"],

  // password → password
  "forgot":      ["password","recupero","reset","dimenticata","accesso"],
  "forgotten":   ["password","recupero","reset","dimenticata"],
  "recover":     ["password","recupero","reset","accesso"],
  "recovery":    ["password","recupero","reset"],

  // account → account
  "profile":     ["account","profilo","accesso"],
  "register":    ["registrarsi","registrazione","account"],
  "registration":["registrazione","account","accesso"],
  "subscribe":   ["registrarsi","account","iscriversi"],
  "signup":      ["registrazione","account","accesso"],

  // notification → notifiche
  "notification":["notifiche","notifica","account","codice"],
  "notifications":["notifiche","notifica","account"],
  "message":     ["notifiche","account","messaggio"],

  // contact → contatti
  "contact":     ["contatti","giuseppe","email","instagram"],
  "reach":       ["contattare","contatti","giuseppe","email"],
  "write":       ["email","contatti","giuseppe","instagram"],

  // booking → prenotazione
  "book":        ["prenotazione","prenotare","appuntamento","booking"],
  "appointment": ["prenotazione","prenotare","appuntamento","booking","taglio"],
  "schedule":    ["prenotazione","prenotare","appuntamento"],
  "reservation": ["prenotazione","prenotare","appuntamento"],
  "haircut":     ["taglio","prenotazione","prenotare","appuntamento","tagli"],

  // refund → reso
  "refund":      ["rimborso","reso","restituzione","giuseppe"],
  "return":      ["reso","rimborso","restituzione"],
  "money":       ["rimborso","reso","pagamento"],

  // site / what is → sito
  "site":        ["sito","menu","sezione"],
  "website":     ["sito","menu","sezione"],
  "page":        ["sito","menu","sezione"],
  "section":     ["menu","sezione","sito"],
};

// ─── Text normalization ───────────────────────────────────────────────────────
export function normalizeText(q: string): string {
  return q.toLowerCase().trim()
    .replace(/[^a-z0-9àèìòùéáíóú ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Extract meaningful tokens ────────────────────────────────────────────────
export function extractTokens(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !IT_STOPWORDS.has(w));
}

// ─── Expand tokens with synonyms ─────────────────────────────────────────────
export function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const tok of tokens) {
    const syns = SYNONYMS[tok];
    if (syns) syns.forEach((s) => expanded.add(s));
  }
  return Array.from(expanded);
}

// ─── Input sanitisation ───────────────────────────────────────────────────────
export function sanitizeInput(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\[?(system|assistant|user)\]?:/gi, "")
    .replace(/```/g, "")
    .trim()
    .slice(0, 500);
}

// ─── Intent detection ─────────────────────────────────────────────────────────
// Returns list of KB categories to boost for this query type
export function detectIntentCategories(question: string): string[] {
  const q = question.toLowerCase();

  // sede / studio / indirizzo / location (IT + EN) — PRIMO blocco per evitare falsi positivi
  // NON usa "dove" generico: cattura solo domande di localizzazione fisica
  if (/\bstudio\b|\bsede\b|\bindirizzo\b|dove.*iusmk|dove.*giuseppe|dove.*lavora|dove.*si.trova|dove.*abita|dove.*vive|dove.*apre|dove.*opera|dove.*riceve|dov.è.*iusmk|dov.è.*giuseppe|milano|londra|\blocation\b|\bsalone\b|\bnegozio\b|\bbottega\b|orari.*apertura|orario.*apertura|apertura.*orari|dove.*città|in.*quale.*città|quale.*città|where.*iusmk|where.*giuseppe|where.*studio|where.*located|\baddress\b|\bcity\b/.test(q)) {
    return ["sede", "contatti"];
  }

  // push notifications (IT + EN) — must check BEFORE generic notifiche block
  if (/attiv.*notif|notif.*push|push.*notif|abili.*notif|attivo.*notif|attiva.*notif|ricevi.*notif|dove.*attiv|come.*attiv.*notif|come.*ricevo|come.*abilit|enable.*notif|turn.*on.*notif|activate.*notif/.test(q)) {
    return ["notifiche", "push"];
  }

  // home screen / install as app (IT + EN)
  if (/home|schermata|schermata.*inizi|aggiungo.*sito|aggiungi.*sito|aggiung.*home|installo.*sito|installa.*sito|installare.*sito|mett.*home|mett.*app|usare.*app|come.*app|applicaz|icona.*telefono|telefono.*icona|safari|chrome.*menu|aggiungo.*applic|come.*installo|come.*aggiungo|add.*home|install.*app|add.*screen/.test(q)) {
    return ["sito", "home-screen"];
  }

  // download / salvataggio / registrazione video (IT + EN)
  // Controllato PRIMA del blocco password perché "registr" appare in entrambi
  if (/scaric|download|salvar|salvare|salvo|salva\b|registr.*(video|corso|film)|(video|corso|film).*registr|offline|copiare.*video|video.*copi|screen.?record|mett.*video|portare.*offline|vedere.*offline|guardare.*offline/.test(q)) {
    return ["download", "policy"];
  }

  // password / login / account / registrazione  (IT + EN)
  if (/password|dimenticat|recuper|reset|accedi|login|registr|account|iscri|profilo|non.*entr|entra.*non|forgot|forgotten|recover|sign.?in|sign.?up/.test(q)) {
    return ["password", "accesso", "account"];
  }

  // corsi / codice / acquisto / notifiche / sblocco  (IT + EN)
  if (/corso|corsi|codice|comprar|acquist|notif|sblocc|video|academy|formazione|dove.*compro|come.*compro|come.*acquist|buy|purchase|course|courses|unlock|code|lesson|class|masterclass|notification/.test(q)) {
    return ["corsi", "accesso", "notifiche"];
  }

  // reso / rimborso  (IT + EN)
  if (/reso|resi|rimborso|restituz|indietro|riavere.*soldi|soldi.*indietro|refund|return|money.?back/.test(q)) {
    return ["policy"];
  }

  // contatti  (IT + EN)
  if (/contatt|giuseppe|whatsapp|telefon|email|instagram|scrivere|chiamare|parlare.*con|contact|reach|write.*to/.test(q)) {
    return ["contatti"];
  }

  // prenotazioni  (IT + EN)
  if (/prenotar|prenotaz|appuntament|taglio|tagli|booking|fissare|visita|book.*appointment|appointment|schedule|haircut|reservation/.test(q)) {
    return ["prenotazioni", "sito"];
  }

  return [];
}

// ─── Weighted score for a KB row ─────────────────────────────────────────────
// title     = 4 pts per token (+ 3 bonus for original)
// keywords  = 3 pts per token (+ 2 bonus for original)
// content   = 1 pt  per token
// category  = 2 pt  per token (+ intent bonus below)
export function scoreRow(
  row: { title: string; content: string; keywords: string | null; category: string | null },
  originalTokens: string[],
  expandedTokens: string[],
  boostedCategories: string[] = []
): number {
  const title    = row.title.toLowerCase();
  const keywords = (row.keywords ?? "").toLowerCase();
  const content  = row.content.toLowerCase();
  const category = (row.category ?? "").toLowerCase();

  let score = 0;

  // Expanded token matching (with synonyms)
  for (const tok of expandedTokens) {
    if (title.includes(tok))    score += 4;
    if (keywords.includes(tok)) score += 3;
    if (content.includes(tok))  score += 1;
    if (category.includes(tok)) score += 2;
  }

  // Original token bonus (exact user words get extra weight)
  for (const tok of originalTokens) {
    if (title.includes(tok))    score += 3;
    if (keywords.includes(tok)) score += 2;
    if (content.includes(tok))  score += 1;
  }

  // Intent category boost: entries in the detected intent category get +8
  if (boostedCategories.length > 0 && boostedCategories.includes(category)) {
    score += 8;
  }

  return score;
}

// ─── Main KB search function ──────────────────────────────────────────────────
export type KBResult = typeof knowledgeBaseTable.$inferSelect & { score: number };

export async function searchKB(
  question: string,
  debugLog?: (msg: string) => void
): Promise<KBResult[]> {
  const log = debugLog ?? (() => {});

  const originalTokens = extractTokens(question);
  const expandedTokens = expandTokens(originalTokens);
  const intentCategories = detectIntentCategories(question);

  log(`[KB] Original tokens: [${originalTokens.join(", ")}]`);
  log(`[KB] Expanded tokens:  [${expandedTokens.join(", ")}]`);
  log(`[KB] Intent categories: [${intentCategories.join(", ")}]`);

  if (!expandedTokens.length) {
    log("[KB] No tokens after normalization → no results");
    return [];
  }

  const allRows = await db
    .select()
    .from(knowledgeBaseTable)
    .where(
      and(
        eq(knowledgeBaseTable.isPublished, true),
        eq(knowledgeBaseTable.isActive,    true)
      )
    );

  log(`[KB] Total active+published entries: ${allRows.length}`);

  const scored = allRows
    .map((row) => ({ ...row, score: scoreRow(row, originalTokens, expandedTokens, intentCategories) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  log(`[KB] Entries with score > 0: ${scored.length}`);
  scored.slice(0, 8).forEach((r) =>
    log(`[KB]   score=${r.score} → "${r.title}" [${r.category}]`)
  );

  // Return top 5 most relevant results
  return scored.slice(0, 5) as KBResult[];
}

export const MIN_SCORE_THRESHOLD = 3;

// ─── Context builder ──────────────────────────────────────────────────────────
export function buildContext(items: KBResult[]): string {
  // Deduplicate by content similarity (skip exact content duplicates)
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const key = i.content.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique
    .map((i) => `### ${i.title} [${i.category}]\n${i.content}`)
    .join("\n\n---\n\n");
}

// ─── System prompt builder ────────────────────────────────────────────────────
export function buildSystemPrompt(context: string, language: "it" | "en" = "it"): string {
  const langRule = language === "en"
    ? `LANGUAGE RULE (MANDATORY): You MUST reply ONLY in English, regardless of the language of the knowledge base content.
If the knowledge base content is in Italian, translate your final answer into English without inventing details.
Never mix languages. Never reply in Italian when the site is set to English.`
    : `REGOLA LINGUA (OBBLIGATORIA): Rispondi SEMPRE e SOLO in italiano.
Anche se il contenuto della knowledge base fosse in inglese, traduci la risposta finale in italiano senza inventare dettagli.
Non mescolare le lingue.`;

  if (language === "en") {
    return `You are the virtual customer assistant for the IUSMK website.

${langRule}

Reply EXCLUSIVELY using the information present in the CONTEXT below.
Do not invent. Do not add external details. Do not use general knowledge not present in the context.

ABSOLUTE RULES — NEVER VIOLATE:
- NEVER invent addresses, cities, physical studios, operating locations, phone numbers, prices or timetables.
- NEVER say that IUSMK has a studio in Milan, London or any other city unless the site explicitly states it.
- NEVER say that the site allows booking haircut appointments.
- If a piece of information is not in the context, say: "I can't find this information on the site. I recommend using the Contact section to get a direct answer."
- For any question about downloading, saving or recording courses: always answer that it is NOT allowed.
- For refund questions: always say they are evaluated case by case by Giuseppe.

BEFORE ANSWERING:
- Identify the precise customer request
- Use ALL relevant information in the context
- If multiple entries complement each other, combine them into one coherent answer
- Reply in a direct, clear and COMPLETE manner
- Never leave sentences unfinished
- Never give vague answers
- Do not list irrelevant information
- If the question has multiple parts, answer all of them if the context allows

RESPONSE RULES:
- If the customer asks how to buy a course: explain where to go, that it is purchased on the site, and that after purchase a code arrives in the notifications to unlock the course
- If the customer asks about a forgotten password: explain only the password reset process, not registration
- If the customer asks about a course code not found: explain to check the account notifications and make sure they are logged in
- If the customer asks about returns/refunds: explain that they must contact Giuseppe directly and he will decide case by case
- If the customer asks about bookings: clearly explain that the site does NOT manage appointments
- If the customer asks about contacts: indicate email, Instagram and the Contact section of the menu (NO WhatsApp, NO phone)
- If the customer asks about a physical location/studio/address: say the site does not indicate a public physical studio, and invite them to use the Contact section

STYLE:
- Direct, concise but complete, friendly response in natural English
- Never cite the "entries" or "context" in the response
- Do not use phrases like "based on available information"
- Speak as the IUSMK website assistant
- MANDATORY: ALWAYS reply with text. Never be silent. If the answer is "no" or "not possible", still write a complete explanatory sentence.
- If the context only contains a partial answer, use it and indicate that for further details the customer can use the Contact section of the site

KNOWLEDGE BASE CONTEXT:
${context}`;
  }

  return `Sei l'assistente virtuale clienti del sito IUSMK.

${langRule}

Rispondi ESCLUSIVAMENTE usando le informazioni presenti nel CONTESTO qui sotto.
Non inventare. Non aggiungere dettagli esterni. Non usare conoscenza generale non presente nel contesto.

REGOLE ASSOLUTE — NON VIOLARE MAI:
- NON inventare mai indirizzi, città, studi fisici, sedi operative, numeri di telefono, prezzi o orari.
- NON dire mai che IUSMK ha uno studio a Milano, a Londra o in qualsiasi altra città, a meno che il sito non lo indichi esplicitamente.
- NON dire mai che dal sito si possono prenotare tagli o appuntamenti.
- Se un'informazione non è nel contesto, di': "Non trovo questa informazione sul sito. Ti consiglio di usare la sezione Contatto per ricevere una risposta diretta."
- Per domande su download, salvataggio o registrazione dei corsi: rispondi sempre che non è consentito.
- Per domande su rimborsi: rispondi sempre che vengono valutati caso per caso da Giuseppe.

PRIMA DI RISPONDERE:
- Identifica la richiesta precisa del cliente
- Usa TUTTE le informazioni pertinenti presenti nel contesto
- Se più voci si completano tra loro, combina le informazioni in un'unica risposta coerente
- Rispondi in modo diretto, chiaro e COMPLETO
- Non lasciare frasi a metà
- Non dare risposte vaghe
- Non elencare informazioni inutili non richieste
- Se la domanda contiene più parti, rispondi a tutte le parti se il contesto lo consente

REGOLE DI RISPOSTA:
- Se il cliente chiede come comprare un corso: spiega dove andare, che si acquista sul sito, e che dopo l'acquisto arriva un codice nelle notifiche per sbloccare il corso
- Se il cliente chiede di password dimenticata: spiega solo il processo di reset password, non la registrazione
- Se il cliente chiede del codice del corso non trovato: spiega di controllare le notifiche dell'account e di verificare di essere loggato
- Se il cliente chiede di resi/rimborsi: spiega che deve contattare Giuseppe direttamente e che sarà lui a decidere caso per caso
- Se il cliente chiede di prenotazioni: spiega chiaramente che il sito NON gestisce prenotazioni
- Se il cliente chiede di contatti: indica email, Instagram e sezione Contatto del menu (NO WhatsApp, NO telefono)
- Se il cliente chiede dello studio fisico, della sede o dell'indirizzo: di' che il sito non indica uno studio fisico aperto al pubblico e invita a usare la sezione Contatto

STILE:
- Risposta diretta, sintetica ma completa, cordiale, in italiano naturale
- Non citare mai le "voci" o il "contesto" nella risposta
- Non usare frasi come "in base alle informazioni disponibili"
- Parla come l'assistente del sito IUSMK
- OBBLIGATORIO: rispondi SEMPRE con del testo. Non restare mai in silenzio. Se la risposta è "no" o "non è possibile", scrivi comunque una frase esplicativa completa.
- Se il contesto contiene solo una risposta parziale, usa quella e indica che per ulteriori dettagli il cliente può usare la sezione Contatto del sito

CONTESTO KNOWLEDGE BASE:
${context}`;
}
