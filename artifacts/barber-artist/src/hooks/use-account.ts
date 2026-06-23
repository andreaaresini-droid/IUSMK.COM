import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  email: string;
  hasPassword: boolean;
}

export function useCustomerProfile(enabled = true) {
  return useQuery({
    queryKey: ["customer", "profile"],
    queryFn: () => fetchApi<CustomerProfile>("/customer/profile"),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { firstName: string; lastName: string }) =>
      fetchApi<any>("/customer/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast({ title: "Profilo aggiornato", description: "Le modifiche sono state salvate." });
    },
    onError: (err: any) => {
      toast({ title: "Aggiornamento fallito", description: err.message, variant: "destructive" });
    },
  });
}

export function useChangePassword() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      fetchApi<any>("/customer/password", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Password aggiornata", description: "La tua password è stata cambiata." });
    },
    onError: (err: any) => {
      toast({ title: "Cambio password fallito", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteAccount() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { password?: string }) =>
      fetchApi<any>("/customer/account", { method: "DELETE", body: JSON.stringify(data) }),
    onSuccess: async () => {
      await supabase?.auth?.signOut()?.catch(() => {});
      localStorage.removeItem("barber_artist_token");
      queryClient.clear();
      toast({ title: "Account eliminato", description: "Il tuo account è stato eliminato definitivamente." });
      setLocation("/");
    },
    onError: (err: any) => {
      toast({ title: "Eliminazione fallita", description: err.message, variant: "destructive" });
    },
  });
}
