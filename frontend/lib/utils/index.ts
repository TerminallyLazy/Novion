// -------------------
// lib/utils/index.ts
// -------------------
"use client";

import { useState } from "react";

/**
 * Minimal "realtime" mutation hook
 * A skeleton example to illustrate streaming or progressive updates
 */
export function useRealtimeMutation<
  TVariables,
  TData = unknown
>(params: {
  mutationFn: (args: TVariables) => Promise<TData>;
  onMutate?: (args: TVariables) => void | Promise<void>;
  onSuccess?: (data: TData) => void;
  onError?: (err: unknown, variables: TVariables) => void;
  onSettled?: (data: TData | null, err: unknown, variables: TVariables) => void;
}) {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function mutate(variables: TVariables) {
    setIsLoading(true);
    setError(null);

    try {
      if (params.onMutate) {
        await params.onMutate(variables);
      }

      const result = await params.mutationFn(variables);
      setData(result);

      if (params.onSuccess) {
        params.onSuccess(result);
      }

      if (params.onSettled) {
        params.onSettled(result, null, variables);
      }

      return result;
    } catch (err) {
      setError(err);
      if (params.onError) {
        params.onError(err, variables);
      }
      if (params.onSettled) {
        params.onSettled(null, err, variables);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}