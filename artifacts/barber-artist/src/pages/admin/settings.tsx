import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { fetchApi } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ShieldCheck, Loader2, CheckCircle } from "lucide-react";

function useAdminCredentials() {
  return useQuery({
    queryKey: ["admin-credentials"],
    queryFn: () => fetchApi<{ username: string; name: string; email: string }>("/admin/credentials"),
  });
}

function useUpdateCredentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { currentPassword: string; newUsername?: string; newPassword?: string; confirmPassword?: string }) =>
      fetchApi<{ success: boolean; message: string }>("/admin/credentials", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast({ title: "Aggiornato", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin-credentials"] });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });
}

function PasswordInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-white/10 text-white px-4 py-3 pr-12 focus:outline-none focus:border-primary placeholder-muted-foreground/40"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: "", width: "0%" };
  if (pw.length < 6) return { label: "Troppo corta", color: "bg-red-500", width: "20%" };
  if (pw.length < 8) return { label: "Debole", color: "bg-orange-500", width: "40%" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const score = [hasUpper, hasNum, hasSymbol].filter(Boolean).length;
  if (score === 0) return { label: "Medio", color: "bg-yellow-500", width: "55%" };
  if (score === 1) return { label: "Buona", color: "bg-blue-400", width: "75%" };
  return { label: "Ottima", color: "bg-green-500", width: "100%" };
}

export default function AdminSettings() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: credentials, isLoading } = useAdminCredentials();
  const updateMutation = useUpdateCredentials();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (credentials) setNewUsername(credentials.username);
  }, [credentials]);

  const strength = passwordStrength(newPassword);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!currentPassword) e.currentPassword = "La password attuale è obbligatoria";
    if (newUsername && newUsername.trim().length < 3) e.newUsername = "Il nome utente deve avere almeno 3 caratteri";
    if (newPassword && newPassword.length < 6) e.newPassword = "La nuova password deve avere almeno 6 caratteri";
    if (newPassword && newPassword !== confirmPassword) e.confirmPassword = "Le password non coincidono";
    if (!newUsername?.trim() && !newPassword) e.general = "Modifica almeno il nome utente o la password";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    if (!validate()) return;
    const payload: any = { currentPassword };
    if (newUsername && newUsername.trim() !== credentials?.username) payload.newUsername = newUsername.trim();
    if (newPassword) { payload.newPassword = newPassword; payload.confirmPassword = confirmPassword; }
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSuccess(false), 4000);
      }
    });
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wider">Credenziali Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Aggiorna il nome utente e la password per accedere al pannello admin.</p>
        </div>

        <div className="max-w-xl">
          <div className="bg-card border border-white/5 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Account attuale</p>
                {isLoading ? (
                  <p className="text-white font-bold mt-0.5">Caricamento...</p>
                ) : (
                  <p className="text-white font-bold mt-0.5 font-mono">{credentials?.username}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Nuovo Nome Utente
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/40 font-mono"
                  placeholder="Nuovo username..."
                />
                {fieldErrors.newUsername && <p className="text-red-400 text-xs mt-1">{fieldErrors.newUsername}</p>}
              </div>

              <div className="border-t border-white/10 pt-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Password Attuale <span className="text-red-400">*</span>
                </label>
                <PasswordInput
                  id="currentPassword"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Inserisci la password attuale per confermare"
                />
                {fieldErrors.currentPassword && <p className="text-red-400 text-xs mt-1">{fieldErrors.currentPassword}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Nuova Password
                </label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Lascia vuoto per non cambiare"
                />
                {newPassword && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Robustezza: <span className="text-white">{strength.label}</span></p>
                  </div>
                )}
                {fieldErrors.newPassword && <p className="text-red-400 text-xs mt-1">{fieldErrors.newPassword}</p>}
              </div>

              {newPassword && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Conferma Nuova Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Ripeti la nuova password"
                  />
                  {fieldErrors.confirmPassword && <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
                </div>
              )}

              {fieldErrors.general && (
                <p className="text-orange-400 text-sm bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded">{fieldErrors.general}</p>
              )}

              {success && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Credenziali aggiornate. Al prossimo login usa le nuove credenziali.
                </div>
              )}

              <div className="pt-2 border-t border-white/10">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full bg-primary text-white py-3 font-semibold uppercase tracking-widest text-sm hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Salvataggio...</>
                  ) : (
                    "Salva Modifiche"
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-5 py-4">
            <p className="text-yellow-400/80 text-xs leading-relaxed">
              <span className="font-bold text-yellow-400">Attenzione:</span> dopo aver cambiato le credenziali, il login admin richiede le nuove credenziali. Non perderle.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
