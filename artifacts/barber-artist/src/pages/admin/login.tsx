import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminLogin, useCurrentUser } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, AlertCircle } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Il nome utente è obbligatorio"),
  password: z.string().min(1, "La password è obbligatoria"),
});

export default function AdminLogin() {
  const loginMutation = useAdminLogin();
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && user && user.role === 'admin') {
      setLocation('/admin/dashboard');
    }
  }, [user, isLoading, setLocation]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (d: { username: string; password: string }) => {
    loginMutation.mutate({
      username: d.username.trim().toLowerCase(),
      password: d.password,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase mb-2">IUSMK</h1>
            <p className="text-muted-foreground text-sm uppercase tracking-widest">Pannello Admin</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Nome Utente</label>
              <Input
                {...form.register("username")}
                className="bg-background"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Password</label>
              <Input
                {...form.register("password")}
                type="password"
                className="bg-background"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {loginMutation.isError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{(loginMutation.error as any)?.message || "Credenziali non valide"}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full uppercase tracking-widest"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Autenticazione in corso..." : "Accedi"}
            </Button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors uppercase tracking-wider">
            <ArrowLeft className="w-4 h-4" /> Torna alla Home
          </Link>
        </div>
      </div>
    </div>
  );
}
