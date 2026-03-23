'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
): UseApiResult<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Don't fire queries until auth token is available
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  const queryKey = ['api', ...deps];

  const { data, isFetching, error, refetch: rqRefetch } = useQuery({
    queryKey,
    queryFn: () => fetcherRef.current(),
    enabled: hasToken,
  });

  return {
    data: data ?? null,
    // loading = true when data hasn't arrived yet (preserves old behavior)
    loading: data === undefined,
    error: error ? (error as Error).message : null,
    refetch: () => { rqRefetch(); },
  };
}

export function useMutation<TArgs extends any[], TResult>(
  mutator: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await mutator(...args);
        // Invalidate all cached queries so stale data is refetched
        queryClient.invalidateQueries();
        return result;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutator, queryClient],
  );

  return { execute, loading, error };
}
