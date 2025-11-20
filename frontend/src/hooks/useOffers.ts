import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOffers } from "../api";
import type { Offer } from "../types";

export function useOffers(enabled: boolean, onInvalidToken?: () => void) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const loadOffers = useCallback(async (token?: string | null) => {
    if (!enabled) {
      setOffers([]);
      setNextPageToken(null);
      setLoading(false);
      return;
    }
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOffers({ maxResults: 50, pageToken: token ?? null });
      setOffers(response.offers);
      setNextPageToken(response.next_page_token ?? null);
    } catch (err) {
      if ((err as any).name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to fetch offers";
      setError(message);
      if (message.toLowerCase().includes("gmail not connected") || message.toLowerCase().includes("invalid token")) {
        onInvalidToken?.();
      }
    } finally {
      setLoading(false);
      requestAbortRef.current = null;
    }
  }, [enabled, onInvalidToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadOffers();
  }, [loadOffers, enabled]);

  return { offers, loading, error, nextPageToken, refresh: loadOffers };
}
