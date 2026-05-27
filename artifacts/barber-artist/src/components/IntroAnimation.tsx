import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/i18n/LanguageContext";

type Phase = "gate" | "cutting" | "falling" | "leaving";

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
const RISE_DURATION = 2400;
const FALL_AT       = 1350;
const FALL_DURATION = 1150;
const LEAVE_AT      = 2350;
const AUDIO_STOP    = 3000;
const DONE_AT       = 3300;

// ─── cutLine: % from viewport-top where the blade currently is ───────────────
// bladeProgress 0 → blade off-screen bottom (cutLine = 100, nothing cut yet)
// bladeProgress 1 → blade off-screen top   (cutLine = 0,   everything cut)
function cutLineFromProgress(p: number): number {
  return Math.max(0, Math.min(100, 115 - 230 * p));
}

export function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("gate");
  const { t }             = useLang();
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const timersRef         = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done              = useCallback(onComplete, [onComplete]);

  const bladeProgress = useMotionValue(0);

  // Blade vertical position (vh offset from top)
  const bladeYStyle = useTransform(bladeProgress, (p) => `${115 - 230 * p}vh`);

  // cutLine: from 100 (uncut) → 0 (fully cut), tracks blade position
  const cutLine = useTransform(bladeProgress, cutLineFromProgress);

  // ── 3 clip regions — NO borders, NO shadows, NO decorative lines ──────────
  // 1. UNCUT region: the part of the image ABOVE the blade (still whole)
  //    Shows top (cutLine)% of the full image
  const uncutClip = useTransform(cutLine, (y) => `inset(0 0 ${100 - y}% 0)`);

  // 2. CUT LEFT: the part BELOW the blade, left half
  //    Clips cutLine% from top and 50% from right
  const cutLeftClip = useTransform(cutLine, (y) => `inset(${y}% 50% 0 0)`);

  // 3. CUT RIGHT: the part BELOW the blade, right half
  //    Clips cutLine% from top and 50% from left
  const cutRightClip = useTransform(cutLine, (y) => `inset(${y}% 0 0 50%)`);

  // ── Audio ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}sounds/razor.mp3`);
    audio.preload = "auto";
    audio.volume  = 0.6;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // ── User tap/click ─────────────────────────────────────────────────────────
  const handleEnter = useCallback(() => {
    if (phase !== "gate") return;

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      const p = audio.play();
      if (p) p.catch(() => {});
      timersRef.current.push(
        setTimeout(() => { audio.pause(); audio.currentTime = 0; }, AUDIO_STOP)
      );
    }

    setPhase("cutting");
    animate(bladeProgress, 1, { duration: RISE_DURATION / 1000, ease: "linear" });

    timersRef.current.push(setTimeout(() => setPhase("falling"), FALL_AT));
    timersRef.current.push(setTimeout(() => setPhase("leaving"), LEAVE_AT));
    timersRef.current.push(setTimeout(() => done(), DONE_AT));
  }, [phase, done, bladeProgress]);

  const imgSrc     = `${import.meta.env.BASE_URL}images/intro-bg.jpg`;
  const clipperSrc = `${import.meta.env.BASE_URL}images/clipper.png`;
  const logoSrc    = `${import.meta.env.BASE_URL}images/logo-iusmk-white.png`;

  const fallEase = [0.4, 0, 1, 1] as const;

  return (
    <AnimatePresence>
      {phase !== "leaving" && (
        <motion.div
          key="intro-overlay"
          className="fixed inset-0 z-[9999] overflow-hidden bg-black"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >

          {/* ════════════════════════════════════════════════════════════════
              GATE — logo pulsante, attende il tap
          ════════════════════════════════════════════════════════════════ */}
          {phase === "gate" && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer select-none"
              onClick={handleEnter}
              onTouchStart={handleEnter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <img
                src={imgSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ filter: "brightness(0.28) blur(2px)", transform: "scale(1.05)" }}
                draggable={false}
              />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <img
                  src={logoSrc}
                  alt="IUSMK"
                  className="h-28 w-auto"
                  style={{ filter: "drop-shadow(0 0 24px rgba(255,214,0,0.8))" }}
                  draggable={false}
                />
                <motion.div
                  className="flex flex-col items-center gap-2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span
                    className="text-xs tracking-[0.35em] uppercase text-center"
                    style={{ color: "#FFD600", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {t.intro.tap}<br />{t.intro.subtitle}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              CUTTING — taglio progressivo sincronizzato con il rasoio.
              3 pannelli guidati dallo stesso bladeProgress:
                1. Sopra il rasoio → immagine intera (uncut)
                2. Sotto il rasoio, sinistra → metà sinistra (cut)
                3. Sotto il rasoio, destra  → metà destra  (cut)
              Nessun bordo, nessuna ombra, nessun separatore orizzontale.
          ════════════════════════════════════════════════════════════════ */}
          {phase === "cutting" && (
            <>
              {/* Pannello 1 — sopra il rasoio: immagine intera */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: uncutClip }}
              >
                <img
                  src={imgSrc}
                  alt=""
                  className="w-full h-full object-cover object-top select-none"
                  draggable={false}
                />
              </motion.div>

              {/* Pannello 2 — sotto il rasoio: metà sinistra */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: cutLeftClip }}
              >
                <img
                  src={imgSrc}
                  alt=""
                  className="w-full h-full object-cover object-top select-none"
                  draggable={false}
                />
              </motion.div>

              {/* Pannello 3 — sotto il rasoio: metà destra */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: cutRightClip }}
              >
                <img
                  src={imgSrc}
                  alt=""
                  className="w-full h-full object-cover object-top select-none"
                  draggable={false}
                />
              </motion.div>

              {/* Rasoio — sale dal basso verso l'alto, sincronizzato */}
              <motion.div
                className="absolute pointer-events-none"
                style={{ left: "50%", top: 0, x: "-50%", y: bladeYStyle }}
              >
                <motion.div
                  animate={{ x: [0, 1.8, -1.6, 1.1, -0.9, 0.5, 0] }}
                  transition={{ duration: 0.13, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src={clipperSrc}
                    alt="rasoio"
                    draggable={false}
                    className="select-none"
                    style={{
                      width: "clamp(80px, 12vw, 118px)",
                      height: "auto",
                      display: "block",
                      transform: "perspective(500px) rotateY(6deg) rotate(-2deg)",
                      filter:
                        "grayscale(0.15) contrast(1.2) brightness(1.08) " +
                        "drop-shadow(0 8px 16px rgba(0,0,0,0.95)) " +
                        "drop-shadow(0 3px 5px rgba(0,0,0,0.75)) " +
                        "drop-shadow(0 0 26px rgba(255,214,0,0.9)) " +
                        "drop-shadow(0 0 8px rgba(255,214,0,0.65))",
                    }}
                  />
                </motion.div>
              </motion.div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              FALLING — le due metà cadono verso il basso con gravità
          ════════════════════════════════════════════════════════════════ */}
          {phase === "falling" && (
            <>
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: "inset(0 50% 0 0)", transformOrigin: "50% 0%" }}
                initial={{ y: 0, rotate: 0, x: 0 }}
                animate={{ y: "135vh", rotate: -11, x: "-8%" }}
                transition={{ duration: FALL_DURATION / 1000, ease: fallEase }}
              >
                <img
                  src={imgSrc}
                  alt=""
                  className="w-full h-full object-cover object-top select-none"
                  draggable={false}
                />
              </motion.div>

              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: "inset(0 0 0 50%)", transformOrigin: "50% 0%" }}
                initial={{ y: 0, rotate: 0, x: 0 }}
                animate={{ y: "135vh", rotate: 11, x: "8%" }}
                transition={{ duration: FALL_DURATION / 1000, ease: fallEase }}
              >
                <img
                  src={imgSrc}
                  alt=""
                  className="w-full h-full object-cover object-top select-none"
                  draggable={false}
                />
              </motion.div>
            </>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  );
}
