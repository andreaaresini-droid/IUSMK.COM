import { LegalLayout } from "@/components/layout/LegalLayout";
import { Mail, Instagram } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function Legal() {
  const { t } = useLang();
  const l = t.legalInfo;
  return (
    <LegalLayout title={l.title}>

      <p>{l.intro}</p>

      {/* Contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
        <a
          href="mailto:iusmkbarber@gmail.com"
          className="flex items-center gap-4 bg-card/50 border border-white/8 hover:border-primary/30 rounded-xl p-5 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Mail size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">{l.emailLabel}</p>
            <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">iusmkbarber@gmail.com</p>
          </div>
        </a>

        <a
          href="https://www.instagram.com/_iusmk_?igsh=cDFyejQ3djNqbnV1"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 bg-card/50 border border-white/8 hover:border-primary/30 rounded-xl p-5 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Instagram size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">{l.instagramLabel}</p>
            <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">@_iusmk_</p>
          </div>
        </a>
      </div>

      {/* Legal info */}
      <div className="bg-card/30 border border-white/8 rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">{l.sectionTitle}</h2>

        <div className="flex items-start gap-3">
          <span className="text-white/30 text-xs uppercase tracking-widest w-28 shrink-0 pt-0.5">{l.referente}</span>
          <span className="text-white font-semibold">Giuseppe Musto</span>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-white/30 text-xs uppercase tracking-widest w-28 shrink-0 pt-0.5">{l.emailLabel}</span>
          <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-white/30 text-xs uppercase tracking-widest w-28 shrink-0 pt-0.5">{l.sede}</span>
          <span className="text-white/40 italic">{l.notAvailable}</span>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-white/30 text-xs uppercase tracking-widest w-28 shrink-0 pt-0.5">{l.partitaIva}</span>
          <span className="text-white/40 italic">{l.notAvailable}</span>
        </div>
      </div>

    </LegalLayout>
  );
}
