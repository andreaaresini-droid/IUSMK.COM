import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Bell, BookOpen, LogOut, ChevronDown, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { fetchApiOptional } from "@/lib/api-client";
import { useOwnedCourseIds } from "@/hooks/use-courses";
import { useLang } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { Logo3D } from "@/components/Logo3D";

function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const langs: Lang[] = ["it", "en"];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 border border-white/15 rounded-sm overflow-hidden w-fit",
        compact && "text-xs"
      )}
    >
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "px-2.5 py-1 text-xs font-bold uppercase tracking-widest transition-colors",
            lang === l
              ? "bg-primary text-white"
              : "text-muted-foreground hover:text-white"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function CustomerMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isCustomerRole = !!user && (user.role === "customer" || user.role === "student");

  const { data: notifications = [] } = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => fetchApiOptional<any[]>("/customer/notifications"),
    enabled: isCustomerRole,
    staleTime: 30 * 1000,
    refetchInterval: 30_000,
  });
  const unreadNotif = Array.isArray(notifications) ? notifications.filter((n: any) => !n.isRead).length : 0;

  const { data: ownedCourses } = useOwnedCourseIds(isCustomerRole);
  const canAccessChat =
    user?.role === "student" ||
    (user?.role === "customer" && (ownedCourses?.courseIds?.length ?? 0) > 0);

  const { data: chatUnread } = useQuery({
    queryKey: ["customer", "chat", "unread"],
    queryFn:  () => fetchApiOptional<{ unread: number }>("/customer/chat/unread"),
    enabled:  canAccessChat,
    refetchInterval: 30_000,
  });
  const unreadChat = chatUnread?.unread ?? 0;

  const totalUnread = unreadNotif + unreadChat;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white hover:border-primary/50 transition-colors"
      >
        <span className="font-medium">{user?.firstName || user?.name?.split(" ")[0] || "Account"}</span>
        {totalUnread > 0 && (
          <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{totalUnread}</span>
        )}
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell size={16} className="text-primary" />
              Notifiche
            </div>
            {unreadNotif > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{unreadNotif}</span>
            )}
          </Link>
          <Link
            href="/my-courses"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
          >
            <BookOpen size={16} className="text-muted-foreground" />
            I miei corsi
          </Link>
          {canAccessChat && (
            <Link
              href="/chat"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={16} className="text-muted-foreground" />
                Messaggi
              </div>
              {unreadChat > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{unreadChat}</span>
              )}
            </Link>
          )}
          <div className="border-t border-white/5" />
          <button
            onClick={() => { setOpen(false); logout.mutate(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary hover:bg-white/5 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { data: user } = useCurrentUser();
  const { t } = useLang();
  const logout = useLogout();

  const isCustomer = user?.role === "customer" || user?.role === "student";

  const { data: mobileOwnedCourses } = useOwnedCourseIds(isCustomer);
  const mobileCanAccessChat =
    user?.role === "student" ||
    (user?.role === "customer" && (mobileOwnedCourses?.courseIds?.length ?? 0) > 0);

  const { data: mobileNotifications = [] } = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => fetchApiOptional<any[]>("/customer/notifications"),
    enabled: isCustomer,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const { data: mobileChatUnread } = useQuery({
    queryKey: ["customer", "chat", "unread"],
    queryFn:  () => fetchApiOptional<{ unread: number }>("/customer/chat/unread"),
    enabled:  mobileCanAccessChat,
    refetchInterval: 30_000,
  });
  const mobileUnreadNotif = Array.isArray(mobileNotifications)
    ? mobileNotifications.filter((n: any) => !n.isRead).length
    : 0;
  const mobileUnreadChat = mobileChatUnread?.unread ?? 0;
  const mobileTotalUnread = mobileUnreadNotif + mobileUnreadChat;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: t.nav.home, href: "/" },
    { label: t.nav.about, href: "/about" },
    { label: t.nav.gallery, href: "/gallery" },
    { label: t.nav.academy, href: "/academy" },
    { label: t.nav.contact, href: "/contact" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-50 border-b",
        isOpen
          ? "bg-card border-white/5 py-4"
          : scrolled
          ? "bg-background/80 backdrop-blur-md border-white/5 py-4 transition-all duration-300"
          : "bg-transparent border-transparent py-6 transition-all duration-300"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link href="/" className="flex items-center shrink-0" style={{ overflow: "visible" }}>
          <Logo3D
            variant="header"
            fallback={
              <img
                src={`${import.meta.env.BASE_URL}images/logo-iusmk-2025.png`}
                alt="IUSMK"
                className="navbar-logo"
                style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}
              />
            }
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary uppercase tracking-wider",
                location === link.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}

          <LangToggle />

          {user?.role === "customer" || user?.role === "student" ? (
            <CustomerMenu />
          ) : user?.role === "admin" ? (
            <Link href="/admin/dashboard">
              <Button variant="default">{t.nav.dashboard}</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="default">{t.nav.accessCourses}</Button>
            </Link>
          )}
        </nav>

        <div className="md:hidden flex items-center gap-2">
          {!user && (
            <Link href="/login" onClick={() => setIsOpen(false)}>
              <Button size="sm" className="text-xs px-3 py-1.5 h-auto font-bold uppercase tracking-wider">
                {t.nav.access}
              </Button>
            </Link>
          )}
          <button
            className="relative text-white p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
            {isCustomer && mobileTotalUnread > 0 && !isOpen && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                {mobileTotalUnread > 9 ? "9+" : mobileTotalUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden fixed inset-0 top-0 bg-card flex flex-col pt-[6.5rem] pb-6 px-5 gap-1 overflow-y-auto z-40">
          {/* ── SEZIONE SUPERIORE: nav links allineati a sinistra ── */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "block py-2.5 px-2 text-sm font-semibold uppercase tracking-wider text-left rounded-lg transition-colors",
                location === link.href
                  ? "text-primary bg-primary/8"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              )}
            >
              {link.label}
            </Link>
          ))}

          {/* Language toggle allineato a sinistra coerente con le voci */}
          <div className="pt-2 pb-1 px-2">
            <LangToggle />
          </div>

          {/* ── SEZIONE INFERIORE: azioni utente centrate ── */}
          <div className="pt-3 border-t border-white/8 mt-1">
            {user?.role === "customer" || user?.role === "student" ? (
              <div className="flex flex-col items-center gap-2">
                {/* Notifiche */}
                <Link href="/notifications" onClick={() => setIsOpen(false)} className="w-full max-w-xs">
                  <div className="flex items-center justify-center gap-2 w-full border border-white/15 rounded-xl px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors relative">
                    <Bell size={16} className="text-primary" />
                    <span className="font-semibold">Notifiche</span>
                    {mobileUnreadNotif > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[20px] h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {mobileUnreadNotif > 9 ? "9+" : mobileUnreadNotif}
                      </span>
                    )}
                  </div>
                </Link>

                {/* I miei corsi */}
                <Link href="/my-courses" onClick={() => setIsOpen(false)} className="w-full max-w-xs">
                  <div className="flex items-center justify-center gap-2 w-full border border-white/15 rounded-xl px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors">
                    <BookOpen size={16} className="text-white/50" />
                    <span className="font-semibold">I miei corsi</span>
                  </div>
                </Link>

                {/* Messaggi — solo studenti */}
                {mobileCanAccessChat && (
                  <Link href="/chat" onClick={() => setIsOpen(false)} className="w-full max-w-xs">
                    <div className="flex items-center justify-center gap-2 w-full border border-white/15 rounded-xl px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors relative">
                      <MessageSquare size={16} className="text-white/50" />
                      <span className="font-semibold">Messaggi</span>
                      {mobileUnreadChat > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[20px] h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {mobileUnreadChat > 9 ? "9+" : mobileUnreadChat}
                        </span>
                      )}
                    </div>
                  </Link>
                )}

                {/* Logout */}
                <button
                  onClick={() => { setIsOpen(false); logout.mutate(); }}
                  className="flex items-center justify-center gap-2 w-full max-w-xs border border-primary/25 rounded-xl px-4 py-3 text-sm text-primary hover:bg-primary/5 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="font-semibold">Logout</span>
                </button>
              </div>
            ) : user?.role === "admin" ? (
              <div className="flex justify-center">
                <Link href="/admin/dashboard" onClick={() => setIsOpen(false)} className="w-full max-w-xs">
                  <Button className="w-full">{t.nav.dashboard}</Button>
                </Link>
              </div>
            ) : (
              <div className="flex justify-center">
                <Link href="/login" onClick={() => setIsOpen(false)} className="w-full max-w-xs">
                  <Button className="w-full">{t.nav.accessCourses}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
