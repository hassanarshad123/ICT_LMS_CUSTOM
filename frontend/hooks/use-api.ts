'use client';

import { useQuery } from '@tanstack/react-query';
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

  const queryKey = ['api', ...deps];

  const { data, isLoading, error, refetch: rqRefetch } = useQuery({
    queryKey,
    queryFn: () => fetcherRef.current(),
    enabled: true,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => { rqRefetch(); },
  };
}

export function useMutation<TArgs extends any[], TResult>(
  mutator: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await mutator(...args);
        return result;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutator],
  );

  return { execute, loading, error };
}
