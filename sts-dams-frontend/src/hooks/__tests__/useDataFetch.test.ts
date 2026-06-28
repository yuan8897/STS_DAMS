import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDataFetch } from '../useDataFetch';

describe('useDataFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态 loading=true, data=null, error=null', () => {
    const fetcher = vi.fn().mockImplementation(
      () => new Promise(() => {}) // 永不 resolve，保持 loading 状态
    );

    const { result } = renderHook(() =>
      useDataFetch({ fetcher })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('成功获取数据后 data 有值, loading=false', async () => {
    const mockData = { items: [{ id: 1, name: 'Test' }], total: 1 };
    const fetcher = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useDataFetch({ fetcher })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetched).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('请求失败时 error 有消息, data=null', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('网络连接失败'));

    const { result } = renderHook(() =>
      useDataFetch({ fetcher })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('网络连接失败');
    expect(result.current.data).toBeNull();
  });

  it('传入 AbortSignal 给 fetcher', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetcher = vi.fn().mockImplementation((signal: AbortSignal) => {
      capturedSignal = signal;
      return Promise.resolve('ok');
    });

    renderHook(() => useDataFetch({ fetcher }));

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal!.aborted).toBe(false);
  });

  it('组件卸载时 abort 请求', async () => {
    const fetcher = vi.fn().mockImplementation(
      () => new Promise(() => {}) // 永不 resolve
    );

    const { unmount } = renderHook(() =>
      useDataFetch({ fetcher })
    );

    // 等待 fetcher 被调用
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });

    // 卸载组件 → abort 被触发
    unmount();

    const signal = fetcher.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(true);
  });

  it('手动 refresh 触发重新请求', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() =>
      useDataFetch({ fetcher })
    );

    await waitFor(() => {
      expect(result.current.data).toBe('first');
    });

    // 手动刷新
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data).toBe('second');
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('按 refreshInterval 轮询', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b')
      .mockResolvedValue('c');

    renderHook(() =>
      useDataFetch({ fetcher, refreshInterval: 5000 })
    );

    // 初始 fetch
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    // 推进 5 秒 → 触发第二次
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    // 再推进 5 秒 → 第三次
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(3);
    });
  });

  it('refreshInterval=0 时不轮询', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');

    renderHook(() =>
      useDataFetch({ fetcher, refreshInterval: 0 })
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    // 推进足够长时间
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // 仍只有初始那一次
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
