import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, KeyRound } from "lucide-react";
import { ResilientImage } from "@/components/ui/resilient-image";
import { usePublicCourses } from "@/hooks/use-courses";
import { SITE_CONTENT } from "@/lib/site-content";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { Logo3D } from "@/components/Logo3D";

const HERO_SLIDES = [
  `${import.meta.env.BASE_URL}slide-2.webp`,
  `${import.meta.env.BASE_URL}slide-1.webp`,
  `${import.meta.env.BASE_URL}slide-3.webp`,
];

const SLIDE_DURATION = 2200;
const FADE_DURATION = 700;

export default function Home() {
  const { data: courses } = usePublicCourses();
  const coursesList = Array.isArray(courses) ? courses : [];
  const featuredCourse = coursesList.find((c: any) => c.isFeatured) || coursesList[0] || null;
  const { t } = useLang();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showFloatingBtn, setShowFloatingBtn] = useState(true);
  const masterclassRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  // Nasconde il bottone fluttuante quando la sezione masterclass è visibile
  useEffect(() => {
    const el = masterclassRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingBtn(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Preload copertina del corso in evidenza (above-the-fold)
  useEffect(() => {
    if (!featuredCourse?.thumbnailUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = featuredCourse.thumbnailUrl;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [featuredCourse?.thumbnailUrl]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Hero Section — Slideshow */}
      <section className="relative h-screen overflow-hidden">
        {/* Preload + render all slides, only active is visible */}
        {HERO_SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`IUSMK slide ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover${i === 2 ? " hero-slide-third" : ""}`}
            style={{
              opacity: i === activeIndex ? 1 : 0,
              transition: `opacity ${FADE_DURATION}ms ease-in-out`,
              zIndex: i === activeIndex ? 1 : 0,
            }}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        ))}

        {/* Dark overlay sopra le immagini */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.32), rgba(0,0,0,0.52))",
            zIndex: 2,
          }}
        />

        {/* Logo 3D centrato sopra lo slideshow — ruotabile con mouse/dito */}
        <div
          className="absolute select-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
        >
          <Logo3D
            variant="hero"
            fallback={
              <img
                src={`${import.meta.env.BASE_URL}images/logo-iusmk-white.png`}
                alt="IUSMK"
                style={{
                  width: "clamp(300px, 52vw, 600px)",
                  maxWidth: "90vw",
                  height: "auto",
                  display: "block",
                }}
              />
            }
          />
        </div>
      </section>

      {/* About Preview */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="aspect-[4/5] relative group overflow-hidden"
            >
              <img
                src={SITE_CONTENT.artist.photo}
                alt={SITE_CONTENT.artist.photoAlt}
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-sm font-bold tracking-[0.3em] text-primary uppercase mb-4">
                {t.home.artistSection.eyebrow}
              </h2>
              <h3 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 uppercase leading-tight whitespace-pre-line">
                {t.home.artistSection.title}
              </h3>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                {t.home.artistSection.description}
              </p>
              <Link href="/about">
                <Button variant="link" className="text-white hover:text-primary pl-0 text-lg group">
                  {t.home.artistSection.bioCta} <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Signature Academy Preview */}
      <section id="masterclass-section" ref={masterclassRef} className="py-24 bg-black/40 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold tracking-[0.3em] text-primary uppercase mb-4">{t.home.academy.eyebrow}</h2>
            <h3 className="text-4xl md:text-5xl font-display font-bold text-white uppercase">{t.home.academy.title}</h3>
          </div>

          {featuredCourse ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-card border border-white/5 hover:border-primary/30 transition-colors group overflow-hidden">
                <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/10 to-black">
                  {featuredCourse.thumbnailUrl ? (
                    <ResilientImage
                      src={featuredCourse.thumbnailUrl}
                      alt={featuredCourse.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      fallbackClassName="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-black"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <KeyRound className="w-16 h-16 text-primary/30" />
                    </div>
                  )}
                </div>
                <div className="p-6 md:p-8">
                  <div className="flex gap-2 mb-4">
                    {featuredCourse.level && (
                      <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-sm uppercase tracking-wider">{featuredCourse.level}</span>
                    )}
                    {featuredCourse.durationHours && (
                      <span className="text-xs font-bold bg-white/5 text-white px-3 py-1 rounded-sm uppercase tracking-wider">{featuredCourse.durationHours}h</span>
                    )}
                  </div>
                  <h4 className="text-2xl md:text-3xl font-display font-bold text-white mb-3 uppercase">{featuredCourse.title}</h4>
                  {featuredCourse.description && (
                    <p className="text-muted-foreground mb-0 line-clamp-2">{featuredCourse.description}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="bg-card border border-white/5 aspect-[16/9] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <KeyRound className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-sm uppercase tracking-widest">{t.home.academy.comingSoon}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 text-center">
            <Link href="/academy">
              <Button size="lg" className="uppercase tracking-widest font-bold px-10">
                {t.home.academy.discoverAll} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bottone fluttuante "Scopri le Masterclass" ──────────────────── */}
      {/*
          NOTA TECNICA: il wrapper motion.div usa Framer Motion "x: '-50%'"
          invece di CSS "transform: translateX(-50%)".
          Questo evita il conflitto tra il translateX di centramento e le
          trasformazioni scale/opacity applicate da Framer Motion durante
          hover e animazione, che su mobile causavano lo shift verso destra.
      */}
      <AnimatePresence>
        {showFloatingBtn && (
          <motion.div
            key="floating-masterclass-btn"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              position:   "fixed",
              bottom:     "24px",
              left:       "50%",
              x:          "-50%",   // proprietà Framer Motion, non CSS — non viene sovrascritta
              zIndex:     9000,
              width:      "calc(100vw - 40px)",
              maxWidth:   "360px",
              boxSizing:  "border-box",
            }}
          >
            <button
              onClick={() =>
                masterclassRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                display:         "block",
                width:           "100%",
                textAlign:       "center",
                background:      "#FFD600",
                color:           "#000",
                fontFamily:      "'Space Grotesk', sans-serif",
                fontWeight:      700,
                fontSize:        "clamp(12px, 3.5vw, 13px)",
                letterSpacing:   "0.22em",
                textTransform:   "uppercase",
                padding:         "15px 20px",
                borderRadius:    "999px",
                border:          "none",
                cursor:          "pointer",
                whiteSpace:      "nowrap",
                boxSizing:       "border-box",
                boxShadow:       "0 0 18px rgba(255,214,0,0.55), 0 4px 16px rgba(0,0,0,0.45)",
              }}
            >
              SCORRI PER I TUTORIAL ↓↓
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
