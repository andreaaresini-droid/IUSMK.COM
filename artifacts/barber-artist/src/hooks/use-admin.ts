import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchApi<any>("/admin/stats"),
  });
}

export function useAdminCourses(archived = false) {
  return useQuery({
    queryKey: ["admin", "courses", archived],
    queryFn: () => fetchApi<any[]>(archived ? "/admin/courses?archived=true" : "/admin/courses"),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/admin/courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast({ title: "Course created successfully" });
    }
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fetchApi(`/admin/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast({ title: "Course updated" });
    }
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast({ title: "Corso eliminato definitivamente" });
    },
    onError: (err: any) => {
      toast({ title: "Errore eliminazione", description: err?.message || "Impossibile eliminare il corso", variant: "destructive" });
    },
  });
}

export function useArchiveCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/courses/${id}/archive`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast({ title: "Corso archiviato", description: "Il corso è stato nascosto dal sito pubblico." });
    },
    onError: (err: any) => {
      toast({ title: "Errore archiviazione", description: err?.message || "Impossibile archiviare il corso", variant: "destructive" });
    },
  });
}

export function useUnarchiveCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/courses/${id}/unarchive`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast({ title: "Corso ripristinato", description: "Il corso è stato rimosso dall'archivio." });
    },
    onError: (err: any) => {
      toast({ title: "Errore ripristino", description: err?.message || "Impossibile ripristinare il corso", variant: "destructive" });
    },
  });
}

export function useNotifyAccessCode() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ success: boolean; message: string; sentAt: string; sendCount: number }>(
        `/admin/access-codes/${id}/notify`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      toast({ title: "Notifica inviata", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Errore invio notifica", description: err?.message || "Impossibile inviare la notifica", variant: "destructive" });
    },
  });
}

export function useAdminAccountSearch(query: string) {
  return useQuery({
    queryKey: ["admin", "accounts-search", query],
    queryFn: () => fetchApi<{ id: number; name: string; email: string }[]>(
      `/admin/broadcast/accounts?search=${encodeURIComponent(query)}`
    ),
    staleTime: 30_000,
  });
}

export function useAdminAccessCodes() {
  return useQuery({
    queryKey: ["admin", "access-codes"],
    queryFn: () => fetchApi<any[]>("/admin/access-codes"),
  });
}

export function useCreateAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/admin/access-codes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      toast({ title: "Code generated successfully" });
    }
  });
}

export function useRevokeAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/access-codes/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      toast({ title: "Codice revocato" });
    }
  });
}

export function useReactivateAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/access-codes/${id}/reactivate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      toast({ title: "Codice riattivato" });
    }
  });
}

export function useUpdateAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetchApi(`/admin/access-codes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      toast({ title: "Codice aggiornato" });
    }
  });
}

export function useDeleteAccessCode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/access-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      toast({ title: "Codice eliminato", description: "Il codice è stato rimosso definitivamente." });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message || "Impossibile eliminare il codice.", variant: "destructive" });
    }
  });
}

export function useAdminGallery() {
  return useQuery({
    queryKey: ["admin", "gallery"],
    queryFn: () => fetchApi<any[]>("/admin/gallery"),
  });
}

export function useAddGalleryItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/admin/gallery", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
      toast({ title: "Gallery item added" });
    }
  });
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; category?: string } }) =>
      fetchApi(`/admin/gallery/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
    }
  });
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/gallery/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
      toast({ title: "Immagine eliminata" });
    }
  });
}

export function useGalleryCategories() {
  return useQuery({
    queryKey: ["admin", "gallery-categories"],
    queryFn: () => fetchApi<any[]>("/admin/gallery/categories"),
  });
}

export function useCreateGalleryCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { name: string }) => fetchApi("/admin/gallery/categories", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery-categories"] });
      toast({ title: "Categoria creata" });
    }
  });
}

export function useUpdateGalleryCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      fetchApi(`/admin/gallery/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
      toast({ title: "Categoria aggiornata" });
    }
  });
}

export function useDeleteGalleryCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/gallery/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "gallery"] });
      toast({ title: "Categoria eliminata" });
    }
  });
}

export function useAdminTestimonials() {
  return useQuery({
    queryKey: ["admin", "testimonials"],
    queryFn: () => fetchApi<any[]>("/admin/testimonials"),
  });
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/admin/testimonials", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
      toast({ title: "Testimonial added" });
    }
  });
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
      toast({ title: "Testimonial deleted" });
    }
  });
}

export function useAdminContacts() {
  return useQuery({
    queryKey: ["admin", "contacts"],
    queryFn: () => fetchApi<any[]>("/admin/contact-requests"),
    refetchInterval: 15000,
    staleTime: 0,
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/contact-requests/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.setQueryData(["admin", "contacts"], (old: any[]) =>
        old?.filter(item => item.id !== id)
      );
    },
  });
}

export function useCreateCourseModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: number; data: any }) =>
      fetchApi(`/admin/courses/${courseId}/modules`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });
}

export function useUpdateCourseModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, moduleId, data }: { courseId: number; moduleId: number; data: any }) =>
      fetchApi(`/admin/courses/${courseId}/modules/${moduleId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });
}

export function useDeleteCourseModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, moduleId }: { courseId: number; moduleId: number }) =>
      fetchApi(`/admin/courses/${courseId}/modules/${moduleId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
  });
}
