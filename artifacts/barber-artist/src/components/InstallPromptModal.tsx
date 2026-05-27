import { useEffect, useState } from "react";
import { X, Smartphone, Bell, Share, MoreVertical, Plus, Download, Home, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HIDE_KEY = "hideInstallPopup";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}
function isAndroid() {
  return /Android/.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
}
function isHomePage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname;
  return path === base || path === base + "/" || path === "/";
}

export function InstallPromptModal() {
  const [visible, setVisible]         = useState(false);
  const [tab, setTab]                 = useState<"install" | "push">("install");
  const [deferredPrompt, setDeferred] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(HIDE_KEY) === "true") return;

    let timer: ReturnType<typeof setTimeout>;

    if (isHomePage()) {
      const introHandler = () => {
        timer = setTimeout(() => setVisible(true), 500);
      };
      window.addEventListener("iusmk-intro-complete", introHandler, { once: true });
      const fallback = setTimeout(() => setVisible(true), 14000);
      return () => {
        window.removeEventListener("iusmk-intro-complete", introHandler);
        clearTimeout(timer);
        clearTimeout(fallback);
      };
    } else {
      timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeSession = () => {
    setVisible(false);
  };

  const hideForever = () => {
    localStorage.setItem(HIDE_KEY, "true");
    setVisible(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") hideForever();
      setDeferred(null);
    }
  };

  if (!visible) return null;

  const ios     = isIOS();
  const android = isAndroid();

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <img src="/images/iusmk-app-icon.png?v=2" alt="IUSMK" className="w-10 h-10 rounded-xl" />
            <div>
              <p className="text-white font-bold text-sm">IUSMK</p>
              <p className="text-white/40 text-xs">Barber Artist</p>
            </div>
          </div>
          <button onClick={closeSession} className="text-white/30 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 px-5">
          {[
            { id: "install" as const, label: "Aggiungi App", icon: Smartphone },
            { id: "push"    as const, label: "Notifiche",    icon: Bell },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-white/40 hover:text-white/60"
              )}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {tab === "install" && (
            <div className="space-y-4">
              <p className="text-white/70 text-sm leading-relaxed">
                Aggiungi IUSMK alla schermata Home del tuo telefono per accedere più facilmente come un'app.
              </p>

              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/80 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Download size={16} /> Installa app
                </button>
              )}

              {ios && !deferredPrompt && (
                <div className="space-y-2 text-sm text-white/60">
                  <p className="text-white/80 font-semibold text-xs uppercase tracking-widest">Su iPhone/iPad:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <Share size={18} className="text-blue-400 shrink-0" />
                      <span>Tocca <strong className="text-white">Condividi</strong> in basso nel browser</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <Plus size={18} className="text-green-400 shrink-0" />
                      <span>Seleziona <strong className="text-white">"Aggiungi alla schermata Home"</strong></span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <Smartphone size={18} className="text-white/50 shrink-0" />
                      <span>Conferma toccando <strong className="text-white">"Aggiungi"</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {android && !deferredPrompt && (
                <div className="space-y-2 text-sm text-white/60">
                  <p className="text-white/80 font-semibold text-xs uppercase tracking-widest">Su Android:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <MoreVertical size={18} className="text-white/50 shrink-0" />
                      <span>Apri il menu del browser (⋮)</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <Plus size={18} className="text-green-400 shrink-0" />
                      <span>Seleziona <strong className="text-white">"Aggiungi a schermata Home"</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {!ios && !android && (
                <p className="text-white/40 text-xs text-center py-2">
                  Sul desktop puoi usare l'icona di installazione nella barra indirizzi del browser.
                </p>
              )}
            </div>
          )}

          {tab === "push" && (
            <div className="space-y-3">
              <p className="text-white/70 text-sm leading-relaxed">
                Per attivare le notifiche push, segui questi passaggi:
              </p>
              <div className="space-y-2">
                {[
                  { icon: Home,       text: <>Aggiungi <strong className="text-white">IUSMK</strong> alla schermata Home del tuo telefono (tab "Aggiungi App")</> },
                  { icon: Smartphone, text: <>Apri il sito <strong className="text-white">dalla schermata Home</strong> come un'app</> },
                  { icon: MoreVertical, text: <>Entra nel <strong className="text-white">menu</strong> del sito (icona in alto)</> },
                  { icon: Bell,       text: <>Vai nella sezione <strong className="text-white">Notifiche</strong></> },
                  { icon: ChevronRight, text: <>Premi <strong className="text-white">"Attiva notifiche push"</strong></> },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <span className="text-sm text-white/60">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={closeSession}
            className="flex-1 py-2.5 text-xs font-semibold text-white/40 hover:text-white border border-white/8 hover:border-white/15 rounded-xl transition-colors"
          >
            Chiudi
          </button>
          <button
            onClick={hideForever}
            className="flex-1 py-2.5 text-xs font-semibold text-white/40 hover:text-white border border-white/8 hover:border-white/15 rounded-xl transition-colors"
          >
            Non mostrare più
          </button>
        </div>
      </div>
    </div>
  );
}
