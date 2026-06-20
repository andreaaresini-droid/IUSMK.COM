import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const BTN       = 56;   // button size px (w-14)
const MARGIN    = 12;   // min distance from viewport edges
const THRESHOLD = 6;    // px movement to consider it a drag vs a click
const LS_KEY    = "iusmk_chat_btn_pos";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SavedPos { x: number; y: number }

function clampPos(x: number, y: number): SavedPos {
  const maxX = window.innerWidth  - BTN - MARGIN;
  const maxY = window.innerHeight - BTN - MARGIN;
  return {
    x: Math.max(MARGIN, Math.min(x, maxX)),
    y: Math.max(MARGIN, Math.min(y, maxY)),
  };
}

function snapX(x: number): number {
  const mid = window.innerWidth / 2;
  return x + BTN / 2 < mid ? MARGIN : window.innerWidth - BTN - MARGIN;
}

function loadPos(): SavedPos {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      const p = JSON.parse(s) as SavedPos;
      if (typeof p.x === "number" && typeof p.y === "number") {
        return clampPos(p.x, p.y);
      }
    }
  } catch { /* ignore */ }
  // Default: bottom-right
  return {
    x: window.innerWidth  - BTN - MARGIN,
    y: window.innerHeight - BTN - MARGIN,
  };
}

function savePos(p: SavedPos) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ─── URL renderer (unchanged) ─────────────────────────────────────────────────

const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TEST_REGEX  = /^https?:\/\/[^\s]+$/;

function renderWithLinks(text: string) {
  const parts = text.split(URL_SPLIT_REGEX);
  return parts.map((part, i) =>
    URL_TEST_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-[#FFD600] hover:text-[#FFD600]/80 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("iusmk_chat_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("iusmk_chat_sid", sid); }
  return sid;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  confidence?: "high" | "low" | "error";
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export function AiChatWidget() {
  const { lang, t } = useLang();
  const c = t.chat;

  // ── Chat state ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: c.welcome, confidence: "high" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Update welcome message text when language changes
  useEffect(() => {
    setMessages((m) =>
      m.map((msg) =>
        msg.id === "welcome" ? { ...msg, content: c.welcome } : msg
      )
    );
  }, [lang, c.welcome]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [pos, setPos]           = useState<SavedPos>({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const posRef   = useRef<SavedPos>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const startPt  = useRef({ cx: 0, cy: 0, bx: 0, by: 0 }); // cursor start, btn start

  // Load saved position on mount
  useEffect(() => {
    const p = loadPos();
    posRef.current = p;
    setPos(p);
  }, []);

  // Re-clamp on window resize
  useEffect(() => {
    function onResize() {
      const clamped = clampPos(posRef.current.x, posRef.current.y);
      posRef.current = clamped;
      setPos(clamped);
      savePos(clamped);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function startDrag(cx: number, cy: number) {
    dragging.current = true;
    hasMoved.current = false;
    startPt.current  = { cx, cy, bx: posRef.current.x, by: posRef.current.y };
    setSnapping(false);
  }

  function moveDrag(cx: number, cy: number) {
    if (!dragging.current) return;
    const dx = cx - startPt.current.cx;
    const dy = cy - startPt.current.cy;
    if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
      hasMoved.current = true;
    }
    const newPos = clampPos(
      startPt.current.bx + dx,
      startPt.current.by + dy,
    );
    posRef.current = newPos;
    setPos(newPos);
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;

    if (hasMoved.current) {
      // Snap to nearest edge
      const snappedX = snapX(posRef.current.x);
      const snappedPos = clampPos(snappedX, posRef.current.y);
      posRef.current = snappedPos;
      setSnapping(true);
      setPos(snappedPos);
      savePos(snappedPos);
      setTimeout(() => setSnapping(false), 380);
    }
  }

  // Mouse events (desktop)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) { moveDrag(ev.clientX, ev.clientY); }
    function onMouseUp() {
      endDrag();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // Touch events (mobile)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault(); // prevent page scroll while dragging
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, []);

  const onTouchEnd = useCallback(() => {
    endDrag();
    // If no significant movement → toggle chat (handled by onClick via isMoved)
  }, []);

  // Click handler — only fires if it was not a drag
  const onButtonClick = useCallback(() => {
    if (hasMoved.current) return; // was a drag, ignore
    setOpen((o) => !o);
  }, []);

  // ── Chat panel position ───────────────────────────────────────────────────

  const panelWidth  = Math.min(window.innerWidth - 32, 384);
  const panelHeight = Math.min(520, window.innerHeight - 120);
  const GAP = 8;

  // Vertically: prefer above the button
  let panelTop = pos.y - panelHeight - GAP;
  if (panelTop < MARGIN) {
    panelTop = pos.y + BTN + GAP;
  }
  panelTop = Math.max(MARGIN, Math.min(panelTop, window.innerHeight - panelHeight - MARGIN));

  // Horizontally: align panel with button, clamped to viewport
  let panelLeft = pos.x + BTN - panelWidth;
  panelLeft = Math.max(MARGIN, Math.min(panelLeft, window.innerWidth - panelWidth - MARGIN));

  // ── sendMessage (unchanged logic) ─────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: q };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    const placeholder: Message = { id: assistantId, role: "assistant", content: "", confidence: "high" };
    setMessages((m) => [...m, placeholder]);

    const activeLang = lang;
    const fallbackMsg = activeLang === "en"
      ? "At the moment I'm not able to provide this information with certainty. I've forwarded your request to the team."
      : "Al momento non sono in grado di darti questa informazione con certezza. Ho segnalato la tua richiesta al team.";
    const noAnswerMsg = activeLang === "en"
      ? "No answer available."
      : "Nessuna risposta disponibile.";
    const errorMsg = activeLang === "en"
      ? "An error occurred. Please try again in a moment."
      : "Si è verificato un errore. Riprova tra un momento.";

    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:  q,
          sessionId: getSessionId(),
          pageUrl:   window.location.pathname,
          language:  activeLang,
        }),
      });

      if (!res.ok || !res.body) throw new Error("network error");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      const { done: d0, value: v0 } = await reader.read();
      const firstChunk = d0 ? "" : decoder.decode(v0, { stream: true });

      const trimmed = firstChunk.trimStart();
      const isSSE   = trimmed.startsWith(":") || trimmed.startsWith("data:");

      if (isSSE) {
        let buffer   = firstChunk;
        let fullText = "";
        let confidence: "high" | "low" | "error" = "high";

        const processBuffer = () => {
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullText += data.content;
                setMessages((m) =>
                  m.map((msg) => msg.id === assistantId ? { ...msg, content: fullText } : msg)
                );
              }
              if (data.done) confidence = data.confidence ?? "high";
            } catch { /* skip malformed */ }
          }
        };

        processBuffer();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
        }

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: fullText || noAnswerMsg, confidence }
              : msg
          )
        );
      } else {
        let fullBody = firstChunk;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullBody += decoder.decode(value, { stream: true });
        }
        let json: { answer?: string; confidence?: string };
        try { json = JSON.parse(fullBody); } catch { json = {}; }

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content:    json.answer || fallbackMsg,
                  confidence: (json.confidence as "high" | "low" | "error") ?? "low",
                }
              : msg
          )
        );
      }
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: errorMsg, confidence: "error" }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }, [loading, lang]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating draggable button ── */}
      <button
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onButtonClick}
        aria-label={open ? c.closeLabel : c.openLabel}
        className={cn(
          "fixed z-[9000] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl",
          "bg-[#FFD600] hover:bg-[#FFC400] border border-white/10",
          "select-none cursor-grab active:cursor-grabbing",
        )}
        style={{
          left:       pos.x,
          top:        pos.y,
          transition: snapping
            ? "left 0.35s cubic-bezier(0.2,0,0,1), top 0.2s ease"
            : "none",
          touchAction: "none",
          userSelect:  "none",
        }}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}><X className="w-6 h-6 text-white" /></motion.span>
            : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}><MessageCircle className="w-6 h-6 text-white" /></motion.span>
          }
        </AnimatePresence>
      </button>

      {/* ── Chat panel (positioned dynamically relative to button) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "fixed z-[9000]",
              "flex flex-col rounded-2xl overflow-hidden shadow-2xl",
              "bg-[#111] border border-white/10"
            )}
            style={{
              left:   panelLeft,
              top:    panelTop,
              width:  panelWidth,
              height: panelHeight,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-white/8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FFD600]/20 border border-[#FFD600]/40 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#FFD600]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{c.title}</p>
                  <p className="text-[10px] text-green-400 mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    {c.online}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors p-1">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-[#FFD600] text-black rounded-br-sm"
                        : "bg-white/8 text-white/90 rounded-bl-sm"
                    )}
                  >
                    {msg.content ? (
                      <span className="whitespace-pre-wrap break-words">
                        {msg.role === "assistant" ? renderWithLinks(msg.content) : msg.content}
                      </span>
                    ) : (
                      <span className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/8 bg-[#1a1a1a]">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={c.placeholder}
                  disabled={loading}
                  maxLength={500}
                  className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#FFD600]/60 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-xl bg-[#FFD600] hover:bg-[#FFC400] flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send className="w-4 h-4 text-black" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
