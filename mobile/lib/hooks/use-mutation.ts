import { useState, useCallback } from 'react';

interface UseMutationResult<TArgs extends unknown[], TResult> {
  execute: (...args: TArgs) => Promise<TResult>;
  loading: boolean;
  error: string | null;
}

export function useMutation<TArgs extends unknown[], TResult>(
  mutator: (...args: TArgs) => Promise<TResult>,
): UseMutationResult<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await mutator(...args);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutator],
  );

  return { execute, loading, error };
}
