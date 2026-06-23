import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { resolveCoverUrl } from "@/lib/media-utils";
import { useStudentCourses, useVideoToken, useUpdateProgress, useDisclaimerAck, useAcknowledgeDisclaimer } from "@/hooks/use-courses";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { useEffect, useCallback, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, CheckCircle, Clock, LogOut, KeyRound, Lock, BookOpen, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoDisclaimerModal } from "@/components/VideoDisclaimerModal";
import { useLang } from "@/i18n/LanguageContext";

export default function StudentDashboard() {
  const { t } = useLang();
  const sd = t.studentDashboard;
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { mutate: logout } = useLogout();
  const queryClient = useQueryClient();

  const urlCourseId = (() => {
    const params = new URLSearchParams(search);
    const v = params.get("courseId");
    return v ? parseInt(v, 10) : null;
  })();

  const isStudent = !authLoading && user?.role === "student";
  const { data: courses, isLoading: coursesLoading } = useStudentCourses(isStudent);
  const { mutate: updateProgress } = useUpdateProgress();

  const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [manuallyCompleted, setManuallyCompleted] = useState<Set<number>>(new Set());
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Disclaimer logic ────────────────────────────────────────────────────────
  const { data: ackData, isLoading: ackLoading } = useDisclaimerAck(activeCourseId || 0);
  const { mutate: acknowledgeDisclaimer } = useAcknowledgeDisclaimer();

  const disclaimerConfirmed = ackData?.acknowledged === true;

  const showDisclaimerModal =
    !ackLoading &&
    !disclaimerConfirmed &&
    activeCourseId !== null &&
    activeModuleId !== null;

  const handleDisclaimerConfirm = useCallback(() => {
    if (!activeCourseId) return;
    acknowledgeDisclaimer(activeCourseId);
  }, [activeCourseId, acknowledgeDisclaimer]);
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setLocation("/login");
      } else if (user.role === "customer") {
        setLocation("/my-courses");
      } else if (user.role !== "student") {
        setLocation("/login");
      }
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    if (urlCourseId && !activeCourseId) {
      const target = courses.find((c: any) => c.id === urlCourseId);
      if (target) {
        setActiveCourseId(target.id);
        if (target.modules && target.modules.length > 0) {
          setActiveModuleId(target.modules[0].id);
        }
        return;
      }
    }
    if (!activeCourseId) {
      setActiveCourseId(courses[0].id);
      if (courses[0].modules && courses[0].modules.length > 0) {
        setActiveModuleId(courses[0].modules[0].id);
      }
    }
  }, [courses, activeCourseId, urlCourseId]);

  // Fetch protected stream URL — only after disclaimer confirmed
  const { data: videoData, isLoading: videoLoading } = useVideoToken(
    disclaimerConfirmed ? (activeCourseId || 0) : 0,
    disclaimerConfirmed ? (activeModuleId || 0) : 0,
  );

  const activeCourse = courses?.find((c: any) => c.id === activeCourseId);
  const activeModule = activeCourse?.modules?.find((m: any) => m.id === activeModuleId);

  // Resolve the stream URL to absolute: the backend returns a relative path (/api/video/stream?token=...)
  // which must be prefixed with VITE_API_URL (the backend domain) — the <video> src is NOT routed via fetchApi.
  const _apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const resolvedStreamUrl = videoData?.streamUrl
    ? (videoData.streamUrl.startsWith("/") ? `${_apiBase}${videoData.streamUrl}` : videoData.streamUrl)
    : null;

  // Debug: log video URLs to console so the browser DevTools shows the actual URLs
  useEffect(() => {
    if (!disclaimerConfirmed || !activeCourseId || !activeModuleId) return;
    const rawUrl = activeModule?.videoUrl ?? "(nessun video nel modulo)";
    const streamUrl = resolvedStreamUrl ?? "(streamUrl non ancora disponibile)";
    console.log("[video-debug] rawVideoUrl:", rawUrl);
    console.log("[video-debug] streamUrl:", streamUrl);
    if (resolvedStreamUrl) {
      console.log("[video-debug] Testing stream HEAD:", resolvedStreamUrl);
      fetch(resolvedStreamUrl, { method: "HEAD" })
        .then(r => console.log(`[video-debug] HEAD → ${r.status}, content-type: ${r.headers.get("content-type")}, content-length: ${r.headers.get("content-length")}, accept-ranges: ${r.headers.get("accept-ranges")}`))
        .catch(e => console.error("[video-debug] HEAD error:", e.message));
    }
  }, [resolvedStreamUrl, activeModule, disclaimerConfirmed, activeCourseId, activeModuleId]);

  // ─── Auto-save video progress every 15s ──────────────────────────────────────
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (!videoData?.streamUrl || !activeModuleId) return;

    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      updateProgress({
        moduleId: activeModuleId,
        progressSeconds: Math.floor(video.currentTime),
        completed: false,
      });
    }, 15_000);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [videoData?.streamUrl, activeModuleId, updateProgress]);

  // Reset player and error state when module changes
  useEffect(() => {
    setVideoError(null);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.load();
    }
  }, [activeModuleId]);

  // Let student manually mark a lesson as completed
  const handleMarkCompleted = useCallback(() => {
    if (!activeModuleId) return;
    setManuallyCompleted(prev => new Set([...prev, activeModuleId]));
    updateProgress({
      moduleId: activeModuleId,
      progressSeconds: Math.floor(videoRef.current?.currentTime || 0),
      completed: true,
    });
  }, [activeModuleId, updateProgress]);

  if (authLoading || coursesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 px-4 space-y-4 max-w-3xl mx-auto">
          <Skeleton className="h-12 w-48 bg-white/5" />
          <Skeleton className="h-[40vh] w-full bg-white/5" />
          <Skeleton className="h-24 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  const noCourses = !courses || courses.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {showDisclaimerModal && (
        <VideoDisclaimerModal onConfirm={handleDisclaimerConfirm} />
      )}

      <main className="flex-1 pt-20 md:pt-24">
        {/* Header */}
        <div className="bg-card border-b border-white/5 py-5 px-4">
          <div className="container mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-tighter">
                {sd.title}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{sd.welcomeBack} {user?.name}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="text-xs uppercase tracking-widest shrink-0 h-10 px-4"
            >
              <LogOut className="w-4 h-4 mr-2" /> {sd.logout}
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 md:py-8">
          {noCourses ? (
            <div className="max-w-md mx-auto text-center py-14 md:py-24">
              <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-9 h-9 text-primary/60" />
              </div>
              <h2 className="text-2xl font-display text-white uppercase mb-3">{sd.noCoursesTitle}</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed text-sm">
                {sd.noCoursesDesc}
              </p>
              <Button
                size="lg"
                onClick={() => setLocation("/access")}
                className="w-full sm:w-auto h-14 text-base font-bold uppercase tracking-wider px-8"
              >
                <KeyRound className="w-5 h-5 mr-2" /> {sd.activateCode}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Course tabs if multiple */}
              {courses.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {courses.map((course: any) => (
                    <button
                      key={course.id}
                      onClick={() => {
                        setActiveCourseId(course.id);
                        setActiveModuleId(course.modules?.[0]?.id || null);
                      }}
                      className={cn(
                        "shrink-0 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap",
                        course.id === activeCourseId
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-white/10 text-muted-foreground hover:text-white hover:bg-white/5"
                      )}
                    >
                      {course.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Video card + info */}
                <div className="lg:col-span-2 space-y-4">

                  {/* ── VIDEO CARD ── */}
                  <div className="bg-card border border-white/10 rounded-lg overflow-hidden shadow-2xl">

                    {/* ── Player area ── */}
                    <div className="relative w-full aspect-video bg-black">
                      {!disclaimerConfirmed ? (
                        /* Locked — disclaimer not accepted yet */
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                          {resolveCoverUrl(activeCourse) && (
                            <img
                              src={resolveCoverUrl(activeCourse)!}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover opacity-20"
                              loading="eager"
                              decoding="async"
                            />
                          )}
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-primary/20 border border-primary/40 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <Shield className="w-7 h-7 text-primary/70" />
                            </div>
                            <p className="text-white/70 text-sm max-w-xs">
                              {sd.readNotice}
                            </p>
                          </div>
                        </div>
                      ) : videoLoading ? (
                        /* Loading token — spinner only while query is in flight */
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          {resolveCoverUrl(activeCourse) && (
                            <img
                              src={resolveCoverUrl(activeCourse)!}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover opacity-20"
                              loading="eager"
                              decoding="async"
                            />
                          )}
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-white/60 text-sm">{sd.loadingLesson}</p>
                          </div>
                        </div>
                      ) : resolvedStreamUrl ? (
                        /* ── Inline video player ── */
                        <div className="relative w-full h-full">
                          <video
                            ref={videoRef}
                            key={`${activeModuleId}-${resolvedStreamUrl}`}
                            src={resolvedStreamUrl}
                            controls
                            playsInline
                            preload="metadata"
                            poster={resolveCoverUrl(activeCourse) || undefined}
                            className="w-full h-full object-contain bg-black"
                            onEnded={() => {
                              if (!activeModuleId) return;
                              setManuallyCompleted(prev => new Set([...prev, activeModuleId]));
                              updateProgress({ moduleId: activeModuleId, progressSeconds: Math.floor(videoRef.current?.duration || 0), completed: true });
                            }}
                            onError={(e) => {
                              const vid = e.target as HTMLVideoElement;
                              const code = vid.error?.code ?? -1;
                              const msg = vid.error?.message ?? "Errore sconosciuto";
                              console.error(`[player] video error code=${code}:`, msg, "src:", vid.currentSrc);
                              setVideoError(sd.videoNotPlayable);
                            }}
                          />

                          {/* Error overlay — shown when video fails to load */}
                          {videoError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-20 text-center px-6">
                              <p className="text-red-400 text-sm font-medium">{videoError}</p>
                              <button
                                className="text-xs text-white/50 underline"
                                onClick={() => {
                                  setVideoError(null);
                                  queryClient.invalidateQueries({ queryKey: ["video-token", activeCourseId, activeModuleId] });
                                }}
                              >
                                {sd.retry}
                              </button>
                            </div>
                          )}

                          {/* Watermark — top-right corner, non-blocking */}
                          {!videoError && videoData.watermarkEmail && (
                            <div className="absolute top-2 right-2 pointer-events-none select-none z-10">
                              <p className="text-white/25 text-[10px] font-mono leading-tight text-right drop-shadow">
                                {videoData.watermarkName}<br />{videoData.watermarkEmail}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* No video URL */
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                          <Play className="w-10 h-10 text-white/20" />
                          <p className="text-white/40 text-sm">{sd.videoNotYet}</p>
                        </div>
                      )}
                    </div>

                    {/* ── Below-player controls ── */}
                    <div className="px-5 py-4 space-y-3">
                      {/* Lesson title */}
                      {activeModule && (
                        <div>
                          <p className="text-white font-bold text-base leading-snug">{activeModule.title}</p>
                          {activeModule.description && (
                            <p className="text-muted-foreground text-sm mt-0.5 line-clamp-2">{activeModule.description}</p>
                          )}
                        </div>
                      )}

                      {/* Mark completed / completed badge */}
                      {disclaimerConfirmed && videoData?.streamUrl && (() => {
                        const isCompleted = activeModule?.completed || manuallyCompleted.has(activeModuleId!);
                        return isCompleted ? (
                          <div className="flex items-center gap-2 text-green-400 text-sm font-medium py-1">
                            <CheckCircle className="w-4 h-4" />
                            {sd.lessonCompleted}
                          </div>
                        ) : (
                          <button
                            onClick={handleMarkCompleted}
                            className="w-full flex items-center justify-center gap-2 border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 text-muted-foreground hover:text-green-400 text-sm py-2.5 rounded-lg transition-all"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {sd.markCompleted}
                          </button>
                        );
                      })()}

                      {/* Security note + duration */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-white/5">
                        <p className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
                          <Shield className="w-3 h-3 shrink-0" />
                          {sd.protectedAccess}
                        </p>
                        {activeModule?.durationMinutes && (
                          <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {activeModule.durationMinutes} min
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Course info card */}
                  {activeCourse && (
                    <div className="bg-card border border-white/5 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-white font-bold text-base md:text-lg leading-tight">{activeCourse.title}</h2>
                          {activeCourse.shortDescription && (
                            <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{activeCourse.shortDescription}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground uppercase tracking-widest">{sd.progress}</div>
                          <div className="text-2xl font-bold text-primary">{Math.round(activeCourse.progress || 0)}%</div>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${activeCourse.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Module list */}
                <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">{sd.modules}</h3>
                    {activeCourse?.modules && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {activeCourse.modules.filter((m: any) => m.completed || manuallyCompleted.has(m.id)).length}/{activeCourse.modules.length}
                      </span>
                    )}
                  </div>

                  {(!activeCourse?.modules || activeCourse.modules.length === 0) ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm px-4 text-center">
                      {sd.noModules}
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-72 lg:max-h-[500px] p-3 space-y-1.5">
                      {activeCourse.modules.map((module: any, index: number) => {
                        const isActive = module.id === activeModuleId;
                        const isCompleted = module.completed || manuallyCompleted.has(module.id);
                        return (
                          <button
                            key={module.id}
                            onClick={() => setActiveModuleId(module.id)}
                            className={cn(
                              "w-full text-left p-3.5 rounded-lg flex gap-3 transition-all duration-200 border min-h-[52px]",
                              isActive
                                ? "bg-primary/10 border-primary/30"
                                : "hover:bg-white/5 border-transparent active:bg-white/10"
                            )}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-muted-foreground flex items-center justify-center text-[10px] text-muted-foreground font-bold">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={cn(
                                  "font-medium text-sm leading-snug",
                                  isActive ? "text-white" : "text-gray-300",
                                  isCompleted && "text-green-400/90"
                                )}>
                                  {module.title}
                                </p>
                                {isCompleted && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400/70 bg-green-400/10 px-1.5 py-0.5 rounded shrink-0">
                                    {sd.completedBadge}
                                  </span>
                                )}
                              </div>
                              {module.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
                              )}
                              {module.durationMinutes && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{module.durationMinutes} min
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
