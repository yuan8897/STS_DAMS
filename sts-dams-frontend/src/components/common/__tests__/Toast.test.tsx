import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastContainer, showToast } from '../Toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    // Reset the module-level addToastFn between tests
    vi.resetModules();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('displays a success toast', async () => {
    render(<ToastContainer />);

    // Wait for effect to register addToastFn
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
      showToast('操作成功', 'success');
    });

    expect(screen.getByText('操作成功')).toBeInTheDocument();
    const toast = screen.getByText('操作成功');
    expect(toast.className).toContain('bg-green-600');
  });

  it('displays an error toast with red background', async () => {
    render(<ToastContainer />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
      showToast('操作失败', 'error');
    });

    expect(screen.getByText('操作失败')).toBeInTheDocument();
    const toast = screen.getByText('操作失败');
    expect(toast.className).toContain('bg-red-500');
  });

  it('displays a warning toast with orange background', async () => {
    render(<ToastContainer />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
      showToast('请注意', 'warning');
    });

    expect(screen.getByText('请注意')).toBeInTheDocument();
    const toast = screen.getByText('请注意');
    expect(toast.className).toContain('bg-orange-500');
  });

  it('removes toast after timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ToastContainer />);

    // Wait for effect to register addToastFn
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    act(() => {
      showToast('临时消息', 'success');
    });

    expect(screen.getByText('临时消息')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.queryByText('临时消息')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
