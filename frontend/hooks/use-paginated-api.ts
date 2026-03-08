'use client';

import { useState, useEffect, useCallback } from 'react';
import { PaginatedResponse } from '@/lib/types/api';

interface UsePaginatedApiResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  refetch: () => void;
}

export function usePaginatedApi<T>(
  fetcher: (params: { page: number; per_page: number }) => Promise<PaginatedResponse<T>>,
  perPage: number = 15,
  deps: any[] = [],
): UsePaginatedApiResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  // Reset to page 1 when deps change
  useEffect(() => {
    setPage(1);
  }, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher({ page, per_page: perPage })
      .then((result) => {
        if (!cancelled) {
          setData(result.data);
          setTotal(result.total);
          setTotalPages(result.totalPages || Math.max(1, Math.ceil(result.total / perPage)));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'An error occurred');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, perPage, trigger, ...deps]);

  return { data, total, page, totalPages, loading, error, setPage, refetch };
}
