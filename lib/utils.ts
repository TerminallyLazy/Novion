import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useRealtimeMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>
) {
  return useMutation({
    mutationFn,
    ...options,
  });
} 