import type { OffersResponse, SessionResponse } from "./types";
import { nhost } from "./nhost";

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = nhost.getUserSession()?.accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
    } catch {
      detail = await response.text();
    }
    console.error("[api] request failed", path, response.status, detail);
    const error = new Error(detail || `Request failed: ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

export function fetchSession() {
  return request<SessionResponse>("/api/session");
}

export function fetchOffers(params: { maxResults?: number; pageToken?: string | null } = {}) {
  const max = params.maxResults ?? 20;
  const tokenPart = params.pageToken ? `&page_token=${encodeURIComponent(params.pageToken)}` : "";
  return request<OffersResponse>(`/api/offers?max_results=${max}${tokenPart}`);
}

export function fetchConnectUrl() {
  return request<{ auth_url: string }>("/api/google/connect");
}
