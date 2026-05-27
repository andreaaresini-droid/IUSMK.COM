import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActivateCode, useStudentLogin, useCurrentUser } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { KeyRound, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";

const activateSchema = z.object({
  code: z.string().min(1, "Il codice di accesso è obbligatorio"),
  email: z.string().email("Indirizzo email non valido"),
  name: z.string().min(2, "Il nome è obbligatorio"),
});

const loginSchema = z.object({
  email: z.string().email("Indirizzo email non valido"),
  code: z.string().min(1, "Il codice di accesso è obbligatorio"),
});

export default function Access() {
  const [mode, setMode] = useState<'activate' | 'login'>('activate');
  const activateMutation = useActivateCode();
  const loginMutation = useStudentLogin();
  const [, setLocation] = useLocation();
  const { data: user, isLoading: checkingAuth } = useCurrentUser();

  useEffect(() => {
    if (!checkingAuth && user && user.role === 'student') {
      setLocation('/dashboard');
    }
  }, [user, checkingAuth, setLocation]);

  const activateForm = useForm({
    resolver: zodResolver(activateSchema),
    defaultValues: { code: "", email: "", name: "" },
  });

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", code: "" },
  });

  const onActivate = (data: any) => activateMutation.mutate(data);
  const onLogin = (data: any) => loginMutation.mutate(data);

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <Navbar />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[100px] rounded-full"></div>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-white/10 p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-primary/50 m-2"></div>
            
            <div className="text-center mb-10">
              <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wider mb-2">
                {mode === 'activate' ? 'Inserisci il Codice' : 'Accesso con Codice'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {mode === 'activate' 
                  ? 'Hai ricevuto un codice di accesso? Inseriscilo qui per sbloccare il tuo corso.' 
                  : 'Bentornato. Inserisci la tua email e il codice per accedere ai tuoi corsi.'}
              </p>
            </div>

            {mode === 'activate' ? (
              <form onSubmit={activateForm.handleSubmit(onActivate)} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Codice di Accesso</label>
                  <Input 
                    {...activateForm.register("code")} 
                    placeholder="123456" 
                    className="font-mono text-center tracking-widest text-2xl h-14"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  {activateForm.formState.errors.code && (
                    <p className="text-destructive text-xs mt-1">{activateForm.formState.errors.code.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Nome Completo</label>
                  <Input {...activateForm.register("name")} placeholder="Mario Rossi" />
                  {activateForm.formState.errors.name && (
                    <p className="text-destructive text-xs mt-1">{activateForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Indirizzo Email</label>
                  <Input {...activateForm.register("email")} type="email" placeholder="mario@esempio.com" />
                  {activateForm.formState.errors.email && (
                    <p className="text-destructive text-xs mt-1">{activateForm.formState.errors.email.message}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg font-bold uppercase tracking-wider" 
                  disabled={activateMutation.isPending}
                >
                  <KeyRound className="mr-2 h-5 w-5" />
                  {activateMutation.isPending ? "Verifica in corso..." : "Sblocca il Corso"}
                </Button>
                
                <div className="text-center mt-6 space-y-3">
                  <div>
                    <Link
                      href="/register"
                      className="text-sm text-primary hover:text-white transition-colors uppercase tracking-widest font-bold"
                    >
                      Ancora non sei registrato? Registrati ora
                    </Link>
                  </div>
                  <div>
                    <button 
                      type="button" 
                      onClick={() => setMode('login')} 
                      className="text-xs text-muted-foreground hover:text-white transition-colors"
                    >
                      Già attivato in precedenza? Accedi con codice
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Indirizzo Email</label>
                  <Input {...loginForm.register("email")} type="email" placeholder="mario@esempio.com" className="h-14" />
                  {loginForm.formState.errors.email && (
                    <p className="text-destructive text-xs mt-1">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Codice di Accesso</label>
                  <Input 
                    {...loginForm.register("code")} 
                    placeholder="123456"
                    className="font-mono text-center tracking-widest text-2xl h-14"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  {loginForm.formState.errors.code && (
                    <p className="text-destructive text-xs mt-1">{loginForm.formState.errors.code.message}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg font-bold uppercase tracking-wider" 
                  disabled={loginMutation.isPending}
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  {loginMutation.isPending ? "Autenticazione in corso..." : "Vai alla Dashboard"}
                </Button>

                <div className="text-center mt-6 space-y-3">
                  <div>
                    <button 
                      type="button" 
                      onClick={() => setMode('activate')} 
                      className="text-sm text-primary hover:text-white transition-colors uppercase tracking-widest font-bold"
                    >
                      Hai un nuovo codice? Attivalo.
                    </button>
                  </div>
                  <div>
                    <Link href="/register" className="text-xs text-muted-foreground hover:text-white transition-colors">
                      Ancora non sei registrato? Registrati ora
                    </Link>
                  </div>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
