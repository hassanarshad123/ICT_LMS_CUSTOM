'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [page, setPageState] = useState(1);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Don't fire queries until auth token is available
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  // Reset to page 1 when deps change
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    setPageState(1);
  }, [depsKey]);

  const queryKey = ['api-paginated', ...deps, page, perPage];

  const { data: result, error, refetch: rqRefetch } = useQuery({
    queryKey,
    queryFn: () => fetcherRef.current({ page, per_page: perPage }),
    enabled: hasToken,
  });

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  return {
    data: result?.data ?? [],
    total: result?.total ?? 0,
    page: result?.page ?? page,
    totalPages: result?.totalPages ?? Math.max(1, Math.ceil((result?.total ?? 0) / perPage)),
    // loading = true when data hasn't arrived yet (preserves old behavior)
    loading: result === undefined,
    error: error ? (error as Error).message : null,
    setPage,
    refetch: () => { rqRefetch(); },
  };
}
