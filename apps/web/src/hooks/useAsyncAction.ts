import { useCallback, useState } from "react";

export interface AsyncActionState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Shared UI-only loading state; domain behavior remains in the repository. */
export function useAsyncAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const [state, setState] = useState<AsyncActionState<TResult>>({ data: null, error: null, loading: false });

  const run = useCallback(async (...args: TArgs) => {
    setState({ data: null, error: null, loading: true });
    try {
      const data = await action(...args);
      setState({ data, error: null, loading: false });
      return data;
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error("请求未完成");
      setState({ data: null, error, loading: false });
      throw error;
    }
  }, [action]);

  return { ...state, run };
}
