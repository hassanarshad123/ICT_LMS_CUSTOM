'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { PaginatedResponse } from '@/lib/types/api';

interface UsePaginatedApiResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  /**
   * Extra top-level fields returned by the endpoint beyond the paging envelope.
   * Endpoints that only return the envelope leave this as an empty object.
   * Callers that expect extra fields should cast: `(extra as { myField?: T })`.
   */
  extra: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  refetch: () => void;
}

const PAGINATION_KEYS = new Set(['data', 'total', 'page', 'perPage', 'totalPages']);

export function usePaginatedApi<T>(
  fetcher: (params: { page: number; per_page: number }) => Promise<PaginatedResponse<T>>,
  perPage: number = 15,
  deps: any[] = [],
): UsePaginatedApiResult<T> {
  const hookId = useId();
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

  const queryKey = ['api-paginated', hookId, ...deps, page, perPage];

  const { data: result, error, refetch: rqRefetch } = useQuery({
    queryKey,
    queryFn: () => fetcherRef.current({ page, per_page: perPage }),
    enabled: hasToken,
  });

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  // Everything on the response that isn't part of the standard paging envelope
  // becomes `extra`. Most endpoints leave this as an empty object; the devices
  // endpoint, for example, returns a `deviceLimit` field here.
  // Double-cast through `unknown` because PaginatedResponse<T> lacks a string
  // index signature under strict TS settings.
  const extra: Record<string, unknown> = result
    ? Object.fromEntries(
        Object.entries(result as unknown as Record<string, unknown>).filter(
          ([key]) => !PAGINATION_KEYS.has(key),
        ),
      )
    : {};

  return {
    data: result?.data ?? [],
    total: result?.total ?? 0,
    page: result?.page ?? page,
    totalPages: result?.totalPages ?? Math.max(1, Math.ceil((result?.total ?? 0) / perPage)),
    extra,
    // loading = true when data hasn't arrived yet (preserves old behavior)
    loading: result === undefined,
    error: error ? (error as Error).message : null,
    setPage,
    refetch: () => { rqRefetch(); },
  };
}
