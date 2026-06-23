import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { KeyRound, CheckCircle, ArrowRight, LogIn, Lock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-auth";
import { fetchApi } from "@/lib/api-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { resolveCoverUrl } from "@/lib/media-utils";
import { useLang } from "@/i18n/LanguageContext";

export default function ActivateCourse() {
  const { t } = useLang();
  const at = t.activateCourse;
  const activateSchema = z.object({
    code: z.string().min(1, at.errCode),
    email: z.string().email(at.errEmail),
    name: z.string().min(2, at.errName),
  });
  const { courseId: courseIdStr } = useParams<{ courseId: string }>();
  const courseId = parseInt(courseIdStr ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activated, setActivated] = useState(false);
  const [activatedCourseId, setActivatedCourseId] = useState<number | null>(null);

  // Read ?code= from URL once (stable — window.location doesn't change on mount)
  const urlCode = new URLSearchParams(window.location.search).get("code") ?? "";

  const { data: user, isLoading: checkingAuth } = useCurrentUser();

  // Corso: staleTime alto → se già in cache non ri-fetcha (pagina si apre subito)
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["courses", courseId],
    queryFn: () => fetchApi<any>(`/courses/${courseId}`),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,   // 5 minuti — usa cache se disponibile
    gcTime:    10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const coverUrl = resolveCoverUrl(course);

  const form = useForm({
    resolver: zodResolver(activateSchema),
    defaultValues: { code: urlCode, email: "", name: "" },
  });

  // Pre-compila email e nome una volta che l'utente è noto
  useEffect(() => {
    if (!user) return;
    if (user.email) form.setValue("email", user.email);
    const fullName =
      user.name ||
      (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
      user.firstName ||
      user.email?.split("@")[0] ||
      "Cliente IUSMK";
    form.setValue("name", fullName);
  }, [user?.email]);   // dipendenza stabile — reagisce solo al cambio email

  const activateMutation = useMutation({
    mutationFn: (data: { code: string; email: string; name: string }) =>
      fetchApi<any>("/access/activate", {
        method: "POST",
        // courseId viene sempre inviato così il backend può verificare
        // che il codice appartenga esattamente al corso della pagina corrente.
        body: JSON.stringify({ ...data, courseId, fingerprint: getDeviceFingerprint() }),
      }, false),
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem("barber_artist_token", data.token);
        if (data.student) queryClient.setQueryData(["current-user"], data.student);
        queryClient.invalidateQueries({ queryKey: ["customer", "my-courses"] });
        queryClient.invalidateQueries({ queryKey: ["owned-course-ids"] });
        queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
      }
      setActivatedCourseId(data.courseId ?? courseId);
      setActivated(true);
    },
  });

  const onSubmit = (data: any) => activateMutation.mutate(data);

  // ── Skeleton minimo mentre verifichiamo auth (< 300ms tipicamente) ──────────
  // Non blocchiamo il render — mostriamo subito qualcosa di utile.
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4 pt-24">
          <div className="w-full max-w-md space-y-4">
            <div className="h-48 bg-white/5 rounded-lg animate-pulse" />
            <div className="bg-card border border-white/10 p-8 space-y-4">
              <div className="h-8 w-48 bg-white/5 rounded animate-pulse mx-auto" />
              <div className="h-4 w-64 bg-white/5 rounded animate-pulse mx-auto" />
              <div className="h-14 bg-white/5 rounded animate-pulse" />
              <div className="h-12 bg-white/5 rounded animate-pulse" />
              <div className="h-14 bg-primary/20 rounded animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Non loggato: prompt login ────────────────────────────────────────────────
  if (!user) {
    const returnPath = `/course/${courseId}/activate${urlCode ? `?code=${urlCode}` : ""}`;
    return (
      <div className="min-h-screen bg-background flex flex-col relative">
        <Navbar />
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[100px] rounded-full" />
        </div>
        <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="bg-card border border-white/10 p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-primary/50 m-2" />
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wider mb-2">
                  {at.loginTitle}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {at.loginDesc}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  className="w-full h-12 text-base font-bold uppercase tracking-wider"
                  onClick={() => {
                    sessionStorage.setItem("checkout_redirect", returnPath);
                    setLocation("/login");
                  }}
                >
                  <LogIn className="mr-2 h-4 w-4" /> {at.login}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-bold uppercase tracking-wider border-white/20"
                  onClick={() => {
                    sessionStorage.setItem("checkout_redirect", returnPath);
                    setLocation("/register");
                  }}
                >
                  {at.createAccount}
                </Button>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ── Loggato: form attivazione ────────────────────────────────────────────────
  const isLoggedIn = true;

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <Navbar />

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[100px] rounded-full" />
      </div>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-24 pb-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          {/* ── Copertina corso ───────────────────────────────────────────────
              Mostrata subito se già in cache; skeleton leggero se ancora loading.
              Il form è utilizzabile a prescindere — non aspetta l'immagine.
          ─────────────────────────────────────────────────────────────────── */}
          {courseLoading ? (
            <div className="h-44 mb-4 bg-white/5 rounded-lg animate-pulse" />
          ) : coverUrl ? (
            <div className="relative mb-4 overflow-hidden rounded-lg aspect-video w-full shadow-xl">
              <img
                src={coverUrl}
                alt={course?.title ?? "Corso"}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              {course?.title && (
                <div className="absolute bottom-3 left-4 right-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">{at.courseBadge}</span>
                  <h2 className="text-white font-display font-bold text-lg leading-tight">
                    {course.title}
                  </h2>
                </div>
              )}
            </div>
          ) : null}

          <div className="bg-card border border-white/10 p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-primary/50 m-2" />

            {/* ── STATO SUCCESSO ── */}
            {activated ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-500/15 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wider mb-2">
                  {at.unlockedTitle}
                </h1>
                {course?.title && (
                  <p className="text-muted-foreground text-sm mb-6">
                    {at.unlockedDescPre}{" "}
                    <span className="text-white font-semibold">"{course.title}"</span>.{" "}
                    {at.unlockedDescPost}
                  </p>
                )}
                <Button
                  className="w-full h-12 text-base font-bold uppercase tracking-wider"
                  onClick={() => setLocation(`/my-courses?unlocked=${activatedCourseId ?? courseId}`)}
                >
                  {at.goToCourse} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              /* ── FORM ATTIVAZIONE — sempre utilizzabile subito ── */
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wider mb-2">
                    {course || courseLoading ? at.unlockTitle : at.activateWithCode}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {at.subtitle}
                  </p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Codice */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {at.codeLabel}
                    </label>
                    <Input
                      {...form.register("code")}
                      placeholder="123456"
                      className="font-mono text-center tracking-widest text-2xl h-14"
                      maxLength={6}
                      inputMode="numeric"
                    />
                    {form.formState.errors.code && (
                      <p className="text-destructive text-xs mt-1">{form.formState.errors.code.message}</p>
                    )}
                  </div>

                  {/* Email — readonly se loggato */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {at.emailLabel}
                    </label>
                    <Input
                      {...form.register("email")}
                      type="email"
                      placeholder={at.emailPlaceholder}
                      className="h-12"
                      readOnly={isLoggedIn}
                    />
                    {form.formState.errors.email && (
                      <p className="text-destructive text-xs mt-1">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  {/* Nome nascosto se loggato */}
                  <input type="hidden" {...form.register("name")} />

                  {/* Errore API */}
                  {activateMutation.isError && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                      {(activateMutation.error as any)?.message ?? at.activationFailed}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-14 text-lg font-bold uppercase tracking-wider"
                    disabled={activateMutation.isPending}
                  >
                    <KeyRound className="mr-2 h-5 w-5" />
                    {activateMutation.isPending ? at.verifying : at.unlockButton}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground/50 text-center mt-6 leading-relaxed">
                  {at.needHelp}{" "}
                  <Link href="/contact" className="text-primary hover:text-white transition-colors">
                    {at.contactIusmk}
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
