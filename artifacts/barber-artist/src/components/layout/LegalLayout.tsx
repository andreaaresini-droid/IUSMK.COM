import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

interface LegalLayoutProps {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wider mb-3">
              {title}
            </h1>
            {lastUpdated && (
              <p className="text-sm text-white/30">Ultimo aggiornamento: {lastUpdated}</p>
            )}
            <div className="mt-4 h-px bg-gradient-to-r from-primary/40 to-transparent" />
          </div>
          <div className="prose-legal space-y-8 text-white/70 text-sm leading-relaxed">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-primary rounded-full shrink-0" />
        {title}
      </h2>
      <div className="pl-3 space-y-2">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-1.5 pl-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-primary mt-1 shrink-0">—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
