import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  KeyRound,
  Image as ImageIcon,
  Mail,
  LogOut,
  Settings,
  Menu,
  X,
  Home,
  Tag,
  ShoppingCart,
  Bell,
  Bot,
  Users,
  MessageSquare,
  Megaphone,
  Link2,
  GraduationCap,
} from "lucide-react";
import { useLogout } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";

const NAV_LINKS = [
  { href: "/admin/dashboard",      label: "Dashboard",            icon: LayoutDashboard },
  { href: "/admin/accounts",       label: "Account Registrati",   icon: Users },
  { href: "/admin/chat",           label: "Chat Clienti",         icon: MessageSquare, chatMenu: true },
  { href: "/admin/academy",         label: "Academy",              icon: GraduationCap },
  { href: "/admin/courses",        label: "Corsi",                icon: BookOpen },
  { href: "/admin/access-codes",   label: "Codici di Accesso",    icon: KeyRound },
  { href: "/admin/discount-codes", label: "Codici Sconto",        icon: Tag },
  { href: "/admin/purchases",      label: "Acquisti",             icon: ShoppingCart },
  { href: "/admin/payment-links",  label: "Link Pagamenti",       icon: Link2 },
  { href: "/admin/gallery",        label: "Galleria",             icon: ImageIcon },
  { href: "/admin/contacts",       label: "Richieste di Contatto",icon: Mail, contactsMenu: true },
  { href: "/admin/notifications",  label: "Notifiche",            icon: Bell, notifsMenu: true },
  { href: "/admin/ai",             label: "Assistente AI",        icon: Bot, aiMenu: true },
  { href: "/admin/broadcast",      label: "Invio Notifiche",      icon: Megaphone },
  { href: "/admin/settings",       label: "Credenziali Admin",    icon: Settings },
];

// AI sub-links shown when on any /admin/ai* page
const AI_SUB_LINKS = [
  { href: "/admin/ai",                label: "Panoramica"       },
  { href: "/admin/knowledge-base",    label: "Knowledge Base"   },
  { href: "/admin/ai-questions",      label: "Domande AI"       },
  { href: "/admin/ai-logs",           label: "Log Conversazioni"},
  { href: "/admin/ai-test",           label: "Test AI"          },
];

function NavLinks({ location, onClick }: { location: string; onClick?: () => void }) {
  const isAiSection = location.startsWith("/admin/ai") || location.startsWith("/admin/knowledge-base");

  const { data: aiCount } = useQuery<{ count: number }>({
    queryKey: ["admin", "ai-unanswered-count"],
    queryFn:  () => fetchApi("/admin/ai/unanswered-questions/count"),
    refetchInterval: 30_000,
  });

  const { data: chatUnread } = useQuery<{ unread: number }>({
    queryKey: ["admin", "chat", "unread"],
    queryFn:  () => fetchApi("/admin/chat/unread-count"),
    refetchInterval: 30_000,
  });

  const { data: contactsUnread } = useQuery<{ unread: number }>({
    queryKey: ["admin", "contacts", "unread"],
    queryFn:  () => fetchApi("/admin/contacts/unread-count"),
    refetchInterval: 30_000,
  });

  const { data: notifsUnread } = useQuery<{ unread: number }>({
    queryKey: ["admin", "notifications", "unread"],
    queryFn:  () => fetchApi("/admin/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  const newCount      = aiCount?.count ?? 0;
  const chatCount     = chatUnread?.unread ?? 0;
  const contactsCount = contactsUnread?.unread ?? 0;
  const notifsCount   = notifsUnread?.unread ?? 0;

  return (
    <>
      {NAV_LINKS.map((link) => {
        const Icon     = link.icon;
        const isActive = link.aiMenu
          ? (location === "/admin/ai" || location.startsWith("/admin/knowledge-base") || location.startsWith("/admin/ai-"))
          : location === link.href;

        const badge = link.aiMenu
          ? (newCount      > 0 ? (newCount      > 99 ? "99+" : String(newCount))      : null)
          : (link as any).chatMenu
          ? (chatCount     > 0 ? (chatCount     > 99 ? "99+" : String(chatCount))     : null)
          : (link as any).contactsMenu
          ? (contactsCount > 0 ? (contactsCount > 99 ? "99+" : String(contactsCount)) : null)
          : (link as any).notifsMenu
          ? (notifsCount   > 0 ? (notifsCount   > 99 ? "99+" : String(notifsCount))   : null)
          : null;

        return (
          <div key={link.href}>
            <Link
              href={link.href}
              onClick={onClick}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{link.label}</span>
              {badge && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center",
                  link.aiMenu
                    ? "bg-yellow-400 text-black"
                    : "bg-primary text-white"
                )}>
                  {badge}
                </span>
              )}
            </Link>

            {/* AI sub-menu */}
            {link.aiMenu && isAiSection && (
              <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/8 pl-3">
                {AI_SUB_LINKS.map((sub) => {
                  const isSubActive = location === sub.href || (sub.href !== "/admin/ai" && location.startsWith(sub.href));
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={onClick}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors",
                        isSubActive
                          ? "text-primary bg-primary/8"
                          : "text-muted-foreground hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span>{sub.label}</span>
                      {sub.href === "/admin/ai-questions" && newCount > 0 && (
                        <span className="text-[9px] bg-yellow-400 text-black font-bold px-1 py-0.5 rounded-full leading-none">
                          {newCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { mutate: logout } = useLogout();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 bg-card border-r border-white/5 hidden md:flex flex-col h-screen fixed left-0 top-0">
        <div className="p-6 border-b border-white/5">
          <Link href="/" className="text-2xl font-bold font-display tracking-widest text-primary block">
            IUSMK
          </Link>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Pannello Admin</p>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <NavLinks location={location} />
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <Home size={18} />
            Torna al Sito
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} />
            Esci
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-white/5 flex items-center justify-between px-4 h-14">
        <Link href="/" className="text-xl font-bold font-display tracking-widest text-primary">
          IUSMK
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-muted-foreground hover:text-white transition-colors p-2" title="Torna al sito">
            <Home size={20} />
          </Link>
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Apri menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-card border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <Link href="/" className="text-2xl font-bold font-display tracking-widest text-primary">
            IUSMK
          </Link>
          <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          <NavLinks location={location} onClick={() => setDrawerOpen(false)} />
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <Link
            href="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <Home size={18} />
            Torna al Sito
          </Link>
          <button
            onClick={() => { setDrawerOpen(false); logout(); }}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} />
            Esci
          </button>
        </div>
      </div>
    </>
  );
}
