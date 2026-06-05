import { useParams, Link } from "wouter";
import { usePublicCourse, useOwnedCourseIds, useOwnedModuleIds } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, ShieldCheck, Check, ArrowLeft, CheckCircle, BookOpen,
  Users, Package, ShoppingCart, KeyRound, Play, X, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { ResilientImage } from "@/components/ui/resilient-image";
import { normalizeMediaUrl } from "@/lib/media-utils";
import { useLocation } from "wouter";
import { useRef, useCallback, useState, useEffect } from "react";
import { useLang } from "@/i18n/LanguageContext";

// ── Helper: rileva video da estensione URL o percorso API ────────────────────
// I video caricati vengono salvati come /api/gallery/video/uploads/{uuid} (senza estensione).
// I video dall'upload diretto possono avere estensione: .mp4, .webm, .mov, ecc.
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|ogv)(\?|$)/i;
function isVideoUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("/api/gallery/video/")) return true;
  return VIDEO_EXTS.test(url);
}

// ── Anteprima video 2 s in loop (griglia galleria) ───────────────────────────
function GalleryVideoPreview({ src }: { src: string }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playingRef   = useRef(false);
  const [hasError, setHasError]   = useState(false);
  const [showPause, setShowPause] = useState(false); // fallback: autoplay bloccato

  const tryPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || playingRef.current) return;
    v.play()
      .then(() => { playingRef.current = true; setShowPause(false); })
      .catch(() => { setShowPause(true); }); // autoplay bloccato → mostra icona play
  }, []);

  useEffect(() => {
    const video     = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    playingRef.current = false;
    setHasError(false);
    setShowPause(false);

    const onTimeUpdate = () => {
      if (video.currentTime >= 2) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) tryPlay();
        else { video.pause(); playingRef.current = false; }
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      observer.disconnect();
    };
  }, [src, tryPlay]);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 text-muted-foreground text-xs text-center p-2 gap-2">
        <Play className="w-6 h-6 opacity-30" />
        <span>Video non disponibile</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black">
      <video
        key={src}
        ref={videoRef}
        src={src}
        muted playsInline preload="metadata"
        disablePictureInPicture
        onCanPlay={tryPlay}
        onError={() => { console.warn("[GalleryVideoPreview] errore caricamento:", src); setHasError(true); }}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= 2) {
            e.currentTarget.currentTime = 0;
            e.currentTarget.play().catch(() => {});
          }
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* Fallback: autoplay bloccato dal browser → mostra icona play centrata */}
      {showPause && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full p-3">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lightbox media (immagini + video con controlli) ───────────────────────────
function MediaLightbox({ items, startIndex, onClose }: {
  items: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex]       = useState(startIndex);
  const [videoError, setVideoError] = useState(false);
  const videoRef                 = useRef<HTMLVideoElement>(null);
  const touchStartX              = useRef<number | null>(null);

  const prev = useCallback(() => { setVideoError(false); setIndex(i => (i - 1 + items.length) % items.length); }, [items.length]);
  const next = useCallback(() => { setVideoError(false); setIndex(i => (i + 1) % items.length); },               [items.length]);

  // Tastiera
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === " ") {
        e.preventDefault();
        const vid = videoRef.current;
        if (vid) vid.paused ? vid.play() : vid.pause();
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

  const url     = items[index];
  const isVideo = isVideoUrl(url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/97"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Chiudi */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        aria-label="Chiudi"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Frecce navigazione */}
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

      {/* Contenuto */}
      <div
        className="relative flex flex-col items-center w-full mx-4 sm:mx-16 max-w-4xl max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {isVideo ? (
          videoError ? (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-16 px-8">
              <Play className="w-10 h-10 opacity-30" />
              <p className="text-sm">Video non disponibile</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              key={url}
              src={url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full max-h-[78vh] rounded-lg shadow-2xl bg-black outline-none"
              style={{ maxWidth: "100%" }}
              onClick={e => e.stopPropagation()}
              onError={() => { console.warn("[MediaLightbox] errore caricamento video:", url); setVideoError(true); }}
            />
          )
        ) : (
          <ResilientImage
            src={url}
            alt={`Media ${index + 1}`}
            className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
            fallbackClassName="w-64 h-48 flex items-center justify-center bg-card rounded-lg"
          />
        )}
        {items.length > 1 && (
          <p className="text-white/30 text-xs mt-3">{index + 1} / {items.length}</p>
        )}
      </div>
    </div>
  );
}

// ── Video trailer con controlli nativi completi ───────────────────────────────
function TrailerPlayer({ src, poster }: { src: string; poster?: string }) {
  return (
    <div className="w-full bg-black rounded-sm overflow-hidden shadow-2xl">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        style={{
          display: "block",
          width: "100%",
          maxHeight: "70vh",
          objectFit: "contain",
          background: "#000",
        }}
      />
    </div>
  );
}

// ── Lista puntata premium ─────────────────────────────────────────────────────
function BulletList({
  items,
  icon: Icon = Check,
  iconClass = "text-primary",
  cols = 2,
}: {
  items: string[];
  icon?: typeof Check;
  iconClass?: string;
  cols?: 1 | 2;
}) {
  return (
    <div className={`grid ${cols === 2 ? "sm:grid-cols-2" : ""} gap-3`}>
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start bg-white/5 border border-white/5 p-4">
          <Icon className={`w-5 h-5 ${iconClass} shrink-0 mt-0.5`} />
          <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const { data: course, isLoading, error } = usePublicCourse(parseInt(courseId || "0"));
  const { data: currentUser } = useCurrentUser();
  const isLoggedInUser = currentUser?.role === "customer" || currentUser?.role === "student";
  const { data: ownedData } = useOwnedCourseIds(isLoggedInUser);
  const { data: ownedModulesData } = useOwnedModuleIds(isLoggedInUser);
  const ownedIds = new Set<number>(ownedData?.courseIds ?? []);
  const ownedModuleIds = new Set<number>(ownedModulesData?.moduleIds ?? []);
  const isOwned = course ? ownedIds.has(course.id) : false;
  const [, setLocation] = useLocation();
  const { lang } = useLang();
  // Tutti gli useState devono stare prima delle early return (rules of hooks)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Floating button is visible immediately when page opens
  const [showFloatingBtn, setShowFloatingBtn] = useState(true);
  const purchaseRef = useRef<HTMLDivElement>(null);

  // Scroll to top on every course page open
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [courseId]);

  // Hide floating button only when purchase card enters viewport
  const courseId_for_effect = course?.id;
  useEffect(() => {
    if (!courseId_for_effect) return;
    setShowFloatingBtn(true);

    const purchase = purchaseRef.current;
    if (!purchase) return;
    const purchaseObs = new IntersectionObserver(
      ([entry]) => { setShowFloatingBtn(!entry.isIntersecting); },
      { threshold: 0.1 },
    );
    purchaseObs.observe(purchase);
    return () => purchaseObs.disconnect();
  }, [courseId_for_effect]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 container mx-auto px-4">
          <Skeleton className="h-[60vh] w-full bg-white/5" />
        </main>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 container mx-auto px-4 text-center">
          <h1 className="text-4xl text-white font-display">Corso Non Trovato</h1>
          <Link href="/academy"><Button className="mt-6">Torna all'Academy</Button></Link>
        </main>
      </div>
    );
  }

  const requireLoginToBuy = (returnPath: string) => {
    sessionStorage.setItem("checkout_redirect", returnPath);
    setLocation("/login");
  };

  const handleBuy = () => {
    if (!isLoggedInUser) {
      requireLoginToBuy(`/course/${course.id}`);
      return;
    }
    if (course.paymentLinkUrl) {
      const url = new URL(course.paymentLinkUrl);
      if (currentUser?.id)    url.searchParams.set("client_reference_id", String(currentUser.id));
      if (currentUser?.email) url.searchParams.set("prefilled_email", currentUser.email);
      window.location.href = url.toString();
    } else {
      setLocation(`/checkout?course=${course.id}`);
    }
  };

  const whatYouWillLearn: string[] = Array.isArray(course.whatYouWillLearn) && course.whatYouWillLearn.length > 0
    ? course.whatYouWillLearn
    : Array.isArray(course.whatYouLearn) ? course.whatYouLearn : [];

  const targetAudience:  string[] = Array.isArray(course.targetAudience)  ? course.targetAudience  : [];
  const includedContent: string[] = Array.isArray(course.includedContent) ? course.includedContent : [];
  // galleryMedia: normalizza ogni item (stringa o oggetto) → URL stringa pulita
  const galleryMedia: string[] = Array.isArray(course.galleryImages)
    ? course.galleryImages.map(normalizeMediaUrl).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Lightbox media */}
      {lightboxIndex !== null && galleryMedia.length > 0 && (
        <MediaLightbox
          items={galleryMedia}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Floating purchase button — always visible until purchase card in view ── */}
      {showFloatingBtn && (
        <button
          onClick={() => {
            document.getElementById("course-purchase-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-primary text-white px-6 py-3 shadow-2xl font-bold uppercase tracking-widest text-sm hover:bg-primary/80 transition-all"
        >
          Acquista / Attiva corso <ChevronDown className="w-4 h-4" /><ChevronDown className="w-4 h-4 -ml-3" />
        </button>
      )}

      <Navbar />

      {/* ── Hero ── */}
      <div
        className="relative pt-32 pb-24 border-b border-white/5 overflow-hidden"
        style={course.backgroundImageUrl ? {} : { backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        {/* Sfondo hero — usa backgroundImageUrl se disponibile, altrimenti thumbnailUrl */}
        {(normalizeMediaUrl(course.backgroundImageUrl) || normalizeMediaUrl(course.thumbnailUrl)) && (
          <div className="absolute inset-0 z-0">
            <img
              src={normalizeMediaUrl(course.backgroundImageUrl) || normalizeMediaUrl(course.thumbnailUrl)}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />
          </div>
        )}

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link
            href="/academy"
            className="text-primary hover:text-white flex items-center gap-2 mb-8 text-sm uppercase tracking-widest transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Torna ai corsi
          </Link>

          <div className="flex flex-wrap gap-3 mb-6">
            <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-sm uppercase tracking-wider border border-primary/20">
              {course.level}
            </span>
            {course.durationHours && (
              <span className="text-xs font-bold bg-white/5 text-white px-3 py-1 rounded-sm uppercase tracking-wider flex items-center gap-1 border border-white/10">
                <Clock className="w-3 h-3" /> {course.durationHours} Ore di Video
              </span>
            )}
            {isOwned && (
              <span className="text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-sm uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Già acquistato
              </span>
            )}
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold text-white uppercase tracking-tighter mb-6 max-w-4xl leading-[1.1]">
            {course.title}
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl font-light leading-relaxed">
            {course.shortDescription || course.description}
          </p>
        </div>

        {/* Thumbnail decorativa — solo desktop, solo se NON c'è backgroundImageUrl */}
        {!course.backgroundImageUrl && (
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none hidden lg:block">
            <ResilientImage
              src={normalizeMediaUrl(course.thumbnailUrl) || `${import.meta.env.BASE_URL}images/academy-course-1.webp`}
              alt=""
              className="w-full h-full object-cover"
              style={{ WebkitMaskImage: "linear-gradient(to right, transparent, black)" } as any}
            />
          </div>
        )}
      </div>

      {/* ── Corpo ── */}
      <div id="course-content" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

          {/* ── Colonna sinistra: contenuti ── */}
          <div className="lg:col-span-2 space-y-16">

            {/* Video trailer */}
            {course.trailerVideoUrl && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Anteprima del corso
                </h2>
                <TrailerPlayer
                  src={course.trailerVideoUrl}
                  poster={normalizeMediaUrl(course.trailerPosterUrl) || normalizeMediaUrl(course.thumbnailUrl) || undefined}
                />
              </section>
            )}

            {/* Descrizione completa */}
            {(course.fullDescription || course.description) && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Su questo corso
                </h2>
                <div className="prose prose-invert prose-lg text-muted-foreground font-light max-w-none">
                  {(course.fullDescription || course.description).split("\n").map((p: string, i: number) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Cosa imparerai */}
            {whatYouWillLearn.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Cosa imparerai
                </h2>
                <BulletList items={whatYouWillLearn} icon={Check} iconClass="text-primary" cols={2} />
              </section>
            )}

            {/* A chi è adatto */}
            {targetAudience.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  A chi è adatto
                </h2>
                <BulletList items={targetAudience} icon={Users} iconClass="text-blue-400" cols={2} />
              </section>
            )}

            {/* Contenuti inclusi */}
            {includedContent.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Contenuti inclusi
                </h2>
                <BulletList items={includedContent} icon={Package} iconClass="text-green-400" cols={1} />
              </section>
            )}

            {/* Programma / moduli */}
            {course.modules && course.modules.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Programma del corso
                </h2>
                <div className="border border-white/5 bg-card">
                  {course.modules.map((module: any, i: number) => (
                    <div
                      key={module.id}
                      className={`p-6 flex justify-between items-start gap-4 ${i !== 0 ? "border-t border-white/5" : ""}`}
                    >
                      <div className="flex gap-4 items-start flex-1 min-w-0">
                        <span className="text-muted-foreground font-display text-xl w-6 shrink-0 pt-0.5">
                          {(i + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-white font-medium text-lg leading-snug">{module.title}</h4>
                          {module.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{module.description}</p>
                          )}
                          {module.durationMinutes > 0 && (
                            <p className="text-xs text-muted-foreground/60 mt-1">{module.durationMinutes} min</p>
                          )}
                        </div>
                      </div>
                      <ShieldCheck className="w-5 h-5 text-primary/40 shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Galleria immagini e video */}
            {galleryMedia.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold text-white uppercase mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-primary inline-block" />
                  Galleria
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryMedia.map((url, i) => {
                    const isVid = isVideoUrl(url);
                    return (
                      <div
                        key={i}
                        className="group relative aspect-square overflow-hidden bg-white/5 cursor-pointer border border-white/5 hover:border-white/20 transition-colors"
                        onClick={() => setLightboxIndex(i)}
                      >
                        {isVid ? (
                          <GalleryVideoPreview src={url} />
                        ) : (
                          <ResilientImage
                            src={url}
                            alt={`${course.title} — foto ${i + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        )}

                        {/* Badge video */}
                        {isVid && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded pointer-events-none">
                            <Play className="w-2.5 h-2.5 fill-white" />
                            Video
                          </div>
                        )}

                        {/* Overlay hover con icona */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center pointer-events-none">
                          <div className="bg-white/15 backdrop-blur-sm rounded-full p-3 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {isVid ? (
                              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                            ) : (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Testo promozionale finale */}
            {course.promoText && (
              <section className="border border-primary/20 bg-primary/5 p-8">
                <p className="text-white text-lg font-light leading-relaxed italic">
                  "{course.promoText}"
                </p>
              </section>
            )}

            {/* Informazioni aggiuntive / Suggerimenti */}
            {course.additionalInfo && (
              <section className="border border-white/10 bg-white/3 p-8 space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Informazioni aggiuntive
                </h2>
                <div className="text-white/80 text-sm leading-relaxed space-y-2">
                  {course.additionalInfo.split("\n").map((line: string, i: number) => (
                    line.trim() ? <p key={i}>{line}</p> : <br key={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Anchor invisibile per lo scroll del pulsante flottante */}
            <div id="course-purchase-section" aria-hidden="true" />

          </div>

          {/* ── Sidebar: acquisto / accesso ── */}
          <div ref={purchaseRef} className="lg:col-span-1">
            {isOwned ? (
              <div className="bg-card border border-green-500/30 p-8 sticky top-32 shadow-2xl shadow-green-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white uppercase">Già acquistato</h3>
                    <p className="text-xs text-green-400/70">Corso attivo nel tuo account</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                  Questo corso è già presente nel tuo account ed è attivo. Puoi accedere ai contenuti dal tuo portale studente.
                </p>
                <Button
                  size="lg"
                  className="w-full uppercase tracking-wider font-bold rounded-none"
                  onClick={() => setLocation("/dashboard")}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Vai al corso
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-primary/30 p-8 sticky top-32 shadow-2xl shadow-primary/5 space-y-6">

                {/* Thumbnail */}
                {normalizeMediaUrl(course.thumbnailUrl) && (
                  <div className="aspect-video overflow-hidden">
                    <ResilientImage
                      src={normalizeMediaUrl(course.thumbnailUrl)}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-2xl font-display font-bold text-white uppercase mb-1">{course.title}</h3>
                  {course.price && course.price > 0 && (
                    <p className="text-3xl font-bold text-primary">€{course.price.toFixed(0)}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {course.price && course.price > 0 && (
                    <Button
                      size="lg"
                      className="w-full uppercase tracking-wider font-bold rounded-none"
                      onClick={handleBuy}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {lang === "it" ? "Acquista ora" : "Buy now"}
                    </Button>
                  )}
                  <Link href={`/course/${course.id}/activate`}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full uppercase tracking-wider font-bold rounded-none border-white/20 hover:border-primary hover:text-primary transition-all"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Attiva con codice
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
                  Accesso esclusivo tramite link di prenotazione ufficiale o codice privato.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>


      <Footer />
    </div>
  );
}
