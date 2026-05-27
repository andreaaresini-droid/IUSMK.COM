import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail, Instagram, Send } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "course_info", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const { t } = useLang();
  const f = t.contact.form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("success");
        setForm({ name: "", email: "", phone: "", subject: "course_info", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white uppercase tracking-tighter mb-4">
              {t.contact.headline}
            </h1>
            <p className="text-muted-foreground text-lg mb-16 max-w-xl">
              {t.contact.subtitle}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{f.name}</label>
                      <input
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        required
                        className="w-full bg-card/50 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/50"
                        placeholder={f.namePlaceholder}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{f.email}</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        required
                        className="w-full bg-card/50 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/50"
                        placeholder={f.emailPlaceholder}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{f.phone}</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      className="w-full bg-card/50 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/50"
                      placeholder={f.phonePlaceholder}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{f.subject}</label>
                    <select
                      value={form.subject}
                      onChange={e => setForm({...form, subject: e.target.value})}
                      className="w-full bg-card/50 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary"
                    >
                      <option value="course_info">{f.subjectCourse}</option>
                      <option value="collaboration">{f.subjectCollab}</option>
                      <option value="other">{f.subjectOther}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{f.message}</label>
                    <textarea
                      value={form.message}
                      onChange={e => setForm({...form, message: e.target.value})}
                      required
                      rows={6}
                      className="w-full bg-card/50 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/50 resize-none"
                      placeholder={f.messagePlaceholder}
                    />
                  </div>

                  {status === "success" && (
                    <p className="text-green-400 text-sm">{f.success}</p>
                  )}
                  {status === "error" && (
                    <p className="text-red-400 text-sm">{f.error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full bg-primary text-white py-4 font-semibold uppercase tracking-widest text-sm hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {status === "loading" ? f.sending : f.send}
                  </button>
                </form>
              </div>

              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-display font-bold text-white uppercase mb-6">{t.contact.direct}</h2>
                  <div className="space-y-4">
                    <a href="mailto:iusmkbarber@gmail.com" className="flex items-center gap-4 text-muted-foreground hover:text-white transition-colors group">
                      <div className="w-12 h-12 border border-white/10 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest mb-1 text-muted-foreground/60">Email</p>
                        <p className="text-white">iusmkbarber@gmail.com</p>
                      </div>
                    </a>
                    <a href="https://www.instagram.com/_iusmk_?igsh=cDFyejQ3djNqbnV1" target="_blank" rel="noreferrer" className="flex items-center gap-4 text-muted-foreground hover:text-white transition-colors group">
                      <div className="w-12 h-12 border border-white/10 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                        <Instagram className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest mb-1 text-muted-foreground/60">Instagram</p>
                        <p className="text-white">@_iusmk_</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="border border-white/10 p-8">
                  <h3 className="text-lg font-display font-bold text-white uppercase mb-3">{t.contact.academyRequests}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t.contact.academyDesc}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
