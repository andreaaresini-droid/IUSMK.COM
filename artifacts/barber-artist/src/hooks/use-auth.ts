import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, fetchApiOptional } from "@/lib/api-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => fetchApiOptional<any>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomerRegister() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { firstName: string; lastName: string; email: string; password: string }) =>
      fetchApi<any>("/auth/customer/register", {
        method: "POST",
        body: JSON.stringify(data),
      }, false),
    onSuccess: (data) => {
      localStorage.setItem("barber_artist_token", data.token);
      queryClient.setQueryData(["current-user"], data.user);
      toast({ title: "Account creato!", description: "Benvenuto su IUSMK Academy." });
      const redirectTo = sessionStorage.getItem("checkout_redirect");
      if (redirectTo) {
        sessionStorage.removeItem("checkout_redirect");
        setLocation(redirectTo);
      } else {
        setLocation("/academy");
      }
    },
    onError: (err: any) => {
      toast({ title: "Registrazione fallita", description: err.message, variant: "destructive" });
    },
  });
}

export function useCustomerLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      fetchApi<any>("/auth/customer/login", {
        method: "POST",
        body: JSON.stringify(data),
      }, false),
    onSuccess: (data) => {
      localStorage.setItem("barber_artist_token", data.token);
      queryClient.setQueryData(["current-user"], data.user);
      toast({ title: "Accesso effettuato", description: "Bentornato su IUSMK Academy." });
      const redirectTo = sessionStorage.getItem("checkout_redirect");
      if (redirectTo) {
        sessionStorage.removeItem("checkout_redirect");
        setLocation(redirectTo);
      } else {
        setLocation("/");
      }
    },
    onError: (err: any) => {
      toast({ title: "Accesso fallito", description: err.message, variant: "destructive" });
    },
  });
}

export function useStudentLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { email: string; code: string }) =>
      fetchApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...data, fingerprint: getDeviceFingerprint() }),
      }, false),
    onSuccess: (data) => {
      localStorage.setItem("barber_artist_token", data.token);
      queryClient.setQueryData(["current-user"], data.user);
      toast({ title: "Accesso effettuato", description: "Benvenuto nella tua dashboard." });
      setLocation("/dashboard");
    },
    onError: (err: any) => {
      toast({ title: "Accesso negato", description: err.message, variant: "destructive" });
    }
  });
}

export function useAdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: any) =>
      fetchApi<any>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify(data),
      }, false),
    onSuccess: (data) => {
      localStorage.setItem("barber_artist_token", data.token);
      queryClient.setQueryData(["current-user"], data.user);
      toast({ title: "Benvenuto", description: "Accesso all'area admin effettuato." });
      setLocation("/admin/dashboard");
    },
    onError: (err: any) => {
      toast({ title: "Accesso negato", description: err.message, variant: "destructive" });
    }
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await supabase?.auth?.signOut()?.catch(() => {});
      await fetchApiOptional("/auth/logout", { method: "POST" });
    },
    onSettled: () => {
      const role = queryClient.getQueryData<any>(["current-user"])?.role;
      localStorage.removeItem("barber_artist_token");
      queryClient.clear();
      if (role === "admin") setLocation("/admin");
      else setLocation("/");
    }
  });
}

export function useActivateCode() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { code: string; email: string; name: string }) =>
      fetchApi<any>("/access/activate", {
        method: "POST",
        body: JSON.stringify({ ...data, fingerprint: getDeviceFingerprint() }),
      }, false),
    onSuccess: (data) => {
      if (data.token) {
        // Save the student token in localStorage
        localStorage.setItem("barber_artist_token", data.token);

        // CRITICAL: use setQueryData (not invalidateQueries) to immediately update
        // the user cache with role="student". invalidateQueries is async and triggers
        // a refetch that could arrive AFTER navigation — causing student-dashboard to
        // see role="customer" and redirect back to /access.
        if (data.student) {
          queryClient.setQueryData(["current-user"], data.student);
        }

        // Invalidate my-courses so the newly unlocked course appears immediately
        queryClient.invalidateQueries({ queryKey: ["customer", "my-courses"] });

        console.log("[COURSE ACCESS] user clicked access — course unlocked, redirecting to my-courses");

        if (data.alreadyUnlocked) {
          toast({ title: "Corso già attivo!", description: "Accesso consentito. Trovi il tuo corso nella sezione 'I miei corsi'." });
        } else {
          toast({ title: "Corso sbloccato!", description: "Il corso è ora accessibile nella sezione 'I miei corsi'." });
        }

        // Redirect to my-courses — from there "Accedi al corso" will work correctly
        // because user.role is now "student" in the cache
        setLocation("/my-courses");
      }
    },
    onError: (err: any) => {
      console.error("[COURSE ACCESS ERROR] activation failed:", err.message);
      toast({ title: "Attivazione fallita", description: err.message, variant: "destructive" });
    }
  });
}
