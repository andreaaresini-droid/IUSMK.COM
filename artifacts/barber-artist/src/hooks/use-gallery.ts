import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";

const PAGE_LIMIT = 12;

export interface GalleryPage {
  items:   any[];
  total:   number;
  hasMore: boolean;
  limit:   number;
  offset:  number;
}

export function useGalleryPage(category: string | undefined, offset: number) {
  return useQuery<GalleryPage>({
    queryKey:    ["gallery", "page", category, offset],
    queryFn:     () => {
      const params = new URLSearchParams({
        limit:  String(PAGE_LIMIT),
        offset: String(offset),
      });
      if (category) params.set("category", category);
      return fetchApi<GalleryPage>(`/gallery?${params}`);
    },
    staleTime: 60_000,
  });
}

// Legacy — used by admin panel
export function useGallery(category?: string) {
  return useQuery({
    queryKey: ["gallery", category],
    queryFn:  () => {
      const url = category
        ? `/gallery?category=${encodeURIComponent(category)}&limit=200`
        : "/gallery?limit=200";
      return fetchApi<GalleryPage>(url).then((r: any) =>
        Array.isArray(r) ? r : (r.items ?? []),
      );
    },
  });
}

export function usePublicGalleryCategories() {
  return useQuery({
    queryKey: ["gallery", "categories"],
    queryFn:  () => fetchApi<any[]>("/gallery/categories"),
  });
}

export function useTestimonials() {
  return useQuery({
    queryKey: ["testimonials"],
    queryFn:  () => fetchApi<any[]>("/testimonials"),
  });
}
