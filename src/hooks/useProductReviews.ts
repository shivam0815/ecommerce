// src/hooks/useProductReviews.ts
import { useEffect, useState } from 'react';

export function useProductReviews(productId: string) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}/reviews`);
    const json = await res.json();
    setReviews(json?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [productId]);

  return { reviews, loading, refresh, setReviews };
}
