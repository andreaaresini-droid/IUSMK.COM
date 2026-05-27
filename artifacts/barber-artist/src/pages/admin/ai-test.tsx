import { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { fetchApi } from "@/lib/api-client";
import { FlaskConical, Send, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";

interface KBMatch {
  id: number;
  title: string;
  category: string;
  keywords: string;
  score: number;
  contentPreview: string;
}

interface TestResult {
  sanitized: string;
  normalized: string;
  originalTokens: string[];
  expandedTokens: string[];
  threshold: number;
  topScore: number;
  hasContext: boolean;
  kbMatches: KBMatch[];
  debugLog: string[];
  systemPromptUsed: string | null;
  aiAnswer: string;
}

export default function AdminAiTest() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const SAMPLE_QUESTIONS = [
    "come compro un corso",
    "come mi contatto con giuseppe",
    "dove trovo il codice del corso",
    "posso prenotare un taglio",
    "come recupero la password",
    "qual è il numero di telefono",
    "cosa succede dopo l'acquisto",
    "dove trovo le notifiche",
  ];

  const runTest = async (q?: string) => {
    const query = (q ?? question).trim();
    if (!query) return;
    if (q) setQuestion(q);
    setLoading(true);
    setResult(null);
    setError(null);
    setShowPrompt(false);
    setShowDebug(false);
    try {
      const data = await fetchApi<TestResult>("/admin/ai/test", {
        method: "POST",
        body: JSON.stringify({ question: query }),
      });
      setResult(data);
    } catch {
      setError("Errore durante il test. Controlla che il server sia attivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[hsl(0,84%,45%)]/20 border border-[hsl(0,84%,45%)]/30 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-[hsl(0,84%,45%)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Test Assistente AI</h1>
              <p className="text-white/50 text-sm">Verifica in tempo reale come l'AI interpreta e risponde alle domande</p>
            </div>
          </div>

          {/* Input */}
          <div className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-6">
            <form onSubmit={(e) => { e.preventDefault(); runTest(); }} className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Scrivi una domanda come la scriverebbe un cliente…"
                disabled={loading}
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[hsl(0,84%,45%)]/60 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="px-5 py-3 bg-[hsl(0,84%,45%)] hover:bg-[hsl(0,84%,38%)] rounded-xl text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {loading ? (
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                ) : (
                  <><Send className="w-4 h-4" /> Testa</>
                )}
              </button>
            </form>

            {/* Sample questions */}
            <div className="mt-4">
              <p className="text-xs text-white/30 mb-2">Domande di esempio:</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => runTest(q)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/8 disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">

              {/* Status banner */}
              <div className={`rounded-2xl p-5 border flex items-start gap-4 ${
                result.hasContext
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-orange-500/10 border-orange-500/30"
              }`}>
                {result.hasContext
                  ? <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                  : <AlertCircle   className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">
                    {result.hasContext ? "Contesto KB trovato — risposta AI generata" : "Nessun contesto KB sufficiente — fallback attivato"}
                  </p>
                  <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{result.aiAnswer}</p>
                </div>
              </div>

              {/* Token analysis */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Token originali</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.originalTokens.length > 0
                      ? result.originalTokens.map((t) => (
                          <span key={t} className="px-2 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs border border-blue-500/20">{t}</span>
                        ))
                      : <span className="text-white/30 text-xs">Nessuno</span>
                    }
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Token espansi (sinonimi)</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.expandedTokens
                      .filter((t) => !result.originalTokens.includes(t))
                      .map((t) => (
                        <span key={t} className="px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs border border-purple-500/20">{t}</span>
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* KB Matches */}
              <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Voci KB trovate</h3>
                  <span className="text-xs text-white/40">Soglia minima: {result.threshold} pt</span>
                </div>
                {result.kbMatches.length === 0 ? (
                  <p className="text-white/30 text-sm">Nessuna voce KB sopra la soglia.</p>
                ) : (
                  <div className="space-y-3">
                    {result.kbMatches.map((m) => (
                      <div key={m.id} className={`rounded-xl p-4 border ${
                        m.score >= result.threshold
                          ? "bg-green-500/8 border-green-500/20"
                          : "bg-white/4 border-white/8 opacity-60"
                      }`}>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-medium">{m.title}</p>
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                            m.score >= result.threshold
                              ? "bg-green-500/20 text-green-400"
                              : "bg-white/10 text-white/40"
                          }`}>
                            {m.score} pt
                          </span>
                        </div>
                        <p className="text-xs text-white/40 mb-1">
                          <span className="text-white/25">Categoria:</span> {m.category} &nbsp;|&nbsp;
                          <span className="text-white/25">Keywords:</span> {m.keywords || "—"}
                        </p>
                        <p className="text-xs text-white/50 line-clamp-2">{m.contentPreview}…</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System prompt (collapsible) */}
              {result.systemPromptUsed && (
                <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setShowPrompt((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-white/4 transition-colors"
                  >
                    <span>System Prompt usato</span>
                    {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showPrompt && (
                    <pre className="px-5 pb-5 text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed border-t border-white/8 pt-4">
                      {result.systemPromptUsed}
                    </pre>
                  )}
                </div>
              )}

              {/* Debug log (collapsible) */}
              <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-white/4 transition-colors"
                >
                  <span>Log debug ({result.debugLog.length} righe)</span>
                  {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showDebug && (
                  <div className="px-5 pb-5 border-t border-white/8 pt-4">
                    {result.debugLog.map((line, i) => (
                      <p key={i} className="text-xs text-white/50 font-mono leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
