import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, fetchApiOptional } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function usePublicCourses() {
  return useQuery({
    queryKey: ["courses", "public"],
    queryFn: () => fetchApi<any[]>("/courses"),
  });
}

export function usePublicCourse(id: number) {
  return useQuery({
    queryKey: ["courses", id],
    queryFn: () => fetchApi<any>(`/courses/${id}`),
    enabled: !!id,
  });
}

export function useStudentCourses() {
  return useQuery({
    queryKey: ["student", "courses"],
    queryFn: () => fetchApi<any[]>("/student/courses"),
  });
}

export function useVideoToken(courseId: number, moduleId: number) {
  return useQuery({
    queryKey: ["video-token", courseId, moduleId],
    queryFn: () => fetchApi<any>(`/student/courses/${courseId}/modules/${moduleId}/video`),
    enabled: !!(courseId && moduleId),
    staleTime: 3 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Ritorna i courseId posseduti (status=active) per l'utente loggato.
 * Attivo per entrambi i ruoli "customer" e "student":
 *   - "customer"  → ha un account ma non ha ancora attivato nulla
 *   - "student"   → ha già attivato almeno un codice (ruolo promosso da access.ts)
 * Il backend /api/customer/owned-course-ids accetta entrambi i ruoli.
 */
export function useOwnedCourseIds(isLoggedInUser: boolean) {
  return useQuery({
    queryKey: ["owned-course-ids"],
    queryFn: () => fetchApiOptional<{ courseIds: number[] }>("/customer/owned-course-ids"),
    enabled: isLoggedInUser,
    staleTime: 60_000,
  });
}

/** IDs dei moduli acquistati singolarmente dall'utente loggato. */
export function useOwnedModuleIds(isLoggedInUser: boolean) {
  return useQuery({
    queryKey: ["owned-module-ids"],
    queryFn: () => fetchApiOptional<{ moduleIds: number[] }>("/customer/owned-module-ids"),
    enabled: isLoggedInUser,
    staleTime: 60_000,
  });
}

export function useDisclaimerAck(courseId: number) {
  return useQuery({
    queryKey: ["disclaimer-ack", courseId],
    queryFn: () => fetchApi<{ acknowledged: boolean }>(`/student/disclaimer/${courseId}`),
    enabled: !!courseId,
    staleTime: Infinity,
  });
}

export function useAcknowledgeDisclaimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: number) =>
      fetchApi(`/student/disclaimer/${courseId}`, { method: "POST" }),
    onSuccess: (_data, courseId) => {
      queryClient.setQueryData(["disclaimer-ack", courseId], { acknowledged: true });
    },
  });
}

// ─── Academy Categories (pubblico) ───────────────────────────────────────────

export function useAcademyCategories() {
  return useQuery({
    queryKey: ["academy-categories"],
    queryFn: () => fetchApi<any[]>("/academy-categories"),
    staleTime: 60_000,
  });
}

export function useAcademyCategory(id: number | string) {
  return useQuery({
    queryKey: ["academy-categories", id],
    queryFn: () => fetchApi<any>(`/academy-categories/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ─── Academy Categories (admin) ───────────────────────────────────────────────

export function useAdminAcademyCategories() {
  return useQuery({
    queryKey: ["admin", "academy-categories"],
    queryFn: () => fetchApi<any[]>("/admin/academy-categories"),
    staleTime: 30_000,
  });
}

export function useCreateAcademyCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/admin/academy-categories", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "academy-categories"] });
      queryClient.invalidateQueries({ queryKey: ["academy-categories"] });
      toast({ title: "Categoria creata" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err?.message || "Creazione fallita", variant: "destructive" });
    },
  });
}

export function useUpdateAcademyCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetchApi(`/admin/academy-categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "academy-categories"] });
      queryClient.invalidateQueries({ queryKey: ["academy-categories"] });
      toast({ title: "Categoria aggiornata" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err?.message || "Aggiornamento fallito", variant: "destructive" });
    },
  });
}

export function useDeleteAcademyCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/academy-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "academy-categories"] });
      queryClient.invalidateQueries({ queryKey: ["academy-categories"] });
      toast({ title: "Categoria eliminata" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err?.message || "Eliminazione fallita", variant: "destructive" });
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { moduleId: number; progressSeconds: number; completed: boolean }) => 
      fetchApi("/student/progress", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
    }
  });
}
