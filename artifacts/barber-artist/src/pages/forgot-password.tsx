import { useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function ForgotPassword() {
  const { t } = useLang();
  const tf = t.pwReset.forgot;
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/auth/customer/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || tf.sendError);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(tf.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-3">
              {tf.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tf.subtitle}
            </p>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-8">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle size={48} className="text-primary" />
                </div>
                <p className="text-white font-medium text-lg">{tf.sentTitle}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tf.sentDesc}
                </p>
                <p className="text-muted-foreground text-xs">
                  {tf.sentSpam}
                </p>
                <Link href="/login" className="inline-block text-sm text-primary hover:underline mt-4">
                  ← {tf.backToLogin}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{tf.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tf.emailPlaceholder}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    autoComplete="email"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> {tf.sending}</>
                  ) : (
                    tf.sendButton
                  )}
                </button>

                <div className="text-center">
                  <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors">
                    <ArrowLeft size={14} />
                    {tf.backToLogin}
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
