'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useId } from 'react';

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
  const hookId = useId();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Don't fire queries until auth token is available
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  const queryKey = ['api', hookId, ...deps];

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
  options?: {
    /** Specific query key prefixes to invalidate after mutation.
     *  e.g. [['api', 'courses'], ['api', 'dashboard']]
     *  If omitted, invalidates ALL queries (backward compatible). */
    invalidateKeys?: string[][];
  },
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
        // Targeted invalidation: only refetch affected queries
        if (options?.invalidateKeys && options.invalidateKeys.length > 0) {
          for (const key of options.invalidateKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        } else {
          // Fallback: invalidate everything (backward compatible for un-migrated call sites)
          queryClient.invalidateQueries();
        }
        return result;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutator, queryClient, options?.invalidateKeys],
  );

  return { execute, loading, error };
}
