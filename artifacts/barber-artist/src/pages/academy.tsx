import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAcademyCategories } from "@/hooks/use-courses";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResilientImage } from "@/components/ui/resilient-image";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Link } from "wouter";
import { useLang } from "@/i18n/LanguageContext";
import { normalizeMediaUrl } from "@/lib/media-utils";

export default function Academy() {
  const { data: rawCategories, isLoading } = useAcademyCategories();
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const { t } = useLang();
  const a = t.academy;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white uppercase tracking-tighter mb-6">
              {a.title}<span className="text-primary">{a.titleHighlight}</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto whitespace-pre-line">
              {a.subtitle}
              <br /><br />
              <span className="text-white font-medium">{a.subtitleEmphasis}</span>
            </p>
            <div className="mt-8 inline-flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full text-sm">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-gray-300">Scegli la tua categoria e inizia il percorso</span>
            </div>
          </div>

          {/* Category Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-80 w-full bg-white/5" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-white/10">
              <h3 className="text-2xl font-display text-white uppercase">{a.noCourses}</h3>
              <p className="text-muted-foreground mt-2">{a.noCoursesDesc}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {categories.map((cat: any, i: number) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="group bg-card border border-white/5 hover:border-primary/30 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/9] overflow-hidden relative">
                    <ResilientImage
                      src={normalizeMediaUrl(cat.thumbnailUrl) || `${import.meta.env.BASE_URL}images/academy-course-1.png`}
                      alt={cat.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      fallbackClassName="w-full h-full flex items-center justify-center bg-white/5"
                      loading={i < 2 ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="text-xs font-bold bg-primary/90 text-white px-3 py-1 uppercase tracking-wider">
                        Categoria
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-6">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-white uppercase mb-3 group-hover:text-primary transition-colors">
                      {cat.title}
                    </h2>

                    {cat.shortDescription && (
                      <p className="text-muted-foreground text-base leading-relaxed mb-6 line-clamp-3 flex-1">
                        {cat.shortDescription}
                      </p>
                    )}

                    <div className="mt-auto">
                      <Link href={`/academy/${cat.id}`}>
                        <Button
                          size="lg"
                          className="w-full uppercase tracking-wider font-bold rounded-none group/btn"
                        >
                          Scopri la categoria
                          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
