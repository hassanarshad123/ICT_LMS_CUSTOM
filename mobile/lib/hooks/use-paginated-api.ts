import { useState, useEffect, useCallback, useRef } from 'react';
import type { PaginatedResponse } from '@/lib/types/api';

interface UsePaginatedApiResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

export function usePaginatedApi<T>(
  fetcher: (params: { page: number; per_page: number }) => Promise<PaginatedResponse<T>>,
  perPage: number = 15,
  deps: unknown[] = [],
): UsePaginatedApiResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setPage((p) => p + 1);
  }, [hasMore, loadingMore, loading]);

  const refetch = useCallback(() => {
    setPage(1);
    setData([]);
    setTrigger((t) => t + 1);
  }, []);

  // Reset when deps change
  useEffect(() => {
    setPage(1);
    setData([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;

    if (isFirstPage) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    fetcherRef.current({ page, per_page: perPage })
      .then((result) => {
        if (cancelled) return;
        if (isFirstPage) {
          setData(result.data);
        } else {
          setData((prev) => [...prev, ...result.data]);
        }
        setTotal(result.total);
        setTotalPages(result.totalPages || Math.max(1, Math.ceil(result.total / perPage)));
        setLoading(false);
        setLoadingMore(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'An error occurred');
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, trigger, ...deps]);

  return { data, total, page, totalPages, loading, loadingMore, error, hasMore, loadMore, refetch };
}
