import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { SITE_CONTENT } from "@/lib/site-content";
import { useLang } from "@/i18n/LanguageContext";

const VARIANTS = ["normal", "normal", "normal", "normal", "normal", "highlight", "closing"] as const;

export default function About() {
  const { t } = useLang();
  const paragraphs = t.about.paragraphs.map((text, i) => ({
    text,
    variant: VARIANTS[i] ?? "normal",
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 md:pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-start">

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="lg:col-span-2 lg:order-2 lg:sticky lg:top-32"
            >
              <div className="relative overflow-hidden">
                <img
                  src={SITE_CONTENT.artist.photo}
                  alt={SITE_CONTENT.artist.photoAlt}
                  className="w-full h-auto object-contain block"
                  style={{ maxHeight: "85vh" }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground uppercase tracking-[0.25em] text-center">
                Giuseppe Musto — IUSMK
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="lg:col-span-3 lg:order-1"
            >
              <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-4">
                {t.about.eyebrow}
              </p>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white uppercase tracking-tighter mb-10 leading-[1.05] whitespace-pre-line">
                {t.about.headline}
              </h1>

              <div className="space-y-7">
                {paragraphs.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: "easeOut" }}
                  >
                    {p.variant === "highlight" ? (
                      <div className="border-l-2 border-primary pl-5 py-1">
                        <p className="text-white text-lg md:text-xl font-light leading-relaxed italic">
                          {p.text}
                        </p>
                      </div>
                    ) : p.variant === "closing" ? (
                      <p className="text-primary font-bold text-xl md:text-2xl font-display uppercase tracking-wide leading-snug whitespace-pre-line pt-4 border-t border-white/10">
                        {p.text}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-base md:text-lg font-light leading-relaxed">
                        {p.text}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
