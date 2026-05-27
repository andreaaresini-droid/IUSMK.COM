export async function fetchApi<T>(endpoint: string, options: RequestInit = {}, redirectOn401 = true): Promise<T> {
  const token = localStorage.getItem("barber_artist_token");
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const response = await fetch(`${apiBase}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("barber_artist_token");
    if (redirectOn401 && !window.location.pathname.includes('/access') && !window.location.pathname.endsWith('/admin')) {
      const isRouteAdmin = window.location.pathname.startsWith('/admin');
      window.location.href = isRouteAdmin ? '/admin' : '/access';
    }
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function fetchApiOptional<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    return await fetchApi<T>(endpoint, options, false);
  } catch {
    return null;
  }
}
