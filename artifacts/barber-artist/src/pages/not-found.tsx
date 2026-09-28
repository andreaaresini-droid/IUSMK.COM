import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLang } from "@/i18n/LanguageContext";

export default function NotFound() {
  const { t } = useLang();
  const n = t.notFound;

  // Il server risponde già 404 agli indirizzi sconosciuti (vercel.json + 404.html);
  // qui si chiede ai motori di ricerca di non indicizzare la pagina.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
          <p className="text-primary font-display font-bold uppercase tracking-[0.3em] text-sm mb-4">{n.code}</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white uppercase tracking-tighter mb-6">
            {n.title}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">{n.desc}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
            >
              {n.home}
            </Link>
            <Link
              href="/academy"
              className="inline-flex items-center justify-center border border-white/15 text-white hover:border-primary/60 px-8 py-4 rounded-xl font-semibold uppercase tracking-wider text-sm transition-colors"
            >
              {n.academy}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {n.helpPre}
            <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>
            {n.helpMid}
            <Link href="/contact" className="text-primary hover:underline">{n.contactLink}</Link>
            {n.helpPost}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
