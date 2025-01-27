// -------------------
// lib/utils/index.ts
// -------------------
"use client";

import { useState } from "react";

/**
 * Minimal Toast Hook Example
 * Use a more robust solution in a real app (e.g., react-hot-toast)
 */
export function useToast() {
  function toast({
    title,
    description,
    variant,
  }: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) {
    // A real implementation would provide a visible
    // toast notification on the screen
    if (variant === "destructive") {
      console.error(`[TOAST ERROR] ${title}: ${description ?? ""}`);
    } else {
      console.log(`[TOAST] ${title}: ${description ?? ""}`);
    }
  }

  return { toast };
}

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