import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  BookOpen, CheckCircle,
  Loader2, ArrowRight, ShoppingBag,
} from "lucide-react";
import { resolveCoverUrl } from "@/lib/media-utils";

interface MyCourse {
  id:              number;
  courseId:        number;
  courseTitle:     string;
  courseThumbnail: string | null;
  courseDescription: string | null;
  purchaseStatus:  string;
  amountPaid:      number;
  activated:       boolean;
  unlockedAt:      string;
  createdAt:       string;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function CourseThumbnail({ course, alt }: { course: any; alt: string }) {
  const [broken, setBroken] = useState(false);
  const src = resolveCoverUrl(course);
  if (!src || broken) {
    return (
      <div className="w-20 h-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <BookOpen className="text-primary/50" size={28} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-20 h-20 rounded-xl object-cover shrink-0 bg-white/5"
      loading="eager"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export default function MyCourses() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  // Read ?unlocked= param — courseId just activated via code
  const unlockedCourseId = (() => {
    const p = new URLSearchParams(window.location.search).get("unlocked");
    const n = parseInt(p ?? "", 10);
    return isNaN(n) ? null : n;
  })();

  // Refs for course cards so we can scroll to the new one
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlightedId, setHighlightedId] = useState<number | null>(unlockedCourseId);

  // Only redirect if not logged in at all — both customer and student roles can access this page.
  // (requireCustomerAuth on the backend accepts both roles)
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "customer" && user.role !== "student"))) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: courses = [], isLoading } = useQuery<MyCourse[]>({
    queryKey: ["customer", "my-courses"],
    queryFn:  () => fetchApi("/customer/my-courses"),
    // Allow both customer and student roles to fetch their courses
    enabled:  !!user && (user.role === "customer" || user.role === "student"),
    refetchOnWindowFocus: false,
  });

  // Scroll to and highlight the newly unlocked course once cards render
  useEffect(() => {
    if (!unlockedCourseId || courses.length === 0) return undefined;
    const el = cardRefs.current.get(unlockedCourseId);
    if (!el) return undefined;
    const scrollTimer = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    // Remove highlight after 4 seconds
    const hideTimer = setTimeout(() => setHighlightedId(null), 4000);
    return () => { clearTimeout(scrollTimer); clearTimeout(hideTimer); };
  }, [unlockedCourseId, courses]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!user || (user.role !== "customer" && user.role !== "student")) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20 md:pt-24">
        {/* Header */}
        <div className="bg-card border-b border-white/5 py-6 px-4">
          <div className="container mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <BookOpen className="text-primary" size={24} />
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-tighter">
                I miei corsi
              </h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Corsi sbloccati — {user.name}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {courses.length === 0 ? (
            /* Empty state */
            <div className="max-w-md mx-auto text-center py-16">
              <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-9 h-9 text-primary/60" />
              </div>
              <h2 className="text-xl font-display text-white uppercase mb-3">Nessun corso sbloccato</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed text-sm">
                Non hai ancora sbloccato nessun corso. Hai un codice di accesso? Vai in Academy e inseriscilo per sbloccare il tuo corso.
              </p>
              <button
                onClick={() => setLocation("/academy")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 text-white font-bold uppercase tracking-wider rounded-xl text-sm transition-colors"
              >
                <BookOpen size={16} /> Vai all'Academy
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-5">
                {courses.length} corso{courses.length !== 1 ? "i" : ""} sbloccato{courses.length !== 1 ? "i" : ""}
              </p>

              {courses.map((course) => {
                const isNew = highlightedId === course.courseId;
                return (
                <div
                  key={course.id}
                  ref={(el) => { if (el) cardRefs.current.set(course.courseId, el); else cardRefs.current.delete(course.courseId); }}
                  className={`bg-card rounded-2xl overflow-hidden transition-all duration-700 ${
                    isNew
                      ? "border-2 border-green-400 shadow-lg shadow-green-500/20"
                      : "border border-white/8 hover:border-white/15"
                  }`}
                >
                  {/* Thumbnail + info */}
                  <div className="flex gap-4 p-5">
                    <CourseThumbnail course={course} alt={course.courseTitle} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-white leading-tight">{course.courseTitle}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isNew && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400 text-black font-bold uppercase tracking-wider animate-pulse">
                              Nuovo!
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">
                            <CheckCircle size={11} /> Attivo
                          </span>
                        </div>
                      </div>
                      {course.courseDescription && (
                        <p className="text-sm text-white/40 line-clamp-2 mb-2">{course.courseDescription}</p>
                      )}
                      <p className="text-xs text-white/25">
                        Sbloccato il {fmt(course.unlockedAt || course.createdAt)}
                        {course.amountPaid > 0 ? ` · €${course.amountPaid.toFixed(2)}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Action: access course content */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => {
                        if (user?.role === "student") {
                          setLocation(`/dashboard?courseId=${course.courseId}`);
                        } else {
                          setLocation("/access");
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl text-sm transition-colors"
                    >
                      <ArrowRight size={16} /> Accedi al corso
                    </button>
                  </div>
                </div>
                );
              })}

              {/* Help */}
              <div className="bg-white/3 border border-white/5 rounded-xl p-4 text-center">
                <p className="text-sm text-white/40">
                  Hai un altro codice?{" "}
                  <button
                    onClick={() => setLocation("/academy")}
                    className="text-primary hover:underline"
                  >
                    Vai in Academy per sbloccarlo
                  </button>
                  {" "}o contatta Giuseppe via{" "}
                  <button
                    onClick={() => setLocation("/chat")}
                    className="text-primary hover:underline"
                  >
                    chat
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
