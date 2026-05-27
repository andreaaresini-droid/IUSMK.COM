import { Link } from "wouter";
import { Instagram } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  );
}

export function Footer() {
  const { t } = useLang();
  const f = t.footer;

  return (
    <footer className="bg-black py-16 border-t border-white/5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main grid — 3 columns: Brand / Esplora / Legale */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-3xl font-bold font-display tracking-widest text-white mb-4 block">
              IUSMK
            </Link>
            <p className="text-muted-foreground mt-4 text-sm leading-loose">
              {f.description}
            </p>
            {/* Social icons */}
            <div className="flex gap-3 mt-6">
              <a
                href="https://www.instagram.com/_iusmk_?igsh=cDFyejQ3djNqbnV1"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary transition-colors"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://www.tiktok.com/@iusmk?_r=1&_t=ZN-94qnCVg4Fug"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary transition-colors"
              >
                <TikTokIcon size={18} />
              </a>
            </div>
          </div>

          {/* Esplora */}
          <div>
            <h4 className="text-white font-semibold uppercase tracking-wider mb-6">{f.explore}</h4>
            <ul className="space-y-3">
              <li><Link href="/gallery" className="text-muted-foreground hover:text-primary transition-colors text-sm">{f.gallery}</Link></li>
              <li><Link href="/academy" className="text-muted-foreground hover:text-primary transition-colors text-sm">{f.academy}</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors text-sm">{f.about}</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors text-sm">{f.contact}</Link></li>
              <li><Link href="/faq" className="text-muted-foreground hover:text-primary transition-colors text-sm">FAQ</Link></li>
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="text-white font-semibold uppercase tracking-wider mb-6">Legale</h4>
            <ul className="space-y-3">
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors text-sm">Termini e Condizioni</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors text-sm">Informativa Privacy</Link></li>
              <li><Link href="/cookie-policy" className="text-muted-foreground hover:text-primary transition-colors text-sm">Cookie Policy</Link></li>
              <li><Link href="/returns" className="text-muted-foreground hover:text-primary transition-colors text-sm">Resi e Recesso</Link></li>
              <li><Link href="/legal" className="text-muted-foreground hover:text-primary transition-colors text-sm">Contatti legali</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom section */}
        <div className="border-t border-white/5 mt-14 pt-8 flex flex-col items-center gap-5">

          {/* Legal quick links */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Termini</Link>
            <Link href="/cookie-policy" className="hover:text-primary transition-colors">Cookie</Link>
            <Link href="/returns" className="hover:text-primary transition-colors">Recesso</Link>
            <Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} IUSMK — Giuseppe Musto. {f.rights}
          </p>

          {/* Admin panel — centered, below copyright */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <p className="text-xs text-white/25 uppercase tracking-widest">{f.adminPanel}</p>
            <Link
              href="/admin"
              className="text-sm font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              {f.adminAccess}
            </Link>
          </div>

        </div>

      </div>
    </footer>
  );
}
