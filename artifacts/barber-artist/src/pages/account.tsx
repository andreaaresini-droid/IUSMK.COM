import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Loader2, User, Lock, Trash2, AlertTriangle, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useCustomerProfile,
  useUpdateProfile,
  useChangePassword,
  useDeleteAccount,
} from "@/hooks/use-account";

const inputClass =
  "w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50";

export default function Account() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const isCustomer = !!user && (user.role === "customer" || user.role === "student");

  // Redirect se non autenticato come cliente
  useEffect(() => {
    if (!userLoading && !isCustomer) setLocation("/login");
  }, [userLoading, isCustomer, setLocation]);

  const { data: profile, isLoading: profileLoading } = useCustomerProfile(isCustomer);
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();

  // ── Profilo ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
    }
  }, [profile]);

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  // ── Eliminazione ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  if (userLoading || (isCustomer && profileLoading)) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navbar />
        <main className="pt-32 pb-20 flex justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isCustomer || !profile) return null;

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    updateProfile.mutate({ firstName: firstName.trim(), lastName: lastName.trim() });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPassword.length < 6) {
      setPwError("La nuova password deve essere di almeno 6 caratteri.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Le due password non coincidono.");
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  };

  const handleDelete = () => {
    deleteAccount.mutate({ password: profile.hasPassword ? deletePassword : undefined });
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="text-center mb-2">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-2">
              Il mio account
            </h1>
            <p className="text-muted-foreground text-sm">
              Gestisci i tuoi dati personali e la sicurezza del tuo account.
            </p>
          </div>

          {/* ── PROFILO ── */}
          <section className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-5">
              <User size={18} className="text-primary" />
              <h2 className="text-lg font-semibold">Dati personali</h2>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Nome</label>
                  <input
                    className={inputClass}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Cognome</label>
                  <input
                    className={inputClass}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
                <input className={inputClass} value={profile.email} disabled readOnly />
                <p className="text-xs text-muted-foreground mt-1">
                  Per cambiare l'indirizzo e-mail contatta l'assistenza.
                </p>
              </div>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
              >
                {updateProfile.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvataggio...</>
                ) : (
                  "Salva modifiche"
                )}
              </button>
            </form>
          </section>

          {/* ── PASSWORD ── */}
          {profile.hasPassword && (
            <section className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <Lock size={18} className="text-primary" />
                <h2 className="text-lg font-semibold">Password</h2>
              </div>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Password attuale</label>
                  <input
                    type="password"
                    className={inputClass}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Nuova password</label>
                    <input
                      type="password"
                      className={inputClass}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Conferma nuova</label>
                    <input
                      type="password"
                      className={inputClass}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
                {pwError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                    {pwError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={changePassword.isPending}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {changePassword.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Aggiornamento...</>
                  ) : (
                    "Cambia password"
                  )}
                </button>
              </form>
            </section>
          )}

          {/* ── ELIMINA ACCOUNT ── */}
          <section className="bg-card border border-red-500/30 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={18} className="text-red-400" />
              <h2 className="text-lg font-semibold text-red-400">Elimina account</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              L'eliminazione è <strong className="text-white">definitiva</strong> e rimuove il tuo
              account e i dati associati: profilo, accessi ai corsi, notifiche, messaggi e
              iscrizioni alle notifiche.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              Alcuni dati relativi agli acquisti possono essere conservati in forma limitata solo
              dove richiesto dalla normativa fiscale, come indicato nell'informativa privacy.
            </p>
            <button
              onClick={() => { setShowDeleteModal(true); setDeletePassword(""); }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              <Trash2 size={16} />
              Elimina il mio account
            </button>
          </section>
        </div>
      </main>
      <Footer />

      {/* ── MODALE DI CONFERMA ELIMINAZIONE ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              aria-label="Chiudi"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-red-400" />
              <h3 className="text-lg font-semibold text-white">Confermi l'eliminazione?</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Questa azione è irreversibile. Il tuo account verrà eliminato definitivamente e dovrai
              registrarti di nuovo per usare l'app.
            </p>

            {profile.hasPassword && (
              <div className="mb-5">
                <label className="text-sm text-muted-foreground mb-1 block">
                  Inserisci la password per confermare
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="La tua password"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-white/15 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteAccount.isPending || (profile.hasPassword && !deletePassword)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-600/90 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {deleteAccount.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Eliminazione...</>
                ) : (
                  "Elimina definitivamente"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
