// ─────────────────────────────────────────────────────────────────────────────
// IntroOverlay — Gate → 1 tap → logo accelera+esplode → sito
//
// FLUSSO:
//   idle      → logo gira alla velocità base (Three.js), testo visibile
//   animating → Three.js accelera la rotazione; Framer Motion scala + opacità
//   Logo3D chiama onAnimComplete → startOutro → fade-out → onComplete()
//
// La rotazione è SEMPRE gestita da Three.js → nessun salto al tap.
// Framer Motion gestisce solo scale (CSS) e opacity.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo3D } from "./Logo3D";

const LOGO_SRC      = `${import.meta.env.BASE_URL}images/logo-iusmk-white.png`;
const BG_SRC        = `${import.meta.env.BASE_URL}images/intro-bg.webp`;
const AUDIO_SRC     = `${import.meta.env.BASE_URL}audio/intro-sound.mp3`;

const OUTRO_MS  = 400;   // durata fade-out finale
const ANIM_S    = 2.8;   // deve coincidere con INTRO_ANIM_S in Logo3D

interface Props {
  onComplete: () => void;
}

export function IntroOverlay({ onComplete }: Props) {
  const [phase,     setPhase]     = useState<"idle" | "animating">("idle");
  const [fadingOut, setFadingOut] = useState(false);
  const [done,      setDone]      = useState(false);

  const tappedRef    = useRef(false);
  const completedRef = useRef(false);
  const audioRef     = useRef<HTMLAudioElement | null>(null);

  // Blocca scroll durante l'intro
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Pre-carica l'audio al mount (senza autoplay — i browser lo bloccherebbero)
  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.volume      = 0.85;
    audio.preload     = "auto";
    audio.loop        = false;
    audioRef.current  = audio;

    return () => {
      // Pulizia: ferma e dealloca l'audio all'unmount
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Ferma l'audio e dissolve verso il sito
  const startOutro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    // Ferma l'audio di intro quando si entra nel sito
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    sessionStorage.setItem("iusmkIntroSeen", "true");
    setFadingOut(true);
    setTimeout(() => {
      setDone(true);
      onComplete();
    }, OUTRO_MS);
  }, [onComplete]);

  // 1 tap → audio parte → testo sparisce → logo accelera (Three.js) + zoom (Framer Motion) → sito
  const handleEnter = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (tappedRef.current) return;
    tappedRef.current = true;

    // Avvia audio con 1 secondo di ritardo — sincronizzato con la fase
    // centrale dell'animazione (quando il logo inizia ad accelerare davvero).
    // Eseguito dentro il gestore del click → i browser lo permettono.
    const audio = audioRef.current;
    if (audio) {
      setTimeout(() => {
        audio.currentTime = 0;
        audio.volume = 0.85;
        audio.play().catch(() => {
          // Browser ha bloccato l'audio (es. policy su alcuni mobile)
          // L'intro continua normalmente senza audio
        });
      }, 1000);
    }

    setPhase("animating");
  }, []);

  if (done) return null;

  return (
    <div
      style={{
        position:      "fixed",
        inset:         0,
        width:         "100vw",
        height:        "100dvh",
        minHeight:     "100svh",
        zIndex:        999999,
        overflow:      "hidden",
        background:    "#000",
        opacity:       fadingOut ? 0 : 1,
        transition:    fadingOut ? `opacity ${OUTRO_MS}ms ease` : "none",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          GATE — cliccabile solo in idle
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position:      "absolute",
          inset:         0,
          zIndex:        1,
          cursor:        phase === "idle" ? "pointer" : "default",
          userSelect:    "none",
          WebkitTapHighlightColor: "transparent",
          touchAction:   "manipulation",
          pointerEvents: phase === "idle" ? "auto" : "none",
        }}
        onClick={handleEnter}
        onTouchStart={handleEnter}
      >
        {/* Sfondo */}
        <div
          style={{
            position:           "absolute",
            inset:              0,
            backgroundImage:    `url(${BG_SRC})`,
            backgroundSize:     "cover",
            backgroundPosition: "center center",
            backgroundRepeat:   "no-repeat",
          }}
        />

        {/* Overlay scuro */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 1 }} />

        {/* ── Logo 3D — canvas full-gate, zero rettangolo ─────────────────────
            Framer Motion gestisce SOLO scale + opacity.
            La rotazione Y è interamente in Three.js → nessun salto al tap.
            onAnimComplete viene chiamato da IntroRotatingScene in Logo3D.
        ─────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 1 }}
          animate={
            phase === "idle"
              ? { opacity: 1, scale: 1 }
              : {
                  // Fase 1 (0-0.29): logo quasi fermo, rotazione appena percettibile
                  // Fase 2 (0.29-0.82): chiaramente più veloce + scala cresce
                  // Fase 3 (0.82-1.0): massima carica → esplosione
                  scale:   [1, 1.02, 1.07, 1.60, 3.2, 6.5],
                  opacity: [1, 1,    1,    0.98, 0.45, 0  ],
                }
          }
          transition={
            phase === "idle"
              ? { duration: 0.9, delay: 0.1, ease: "easeOut" }
              : {
                  duration: ANIM_S,
                  times:    [0, 0.12, 0.29, 0.58, 0.82, 1.0],
                  ease:     "easeIn",
                }
          }
          onAnimationComplete={() => {
            if (phase === "animating") startOutro();
          }}
          style={{
            position:        "absolute",
            inset:           0,
            zIndex:          2,
            pointerEvents:   "none",
            transformOrigin: "center center",
            filter:          "drop-shadow(0 0 28px rgba(255,214,0,0.55)) drop-shadow(0 0 10px rgba(255,214,0,0.3))",
            willChange:      "transform, opacity",
          }}
        >
          <Logo3D
            variant="intro"
            style={{ width: "100%", height: "100%" }}
            animating={phase === "animating"}
            onAnimComplete={startOutro}
            fallback={
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  src={LOGO_SRC}
                  alt="IUSMK"
                  draggable={false}
                  style={{ width: "clamp(140px, 38vw, 220px)", height: "auto", display: "block" }}
                />
              </div>
            }
          />
        </motion.div>

        {/* Flash fucsia — glow ampio + blur al picco */}
        <AnimatePresence>
          {phase === "animating" && (
            <>
              {/* Layer 1: radiale fucsia intenso con blur */}
              <motion.div
                key="flash-glow"
                style={{
                  position:      "absolute",
                  inset:         0,
                  zIndex:        4,
                  background:    "radial-gradient(circle, rgba(255,214,0,1) 0%, rgba(255,214,0,0.4) 45%, transparent 80%)",
                  pointerEvents: "none",
                }}
                initial={{ opacity: 0, filter: "blur(0px)" }}
                animate={{
                  opacity: [0, 0, 0, 0, 1.0, 0],
                  filter:  ["blur(0px)", "blur(0px)", "blur(0px)", "blur(0px)", "blur(22px)", "blur(0px)"],
                }}
                transition={{
                  duration: ANIM_S,
                  times:    [0, 0.60, 0.76, 0.84, 0.93, 1.0],
                  ease:     "easeInOut",
                }}
              />
              {/* Layer 2: bianco accecante brevissimo al picco */}
              <motion.div
                key="flash-white"
                style={{
                  position:      "absolute",
                  inset:         0,
                  zIndex:        5,
                  background:    "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,214,0,0.5) 50%, transparent 80%)",
                  pointerEvents: "none",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 0, 0, 0, 0.75, 0] }}
                transition={{
                  duration: ANIM_S,
                  times:    [0, 0.60, 0.76, 0.84, 0.88, 0.93, 1.0],
                  ease:     "easeInOut",
                }}
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTO — visibile solo in idle, esce immediatamente al tap
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div
            key="text"
            style={{
              position:       "absolute",
              inset:          0,
              zIndex:         5,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              pointerEvents:  "none",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div
              style={{
                marginTop:     "clamp(220px, 45vmin, 340px)",
                animation:     "iusmk-pulse 2.2s ease-in-out infinite",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           4,
              }}
            >
              <p
                style={{
                  color:         "#FFD600",
                  fontSize:      "clamp(13px, 3.2vw, 16px)",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  fontFamily:    "'Space Grotesk', sans-serif",
                  fontWeight:    500,
                  textAlign:     "center",
                  lineHeight:    1.6,
                  margin:        0,
                  padding:       0,
                  border:        "none",
                  outline:       "none",
                  boxShadow:     "none",
                  background:    "none",
                  textShadow:    "0 0 6px rgba(255,214,0,0.75), 0 0 14px rgba(255,214,0,0.45)",
                }}
              >
                Tocca per entrare<br />nel mondo di IUSMK
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
