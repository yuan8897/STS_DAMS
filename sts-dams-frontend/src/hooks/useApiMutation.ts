/**
 * useApiMutation — 统一数据写入 Hook
 *
 * 替代各页面分散的 try { await api.doAction() } catch { showError } 模式。
 * API 成功 → 显示 success toast → 返回结果
 * API 失败 → 显示 error toast → 返回 null
 *
 * 用法：
 *   const { execute: createSession, loading } = useApiMutation({
 *     apiFn: (data) => sessionsApi.createSession(data),
 *     successMessage: '场次创建成功',
 *   });
 *
 *   await createSession({ Copy_ID: 1, ... });
 */

import { useState, useCallback } from 'react';
import { showToast } from '../components/common/Toast';

export interface UseApiMutationOptions<TInput, TOutput> {
  /** API 调用函数 */
  apiFn: (input: TInput) => Promise<TOutput>;
  /** 成功提示消息，可以是字符串或根据返回结果生成的字符串 */
  successMessage?: string | ((result: TOutput) => string);
  /** 错误消息前缀，默认 "操作失败" */
  errorMessage?: string;
}

export interface UseApiMutationResult<TInput, TOutput> {
  /** 执行 mutation */
  execute: (input: TInput) => Promise<TOutput | null>;
  /** 是否正在执行 */
  loading: boolean;
  /** 最近的错误消息 */
  error: string | null;
}

export function useApiMutation<TInput, TOutput>(
  options: UseApiMutationOptions<TInput, TOutput>
): UseApiMutationResult<TInput, TOutput> {
  const { apiFn, successMessage, errorMessage = '操作失败' } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (input: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFn(input);
      const msg = typeof successMessage === 'function'
        ? successMessage(result)
        : successMessage;
      if (msg) showToast(msg, 'success');
      return result;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || errorMessage;
      setError(msg);
      showToast(msg, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFn, successMessage, errorMessage]);

  return { execute, loading, error };
}
