import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  ArrowLeft, Bell, MessageSquare, KeyRound, BookOpen,
  ShoppingCart, User, Zap, Megaphone, Play, ExternalLink,
  Loader2, AlertTriangle, X, ZoomIn, Video, Calendar, Tag, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NotifType = string;

function notifIcon(type: NotifType, size = 22) {
  switch (type) {
    case "chat_message":        return <MessageSquare size={size} className="text-primary" />;
    case "course_code_assigned":
    case "code_resent":         return <KeyRound size={size} className="text-blue-400" />;
    case "course_update":       return <BookOpen size={size} className="text-blue-400" />;
    case "order_update":
    case "purchase":            return <ShoppingCart size={size} className="text-green-400" />;
    case "account_update":      return <User size={size} className="text-primary" />;
    case "promo_notification":
    case "discount_code":       return <Tag size={size} className="text-amber-400" />;
    case "broadcast":
    case "admin_notification":
    case "private_message":     return <Megaphone size={size} className="text-primary" />;
    default:                    return <Bell size={size} className="text-primary" />;
  }
}

function notifTypeLabel(type: NotifType, t: any): string {
  const ty = t.notifications.types;
  switch (type) {
    case "chat_message":        return ty.message;
    case "course_code_assigned":return ty.courseCode;
    case "code_resent":         return ty.codeResent;
    case "course_update":       return ty.courseUpdate;
    case "order_update":
    case "purchase":            return ty.order;
    case "account_update":      return ty.account;
    case "promo_notification":  return ty.promo;
    case "discount_code":       return ty.coupon;
    case "admin_notification":
    case "private_message":     return ty.adminComm;
    case "broadcast":           return ty.broadcast;
    case "reminder":            return ty.reminder;
    case "system_notification": return ty.system;
    default:                    return ty.default;
  }
}

function notifTypeBadgeColor(type: NotifType): string {
  switch (type) {
    case "chat_message":        return "bg-primary/15 text-primary border-primary/20";
    case "course_code_assigned":
    case "code_resent":
    case "course_update":       return "bg-blue-500/15 text-blue-300 border-blue-500/20";
    case "order_update":
    case "purchase":            return "bg-green-500/15 text-green-300 border-green-500/20";
    case "promo_notification":
    case "discount_code":       return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    default:                    return "bg-white/8 text-white/60 border-white/10";
  }
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors z-10"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt="Immagine notifica"
        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Video Player (uses server-issued token to bypass 403 on GCS videos) ──────

function VideoPlayer({ notifId }: { notifId: number }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const { t } = useLang();
  const td = t.notifDetail;
  const videoRef = useRef<HTMLVideoElement>(null);

  async function loadVideo() {
    setState("loading");
    setErrorMsg("");
    console.log("[VideoPlayer] Fetching video token for notification:", notifId);
    try {
      const data = await fetchApi<{ token: string; streamUrl: string }>(
        `/customer/notifications/${notifId}/video-token`
      );
      console.log("[VideoPlayer] Got streamUrl:", data.streamUrl);
      setStreamUrl(data.streamUrl);
      setState("ready");
    } catch (err: any) {
      const msg = err.message || td.videoError;
      console.error("[VideoPlayer] Error fetching token:", msg);
      setErrorMsg(msg);
      setState("error");
    }
  }

  function handleVideoError() {
    const v = videoRef.current;
    if (!v) return;
    const code = v.error?.code ?? 0;
    const mediaErr = [
      "", "MEDIA_ERR_ABORTED", "MEDIA_ERR_NETWORK",
      "MEDIA_ERR_DECODE", "MEDIA_ERR_SRC_NOT_SUPPORTED",
    ][code] || "UNKNOWN";
    console.error("[VideoPlayer] HTMLVideoElement error:", mediaErr, v.error?.message);
    setErrorMsg(`${td.playerError} ${mediaErr}`);
    setState("error");
  }

  if (state === "idle") {
    return (
      <div
        className="relative rounded-2xl overflow-hidden bg-black/70 border border-white/10 cursor-pointer group"
        onClick={loadVideo}
      >
        <div className="flex flex-col items-center justify-center py-14 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center group-hover:bg-primary/35 transition-colors">
            <Play size={28} className="text-primary ml-1" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold">{td.videoAttached}</p>
            <p className="text-white/40 text-sm mt-1">{td.tapToPlay}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 flex flex-col items-center justify-center py-14 gap-3">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-white/50 text-sm">{td.videoLoading}</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/8 flex flex-col items-center justify-center py-10 gap-3 px-4">
        <AlertTriangle size={28} className="text-red-400" />
        <div className="text-center">
          <p className="text-red-300 font-semibold text-sm">{td.videoError}</p>
          {errorMsg && <p className="text-red-400/60 text-xs mt-1">{errorMsg}</p>}
        </div>
        <button
          onClick={loadVideo}
          className="mt-1 flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold text-sm rounded-xl transition-colors"
        >
          <Play size={14} /> {td.retry}
        </button>
        {streamUrl && (
          <a
            href={streamUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <ExternalLink size={12} /> {td.openNewTab}
          </a>
        )}
      </div>
    );
  }

  // state === "ready"
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
      <video
        ref={videoRef}
        src={streamUrl!}
        controls
        autoPlay
        playsInline
        className="w-full max-h-[60vh]"
        controlsList="nodownload"
        onError={handleVideoError}
        onLoadStart={() => console.log("[VideoPlayer] Video load started:", streamUrl)}
        onCanPlay={() => console.log("[VideoPlayer] Video can play")}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NotificationDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const td = t.notifDetail;
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [lightbox, setLightbox] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const notifId = parseInt(params.id || "");

  // Both customers AND students can view notifications.
  // A customer who activates a course code becomes a "student" but must still read their notifs.
  const isAuthorized = !!user && (user.role === "customer" || user.role === "student");

  const { data: notif, isLoading, isError } = useQuery({
    queryKey:  ["notification", notifId],
    queryFn:   () => fetchApi<any>(`/customer/notifications/${notifId}`),
    enabled:   isAuthorized && !isNaN(notifId),
    staleTime: 0,
  });

  // After loading the notification (which auto-marks as read on the server),
  // invalidate the notification list so the unread counter updates
  useEffect(() => {
    if (notif) {
      queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
    }
  }, [notif, queryClient]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!userLoading && !isAuthorized) {
      setLocation("/login");
    }
  }, [isAuthorized, userLoading, setLocation]);

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  if (isNaN(notifId) || isError) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navbar />
        <main className="pt-32 pb-20 px-4 text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">{td.notFoundTitle}</h1>
          <p className="text-muted-foreground mb-6">{td.notFoundDesc}</p>
          <button
            onClick={() => setLocation("/notifications")}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            <ArrowLeft size={16} /> {td.backToNotifs}
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const meta: Record<string, any> = (() => {
    try { return notif?.metadata ? JSON.parse(notif.metadata) : {}; } catch { return {}; }
  })();

  const hasImage = !!notif?.imageUrl;
  const hasVideo = !!notif?.videoUrl;
  const hasLink  = !!notif?.linkUrl;
  const isChat   = notif?.type === "chat_message";

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Back button */}
          <button
            onClick={() => setLocation("/notifications")}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            {td.notifCenter}
          </button>

          {/* Hero image */}
          {hasImage && (
            <div
              className="relative rounded-2xl overflow-hidden mb-6 cursor-zoom-in group"
              onClick={() => setLightbox(true)}
            >
              <img
                src={notif.imageUrl}
                alt="Immagine allegata"
                className="w-full max-h-72 object-cover group-hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-white/80 text-xs">
                <ZoomIn size={12} /> {td.openLarge}
              </div>
            </div>
          )}

          {/* Card */}
          <div className="bg-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">

            {/* Header */}
            <div className="p-6 pb-0">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                  ["promo_notification","discount_code"].includes(notif?.type) ? "bg-amber-500/15" :
                  ["purchase","order_update"].includes(notif?.type) ? "bg-green-500/15" :
                  ["course_code_assigned","code_resent","course_update"].includes(notif?.type) ? "bg-blue-500/15" :
                  "bg-primary/15"
                )}>
                  {notif && notifIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {notif && (
                      <span className={cn("text-xs font-semibold px-2 py-1 rounded-lg border", notifTypeBadgeColor(notif.type))}>
                        {notifTypeLabel(notif.type, t)}
                      </span>
                    )}
                    {notif?.isRead === false && (
                      <span className="text-xs px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary font-semibold">
                        {td.unreadBadge}
                      </span>
                    )}
                    {hasImage && (
                      <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-white/40 flex items-center gap-1">
                        📷 {td.imageBadge}
                      </span>
                    )}
                    {hasVideo && (
                      <span className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-white/40 flex items-center gap-1">
                        <Video size={10} /> {td.videoBadge}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-display font-bold text-white leading-tight">
                    {notif?.title}
                  </h1>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="mx-6 my-5 border-t border-white/8" />

            {/* Body */}
            <div className="px-6 pb-6 space-y-6">

              {/* Message text */}
              <div>
                <p className="text-white/80 leading-relaxed text-base whitespace-pre-wrap">
                  {notif?.message}
                </p>
              </div>

              {/* Access code */}
              {notif?.accessCode && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-5 py-4 flex items-center gap-3">
                  <KeyRound size={20} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-primary/70 font-semibold uppercase tracking-wide mb-1">{td.yourAccessCode}</p>
                    <span className="font-mono font-bold text-primary tracking-[0.3em] text-2xl">
                      {notif.accessCode}
                    </span>
                  </div>
                </div>
              )}

              {/* Video player */}
              {hasVideo && <VideoPlayer notifId={notifId} />}

              {/* Meta info */}
              <div className="space-y-2 text-sm text-white/40">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="shrink-0" />
                  <span>{notif && formatDate(notif.createdAt, lang)}</span>
                </div>
                {meta.senderName && (
                  <div className="flex items-center gap-2">
                    <User size={14} className="shrink-0" />
                    <span>{td.from} <span className="text-white/60 font-semibold">{meta.senderName}</span></span>
                  </div>
                )}
                {notif?.type && (
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="shrink-0" />
                    <span>{notifTypeLabel(notif.type, t)}</span>
                  </div>
                )}
              </div>

              {/* Coupon code highlight — accessCode used to carry the coupon string */}
              {notif?.type === "discount_code" && notif?.accessCode && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-5 py-4 flex items-center gap-3">
                  <Tag size={20} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-400/70 font-semibold uppercase tracking-wide mb-1">{td.yourCoupon}</p>
                    <span className="font-mono font-bold text-amber-300 tracking-[0.3em] text-2xl">
                      {notif.accessCode}
                    </span>
                    <p className="text-xs text-white/40 mt-1">{td.couponHint}</p>
                  </div>
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
                {isChat && (
                  <button
                    onClick={() => setLocation("/chat")}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    <MessageSquare size={16} /> {td.openChat}
                  </button>
                )}

                {/* Copia coupon — for discount_code notifications */}
                {notif?.type === "discount_code" && notif?.accessCode && (
                  <>
                    <button
                      onClick={() => copyCode(notif.accessCode)}
                      className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? td.copied : td.copyCoupon}
                    </button>
                    <button
                      onClick={() => setLocation("/academy")}
                      className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                    >
                      <BookOpen size={16} /> {td.goCourses}
                    </button>
                  </>
                )}

                {/* Copia codice — for access codes (non-coupon) */}
                {notif?.type !== "discount_code" && notif?.accessCode && (
                  <button
                    onClick={() => copyCode(notif.accessCode)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? td.copied : td.copyCode}
                  </button>
                )}

                {/* Vai al corso — for code-based notifications */}
                {(notif?.type === "course_code_assigned" || notif?.type === "code_resent") && (
                  <button
                    onClick={() => {
                      const courseId = notif?.courseId;
                      const code = notif?.accessCode;
                      if (courseId && user?.role === "student") {
                        setLocation(`/course/${courseId}`);
                      } else if (courseId) {
                        const url = `/course/${courseId}/activate${code ? `?code=${code}` : ""}`;
                        setLocation(url);
                      } else {
                        setLocation("/my-courses");
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    <BookOpen size={16} /> {user?.role === "student" ? td.goToCourse : td.accessCourse}
                  </button>
                )}

                {/* Purchase notification CTA — smart routing: locked → activate page, unlocked → course */}
                {(notif?.type === "purchase" || notif?.type === "order_update") && (
                  <button
                    onClick={() => {
                      const courseId = notif?.courseId;
                      const code = notif?.accessCode;
                      if (user?.role === "student" && courseId) {
                        setLocation(`/course/${courseId}`);
                      } else if (courseId) {
                        const url = `/course/${courseId}/activate${code ? `?code=${code}` : ""}`;
                        setLocation(url);
                      } else {
                        setLocation("/my-courses");
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    <BookOpen size={16} /> {user?.role === "student" ? td.accessCourse : td.unlockCourse}
                  </button>
                )}

                {/* Generic external link — only for non-course, non-chat, non-purchase notifications */}
                {hasLink && !isChat &&
                  notif?.type !== "course_code_assigned" &&
                  notif?.type !== "code_resent" &&
                  notif?.type !== "purchase" &&
                  notif?.type !== "order_update" &&
                  notif?.linkUrl?.startsWith("http") && (
                  <a
                    href={notif.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    <ExternalLink size={16} /> {td.openContent}
                  </a>
                )}

                {hasImage && (
                  <button
                    onClick={() => setLightbox(true)}
                    className="flex items-center justify-center gap-2 border border-white/15 hover:border-white/25 text-white/60 hover:text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
                  >
                    <ZoomIn size={16} /> {td.viewImage}
                  </button>
                )}
                <button
                  onClick={() => setLocation("/notifications")}
                  className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 text-white/40 hover:text-white px-5 py-3 rounded-xl text-sm transition-colors sm:ml-auto"
                >
                  <ArrowLeft size={16} /> {td.allNotifs}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {lightbox && hasImage && (
        <Lightbox src={notif.imageUrl} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}
