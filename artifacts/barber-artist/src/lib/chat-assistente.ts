import { useSyncExternalStore } from "react";

/**
 * 26/10 (Andrea): le domande all'assistente non si devono perdere se si cambia
 * sezione o se il telefono va in sottofondo.
 *
 * La conversazione e la domanda in attesa vivono qui, fuori dal widget, e sono
 * copiate in sessionStorage: anche ricaricando la pagina si vede «sta
 * pensando…» e poi la risposta, senza rifare la domanda.
 * Il server salva la risposta nel log prima di rispondere; se la risposta
 * diretta si perde (rete caduta in sottofondo), qui si va a prenderla con
 * GET /api/ai/chat/answer, ogni pochi secondi solo a pagina visibile.
 */

export interface MessaggioChat {
  id: string;
  role: "assistant" | "user";
  content: string;
  confidence?: "high" | "low" | "error";
}

interface DomandaInAttesa {
  domanda: string;
  rispostaId: string;   // id del messaggio «sta pensando…»
  lingua: "it" | "en";
  pagina: string;
  inviataAlle: number;
  tentativi: number;
}

interface StatoChat {
  messaggi: MessaggioChat[];
  inAttesa: DomandaInAttesa | null;
}

const CHIAVE = "iusmk_chat_stato";
const OGNI_MS = 3000;
// Il server ha al massimo 60 s: oltre questo la risposta non arriverà più.
const RIPROVA_DOPO_MS = 75_000;
const TENTATIVI_MASSIMI = 2;

const apiBase = () => (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function getSessionId(): string {
  let sid = sessionStorage.getItem("iusmk_chat_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("iusmk_chat_sid", sid); }
  return sid;
}

function leggiStato(): StatoChat {
  try {
    const s = sessionStorage.getItem(CHIAVE);
    if (s) {
      const p = JSON.parse(s) as StatoChat;
      if (Array.isArray(p.messaggi)) return { messaggi: p.messaggi, inAttesa: p.inAttesa ?? null };
    }
  } catch { /* ignore */ }
  return { messaggi: [], inAttesa: null };
}

let stato: StatoChat = typeof window !== "undefined" ? leggiStato() : { messaggi: [], inAttesa: null };
const ascoltatori = new Set<() => void>();

function cambia(nuovo: StatoChat) {
  stato = nuovo;
  try { sessionStorage.setItem(CHIAVE, JSON.stringify(stato)); } catch { /* ignore */ }
  ascoltatori.forEach((fn) => fn());
}

export function useChatAssistente(): StatoChat {
  return useSyncExternalStore(
    (fn) => { ascoltatori.add(fn); return () => { ascoltatori.delete(fn); }; },
    () => stato,
    () => stato,
  );
}

function testi(lingua: "it" | "en") {
  return lingua === "en"
    ? {
        fallback: "At the moment I'm not able to provide this information with certainty. I've forwarded your request to the team.",
        errore:   "An error occurred. Please try again in a moment.",
      }
    : {
        fallback: "Al momento non sono in grado di darti questa informazione con certezza. Ho segnalato la tua richiesta al team.",
        errore:   "Si è verificato un errore. Riprova tra un momento.",
      };
}

/** Mette la risposta al posto di «sta pensando…» (una volta sola). */
function completa(rispostaId: string, content: string, confidence: "high" | "low" | "error") {
  if (stato.inAttesa?.rispostaId !== rispostaId) return;
  cambia({
    messaggi: stato.messaggi.map((m) => (m.id === rispostaId ? { ...m, content, confidence } : m)),
    inAttesa: null,
  });
}

/** Manda la domanda in attesa al server. Se la rete cade, ci pensa `controlla`. */
async function invia(attesa: DomandaInAttesa) {
  const t = testi(attesa.lingua);
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question:  attesa.domanda,
        sessionId: getSessionId(),
        pageUrl:   attesa.pagina,
        language:  attesa.lingua,
      }),
    });
  } catch {
    // Rete persa (spesso: telefono in tasca). La risposta, se il server l'ha
    // preparata, si recupera dal log appena la pagina torna visibile.
    return;
  }
  if (!res.ok) {
    completa(attesa.rispostaId, t.errore, "error");
    return;
  }
  try {
    const json = (await res.json()) as { answer?: string; confidence?: string };
    completa(
      attesa.rispostaId,
      json.answer || t.fallback,
      (json.confidence as "high" | "low" | "error") ?? "low",
    );
  } catch {
    // Corpo perso a metà: come sopra, lo si recupera dal log.
  }
}

let controlloInCorso = false;

/** Chiede al server se la risposta è pronta; dopo troppo tempo riprova una volta. */
async function controlla() {
  const attesa = stato.inAttesa;
  if (!attesa || controlloInCorso) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  controlloInCorso = true;
  const t = testi(attesa.lingua);
  try {
    const q = new URLSearchParams({ sessionId: getSessionId(), question: attesa.domanda });
    const res = await fetch(`${apiBase()}/api/ai/chat/answer?${q}`);
    if (res.ok) {
      const json = (await res.json()) as { status: string; answer?: string; confidence?: string };
      if (json.status === "ready") {
        completa(attesa.rispostaId, json.answer || t.fallback, (json.confidence as "high" | "low") ?? "high");
        return;
      }
      if (json.status === "error") {
        completa(attesa.rispostaId, t.errore, "error");
        return;
      }
    }
    // Ancora niente. Oltre il tempo massimo del server la domanda è andata
    // persa per strada: la si rifà da soli, una volta.
    if (Date.now() - attesa.inviataAlle > RIPROVA_DOPO_MS) {
      if (attesa.tentativi >= TENTATIVI_MASSIMI) {
        completa(attesa.rispostaId, t.errore, "error");
      } else {
        const nuova = { ...attesa, tentativi: attesa.tentativi + 1, inviataAlle: Date.now() };
        cambia({ ...stato, inAttesa: nuova });
        void invia(nuova);
      }
    }
  } catch {
    // Rete ancora assente: si riprova al prossimo giro.
  } finally {
    controlloInCorso = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Finché c'è una domanda in attesa: controllo ogni pochi secondi (solo a pagina visibile). */
function sorveglia() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => {
    if (!stato.inAttesa) {
      clearInterval(timer!);
      timer = null;
      return;
    }
    // I primi secondi la risposta arriva di solito direttamente.
    if (Date.now() - stato.inAttesa.inviataAlle < 8000) return;
    void controlla();
  }, OGNI_MS);
}

if (typeof document !== "undefined") {
  // Tornando nell'app o nella scheda: si controlla subito.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && stato.inAttesa) void controlla();
  });
  // Pagina ricaricata con una domanda ancora in attesa: si riprende ad aspettare.
  if (stato.inAttesa) sorveglia();
}

export function inviaDomanda(testo: string, lingua: "it" | "en") {
  const q = testo.trim();
  if (!q || stato.inAttesa) return;
  const ora = Date.now();
  const rispostaId = `${ora}-r`;
  const attesa: DomandaInAttesa = {
    domanda: q,
    rispostaId,
    lingua,
    pagina: window.location.pathname,
    inviataAlle: ora,
    tentativi: 1,
  };
  cambia({
    messaggi: [
      ...stato.messaggi,
      { id: `${ora}-d`, role: "user", content: q },
      { id: rispostaId, role: "assistant", content: "", confidence: "high" },
    ],
    inAttesa: attesa,
  });
  sorveglia();
  void invia(attesa);
}
