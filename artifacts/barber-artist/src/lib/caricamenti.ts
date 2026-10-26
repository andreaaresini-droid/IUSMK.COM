import { useSyncExternalStore } from "react";

/**
 * 26/10 (Andrea): i caricamenti di foto e video non si devono fermare se si
 * cambia sezione o se il telefono va in sottofondo.
 *
 * Qui vivono FUORI dalle pagine (a livello di modulo): la pagina avvia il
 * lavoro con `avviaCaricamento`, poi può anche sparire; il lavoro continua,
 * salva nel database e l'indicatore in basso (IndicatoreCaricamenti, montato
 * in App) mostra «Caricamento… 60%» ovunque si trovi la persona.
 * Se la rete cade mentre l'app è in sottofondo, si riprova da soli al ritorno.
 */

export type StatoCaricamento = "in-corso" | "attesa-rete" | "fatto" | "errore";

export interface Caricamento {
  id: number;
  etichetta: string;
  passo: string;
  percento: number;
  stato: StatoCaricamento;
  errore?: string;
}

export interface ControlloCaricamento {
  /** 0–100 del passo in corso */
  avanzamento: (percento: number) => void;
  /** testo del passo in corso, es. «Caricamento video 1 di 2…» */
  passo: (testo: string) => void;
}

let elenco: Caricamento[] = [];
let prossimoId = 1;
const ascoltatori = new Set<() => void>();

function avvisa() {
  ascoltatori.forEach((fn) => fn());
}

function aggiorna(id: number, cambi: Partial<Caricamento>) {
  elenco = elenco.map((c) => (c.id === id ? { ...c, ...cambi } : c));
  avvisa();
}

export function togliCaricamento(id: number) {
  elenco = elenco.filter((c) => c.id !== id);
  avvisa();
}

export function useCaricamenti(): Caricamento[] {
  return useSyncExternalStore(
    (fn) => { ascoltatori.add(fn); return () => { ascoltatori.delete(fn); }; },
    () => elenco,
    () => elenco,
  );
}

export function caricamentiInCorso(): boolean {
  return elenco.some((c) => c.stato === "in-corso" || c.stato === "attesa-rete");
}

// Solo se la persona chiude o ricarica la pagina durante un caricamento.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (!caricamentiInCorso()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/** Il caricamento in corso (per sapere a chi segnalare «attesa rete»). */
let attivoCorrente: number | null = null;

/**
 * Avvia un lavoro di caricamento che sopravvive alla pagina.
 * Ritorna la stessa promessa del lavoro: la pagina, se è ancora aperta,
 * può aspettarla per aggiornare il suo stato; se non c'è più, pazienza.
 */
export function avviaCaricamento<T>(
  etichetta: string,
  lavoro: (c: ControlloCaricamento) => Promise<T>,
): Promise<T> {
  const id = prossimoId++;
  elenco = [...elenco, { id, etichetta, passo: "", percento: 0, stato: "in-corso" }];
  avvisa();

  const controllo: ControlloCaricamento = {
    avanzamento: (p) => {
      attivoCorrente = id;
      aggiorna(id, { percento: Math.max(0, Math.min(100, Math.round(p))), stato: "in-corso" });
    },
    passo: (testo) => {
      attivoCorrente = id;
      aggiorna(id, { passo: testo, stato: "in-corso" });
    },
  };

  attivoCorrente = id;
  return lavoro(controllo).then(
    (risultato) => {
      aggiorna(id, { stato: "fatto", percento: 100, passo: "" });
      setTimeout(() => togliCaricamento(id), 4000);
      return risultato;
    },
    (err: any) => {
      aggiorna(id, { stato: "errore", errore: err?.message || "Caricamento non riuscito." });
      setTimeout(() => togliCaricamento(id), 15000);
      throw err;
    },
  );
}

// ─── Rete: riprovare da soli ──────────────────────────────────────────────────

/** Errore di rete (non una risposta del server): si può riprovare. */
export class ErroreRete extends Error {}

const TENTATIVI_MASSIMI = 3;

/** Aspetta che la pagina sia visibile e il telefono in rete. */
function aspettaVisibileEInRete(): Promise<void> {
  return new Promise((resolve) => {
    const pronto = () =>
      document.visibilityState === "visible" && (typeof navigator === "undefined" || navigator.onLine !== false);
    if (pronto()) { resolve(); return; }
    const controlla = () => {
      if (!pronto()) return;
      document.removeEventListener("visibilitychange", controlla);
      window.removeEventListener("online", controlla);
      resolve();
    };
    document.addEventListener("visibilitychange", controlla);
    window.addEventListener("online", controlla);
  });
}

/**
 * Esegue `tentativo`; se fallisce per la rete (es. app in sottofondo), aspetta
 * che la pagina torni visibile e in rete e riprova, al massimo 3 volte in tutto.
 */
export async function conRitenta<T>(tentativo: (numero: number) => Promise<T>): Promise<T> {
  for (let numero = 1; ; numero++) {
    try {
      return await tentativo(numero);
    } catch (err) {
      if (!(err instanceof ErroreRete) || numero >= TENTATIVI_MASSIMI) throw err;
      const id = attivoCorrente;
      if (id !== null) aggiorna(id, { stato: "attesa-rete" });
      await aspettaVisibileEInRete();
      await new Promise((r) => setTimeout(r, 1000 * numero));
      if (id !== null) aggiorna(id, { stato: "in-corso" });
    }
  }
}

// ─── Caricamenti veri ─────────────────────────────────────────────────────────

const apiBase = () => (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const token = () => localStorage.getItem("barber_artist_token") || "";

function xhr(
  metodo: "POST" | "PUT",
  url: string,
  corpo: XMLHttpRequestBodyInit,
  intestazioni: Record<string, string>,
  avanzamento: (p: number) => void,
): Promise<{ stato: number; testo: string }> {
  return new Promise((resolve, reject) => {
    const r = new XMLHttpRequest();
    r.open(metodo, url);
    Object.entries(intestazioni).forEach(([k, v]) => r.setRequestHeader(k, v));
    r.upload.onprogress = (e) => {
      if (e.lengthComputable) avanzamento(Math.round((e.loaded / e.total) * 100));
    };
    r.onload = () => resolve({ stato: r.status, testo: r.responseText });
    r.onerror = () => reject(new ErroreRete("Errore di rete. Controlla la connessione e riprova."));
    r.onabort = () => reject(new ErroreRete("Caricamento interrotto."));
    r.send(corpo);
  });
}

function messaggioErrore(testo: string, ripiego: string): string {
  try { return JSON.parse(testo).error || ripiego; } catch { return ripiego; }
}

/**
 * Carica un file passando dal server (POST /api/upload/image o /video, max 4 MB).
 * Ritorna la risposta del server ({ url, thumbnailUrl? ... }).
 */
export function caricaSulServer(
  file: File,
  tipo: "image" | "video",
  avanzamento: (p: number) => void,
): Promise<{ url: string; thumbnailUrl?: string }> {
  return conRitenta(async () => {
    const fd = new FormData();
    fd.append("file", file);
    const { stato, testo } = await xhr("POST", `${apiBase()}/api/upload/${tipo}`, fd,
      { Authorization: `Bearer ${token()}` }, avanzamento);
    if (stato >= 200 && stato < 300) {
      try { return JSON.parse(testo); } catch { throw new Error("Risposta non valida dal server."); }
    }
    throw new Error(messaggioErrore(testo, `Errore ${stato} durante il caricamento.`));
  });
}

/** Immagine via server: ritorna l'URL. */
export async function caricaImmagine(file: File, avanzamento: (p: number) => void): Promise<string> {
  return (await caricaSulServer(file, "image", avanzamento)).url;
}

/**
 * Video grande: il server prepara un indirizzo firmato di Supabase e il file va
 * lì direttamente (niente limite di 4,5 MB di Vercel). Ritorna il path da salvare.
 */
export async function caricaVideo(file: File, avanzamento: (p: number) => void): Promise<string> {
  avanzamento(1);
  const { resumableUri, finalUrl } = await conRitenta(async () => {
    let res: Response;
    try {
      res = await fetch(`${apiBase()}/api/upload/video/resumable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
    } catch {
      throw new ErroreRete("Errore di rete. Controlla la connessione e riprova.");
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || "Errore nell'avvio dell'upload video.");
    }
    return res.json() as Promise<{ resumableUri: string; finalUrl: string }>;
  });

  await conRitenta(async (numero) => {
    const { stato, testo } = await xhr("PUT", resumableUri, file,
      { "Content-Type": file.type }, (p) => avanzamento(1 + Math.round(p * 0.98)));
    if (stato >= 200 && stato < 300) return;
    // Al secondo tentativo il file può essere già arrivato col primo
    // (si era persa solo la risposta): Supabase dice «esiste già».
    if (numero > 1 && (stato === 409 || /exists|duplicate/i.test(testo))) return;
    throw new Error(`Errore ${stato} durante il caricamento del video.`);
  });

  avanzamento(100);
  return finalUrl;
}
