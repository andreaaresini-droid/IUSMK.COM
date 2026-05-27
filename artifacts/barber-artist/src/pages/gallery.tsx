import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useState, useEffect, useCallback, useRef } from "react";
import { useGalleryPage, usePublicGalleryCategories } from "@/hooks/use-gallery";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { ResilientImage } from "@/components/ui/resilient-image";
import { useLang } from "@/i18n/LanguageContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getImageSrc(item: any): string {
  return item.thumbnailUrl || item.optimizedUrl || item.mobileUrl || item.imageUrl || item.url || "";
}

function getVideoPoster(item: any): string | null {
  return item.posterUrl || item.thumbnailUrl || null;
}

// ── VideoPreviewCard ──────────────────────────────────────────────────────────
// Anteprima animata dei primi 2 secondi del video in loop silenzioso.
// Strategia robusta per tutti i browser (Chrome, Safari/iOS, Firefox, PWA):
//   1. <video> con attributi HTML autoPlay muted playsInline loop
//      → i browser/OS rispettano l'autoplay SOLO quando tutti e tre sono presenti
//   2. poster sull'elemento → frame visibile istantaneo prima del play
//   3. onTimeUpdate: quando currentTime >= 2s → reset a 0 (loop 2 s)
//   4. IntersectionObserver → pause quando fuori schermo (performance)
//   5. onCanPlay → tentativo play() JS come rinforzo su browser lenti
//   6. Se play() viene bloccato → si mostra il poster come fallback statico

function VideoPreviewCard({ src, poster }: { src: string; poster?: string | null }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playingRef   = useRef(false);

  // Avvia il play con gestione errori silenziosa
  const tryPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || playingRef.current) return;
    v.play().then(() => {
      playingRef.current = true;
    }).catch(() => {
      // autoplay bloccato: il poster sull'elemento resta visibile
    });
  }, []);

  useEffect(() => {
    const video     = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    playingRef.current = false;

    // Loop manuale a 2 secondi
    const onTimeUpdate = () => {
      if (video.currentTime >= 2) {
        video.currentTime = 0;
        // play() dopo il reset garantisce continuità su Safari
        video.play().catch(() => {});
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);

    // Avvia/pausa in base alla visibilità nel viewport
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          tryPlay();
        } else {
          video.pause();
          playingRef.current = false;
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      observer.disconnect();
    };
  }, [src, tryPlay]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: "#000" }}>
      <video
        ref={videoRef}
        src={src}
        // poster sull'elemento: frame visibile PRIMA del play (elimina schermo nero iniziale)
        poster={poster || undefined}
        muted
        playsInline
        autoPlay
        loop
        preload="metadata"
        disablePictureInPicture
        // onCanPlay: rinforza il play() su browser che ignorano l'attributo autoPlay
        onCanPlay={tryPlay}
        onTimeUpdate={(e) => {
          // Secondo handler inline: funziona anche se l'effect non è ancora attivo
          if (e.currentTarget.currentTime >= 2) {
            e.currentTarget.currentTime = 0;
            e.currentTarget.play().catch(() => {});
          }
        }}
        onError={() => {/* lascia il poster visibile */}}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", display: "block",
        }}
      />
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  items,
  startIndex,
  onClose,
  categories,
}: {
  items: any[];
  startIndex: number;
  onClose: () => void;
  categories: any[];
}) {
  const [index, setIndex] = useState(startIndex);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const touchStartX  = useRef<number | null>(null);

  const prev = useCallback(() => setIndex(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % items.length),               [items.length]);

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) { vid.pause(); vid.currentTime = 0; }
  }, [index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === " ") {
        const vid = videoRef.current;
        if (vid) { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
      }
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const item     = items[index];
  const isVideo  = item?.mediaType === "video";
  const catLabel =
    categories?.find((c: any) => c.slug === item?.category)?.name ||
    item?.category?.replace(/_/g, " ") || "";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/97"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          aria-label="Chiudi"
        >
          <X className="w-6 h-6" />
        </button>

        {items.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-50 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
              aria-label="Precedente"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-50 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
              aria-label="Successiva"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18 }}
          className="relative flex flex-col items-center w-full mx-4 sm:mx-16 max-w-4xl max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              key={item.imageUrl}
              src={item.imageUrl}
              poster={getVideoPoster(item) || undefined}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[78vh] rounded-lg shadow-2xl bg-black outline-none"
              style={{ maxWidth: "100%" }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <ResilientImage
              src={item?.imageUrl}
              alt={item?.title || catLabel}
              className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
              fallbackClassName="w-64 h-48 flex items-center justify-center bg-card rounded-lg"
            />
          )}

          {(item?.title || catLabel) && (
            <div className="mt-4 text-center px-4">
              {catLabel && (
                <p className="text-primary text-xs font-bold uppercase tracking-widest mb-1">{catLabel}</p>
              )}
              {item?.title && (
                <p className="text-white font-display text-lg uppercase">{item.title}</p>
              )}
            </div>
          )}

          {items.length > 1 && (
            <p className="text-white/30 text-xs mt-2">{index + 1} / {items.length}</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Gallery page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [lightboxIndex,  setLightboxIndex]  = useState<number | null>(null);
  const [offset,         setOffset]         = useState(0);
  const [allItems,       setAllItems]       = useState<any[]>([]);
  const [hasMore,        setHasMore]        = useState(true);

  const { data: categories } = usePublicGalleryCategories();
  const { t } = useLang();

  const { data: page, isLoading, isFetching } = useGalleryPage(
    activeCategory || undefined,
    offset,
  );

  // Quando arriva una nuova pagina di dati, accumula gli elementi
  useEffect(() => {
    if (!page?.items) return;
    if (offset === 0) {
      // Reset completo al cambio categoria o al primo caricamento
      setAllItems(page.items);
    } else {
      // Aggiunge gli elementi successivi senza duplicati
      setAllItems(prev => {
        const ids = new Set(prev.map((x: any) => x.id));
        const news = page.items.filter((x: any) => !ids.has(x.id));
        return [...prev, ...news];
      });
    }
    setHasMore(page.hasMore);
  }, [page, offset]);

  // Sentinel per infinite scroll automatico
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setOffset(prev => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  // Reset al cambio categoria
  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    setOffset(0);
    setAllItems([]);
    setHasMore(true);
    setLightboxIndex(null);
  };

  const openLightbox  = (i: number) => setLightboxIndex(i);
  const closeLightbox = ()          => setLightboxIndex(null);

  const isFirstLoad = isLoading && allItems.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {lightboxIndex !== null && allItems.length > 0 && (
        <Lightbox
          items={allItems}
          startIndex={lightboxIndex}
          onClose={closeLightbox}
          categories={categories || []}
        />
      )}

      <main className="flex-1 pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header + filtri */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-display font-bold text-white uppercase tracking-tighter mb-4">
                {t.gallery.title}
              </h1>
              <p className="text-muted-foreground max-w-lg leading-relaxed whitespace-pre-line">
                {t.gallery.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeCategory === "" ? "default" : "outline"}
                onClick={() => handleCategoryChange("")}
                size="sm"
                className="uppercase tracking-wider text-xs rounded-full"
              >
                {t.gallery.all}
              </Button>
              {categories?.map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.slug ? "default" : "outline"}
                  onClick={() => handleCategoryChange(cat.slug)}
                  size="sm"
                  className="uppercase tracking-wider text-xs rounded-full"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Scheletro al primo caricamento */}
          {isFirstLoad ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allItems.map((item: any, i: number) => {
                  const isVideo = item.mediaType === "video";
                  const gridSrc = getImageSrc(item);
                  const poster  = getVideoPoster(item);
                  // Primi 6 eager, resto lazy
                  const loadingPriority: "eager" | "lazy" = i < 6 ? "eager" : "lazy";

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min((i % PAGE_SIZE) * 0.04, 0.35) }}
                      className="group relative aspect-square overflow-hidden bg-card border border-white/5 cursor-pointer"
                      onClick={() => openLightbox(i)}
                    >
                      {isVideo ? (
                        <VideoPreviewCard src={item.imageUrl} poster={poster} />
                      ) : (
                        <ResilientImage
                          src={gridSrc}
                          alt={item.title || "Lavoro in galleria"}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          fallbackClassName="w-full h-full flex items-center justify-center bg-card"
                          loading={loadingPriority}
                          decoding="async"
                        />
                      )}

                      {isVideo && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                          <Play className="w-2.5 h-2.5 fill-white" />
                          Video
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                        <div />
                        <div className="w-full">
                          <p className="text-primary text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate">
                            {categories?.find((c: any) => c.slug === item.category)?.name ||
                              item.category?.replace(/_/g, " ") || ""}
                          </p>
                          {item.title && (
                            <p className="text-white text-xs font-display uppercase truncate">{item.title}</p>
                          )}
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="bg-white/15 backdrop-blur-sm rounded-full p-3 border border-white/20">
                          {isVideo ? (
                            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {allItems.length === 0 && !isFetching && (
                  <div className="col-span-full text-center py-24 text-muted-foreground border border-dashed border-white/10">
                    {t.gallery.empty}
                  </div>
                )}
              </motion.div>

              {/* Skeleton "load more" */}
              {isFetching && allItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full bg-white/5" />
                  ))}
                </div>
              )}

              {/* Sentinel invisibile per l'infinite scroll */}
              <div ref={sentinelRef} className="h-1" aria-hidden />

              {/* Fine galleria */}
              {!hasMore && allItems.length > 0 && (
                <p className="text-center text-white/20 text-xs uppercase tracking-widest mt-12">
                  — Fine galleria —
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
