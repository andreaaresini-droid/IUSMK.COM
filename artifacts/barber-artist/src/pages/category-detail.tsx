import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAcademyCategory, useOwnedCourseIds } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResilientImage } from "@/components/ui/resilient-image";
import { normalizeGallery, normalizeMediaUrl, type NormalizedMedia as SharedMedia } from "@/lib/media-utils";
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  BookOpen,
  ExternalLink,
  ImageIcon,
  Tag,
  Video,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  params: { categoryId: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("/gallery/video/")) return true;
  return /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url);
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i.test(url);
}

/** Alias locale — delegato alla lib condivisa che supporta tutti i formati. */
function normalizeAcademyMedia(item: any): SharedMedia {
  // Importato come normalizeGallery/normalizeMediaUrl da @/lib/media-utils.
  // Usiamo lo stesso formato interno { url, type } così il resto del file non cambia.
  const { url, type, poster, mimeType } = ((): SharedMedia => {
    const raw: string =
      typeof item === "string"
        ? item
        : (item?.url || item?.src ||
           item?.imageUrl || item?.coverImage || item?.coverImageUrl ||
           item?.thumbnail || item?.thumbnailUrl ||
           item?.poster || item?.posterUrl ||
           item?.fileUrl || item?.publicUrl || item?.href || "");

    if (!raw || raw.startsWith("blob:")) return { url: "", type: "image" };

    let type: "image" | "video";
    let poster: string | undefined;
    let mimeType: string | undefined;

    if (item && typeof item === "object") {
      mimeType = item.mimeType || item.mime || undefined;
      if (item.type === "video" || mimeType?.startsWith("video/")) type = "video";
      else if (item.type === "image" || mimeType?.startsWith("image/")) type = "image";
      else if (isVideoUrl(raw)) type = "video";
      else if (isImageUrl(raw)) type = "image";
      else type = "image";

      const rp = item.poster || item.posterUrl || item.thumbnailUrl || item.thumbnail || "";
      if (rp && !rp.startsWith("blob:")) poster = rp;
    } else {
      if (isVideoUrl(raw)) type = "video";
      else if (isImageUrl(raw)) type = "image";
      else type = "image";
    }

    if (import.meta.env.DEV) {
      console.debug("[normalizeAcademyMedia]", { raw: item, url: raw, type });
    }
    return { url: raw, type, poster, mimeType };
  })();
  return { url, type, poster, mimeType };
}

// ─── Safe media components ────────────────────────────────────────────────────

function SafeImg({
  src, alt, className, onClick,
}: { src: string; alt?: string; className?: string; onClick?: () => void }) {
  const { lang } = useLang();
  const [retries, setRetries] = useState(0);
  const [broken, setBroken] = useState(false);
  const prevSrc = useRef(src);
  if (prevSrc.current !== src) {
    prevSrc.current = src;
    setBroken(false);
    setRetries(0);
  }

  const handleError = () => {
    if (retries < 2) {
      // Retry caricamento dopo breve attesa (firma URL potrebbe essere in generazione)
      setTimeout(() => setRetries(r => r + 1), 1500 * (retries + 1));
    } else {
      setBroken(true);
    }
  };

  if (!src || broken) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-white/5 text-muted-foreground text-xs gap-2 ${className || ""}`}
        onClick={onClick}
      >
        <ImageIcon className="w-5 h-5 opacity-40" />
        {broken && <span className="opacity-40">{lang === "it" ? "Media non disponibile" : "Media unavailable"}</span>}
      </div>
    );
  }
  // La key include `retries` per forzare il re-mount e ri-fetch dell'immagine
  return (
    <img
      key={`${src}-${retries}`}
      src={src} alt={alt || ""}
      className={className}
      onClick={onClick}
      onError={handleError}
    />
  );
}

function SafeVideo({
  src, className, autoLoop, onClick,
}: { src: string; className?: string; autoLoop?: boolean; onClick?: () => void }) {
  const { lang } = useLang();
  const [broken, setBroken] = useState(false);
  const prevSrc = useRef(src);
  if (prevSrc.current !== src) {
    prevSrc.current = src;
    setBroken(false);
  }
  if (!src || broken) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-white/5 text-muted-foreground text-xs gap-2 ${className || ""}`}
        onClick={onClick}
      >
        <Video className="w-5 h-5 opacity-40" />
        {broken && <span className="opacity-40">{lang === "it" ? "Video non disponibile" : "Video unavailable"}</span>}
      </div>
    );
  }
  if (autoLoop) {
    return (
      <video
        key={src}
        src={src}
        autoPlay muted loop playsInline preload="metadata"
        className={className}
        onClick={onClick}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <video
      key={src}
      src={src}
      controls playsInline preload="metadata"
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

// ─── Trailer player ───────────────────────────────────────────────────────────

function TrailerPlayer({ url, poster }: { url: string; poster?: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="aspect-video w-full flex items-center justify-center bg-white/5 text-muted-foreground text-sm">
        <Video className="w-6 h-6 mr-2 opacity-40" /> Trailer non disponibile
      </div>
    );
  }

  const isCloudflare = url.includes("cloudflarestream.com") || url.includes("iframe.cloudflarestream.com");
  if (isCloudflare) {
    const embedUrl = url.includes("/iframe") ? url : url.replace("/watch", "/iframe");
    const src = `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}${poster ? `poster=${encodeURIComponent(poster)}&` : ""}controls=true&autoplay=false`;
    return (
      <div className="aspect-video w-full bg-black">
        <iframe src={src}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen className="w-full h-full" />
      </div>
    );
  }

  return (
    <video
      key={url}
      src={url}
      poster={poster || undefined}
      controls playsInline preload="metadata"
      className="w-full aspect-video bg-black object-contain"
      onError={() => setBroken(true)}
    />
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

type MediaItem = SharedMedia;

function Lightbox({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/96 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10">
          <X className="w-6 h-6" />
        </button>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="max-w-5xl w-full"
        >
          {item.type === "video" ? (
            <video
              src={item.url}
              controls autoPlay playsInline preload="metadata"
              className="w-full max-h-[85vh] bg-black object-contain"
            />
          ) : (
            <img
              src={item.url} alt=""
              className="w-full max-h-[85vh] object-contain"
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Gallery item ─────────────────────────────────────────────────────────────

function GalleryItem({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const { url, type } = item;
  if (!url) return null;

  return (
    <div
      className="aspect-square overflow-hidden border border-white/5 hover:border-white/20 transition-colors cursor-pointer relative group bg-black"
      onClick={onClick}
    >
      {type === "video" ? (
        <>
          <SafeVideo src={url} autoLoop className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
          </div>
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
            <Video className="w-3 h-3" />
          </div>
        </>
      ) : (
        <>
          <SafeImg src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <ImageIcon className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CategoryDetail({ params }: Props) {
  const { categoryId } = params;
  const { data: cat, isLoading, error } = useAcademyCategory(categoryId);
  const { data: currentUser } = useCurrentUser();
  const isLoggedInUser = currentUser?.role === "customer" || currentUser?.role === "student";
  const { data: ownedData } = useOwnedCourseIds(isLoggedInUser);
  const ownedIds = new Set<number>(ownedData?.courseIds ?? []);
  const { lang } = useLang();
  const [, setLocation] = useLocation();
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [showFloatingBtn, setShowFloatingBtn] = useState(true);
  const coursesRef = useRef<HTMLDivElement>(null);

  // Nascondi il bottone solo quando la sezione video corsi entra nel viewport
  useEffect(() => {
    const el = coursesRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShowFloatingBtn(false);
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleFloatingClick = () => {
    setShowFloatingBtn(false);
    coursesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const courses: any[] = Array.isArray(cat?.courses) ? cat.courses : [];

  // Normalize gallery: support all formats (string, { url }, { src }, { fileUrl }, { publicUrl })
  // normalizeAcademyMedia preserves explicit type/mimeType information
  const galleryMedia: MediaItem[] = Array.isArray(cat?.galleryImages)
    ? cat.galleryImages.map(normalizeAcademyMedia).filter((m: MediaItem) => Boolean(m.url))
    : [];

  const whatYouWillLearn: string[] = Array.isArray(cat?.whatYouWillLearn)
    ? cat.whatYouWillLearn
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 pb-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            <Skeleton className="h-8 w-40 bg-white/5 mb-8" />
            <Skeleton className="h-16 w-3/4 bg-white/5 mb-6" />
            <Skeleton className="aspect-video w-full bg-white/5 mb-8" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !cat) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 pb-24 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-display text-white uppercase mb-4">{lang === "it" ? "Categoria non trovata" : "Category not found"}</h1>
            <Link href="/academy">
              <Button variant="outline" className="rounded-none">
                <ArrowLeft className="w-4 h-4 mr-2" /> {lang === "it" ? "Torna all'Academy" : "Back to the Academy"}
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

      <main className="flex-1 pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">

          {/* Back link */}
          <Link href="/academy"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Academy
          </Link>

          {/* Category badge */}
          <div className="mb-4">
            <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 uppercase tracking-wider">
              {lang === "it" ? "Categoria" : "Category"}
            </span>
          </div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-display font-bold text-white uppercase tracking-tighter mb-6"
          >
            {cat.title}
          </motion.h1>

          {/* Short description */}
          {cat.shortDescription && (
            <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-3xl">
              {cat.shortDescription}
            </p>
          )}

          {/* Trailer video */}
          {cat.trailerVideoUrl && (
            <div className="mb-12 border border-white/10 overflow-hidden">
              <TrailerPlayer
                url={cat.trailerVideoUrl}
                poster={
                  normalizeMediaUrl(cat.trailerPosterUrl) ||
                  normalizeMediaUrl(cat.thumbnailUrl) ||
                  undefined
                }
              />
            </div>
          )}

          {/* Hero thumbnail (se non c'è trailer) */}
          {!cat.trailerVideoUrl && normalizeMediaUrl(cat.thumbnailUrl) && (
            <div className="aspect-[16/9] overflow-hidden mb-12 border border-white/10">
              <SafeImg
                src={normalizeMediaUrl(cat.thumbnailUrl)}
                alt={cat.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Full description */}
          {cat.fullDescription && (
            <div className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight mb-4">
                {lang === "it" ? "Descrizione" : "Description"}
              </h2>
              <div className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg">
                {cat.fullDescription}
              </div>
            </div>
          )}

          {/* Cosa imparerai */}
          {whatYouWillLearn.length > 0 && (
            <div className="mb-12 bg-white/3 border border-white/8 p-6 md:p-8">
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight mb-5 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                {lang === "it" ? "Cosa imparerai" : "What you\'ll learn"}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {whatYouWillLearn.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Galleria media */}
          {galleryMedia.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight mb-5 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Gallery
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryMedia.map((mediaItem, i) => (
                  <GalleryItem
                    key={mediaItem.url || i}
                    item={mediaItem}
                    onClick={() => setLightboxItem(mediaItem)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Video Corsi */}
          <div id="academy-course-videos" ref={coursesRef} className="mt-16 pt-12 border-t border-white/10">
            <h2 className="text-3xl font-display font-bold text-white uppercase tracking-tighter mb-2">
              {lang === "it" ? "Video Corsi" : "Video Courses"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {lang === "it" ? "Scegli il corso e acquistalo per accedere ai contenuti esclusivi." : "Choose your course and buy it to access exclusive content."}
            </p>

            {courses.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{lang === "it" ? "Nessun corso disponibile in questa categoria al momento." : "No courses available in this category at the moment."}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {courses.map((course: any, i: number) => {
                  const isOwned = ownedIds.has(course.id);
                  return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                      className="flex flex-col sm:flex-row gap-5 bg-card border border-white/5 hover:border-white/10 transition-colors p-5"
                    >
                      {/* Thumbnail */}
                      <div className="sm:w-48 aspect-video sm:aspect-[4/3] shrink-0 overflow-hidden relative">
                        <ResilientImage
                          src={normalizeMediaUrl(course.thumbnailUrl) || `${import.meta.env.BASE_URL}images/academy-course-1.png`}
                          alt={course.title}
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full flex items-center justify-center bg-white/5"
                        />
                        {isOwned && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-col flex-1 justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {course.level && (
                              <span className="text-xs font-bold bg-primary/15 text-primary px-2 py-0.5 uppercase tracking-wider">
                                {course.level}
                              </span>
                            )}
                            {isOwned && (
                              <span className="text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> {lang === "it" ? "Già acquistato" : "Already purchased"}
                              </span>
                            )}
                            {course.price && !isOwned && (
                              <span className="text-xs font-bold bg-white/5 text-white px-2 py-0.5 flex items-center gap-1">
                                <Tag className="w-3 h-3" /> €{course.price}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-display font-bold text-white uppercase mb-2">
                            {course.title}
                          </h3>
                          {course.description && (
                            <p className="text-muted-foreground text-sm line-clamp-2">
                              {course.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {isOwned ? (
                            <Button size="sm" className="rounded-none uppercase tracking-wider font-bold"
                              onClick={() => setLocation("/dashboard")}>
                              <BookOpen className="w-4 h-4 mr-2" />
                              {lang === "it" ? "Apri corso" : "Open course"}
                            </Button>
                          ) : (
                            <>
                              <Link href={`/course/${course.id}`}>
                                <Button size="sm" className="rounded-none uppercase tracking-wider font-bold">
                                  <PlayCircle className="w-4 h-4 mr-2" />
                                  {lang === "it" ? "Scopri il corso" : "Discover the course"}
                                </Button>
                              </Link>
                              {(course.price || course.paymentLinkUrl) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-none uppercase tracking-wider font-bold border-white/20 hover:border-white/40"
                                  onClick={() => {
                                    // Passa SEMPRE dal checkout API (/checkout → /api/sumup/checkout):
                                    // genera il reference che permette di attribuire il pagamento e
                                    // sbloccare il corso. Niente più link statico (il corso non si sbloccava).
                                    if (!isLoggedInUser) {
                                      sessionStorage.setItem("checkout_redirect", `/checkout?course=${course.id}`);
                                      setLocation("/login");
                                    } else {
                                      setLocation(`/checkout?course=${course.id}`);
                                    }
                                  }}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  {lang === "it" ? "Acquista" : "Buy"}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Floating CTA — scompare al primo scroll o al click */}
      <AnimatePresence>
        {showFloatingBtn && (
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
            onClick={handleFloatingClick}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40
              bg-primary hover:bg-primary/90 text-white
              px-6 py-3 rounded-xl shadow-xl shadow-black/40
              text-sm font-bold uppercase tracking-wider
              flex items-center gap-2 whitespace-nowrap
              border border-primary/30"
            style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.45)" }}
          >
            {lang === "it" ? "Scopri tutti i corsi" : "Discover all courses"} ↓↓
          </motion.button>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
