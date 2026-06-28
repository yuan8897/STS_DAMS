/**
 * useDataFetch — 统一数据读取 Hook
 *
 * 替代各页面分散的 useState + useEffect + try-catch 模式。
 * API 成功 → data=结果
 * API 失败 → error=消息, data=null
 *
 * 用法：
 *   const { data, loading, error, refresh } = useDataFetch({
 *     fetcher: (signal) => api.getSessions(signal),
 *     refreshInterval: 20000,
 *   });
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseDataFetchOptions<T> {
  /** API 调用函数，接收 AbortSignal 用于取消请求 */
  fetcher: (signal: AbortSignal) => Promise<T>;
  /** 轮询间隔 (ms)，0 或省略表示不轮询 */
  refreshInterval?: number;
  /** 显式依赖数组 — 变化时自动重新请求（类似 useEffect deps）。
   *  用于 fetcher 内部捕获了异步加载的外部数据时触发重执行。
   *  例：deps: [dms.length] — dms列表从空变非空时自动刷新 */
  deps?: unknown[];
}

export interface UseDataFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 手动触发重新加载 */
  refresh: () => void;
  /** 最近一次成功返回的时间 */
  lastFetched: Date | null;
}

export function useDataFetch<T>(options: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const { fetcher, refreshInterval = 0, deps } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Use refs for latest values to avoid stale closures and unnecessary effect re-runs
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(result);
      setLastFetched(new Date());
      setError(null);
    } catch (err: unknown) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const message = (err as Error)?.message || '请求失败';
      setError(message);
      console.error('[STS-DAMS] 数据加载失败:', message);
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []); // stable — uses fetcherRef internally, never needs to be recreated

  // Keep a stable ref to execute for interval and deps effects
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const refresh = useCallback(() => {
    execute();
  }, [execute]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [execute]);

  // Re-fetch when explicit deps change (skip initial mount — main effect handles that)
  const depsInitialRef = useRef(true);
  useEffect(() => {
    if (!deps) return;
    if (depsInitialRef.current) {
      depsInitialRef.current = false;
      return;
    }
    executeRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || []);

  // Polling interval — stable, only restarts when refreshInterval changes
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const timer = setInterval(() => executeRef.current(), refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  return { data, loading, error, refresh, lastFetched };
}
